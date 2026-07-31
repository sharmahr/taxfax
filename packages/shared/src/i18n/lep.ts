/**
 * Schedule LEP (Form 1040) — "Request for Change in Language Preference".
 *
 * A taxpayer attaches Schedule LEP to elect, by numeric code, the language the
 * IRS should write to them in. TaxFax already parses last year's return to build
 * the checklist; if Schedule LEP was in that package we learn the client's
 * language from the same evidence, with zero effort from the firm.
 *
 * All twenty codes live here, not just the ones we can write. A code we
 * recognize but cannot yet write is a *different* outcome from a code we have
 * never heard of: the first tells the firm "this person asked the IRS for
 * Khmer and we're still sending English", which is exactly the thing a firm
 * needs to know. Silent English fallback would hide it.
 */

import { isLocaleId, type LocaleId } from './locales.ts';

export interface LepLanguage {
  /** Three-digit code exactly as printed on the form. */
  code: string;
  /** The language's English name as the IRS prints it on the schedule. */
  language: string;
  /** Our locale, when we have a dictionary for it. */
  locale: LocaleId | null;
}

/** `000` is not a language — it cancels a prior election and reverts to English. */
export const LEP_CANCEL_CODE = '000';

export const LEP_LANGUAGES: LepLanguage[] = [
  { code: '000', language: 'English (cancels a prior election)', locale: 'en' },
  { code: '001', language: 'Spanish', locale: 'es' },
  { code: '002', language: 'Korean', locale: 'ko' },
  { code: '003', language: 'Vietnamese', locale: 'vi' },
  { code: '004', language: 'Russian', locale: 'ru' },
  { code: '005', language: 'Arabic', locale: 'ar' },
  { code: '006', language: 'Haitian Creole', locale: 'ht' },
  { code: '007', language: 'Tagalog', locale: 'tl' },
  { code: '008', language: 'Portuguese', locale: 'pt' },
  { code: '009', language: 'Polish', locale: null },
  { code: '010', language: 'Farsi', locale: null },
  { code: '011', language: 'French', locale: null },
  { code: '012', language: 'Japanese', locale: null },
  { code: '013', language: 'Gujarati', locale: null },
  { code: '014', language: 'Punjabi', locale: null },
  { code: '015', language: 'Khmer', locale: null },
  { code: '016', language: 'Urdu', locale: null },
  { code: '017', language: 'Bengali', locale: null },
  { code: '018', language: 'Italian', locale: null },
  { code: '019', language: 'Chinese (Traditional)', locale: 'zh-Hant' },
  { code: '020', language: 'Chinese (Simplified)', locale: 'zh-Hans' },
];

const BY_CODE = new Map(LEP_LANGUAGES.map((l) => [l.code, l]));

/** How a Schedule LEP election resolved. Exactly one of these is true. */
export type LepOutcome =
  /** We recognize the code and can write in it. */
  | { kind: 'supported'; code: string; language: string; locale: LocaleId }
  /** A real IRS language we do not have a dictionary for. The firm is told. */
  | { kind: 'unsupported'; code: string; language: string; locale: 'en' }
  /** Not a code on the form — a bad parse. Treated as no election at all. */
  | { kind: 'unknown'; code: string; language: null; locale: 'en' };

/**
 * Resolve a raw code off the form. Always lands somewhere sane: an election we
 * cannot honor still yields English, but says so, so the caller can surface it
 * instead of swallowing it.
 */
export function resolveLepCode(raw: string | undefined | null): LepOutcome {
  const trimmed = String(raw ?? '').trim();
  // A missing or malformed code is not an election. Padding it first would turn
  // an empty string into `000`, i.e. a deliberate revert to English.
  if (!/^\d{1,3}$/.test(trimmed)) {
    return { kind: 'unknown', code: trimmed, language: null, locale: 'en' };
  }
  const code = trimmed.padStart(3, '0');
  const found = BY_CODE.get(code);
  if (!found) return { kind: 'unknown', code, language: null, locale: 'en' };
  if (found.locale && isLocaleId(found.locale)) {
    return { kind: 'supported', code: found.code, language: found.language, locale: found.locale };
  }
  return { kind: 'unsupported', code: found.code, language: found.language, locale: 'en' };
}

/** Lookup by the language name the IRS prints, e.g. "Chinese (Traditional)". */
export function lepCodeForLanguage(name: string): string | undefined {
  const want = name.trim().toLowerCase();
  return LEP_LANGUAGES.find((l) => l.language.toLowerCase() === want)?.code;
}
