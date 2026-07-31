/**
 * Which language a client is written to in, and who gets to decide.
 *
 * Three parties can have an opinion, and they must be ranked or the last write
 * wins by accident:
 *
 *   taxpayer (30)  The person reading the message. They picked it themselves on
 *                  the portal, in a UI that was already in a language they could
 *                  read, so it is a deliberate choice about their own mail.
 *   preparer (20)  Knows the client personally, and is the one who corrects a
 *                  bad detection ("that's her husband's election, not hers").
 *   detected (10)  A Schedule LEP election lifted off last year's return. Strong
 *                  evidence — it is a formal election made to the IRS — but it
 *                  is still evidence, produced by a parser, about a document
 *                  that may be a year stale.
 *   default  (0)   English.
 *
 * So: **a human always beats the parser, and between humans the taxpayer wins.**
 * A re-parse of next year's return can refresh a detection, but it can never
 * overwrite a person. What it *can* do is record its evidence anyway, so the
 * firm can see "they elected Vietnamese with the IRS; you have them on Spanish"
 * rather than have the finding silently dropped.
 */

import type { Timestampish } from '../models.ts';
import { DEFAULT_LOCALE, isLocaleId, type LocaleId } from './locales.ts';

export type LanguageSource = 'taxpayer' | 'preparer' | 'detected' | 'default';

export const LANGUAGE_SOURCE_RANK: Record<LanguageSource, number> = {
  taxpayer: 30,
  preparer: 20,
  detected: 10,
  default: 0,
};

export const LANGUAGE_SOURCE_LABEL: Record<LanguageSource, string> = {
  taxpayer: 'Chosen by the client',
  preparer: 'Set by your team',
  detected: 'From their Schedule LEP election',
  default: 'Firm default',
};

/** Stored at `Client.language`. */
export interface ClientLanguage {
  /** The locale we actually write in. Always one we have a dictionary for. */
  locale: LocaleId;
  source: LanguageSource;
  /** Raw Schedule LEP code found on the prior-year return, e.g. `'003'`. */
  lepCode?: string;
  /**
   * Set when the LEP election names a real IRS language we cannot write yet.
   * Its presence is what the firm gets told about — never a silent fallback.
   */
  unsupported?: { code: string; language: string };
  updatedAt?: Timestampish;
}

/** Firms that want nothing to do with this can switch it off; absent means on. */
export function multilingualEnabled(
  firm: { multilingual?: { enabled?: boolean } } | undefined | null,
): boolean {
  return firm?.multilingual?.enabled !== false;
}

/**
 * The locale to render in. Total and defensive: an unknown locale, a missing
 * record, or a firm that has opted out all resolve to English.
 */
export function effectiveLocale(
  language: ClientLanguage | undefined | null,
  enabled = true,
): LocaleId {
  if (!enabled) return DEFAULT_LOCALE;
  return isLocaleId(language?.locale) ? language.locale : DEFAULT_LOCALE;
}

/**
 * Merge an incoming language decision against what's on file.
 *
 * Returns the value to write, or `null` when the incoming decision must be
 * ignored entirely. A rejected *detection* that carries new evidence still
 * returns a patch — the evidence is kept, the locale is not touched.
 */
export function preferLanguage(
  existing: ClientLanguage | undefined | null,
  next: ClientLanguage,
): ClientLanguage | null {
  if (!existing) return next;

  const outranks = LANGUAGE_SOURCE_RANK[next.source] >= LANGUAGE_SOURCE_RANK[existing.source];
  if (outranks) return next;

  const evidenceIsNew =
    next.lepCode !== undefined &&
    (next.lepCode !== existing.lepCode ||
      next.unsupported?.code !== existing.unsupported?.code);
  if (!evidenceIsNew) return null;

  // Keep the human's locale; record what the return actually said.
  return {
    ...existing,
    lepCode: next.lepCode,
    ...(next.unsupported ? { unsupported: next.unsupported } : {}),
    updatedAt: next.updatedAt,
  };
}
