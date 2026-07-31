/**
 * Prior-year return parsing — the intelligence behind TaxFax's wedge.
 *
 * `parseReturnText` is a pure function over the page-text of a US tax return: it
 * detects the form, the year, the schedules that were filed, the dollar amounts
 * on the well-known 1040 lines, and — crucially — the *names* of the employers,
 * banks, and partnerships that issued last year's documents. Those facts feed
 * `generateChecklist`, so "Last year you had 2 W-2s — from Acme Corporation and
 * Northwind Logistics LLC" comes out the other end.
 *
 * PDF I/O is kept in `parsePriorYearReturnFromPdf` so the parser itself is unit
 * testable with fixture strings, and so a scanned, foreign, or malformed file
 * degrades to `confidence: 0` instead of throwing.
 */

import {
  DOC_TYPES,
  LEP_LANGUAGES,
  emptyPriorYear,
  type DocTypeDef,
  type EntityType,
  type FilingStatus,
  type PriorYearReturn,
} from '../../../packages/shared/src/index.ts';

// ── Text utilities ────────────────────────────────────────────────────────────

/** Lowercased, whitespace-collapsed to single spaces — matches the taxonomy's
 * assumption that patterns run against single-spaced text. */
function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').toLowerCase().trim();
}

/**
 * Parses a currency-shaped token into a number. Handles `$`, thousands commas,
 * parenthesised negatives, and cents. Returns null when the token isn't money.
 */
function parseCurrency(token: string): number | null {
  const negative = /^\(.*\)$/.test(token.trim()) || /^-/.test(token.trim().replace(/^[($]+/, ''));
  const cleaned = token.replace(/[(),$\s-]/g, '');
  if (!/^\d/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/**
 * Finds the first plausible money value inside a text window, skipping the
 * traps that PDF extraction scatters around form values: line labels like `1a`
 * / `8z` (a digit glued to a letter), and bare four-digit years such as the
 * "amount applied from 2022 return" that sits right before line 26's value.
 */
function firstMoneyToken(segment: string): number | null {
  const tokens = segment
    .split(/\s+/)
    .map((raw) => raw.replace(/^[.:·•]+/, ''))
    .filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    // A digit immediately followed by a letter is a line label (1a, 1z, 8z), not a value.
    if (/^\(?-?\$?\d[\d,]*[a-z]/i.test(token)) continue;
    if (!/^\(?-?\$?\d[\d,]*(?:\.\d{1,2})?\)?$/.test(token)) continue;
    const value = parseCurrency(token);
    if (value === null) continue;
    // A bare four-digit number in [1900, 2099] is almost always a tax year.
    const bareDigits = token.replace(/[(),$\s-]/g, '');
    if (/^\d{4}$/.test(bareDigits) && value >= 1900 && value <= 2099) continue;
    // A bare 1–2 digit integer glued in front of a label word is a line number,
    // not a value — e.g. "1 Medical and dental expenses 9,500" after the
    // section header repeats the label.
    const next = tokens[i + 1];
    if (/^\d{1,2}$/.test(token) && value >= 1 && !!next && /^[a-z]/i.test(next)) continue;
    return value;
  }
  return null;
}

/** The dollar amount that follows an anchor (a line token or a label phrase). */
function moneyAfter(scope: string, anchor: RegExp, windowLen = 90): number | null {
  const match = anchor.exec(scope);
  if (!match) return null;
  const from = match.index + match[0].length;
  return firstMoneyToken(scope.slice(from, from + windowLen));
}

/** Concatenated, normalised text of every page whose text matches `re`. */
function scopeMatching(normPages: string[], re: RegExp): string {
  return normPages.filter((p) => re.test(p)).join(' \u2029 ');
}

// ── Form type & entity ────────────────────────────────────────────────────────

/**
 * Authoritative title phrases. Only the primary return carries these — an
 * embedded K-1 says "Schedule K-1 (Form 1065)", never "U.S. Return of
 * Partnership Income" — so titles disambiguate a 1040 package from the entity
 * returns whose K-1s it contains.
 */
const FORM_TITLES: { form: PriorYearReturn['formType']; entity: EntityType; re: RegExp }[] = [
  { form: '1040', entity: 'individual', re: /u\.?s\.? individual income tax return/ },
  { form: '1120S', entity: 's-corp', re: /income tax return for an s corporation/ },
  { form: '1065', entity: 'partnership', re: /u\.?s\.? return of partnership income/ },
  { form: '1120', entity: 'c-corp', re: /u\.?s\.? corporation income tax return/ },
  { form: '1041', entity: 'trust', re: /income tax return for estates and trusts/ },
];

/** Bare form-number fallback for OCR'd returns whose title line was lost. */
const FORM_NUMBERS: { form: PriorYearReturn['formType']; entity: EntityType; re: RegExp }[] = [
  { form: '1120S', entity: 's-corp', re: /\bform 1120-?s\b|\b1120s\b/ },
  { form: '1065', entity: 'partnership', re: /\bform 1065\b/ },
  { form: '1041', entity: 'trust', re: /\bform 1041\b/ },
  { form: '1120', entity: 'c-corp', re: /\bform 1120\b/ },
  { form: '1040', entity: 'individual', re: /\bform 1040(?:-?sr)?\b/ },
];

function detectForm(
  full: string,
  page1: string,
): { formType: PriorYearReturn['formType']; entityType: EntityType } {
  for (const sig of FORM_TITLES) {
    if (sig.re.test(full)) return { formType: sig.form, entityType: sig.entity };
  }
  // No title survived extraction: fall back to the bare form number on the
  // first page, with any embedded "Schedule K-1 (Form NNNN)" stripped so a
  // partner's K-1 can't masquerade as the return itself.
  const primary = page1.replace(/schedule k-1 \(form \d{3,4}-?s?\)/g, ' ');
  for (const sig of FORM_NUMBERS) {
    if (sig.re.test(primary)) return { formType: sig.form, entityType: sig.entity };
  }
  return { formType: 'unknown', entityType: 'individual' };
}

// ── Tax year ──────────────────────────────────────────────────────────────────

function detectTaxYear(full: string): number | null {
  const forYear =
    /for the (?:tax )?year (?:jan(?:uary|\.)?\s*1[\s,\u2013\u2014-]+dec(?:ember|\.)?\s*31,?\s*)?(20\d\d)/.exec(
      full,
    ) || /for calendar year\s*(20\d\d)/.exec(full);
  if (forYear) return Number(forYear[1]);

  const headerYear = /form 1040(?:-?sr)?[^.]{0,40}?(20\d\d)|\b1040\b[^.]{0,20}?(20\d\d)/.exec(full);
  if (headerYear) return Number(headerYear[1] ?? headerYear[2]);

  // Fall back to the most frequent plausible tax year mentioned.
  const tally = new Map<number, number>();
  for (const m of full.matchAll(/\b(20[0-3]\d)\b/g)) {
    const year = Number(m[1]);
    tally.set(year, (tally.get(year) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [year, c] of tally) {
    if (c > bestCount) {
      best = year;
      bestCount = c;
    }
  }
  return best;
}

// ── Filing status ─────────────────────────────────────────────────────────────

const STATUS_PATTERNS: { status: FilingStatus; re: RegExp }[] = [
  { status: 'mfj', re: /married filing jointly/ },
  { status: 'mfs', re: /married filing separately/ },
  { status: 'hoh', re: /head of household/ },
  { status: 'qw', re: /qualifying (?:surviving spouse|widow)/ },
  { status: 'single', re: /\bsingle\b/ },
];

function detectFilingStatus(full: string, entityType: EntityType): FilingStatus | undefined {
  if (entityType !== 'individual') return 'entity';
  let fallback: FilingStatus | undefined;
  for (const { status, re } of STATUS_PATTERNS) {
    const m = re.exec(full);
    if (!m) continue;
    fallback ??= status;
    const before = full.slice(Math.max(0, m.index - 5), m.index);
    const after = full.slice(m.index + m[0].length, m.index + m[0].length + 3);
    // The single checked box carries an "x" (or a filled box glyph) beside it.
    if (/x\s*$|\[x\]|\u2612|\u25a0/.test(before) || /^\s*x\b/.test(after)) return status;
  }
  // No box marker survived extraction: infer joint when a spouse SSN is present.
  if (fallback === 'mfj' || /spouse'?s social security/.test(full)) {
    if (/spouse'?s (?:social security|first name)/.test(full)) return 'mfj';
  }
  return fallback;
}

// ── Schedules & attached forms ────────────────────────────────────────────────

const SCHEDULE_SIGNATURES: { token: string; re: RegExp }[] = [
  { token: '1', re: /schedule 1 \(form 1040\)|additional income and adjustments to income/ },
  { token: '2', re: /schedule 2 \(form 1040\)|additional taxes/ },
  { token: '3', re: /schedule 3 \(form 1040\)|additional credits and payments/ },
  { token: 'A', re: /schedule a \(form 1040\)|itemized deductions/ },
  { token: 'B', re: /schedule b \(form 1040\)|interest and ordinary dividends/ },
  { token: 'D', re: /schedule d \(form 1040\)|capital gains and losses/ },
  { token: 'E', re: /schedule e \(form 1040\)|supplemental income and loss/ },
  { token: 'F', re: /schedule f \(form 1040\)|profit or loss from farming/ },
  { token: 'SE', re: /schedule se \(form 1040\)|self-employment tax/ },
  { token: '8829', re: /form 8829|expenses for business use of your home/ },
  { token: '4562', re: /form 4562|depreciation and amortization/ },
  { token: '2441', re: /form 2441|child and dependent care expenses/ },
  { token: '8863', re: /form 8863|education credits/ },
  { token: '8889', re: /form 8889|health savings accounts/ },
  { token: '8962', re: /form 8962|premium tax credit/ },
  { token: '5695', re: /form 5695|residential (?:energy credits|clean energy)/ },
  { token: '8812', re: /schedule 8812|credits for qualifying children/ },
];

function detectSchedules(normPages: string[], full: string): string[] {
  const schedules: string[] = [];
  for (const { token, re } of SCHEDULE_SIGNATURES) {
    if (re.test(full)) schedules.push(token);
  }
  // Schedule C is special: each business is its own Schedule C, and the P&L rule
  // reads the multiplicity, so push one 'C' per detected form.
  const cPages = normPages.filter((p) => /schedule c \(form 1040\)|profit or loss from business/.test(p));
  const cCount = Math.max(cPages.length, /profit or loss from business/.test(full) ? 1 : 0);
  for (let i = 0; i < cCount; i++) schedules.push('C');
  return schedules;
}

// ── Schedule LEP (language preference) ────────────────────────────────────────

/**
 * Schedule LEP is the taxpayer's formal election of the language the IRS writes
 * to them in. If it was in last year's package we already know how to address
 * them, at no cost to the firm.
 *
 * The failure mode that matters is the *blank* schedule: a printed but unmarked
 * form lists all twenty languages, and reading the first one off it would put a
 * monolingual English client on Spanish. So when the full list is present a mark
 * is required, and an ambiguous page yields nothing rather than a guess.
 */
const LEP_PAGE = /schedule lep|request for change in language preference/;

/** A checked box survives extraction as an x, a tick, or a filled glyph. */
const LEP_MARK = '[x\\u2611\\u2612\\u2713\\u2714\\u25a0\\u2588]';

/**
 * A three-digit code from the schedule, refusing anything that is really part of
 * a longer number. The taxpayer's SSN is printed on this very page, and
 * `012-34-5678` must not elect French.
 */
const LEP_CODE = '(?<![\\w-])(0(?:[01]\\d|20))(?![\\w-])';

/** The box may extract either side of the code it belongs to. */
const LEP_MARKED = [
  new RegExp(`(?<![a-z0-9-])${LEP_MARK}\\s{0,3}${LEP_CODE}`, 'g'),
  new RegExp(`${LEP_CODE}\\s{0,3}${LEP_MARK}(?![a-z0-9-])`, 'g'),
];

const codesIn = (page: string, re: RegExp): Set<string> =>
  new Set([...page.matchAll(re)].map((m) => m[1]!));

function detectLepElection(normPages: string[]): { code: string; language: string } | undefined {
  const page = scopeMatching(normPages, LEP_PAGE);
  if (!page) return undefined;

  const marked = new Set(LEP_MARKED.flatMap((re) => [...codesIn(page, re)]));
  const present = codesIn(page, new RegExp(LEP_CODE, 'g'));

  // A ticked box wins. Failing that, tax software often prints only the elected
  // row with no box that survives extraction — one code on a LEP page is
  // unambiguous, twenty is the blank form and means nothing.
  const code =
    marked.size === 1 ? [...marked][0]! : present.size === 1 ? [...present][0]! : undefined;

  const found = LEP_LANGUAGES.find((l) => l.code === code);
  return found ? { code: found.code, language: found.language } : undefined;
}

// ── Line values ───────────────────────────────────────────────────────────────

/** Anchors for the 1040 main-form lines the rules consult. Lettered lines use
 * their unique token; bare-number lines use a description to avoid matching a
 * stray digit. */
const FORM_1040_LINES: { key: string; anchor: RegExp }[] = [
  { key: '1z', anchor: /\b1z\b/ },
  { key: '1a', anchor: /wages,? salaries,? tips/ },
  { key: '2a', anchor: /tax-exempt interest/ },
  { key: '2b', anchor: /taxable interest/ },
  { key: '3a', anchor: /qualified dividends/ },
  { key: '3b', anchor: /ordinary dividends/ },
  { key: '4a', anchor: /ira distributions/ },
  { key: '4b', anchor: /\b4b\b/ },
  { key: '5a', anchor: /pensions and annuities/ },
  { key: '5b', anchor: /\b5b\b/ },
  { key: '6a', anchor: /social security benefits/ },
  { key: '7', anchor: /capital gain or \(loss\)/ },
  { key: '26', anchor: /estimated tax payments/ },
];

const SCH1_LINES: { key: string; anchor: RegExp }[] = [
  { key: 'sch1-3', anchor: /business income or \(loss\)/ },
  { key: 'sch1-5', anchor: /rental real estate,? royalties/ },
  { key: 'sch1-7', anchor: /unemployment compensation/ },
  { key: 'sch1-8z', anchor: /\b8z\b/ },
  { key: 'sch1-11', anchor: /educator expenses/ },
  { key: 'sch1-20', anchor: /ira deduction/ },
  { key: 'sch1-21', anchor: /student loan interest/ },
];

const SCHA_LINES: { key: string; anchor: RegExp }[] = [
  { key: 'schA-1', anchor: /medical and dental expenses/ },
  { key: 'schA-14', anchor: /add lines 11 through 13/ },
];

function extractLines(mainForm: string, sch1: string, schA: string): Record<string, number> {
  const lines: Record<string, number> = {};
  const collect = (scope: string, specs: { key: string; anchor: RegExp }[]) => {
    if (!scope) return;
    for (const { key, anchor } of specs) {
      if (key in lines) continue;
      const value = moneyAfter(scope, anchor);
      if (value !== null) lines[key] = value;
    }
  };
  collect(mainForm, FORM_1040_LINES);
  collect(sch1, SCH1_LINES);
  collect(schA, SCHA_LINES);

  // Wages: normalise `1a` (older layout) into `1z` when only 1a was found.
  if (lines['1z'] === undefined && lines['1a'] !== undefined) lines['1z'] = lines['1a'];

  return lines;
}

// ── Rental property count ─────────────────────────────────────────────────────

const STATE_ZIP =
  /\b(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)\s+\d{5}(?:-\d{4})?\b/gi;

/** How many rental properties Schedule E reported — one address per property,
 * clamped to the three a single Schedule E can hold. */
function countRentalProperties(schE: string): number {
  if (!schE) return 0;
  const addresses = new Set<string>();
  for (const m of schE.matchAll(STATE_ZIP)) addresses.add(m[0]);
  return Math.min(Math.max(addresses.size, 1), 3);
}

// ── Document counting & issuers ───────────────────────────────────────────────

interface CompiledType {
  def: DocTypeDef;
  strong: RegExp[];
  weak: RegExp[];
  veto: RegExp[];
}

function safeRegexes(patterns: string[] | undefined): RegExp[] {
  const out: RegExp[] = [];
  for (const p of patterns ?? []) {
    try {
      out.push(new RegExp(p, 'i'));
    } catch {
      // A malformed taxonomy pattern must never break parsing.
    }
  }
  return out;
}

const COMPILED_TYPES: CompiledType[] = DOC_TYPES.map((def) => ({
  def,
  strong: safeRegexes(def.match.strong),
  weak: safeRegexes(def.match.weak),
  veto: safeRegexes(def.match.veto),
}));

/** Pages that are components of the return itself, not source documents the
 * taxpayer received — excluded from the source-document tally. */
const RETURN_PAGE =
  /u\.?s\.? individual income tax return|return of partnership income|income tax return for an s corporation|corporation income tax return|income tax return for estates and trusts|schedule [a-z] \(form 1040\)|schedule [1-9] \(form 1040\)|additional income and adjustments|additional credits and payments|itemized deductions|interest and ordinary dividends|capital gains and losses|supplemental income and loss|profit or loss from (?:business|farming)|self-employment tax|expenses for business use of your home|premium tax credit|education credits|child and dependent care expenses|health savings accounts/;

function bestTypeForPage(norm: string): CompiledType | null {
  let best: CompiledType | null = null;
  let bestScore = 0;
  for (const type of COMPILED_TYPES) {
    if (type.strong.length === 0) continue;
    if (type.veto.some((r) => r.test(norm))) continue;
    const strongHits = type.strong.filter((r) => r.test(norm)).length;
    if (strongHits === 0) continue;
    const weakHits = type.weak.filter((r) => r.test(norm)).length;
    const score = strongHits * 10 + weakHits;
    if (score > bestScore) {
      best = type;
      bestScore = score;
    }
  }
  return best;
}

const ISSUER_BOILERPLATE =
  /^(?:and\b|zip\b|code\b|address\b|street\b|city\b|state\b|province\b|country\b|number\b|name\b|recipient|payer|employer|filer|no\.\b)/i;

/** Trims a raw label-adjacent string down to just the issuer name: drops the
 * street address that follows it, any trailing EIN, and label boilerplate. */
function cleanIssuerName(raw: string | undefined): string | null {
  if (!raw) return null;
  let name = raw.replace(/[\r\t]+/g, ' ').replace(/^[\s,:;.\-]+/, '').trim();
  name = name.replace(/\b\d{2}-\d{7}\b.*$/, '').trim(); // EIN and anything after
  name = name.replace(/\s\d{2,}.*$/, '').trim(); // street number / ZIP begins the address
  name = name.replace(/[,.;]+$/, '').replace(/\s{2,}/g, ' ').trim();
  if (name.length < 2 || name.length > 60) return null;
  if (ISSUER_BOILERPLATE.test(name)) return null;
  return name;
}

function issuerLabels(docTypeId: string): RegExp[] {
  if (docTypeId === 'w2' || docTypeId === 'w2g') return [/employer'?s name/i];
  if (docTypeId === '1098' || docTypeId === '1098-e' || docTypeId === '1098-t') {
    return [/(?:recipient'?s\/lender'?s|lender'?s|recipient'?s|filer'?s) name/i];
  }
  if (docTypeId === 'k1-1065') return [/partnership'?s name/i];
  if (docTypeId === 'k1-1120s') return [/corporation'?s name/i];
  if (docTypeId === 'k1-1041') return [/(?:estate'?s or trust'?s|trust'?s|estate'?s) name/i];
  return [/payer'?s name/i, /issuer'?s name/i];
}

/** Pulls the payer/employer/partnership name off a source-document page. */
function extractIssuer(rawPage: string, docTypeId: string): string | null {
  const lines = rawPage.split(/\r?\n/);
  const labels = issuerLabels(docTypeId);
  for (let i = 0; i < lines.length; i++) {
    for (const label of labels) {
      const m = label.exec(lines[i]!);
      if (!m) continue;
      const sameLine = lines[i]!.slice(m.index + m[0].length);
      const candidate =
        cleanIssuerName(sameLine) ||
        cleanIssuerName(lines[i + 1]) ||
        cleanIssuerName(lines[i + 2]);
      if (candidate) return candidate;
    }
  }
  return null;
}

function countDocuments(
  rawPages: string[],
  normPages: string[],
): { documentCounts: Record<string, number>; issuers: { docTypeId: string; name: string }[] } {
  const documentCounts: Record<string, number> = {};
  const issuers: { docTypeId: string; name: string }[] = [];
  for (let i = 0; i < normPages.length; i++) {
    const norm = normPages[i]!;
    if (RETURN_PAGE.test(norm)) continue;
    const best = bestTypeForPage(norm);
    if (!best) continue;
    documentCounts[best.def.id] = (documentCounts[best.def.id] ?? 0) + 1;
    const name = extractIssuer(rawPages[i]!, best.def.id);
    if (name) issuers.push({ docTypeId: best.def.id, name });
  }
  return { documentCounts, issuers };
}

// ── Digital assets & state of residence ───────────────────────────────────────

function detectDigitalAssets(full: string): boolean {
  const m = /digital asset/.exec(full);
  if (!m) return false;
  const window = full.slice(m.index, m.index + 200);
  // "Yes" carrying the checkbox mark, with no intervening "No" claiming it.
  return /\byes\b\s*(?:x|\u2612|\[x\])/.test(window) && !/\bno\b\s*(?:x|\u2612|\[x\])\s*yes/.test(window);
}

function detectState(mainForm: string): string | undefined {
  STATE_ZIP.lastIndex = 0;
  const m = STATE_ZIP.exec(mainForm);
  return m ? m[1]!.toUpperCase() : undefined;
}

// ── Dependents ────────────────────────────────────────────────────────────────

function countDependents(full: string): number {
  const start = /dependents(?:\s*\(see instructions\))?/.exec(full);
  if (!start) return 0;
  const block = full.slice(start.index, start.index + 600);
  const stop = /(?:standard deduction|adjusted gross income|attach form|total income)/.exec(block);
  const scoped = stop ? block.slice(0, stop.index) : block;
  const ssns = scoped.match(/\b\d{3}-\d{2}-\d{4}\b/g);
  return ssns ? Math.min(ssns.length, 12) : 0;
}

// ── Confidence ────────────────────────────────────────────────────────────────

function scoreConfidence(prior: {
  formType: PriorYearReturn['formType'];
  taxYearFound: boolean;
  filingStatus?: FilingStatus;
  lines: Record<string, number>;
  schedules: string[];
  documentCounts: Record<string, number>;
}): number {
  let score = 0;
  if (prior.formType !== 'unknown') score += 0.3;
  if (prior.taxYearFound) score += 0.15;
  if (prior.filingStatus) score += 0.1;
  const numericLines = Object.keys(prior.lines).filter((k) => k !== 'digital-assets').length;
  score += Math.min(numericLines / 6, 1) * 0.25;
  if (prior.schedules.length > 0) score += 0.1;
  if (Object.keys(prior.documentCounts).length > 0) score += 0.1;
  return Math.round(Math.min(score, 1) * 100) / 100;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract a `PriorYearReturn` from the per-page text of a tax return. Pure and
 * total: any input — including an empty array from a scanned image — yields a
 * valid `PriorYearReturn`, with `confidence` reflecting how much was recovered.
 */
export function parseReturnText(pages: string[]): PriorYearReturn {
  const fallbackYear = new Date().getUTCFullYear() - 1;
  const rawPages = (pages ?? []).filter((p): p is string => typeof p === 'string');
  const normPages = rawPages.map(normalize);
  const full = normPages.join(' \u2029 ');

  // A scanned, image-only PDF extracts to almost nothing — bail to confidence 0
  // so the UI falls back to the starter checklist.
  if (full.replace(/[\s\u2029]/g, '').length < 24) {
    return { ...emptyPriorYear(fallbackYear), confidence: 0 };
  }

  const { formType, entityType } = detectForm(full, normPages[0] ?? '');
  const detectedYear = detectTaxYear(full);
  const taxYear = detectedYear ?? fallbackYear;
  const filingStatus = detectFilingStatus(full, entityType);
  const schedules = detectSchedules(normPages, full);

  const mainForm =
    scopeMatching(normPages, /individual income tax return|filing status|standard deduction/) || full;
  const sch1 = scopeMatching(normPages, /schedule 1 \(form 1040\)|additional income and adjustments/);
  const schA = scopeMatching(normPages, /schedule a \(form 1040\)|itemized deductions/);
  const schE = scopeMatching(normPages, /schedule e \(form 1040\)|supplemental income and loss/);

  const lines = extractLines(mainForm, sch1, schA);
  if (detectDigitalAssets(full)) lines['digital-assets'] = 1;

  const { documentCounts, issuers } = countDocuments(rawPages, normPages);

  // Schedule E's property count drives the rental line quantity and its reason.
  if (schedules.includes('E')) {
    const rentals = countRentalProperties(schE);
    if (rentals > 0) documentCounts['rental-summary'] = rentals;
  }

  const itemized = schedules.includes('A');
  const state = detectState(mainForm);
  const dependents = entityType === 'individual' ? countDependents(full) : 0;
  const lep = detectLepElection(normPages);

  const confidence = scoreConfidence({
    formType,
    taxYearFound: detectedYear !== null,
    filingStatus,
    lines,
    schedules,
    documentCounts,
  });

  return {
    taxYear,
    formType,
    entityType,
    filingStatus,
    dependents,
    state,
    schedules,
    lines,
    issuers,
    ...(lep ? { lepCode: lep.code, lepLanguage: lep.language } : {}),
    itemized,
    documentCounts,
    confidence,
  };
}

/**
 * Downloads-agnostic PDF entry point: turns raw bytes into page text with
 * `unpdf` (pure-JS, serverless-safe) and hands off to `parseReturnText`. Never
 * throws — a corrupt or encrypted file becomes a `confidence: 0` result.
 */
export async function parsePriorYearReturnFromPdf(
  data: Uint8Array | ArrayBuffer | Buffer,
): Promise<PriorYearReturn> {
  try {
    const { extractText } = await import('unpdf');
    const bytes =
      data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(data as ArrayBuffer);
    const { text } = await extractText(bytes, { mergePages: false });
    const pages = Array.isArray(text) ? text : [text];
    return parseReturnText(pages);
  } catch {
    return { ...emptyPriorYear(new Date().getUTCFullYear() - 1), confidence: 0 };
  }
}
