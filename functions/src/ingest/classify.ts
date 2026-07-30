/**
 * Deterministic document classifier.
 *
 * IRS forms carry fixed, literal titles ("Wage and Tax Statement"), so pattern
 * matching genuinely beats a model here: it is fast, it never hallucinates, and
 * every decision is explainable — the preparer sees the exact phrase that fired
 * and on which page. No network, no LLM, no surprises during tax season.
 *
 * Calibration bias: a false-accept (a W-2 auto-filed as something else) is far
 * more damaging than a false-review, so the scoring is deliberately cautious —
 * without a literal form-title ("strong") match we never reach auto-accept.
 */

import {
  CLASSIFY_REVIEW_THRESHOLD,
  DOC_TYPES,
  docType,
  type Classification,
  type DocTypeDef,
} from '../../../packages/shared/src/index.ts';

// ── Tuning ──────────────────────────────────────────────────────────────────
// Weights and the confidence curve are calibrated against a battery of realistic
// samples (see the classifier accuracy table in the ingest report). The guiding
// rule: one clean form title near the top of page one clears the accept bar; a
// pile of weak hints alone never does.

/** A literal form title / OMB identifier — near-certain evidence. */
const STRONG_POINTS = 1.5;
/** A supporting signal (a box label, an issuer keyword). */
const WEAK_POINTS = 0.32;
/** Weak hits are capped so a keyword-stuffed page can't fake certainty. */
const MAX_WEAK_HITS = 4;
/** A filename is a hint, not proof: it can nudge, never decide. */
const FILENAME_POINTS = 0.34;
/** Softening constant for the score→confidence curve. */
const CONFIDENCE_K = 0.62;
/** Without a strong form-title match, confidence is capped below auto-accept. */
const NO_STRONG_CEILING = 0.8;
/** A filename with no in-document support stays below human-review. */
const FILENAME_ONLY_CEILING = CLASSIFY_REVIEW_THRESHOLD - 0.01;
/** Page separator emitted by the extractor between document pages. */
const PAGE_SEP = '\f';

interface CompiledType {
  def: DocTypeDef;
  strong: RegExp[];
  weak: RegExp[];
  veto: RegExp[];
  /** Matches this type's code/id in a filename, e.g. `w2`, `1099-int`. */
  filename?: RegExp;
}

/** A page as the matcher sees it: lowercase for matching, original for display. */
interface Page {
  lower: string;
  original: string;
  /** Char offset of this page's start within the whole document. */
  start: number;
}

interface PatternHit {
  /** Text as it actually appears in the document — shown to the preparer. */
  quote: string;
  page: number;
  positionWeight: number;
}

/** Compiled once at cold start; matching a document then costs only regex runs. */
const COMPILED: CompiledType[] = DOC_TYPES.map((def) => ({
  def,
  strong: def.match.strong.map(compile),
  weak: (def.match.weak ?? []).map(compile),
  veto: (def.match.veto ?? []).map(compile),
  filename: filenameMatcher(def),
}));

/**
 * Compiles a taxonomy pattern. Patterns that are plain phrases (no regex
 * metacharacters) are anchored on word boundaries so `lease` matches the word
 * "lease", not the tail of "Please" — a real source of false weak hits.
 * Patterns that already use regex syntax (`1099-?int`, `\bform w-?2\b`) are
 * honoured verbatim.
 */
function compile(pattern: string): RegExp {
  const isPlain = !/[\\()[\]{}.?*+^$|]/.test(pattern);
  if (isPlain) {
    const left = /^\w/.test(pattern) ? '\\b' : '';
    const right = /\w$/.test(pattern) ? '\\b' : '';
    return new RegExp(`${left}${pattern}${right}`, 'i');
  }
  return new RegExp(pattern, 'i');
}

/**
 * Builds a permissive filename matcher from a type's identifiers so `w2_acme`,
 * `1099-int (1)`, and `Consolidated1099` all read as hints toward their type.
 */
function filenameMatcher(def: DocTypeDef): RegExp | undefined {
  const tokens = new Set<string>();
  const add = (raw: string) => {
    const t = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (t.length >= 2) tokens.add(t);
  };
  add(def.code);
  add(def.id);
  add(def.slug);
  if (tokens.size === 0) return undefined;
  // Allow optional separators between the digits/letters of each token so
  // `1099int`, `1099-int` and `1099_int` all match a single compiled form.
  const alts = [...tokens]
    .sort((a, b) => b.length - a.length)
    .map((t) => t.split('').map(escapeRegExp).join('[^a-z0-9]?'));
  return new RegExp(`(?:^|[^a-z0-9])(?:${alts.join('|')})(?:[^a-z0-9]|$)`, 'i');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Splits the extractor's page-delimited text into matchable pages. */
function toPages(text: string): Page[] {
  const raw = text.split(PAGE_SEP);
  const pages: Page[] = [];
  let start = 0;
  for (const chunk of raw) {
    // Newlines helped issuer extraction; for matching, a title that wrapped
    // across two lines must read as one phrase.
    const original = chunk.replace(/\n+/g, ' ');
    const lower = original.toLowerCase();
    pages.push({ original, lower, start });
    start += lower.length + 1;
  }
  return pages;
}

/** Evidence weight by where in the document the phrase sits. */
function positionWeight(globalOffset: number, totalLength: number): number {
  if (totalLength <= 0) return 1;
  const fraction = globalOffset / totalLength;
  if (fraction <= 0.15) return 1;
  return Math.max(0.55, 1 - 0.45 * ((fraction - 0.15) / 0.85));
}

/** Earliest occurrence of `re` across pages, with a display quote and weight. */
function firstHit(re: RegExp, pages: Page[], totalLength: number): PatternHit | null {
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const m = re.exec(page.lower);
    if (!m) continue;
    const quote =
      page.original.length === page.lower.length
        ? page.original.slice(m.index, m.index + m[0].length)
        : m[0];
    return {
      quote: quote.trim(),
      page: i,
      positionWeight: positionWeight(page.start + m.index, totalLength),
    };
  }
  return null;
}

interface TypeScore {
  docTypeId: string;
  score: number;
  strongHits: number;
  weakHits: number;
  filenameHit: boolean;
  evidence: string[];
}

function scoreType(ct: CompiledType, pages: Page[], totalLength: number, filename: string): TypeScore {
  const evidence: string[] = [];

  // A veto (an instruction page, a look-alike sibling form) disqualifies the
  // type outright — better to fall through to review than to misfile.
  for (const v of ct.veto) {
    if (pages.some((p) => v.test(p.lower))) {
      return { docTypeId: ct.def.id, score: 0, strongHits: 0, weakHits: 0, filenameHit: false, evidence };
    }
  }

  let score = 0;
  let strongHits = 0;
  let weakHits = 0;

  for (const re of ct.strong) {
    const hit = firstHit(re, pages, totalLength);
    if (!hit) continue;
    strongHits++;
    score += STRONG_POINTS * hit.positionWeight;
    evidence.push(`Matched form title “${hit.quote}” on page ${hit.page + 1}`);
  }

  for (const re of ct.weak) {
    if (weakHits >= MAX_WEAK_HITS) break;
    const hit = firstHit(re, pages, totalLength);
    if (!hit) continue;
    weakHits++;
    score += WEAK_POINTS * hit.positionWeight;
    evidence.push(`Supporting detail “${hit.quote}” on page ${hit.page + 1}`);
  }

  let filenameHit = false;
  if (ct.filename && ct.filename.test(filename)) {
    filenameHit = true;
    score += FILENAME_POINTS;
    evidence.push(`Filename looks like a ${ct.def.code}`);
  }

  return { docTypeId: ct.def.id, score, strongHits, weakHits, filenameHit, evidence };
}

/** Saturating score→confidence curve, then honesty ceilings. */
function toConfidence(ts: TypeScore): number {
  let confidence = 1 - Math.exp(-ts.score / CONFIDENCE_K);
  if (ts.strongHits === 0) confidence = Math.min(confidence, NO_STRONG_CEILING);
  if (ts.strongHits === 0 && ts.weakHits === 0) {
    // Filename (or nothing) only — a hint must never masquerade as proof.
    confidence = Math.min(confidence, FILENAME_ONLY_CEILING);
  }
  return Math.round(confidence * 1000) / 1000;
}

/**
 * Classifies extracted document text into exactly one tax document type.
 *
 * `text` is the extractor's page-delimited, whitespace-normalised text (pages
 * separated by a form-feed). `filename` is the taxpayer's original filename,
 * used only as a tie-breaking hint. The returned `method` reflects that this
 * ran on text; the pipeline upgrades it to `'ocr'` when the text came from the
 * image OCR extension.
 */
export function classifyText(text: string, filename: string): Classification {
  const pages = toPages(text);
  const totalLength = pages.reduce((n, p) => n + p.lower.length, 0);
  const hasText = totalLength > 0;
  const cleanFilename = filename.toLowerCase();

  const scored = COMPILED
    // `other` is the catch-all; it never wins on evidence, only by default.
    .filter((ct) => ct.def.id !== 'other')
    .map((ct) => scoreType(ct, pages, totalLength, cleanFilename))
    .filter((ts) => ts.score > 0)
    .map((ts) => ({ ...ts, confidence: toConfidence(ts) }))
    .sort((a, b) => b.confidence - a.confidence || b.score - a.score);

  const method: Classification['method'] = hasText ? 'text' : 'filename';

  if (scored.length === 0) {
    return {
      docTypeId: 'other',
      confidence: 0,
      evidence: hasText
        ? ['No tax form title or recognisable identifiers were found.']
        : ['No readable text — needs a human to identify this document.'],
      alternates: [],
      method,
    };
  }

  const [top, ...rest] = scored;
  return {
    docTypeId: top.docTypeId,
    confidence: top.confidence,
    evidence: top.evidence,
    alternates: rest.slice(0, 3).map((ts) => ({ docTypeId: ts.docTypeId, confidence: ts.confidence })),
    method,
  };
}

// ── Issuer extraction ───────────────────────────────────────────────────────

/** Label anchors that precede the issuer's name on each family of form. */
function issuerAnchors(def: DocTypeDef): RegExp[] {
  switch (def.id) {
    case 'w2':
    case 'w2g':
      return [/employer'?s name[^A-Za-z0-9]*(?:address[^A-Za-z0-9]*zip code)?/i];
    case '1098':
      return [/(?:recipient'?s\/?lender'?s|lender'?s|recipient'?s) name/i];
    case '1098-e':
    case '1098-t':
      return [/(?:recipient'?s\/?lender'?s|lender'?s|filer'?s) name/i];
    case 'k1-1065':
      return [/partnership'?s name(?:, address[^A-Za-z]*zip code)?/i, /part i[^a-z]*information about the partnership/i];
    case 'k1-1120s':
      return [/corporation'?s name(?:, address[^A-Za-z]*zip code)?/i];
    case 'k1-1041':
      return [/estate'?s or trust'?s name/i];
    case 'ssa-1099':
    case 'rrb-1099':
      // Issuer is the government agency — already implicit in the type.
      return [];
    default:
      // Every remaining 1099 (and most information returns) name the "PAYER".
      return [/payer'?s name(?:, street address[^A-Za-z]*(?:telephone no\.?|number))?/i, /filer'?s name/i];
  }
}

const ISSUER_STOPWORDS = new Set([
  'street', 'address', 'city', 'town', 'state', 'province', 'country', 'zip',
  'code', 'foreign', 'postal', 'telephone', 'no', 'number', 'and', 'or', 'the',
]);
/** Suffixes that read best left uppercase; everything else is title-cased. */
const ENTITY_SUFFIX = /^(?:llc|inc|lp|llp|pllc|na|plc)$/i;
/** A line that is form boilerplate, never the issuer's actual name. */
const LABEL_LINE =
  /\b(name|address|street|city or town|state or province|zip|postal|telephone|identification number|\btin\b|\bein\b|omb no|corrected|void|copy [a-d]\b|department of the treasury)\b/i;

/** Turns a raw captured span into a clean issuer name, or nothing. */
function cleanIssuer(raw: string): string | undefined {
  let s = raw
    .replace(/\d{2}-\d{7}/g, ' ') // EIN
    .replace(/\b\d{5}(?:-\d{4})?\b/g, ' ') // ZIP
    .replace(/[|•]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Cut at the first token that begins a street address (a bare number).
  const words = s.split(' ');
  const out: string[] = [];
  for (const w of words) {
    if (/^\d/.test(w)) break; // "500 Industrial Way…" — the address begins
    const bare = w.replace(/[^a-z]/gi, '').toLowerCase();
    if (out.length > 0 && ISSUER_STOPWORDS.has(bare)) break;
    out.push(w);
    if (out.length >= 6) break;
  }
  s = out.join(' ').replace(/[,\s.]+$/, '').replace(/^[,\s.]+/, '').trim();
  if (s.length < 2 || s.length > 60 || !/[a-z]/i.test(s)) return undefined;

  // ALL-CAPS scanned names read better title-cased; keep short acronyms/suffixes.
  if (s === s.toUpperCase()) {
    s = s
      .split(' ')
      .map((w) => (w.length <= 3 || ENTITY_SUFFIX.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
      .join(' ');
  }
  return s;
}

/** True for a line that is clearly label text rather than a company name. */
function isLabelLine(line: string): boolean {
  if (LABEL_LINE.test(line)) return true;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const stop = words.filter((w) => ISSUER_STOPWORDS.has(w.replace(/[^a-z]/gi, '').toLowerCase())).length;
  return stop / words.length > 0.5;
}

/**
 * Reads the issuer from the line(s) that follow a label anchor. On a real form
 * the label ("PAYER'S name, street address…") and the value ("Acme Bank") sit
 * on different lines, so we skip boilerplate lines and take the first real one.
 */
function captureAfter(text: string, anchor: RegExp): string | undefined {
  const m = anchor.exec(text);
  if (!m) return undefined;
  const lines = text.slice(m.index + m[0].length).split('\n');
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.replace(/^[\s,:.-]+/, '').trim();
    if (!trimmed || isLabelLine(trimmed)) continue;
    const cleaned = cleanIssuer(trimmed);
    if (cleaned) return cleaned;
    break; // the first non-boilerplate line wasn't a usable name — don't reach
  }
  return undefined;
}

const HEADER_TITLE =
  /^(profit and loss|balance sheet|income statement|statement of|for the (?:year|period)|as of|tax reporting|consolidated|form\b|schedule\b)/i;

/** The first line that looks like an entity name, for header-style documents. */
function headerIssuer(text: string): string | undefined {
  const firstPage = text.split(PAGE_SEP)[0] ?? '';
  for (const line of firstPage.split('\n').slice(0, 6)) {
    const trimmed = line.trim();
    if (trimmed.length < 3 || trimmed.length > 60) continue;
    if (!/[a-z]/i.test(trimmed)) continue;
    // Skip the report's own title so we grab the company, not "Profit and Loss".
    if (HEADER_TITLE.test(trimmed) || isLabelLine(trimmed)) continue;
    const cleaned = cleanIssuer(trimmed);
    if (cleaned) return cleaned;
  }
  return undefined;
}

/**
 * Pulls the payer / employer / lender / partnership name out of a document.
 * Returns `undefined` rather than a guess — a wrong issuer baked into a filename
 * is worse than no issuer at all.
 */
export function extractIssuer(text: string, docTypeId: string): string | undefined {
  const def = docType(docTypeId);
  for (const anchor of issuerAnchors(def)) {
    const value = captureAfter(text, anchor);
    if (value) return value;
  }
  // Bookkeeping exports and brokerage statements lead with the firm's name.
  if (['business', 'investment', 'property'].includes(def.category)) {
    return headerIssuer(text);
  }
  return undefined;
}

// ── Tax-year extraction ─────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getUTCFullYear();
const MIN_TAX_YEAR = 2015;

/**
 * Finds the tax year the form is *for* — so the pipeline can catch a taxpayer
 * who uploads last year's W-2 by mistake, a small but genuinely delightful save.
 */
export function extractTaxYear(text: string): number | undefined {
  const head = text.split(PAGE_SEP).slice(0, 2).join('\n');
  const max = CURRENT_YEAR + 1;

  const labelled = [
    /(?:for )?(?:tax|calendar) year\s*(?:ending)?\s*(?:dec(?:ember)? 31,?\s*)?(20\d{2})/i,
    /for the year\s*(?:jan(?:uary)? 1[\s–-]+dec(?:ember)? 31,?\s*)?(20\d{2})/i,
    /omb no\.[^\n]*\b(20\d{2})\b/i,
    /\b(20\d{2})\b\s*(?:form\b|w-?2\b|1099|1098|1095|1040)/i,
    /(?:form\b|w-?2\b|1099[\w-]*|1098[\w-]*|1095[\w-]*|1040)\s*(?:for)?\s*\b(20\d{2})\b/i,
  ];
  for (const re of labelled) {
    const m = re.exec(head);
    if (m) {
      const year = Number(m[1]);
      if (year >= MIN_TAX_YEAR && year <= max) return year;
    }
  }

  // Fall back to the most frequent plausible year in the header.
  const counts = new Map<number, number>();
  for (const m of head.matchAll(/\b(20\d{2})\b/g)) {
    const year = Number(m[1]);
    if (year >= MIN_TAX_YEAR && year <= max) counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  let best: number | undefined;
  let bestCount = 0;
  for (const [year, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== undefined && year > best)) {
      best = year;
      bestCount = count;
    }
  }
  return best;
}
