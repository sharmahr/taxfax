/**
 * "Why we need this", in the reader's language.
 *
 * The sentence under a checklist line is the single most persuasive thing the
 * product says — it is what turns "another document request" into "oh, the
 * Northwind K-1, I know where that is". It was an English string literal baked
 * into the rule that produced it and persisted as `DocRequest.reason`, which
 * made it architecturally untranslatable: there was no key to look up, and the
 * evidence the rule had found (two employers, $45k of net income) was already
 * dissolved into English prose by the time it was stored.
 *
 * So a reason is now a **reference** — a key plus the evidence — and the
 * sentence is assembled at display time:
 *
 *     { key: 'reason.w2IssuersMany', vars: { count: 2, issuers: [...] } }
 *
 * Three things follow from that shape, and each is deliberate:
 *
 *   • **IRS identifiers belong to the key, not to the translator.** "W-2",
 *     "Schedule D", "1095-A" are supplied by `REASON_CODES` and interpolated,
 *     which means `interpolate` bidi-isolates them in an RTL locale for free.
 *     A translator never sees them and so can never translate them — which is
 *     the point: it is what is printed on the paper in the drawer.
 *   • **Issuer names and dollar figures are values, not text.** They are joined
 *     with the reader's own list format and isolated the same way.
 *   • **Legacy reasons are recovered, not lost.** Every reason already written
 *     to Firestore is an English sentence produced by one of these templates,
 *     so `recoverReason` matches it back to its key and evidence. The recogniser
 *     is *generated from the same English template* the renderer uses, so the
 *     two cannot drift, and `check.ts` round-trips every key through both.
 *     Anything that does not match — a preparer's own free text — renders
 *     verbatim, exactly as it does today.
 */

import { formatNames, interpolate, type Vars } from './format.ts';
import { DEFAULT_LOCALE, isLocaleId, type LocaleId } from './locales.ts';
import { REASON_KEYS, type Dictionary, type ReasonKey, type ReasonRef, type ReasonVars } from './types.ts';
import { en } from './dict/en.ts';

/**
 * The IRS identifiers each sentence splices in. These are part of the *key*,
 * not of the translation and not of the stored evidence — "1099-DIV" is printed
 * in Latin on the document a taxpayer is hunting for, so a Korean paraphrase of
 * it makes the paper harder to find, not easier. The same rule already governs
 * checklist titles in `outstandingLabel`.
 */
export const REASON_CODES: Partial<Record<ReasonKey, Record<string, string>>> = {
  'reason.w2Issuers': { code: 'W-2' },
  'reason.w2IssuersMany': { code: 'W-2' },
  'reason.brokerIssuers': { code: 'Schedule D' },
  'reason.brokerSchedule': { code: 'Schedule D', code2: '1099' },
  'reason.scheduleCMany': { code: 'Schedule C' },
  'reason.scheduleCIncome': { code: 'Schedule C' },
  'reason.scheduleC': { code: 'Schedule C' },
  'reason.necIssuers': { code: '1099-NEC' },
  'reason.necSelfEmployed': { code: '1099-NEC' },
  'reason.paymentAppIssuers': { code: '1099-K' },
  'reason.paymentApp': { code: '1099-K' },
  'reason.payroll': { codes: 'W-3, 940, 941' },
  'reason.k1PartnershipIssuers': { code: 'K-1' },
  'reason.k1Partnership': { code: 'K-1' },
  'reason.k1PartnershipMany': { code: 'K-1' },
  'reason.k1SCorp': { code: 'K-1' },
  'reason.k1SCorpMany': { code: 'K-1' },
  'reason.rentalMany': { code: 'Schedule E' },
  'reason.rentalOne': { code: 'Schedule E' },
  'reason.hsa': { code: '8889' },
  'reason.marketplace': { code: '1095-A' },
};

const REASON_KEY_SET = new Set<string>(REASON_KEYS);

export function isReasonKey(v: unknown): v is ReasonKey {
  return typeof v === 'string' && REASON_KEY_SET.has(v);
}

/** How many payers we name before the sentence gets unreadable. */
const MAX_NAMED_ISSUERS = 3;

/**
 * Assemble the sentence. `dict` is threaded in rather than looked up so this
 * module stays free of the dictionary registry and out of its import cycle.
 */
export function renderReason(locale: LocaleId, ref: ReasonRef, dict: Dictionary): string {
  const template = dict.reason[ref.key] ?? en.reason[ref.key];
  if (!template) return '';

  const vars: Vars = { ...REASON_CODES[ref.key] };
  const { count, year, amount, issuers } = ref.vars ?? {};
  if (count !== undefined) vars.count = count;
  if (year !== undefined) vars.year = year;
  if (amount !== undefined) vars.amount = amount;
  if (issuers && issuers.length > 0) {
    const shown = issuers.slice(0, MAX_NAMED_ISSUERS);
    const rest = issuers.length - shown.length;
    const joined = formatNames(locale, shown);
    vars.issuers =
      rest > 0
        ? joined + interpolate(dict.s['list.plus'], { restCount: rest }, locale, dict.plural)
        : joined;
  }
  return interpolate(template, vars, locale, dict.plural);
}

// ── Recovering a reason already written to Firestore ─────────────────────────

/**
 * How each dynamic slot looks once English has rendered it. Tight on purpose —
 * a loose `.+` would let one template swallow another's sentence and recover
 * the wrong key.
 */
const SLOT_PATTERN: Record<string, string> = {
  count: '(\\d+)',
  year: '(\\d{4})',
  amount: '(\\$[\\d,.]+k?)',
  issuers: '(.+?)',
};

const ESCAPE = /[.*+?^${}()|[\]\\]/g;

/**
 * Build the recogniser for one key straight off its English template: literal
 * text is escaped, IRS codes are pinned as literals (they are constants of the
 * key), and only the genuinely variable slots become captures. Generating it
 * from the template is what stops the two from drifting.
 */
function recogniser(key: ReasonKey): { re: RegExp; slots: string[] } {
  const template = en.reason[key];
  const codes = REASON_CODES[key] ?? {};
  const slots: string[] = [];
  let source = '';
  let last = 0;
  for (const m of template.matchAll(/\{(\w+)(?:#\w+)?\}/g)) {
    source += template.slice(last, m.index).replace(ESCAPE, '\\$&');
    last = m.index + m[0].length;
    const name = m[1]!;
    const code = codes[name];
    if (code !== undefined) {
      source += code.replace(ESCAPE, '\\$&');
    } else {
      source += SLOT_PATTERN[name] ?? '(.+?)';
      slots.push(name);
    }
  }
  source += template.slice(last).replace(ESCAPE, '\\$&');
  return { re: new RegExp(`^${source}$`), slots };
}

let recognisers: { key: ReasonKey; re: RegExp; slots: string[] }[] | null = null;

/**
 * Longest template first. Several sentences share a stem — "You made estimated
 * payments last year." is a prefix of the one that names the total — and the
 * more specific one has to win.
 */
function allRecognisers() {
  if (!recognisers) {
    recognisers = REASON_KEYS.map((key) => ({ key, ...recogniser(key) })).sort(
      (a, b) => en.reason[b.key].length - en.reason[a.key].length,
    );
  }
  return recognisers;
}

/**
 * English's own list punctuation, undone. Only ever applied to a sentence this
 * module rendered, and only as a fallback: `DocRequest.expectedIssuers` carries
 * the same names exactly, and takes precedence wherever it is present.
 */
function splitIssuers(joined: string): string[] {
  const trimmed = joined.replace(/,? plus \d+ more$/, '');
  return trimmed
    .split(/, | and /)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Match an English reason back to the key and evidence that produced it, so a
 * checklist written before reasons had keys still reads in the taxpayer's own
 * language. Returns `null` for anything we did not write — a preparer's free
 * text, which is theirs and renders verbatim.
 */
export function recoverReason(english: string | undefined | null): ReasonRef | null {
  if (!english) return null;
  const text = english.trim();
  for (const { key, re, slots } of allRecognisers()) {
    const m = re.exec(text);
    if (!m) continue;
    const vars: ReasonVars = {};
    slots.forEach((name, i) => {
      const raw = m[i + 1]!;
      if (name === 'count') vars.count = Number(raw);
      else if (name === 'year') vars.year = raw;
      else if (name === 'amount') vars.amount = raw;
      else if (name === 'issuers') vars.issuers = splitIssuers(raw);
    });
    return Object.keys(vars).length > 0 ? { key, vars } : { key };
  }
  return null;
}

/** The persisted shape this module can read a reason out of. */
export interface ReasonBearing {
  reason?: string;
  reasonKey?: string;
  reasonVars?: ReasonVars;
  /** Carried forward from the prior return, and the exact source for `{issuers}`. */
  expectedIssuers?: string[];
}

/**
 * The reason a taxpayer reads, resolved in the order the data deserves:
 *
 *   1. The key the rule wrote. Authoritative, and the only path once every
 *      writer has been through a season.
 *   2. The key recovered from the English sentence on file. Every checklist
 *      written before this existed goes through here — which is why no
 *      migration was needed and why nothing had to be rewritten in place.
 *   3. The stored sentence, verbatim. A preparer's own words, in the language
 *      they typed them.
 */
export function requestReason(
  locale: LocaleId,
  request: ReasonBearing,
  dict: Dictionary,
): string {
  const ref = isReasonKey(request.reasonKey)
    ? { key: request.reasonKey, vars: request.reasonVars }
    : recoverReason(request.reason);
  if (!ref) return request.reason ?? '';

  const issuers =
    request.expectedIssuers && request.expectedIssuers.length > 0
      ? request.expectedIssuers
      : ref.vars?.issuers;
  const wanted = /\{issuers\}/.test(en.reason[ref.key]);
  return renderReason(
    isLocaleId(locale) ? locale : DEFAULT_LOCALE,
    wanted && issuers ? { key: ref.key, vars: { ...ref.vars, issuers } } : ref,
    dict,
  );
}
