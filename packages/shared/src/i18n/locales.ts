/**
 * The locale registry.
 *
 * Scope is deliberate: **taxpayer-facing surfaces only** — the chase email, the
 * chase SMS, and the portal. The firm-facing console stays English. Preparers
 * and partners work in English; translating an admin console is enormous,
 * largely unread, and a maintenance liability every time a button moves. The
 * people who need their own language are taxpayers, and taxpayers see exactly
 * two things.
 *
 * Tiers, and why each language is here:
 *   • IRS Pub-17 six — Spanish, Chinese (Simplified), Chinese (Traditional),
 *     Korean, Russian, Vietnamese. The IRS itself publishes Publication 17 and
 *     the core forms in exactly these. If the IRS writes to a taxpayer in that
 *     language, so should the firm chasing their documents.
 *   • Coverage — Haitian Creole (IRS web resources; Miami, Brooklyn), Tagalog,
 *     Portuguese. Large US filing populations, all three carry a Schedule LEP
 *     code.
 *   • Arabic — carried mainly because it forces RTL to be real rather than
 *     claimed. Everything bidirectional in this module exists because `ar` is
 *     in the list.
 */

export type Direction = 'ltr' | 'rtl';

export type LocaleId =
  | 'en'
  | 'es'
  | 'zh-Hans'
  | 'zh-Hant'
  | 'ko'
  | 'vi'
  | 'ru'
  | 'ht'
  | 'tl'
  | 'pt'
  | 'ar';

export interface LocaleRecord {
  id: LocaleId;
  /** Tag handed to every `Intl` constructor. */
  bcp47: string;
  /**
   * Tag used for `Intl.ListFormat` only, when CLDR's default punctuation is not
   * TaxFax's house style. `en` maps to `en-GB` because CLDR's `en` conjunction
   * carries a serial comma ("A, B, and C") and every string shipped today does
   * not. This is a punctuation choice, not a language choice.
   */
  listLocale?: string;
  /**
   * Conjunction used *instead of* `Intl.ListFormat`, for languages ICU has no
   * data for. Only Haitian Creole needs this — Node's ICU resolves `ht` to an
   * English locale, so a list would otherwise read "W-2, 1098 and 1099-DIV".
   * ponytail: one data field beats reimplementing ListFormat; drop it the day
   * CLDR ships `ht`.
   */
  conjunction?: string;
  /** The language's name in the language itself — the only label a taxpayer picking one can read. */
  endonym: string;
  englishName: string;
  dir: Direction;
  /** The IRS publishes Publication 17 and the core forms in this language. */
  irsPub17: boolean;
}

export const LOCALES: Record<LocaleId, LocaleRecord> = {
  en: {
    id: 'en',
    bcp47: 'en-US',
    listLocale: 'en-GB',
    endonym: 'English',
    englishName: 'English',
    dir: 'ltr',
    irsPub17: true,
  },
  es: {
    id: 'es',
    bcp47: 'es',
    endonym: 'Español',
    englishName: 'Spanish',
    dir: 'ltr',
    irsPub17: true,
  },
  'zh-Hans': {
    id: 'zh-Hans',
    bcp47: 'zh-Hans',
    endonym: '简体中文',
    englishName: 'Chinese (Simplified)',
    dir: 'ltr',
    irsPub17: true,
  },
  'zh-Hant': {
    id: 'zh-Hant',
    bcp47: 'zh-Hant',
    endonym: '繁體中文',
    englishName: 'Chinese (Traditional)',
    dir: 'ltr',
    irsPub17: true,
  },
  ko: {
    id: 'ko',
    bcp47: 'ko',
    endonym: '한국어',
    englishName: 'Korean',
    dir: 'ltr',
    irsPub17: true,
  },
  vi: {
    id: 'vi',
    bcp47: 'vi',
    endonym: 'Tiếng Việt',
    englishName: 'Vietnamese',
    dir: 'ltr',
    irsPub17: true,
  },
  ru: {
    id: 'ru',
    bcp47: 'ru',
    endonym: 'Русский',
    englishName: 'Russian',
    dir: 'ltr',
    irsPub17: true,
  },
  ht: {
    id: 'ht',
    // ICU has no Haitian Creole data and silently resolves `ht` to English.
    // Dates therefore render with English month names; see the report.
    bcp47: 'ht',
    conjunction: 'ak',
    endonym: 'Kreyòl ayisyen',
    englishName: 'Haitian Creole',
    dir: 'ltr',
    irsPub17: false,
  },
  tl: {
    id: 'tl',
    // CLDR files Tagalog under Filipino; `Intl` canonicalizes `tl` → `fil`.
    bcp47: 'fil',
    endonym: 'Tagalog',
    englishName: 'Tagalog',
    dir: 'ltr',
    irsPub17: false,
  },
  pt: {
    id: 'pt',
    bcp47: 'pt',
    endonym: 'Português',
    englishName: 'Portuguese',
    dir: 'ltr',
    irsPub17: false,
  },
  ar: {
    id: 'ar',
    bcp47: 'ar',
    endonym: 'العربية',
    englishName: 'Arabic',
    dir: 'rtl',
    irsPub17: false,
  },
};

export const DEFAULT_LOCALE: LocaleId = 'en';

export const LOCALE_IDS = Object.keys(LOCALES) as LocaleId[];

export function isLocaleId(v: unknown): v is LocaleId {
  return typeof v === 'string' && Object.hasOwn(LOCALES, v);
}

/** Never throws: an unknown or missing id resolves to English. */
export function localeRecord(id: string | undefined | null): LocaleRecord {
  return isLocaleId(id) ? LOCALES[id] : LOCALES[DEFAULT_LOCALE];
}

export function directionOf(id: string | undefined | null): Direction {
  return localeRecord(id).dir;
}
