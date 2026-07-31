/**
 * The locale core. One registry, static dictionaries, `Intl` for everything the
 * platform already does correctly.
 *
 *   • No i18n framework. `Intl.PluralRules`, `Intl.NumberFormat`,
 *     `Intl.ListFormat` and `Intl.DateTimeFormat` are built in, correct, and
 *     free; a library that wraps them is a dependency that only adds a place
 *     for bugs to live.
 *   • No ICU message parser. Two slot shapes — `{name}` and `{name#pluralKey}`
 *     — cover every string in the product, and plural selection is delegated to
 *     CLDR through `Intl.PluralRules`.
 *   • No network. Dictionaries are TypeScript modules compiled into the bundle,
 *     so a chase send never depends on a translation service being up.
 */

export * from './locales.ts';
export * from './lep.ts';
export * from './format.ts';
export * from './language.ts';
export type {
  ChaseStringKey,
  DescriptorDocTypeId,
  Dictionary,
  PluralKey,
  PortalStringKey,
  ReviewStatus,
  StringKey,
  ToneCopy,
} from './types.ts';
export { DESCRIPTOR_DOC_TYPE_IDS, TONES } from './types.ts';

import { interpolate, type Vars } from './format.ts';
import { DEFAULT_LOCALE, isLocaleId, type LocaleId } from './locales.ts';
import type { DescriptorDocTypeId, Dictionary, StringKey } from './types.ts';

import { en } from './dict/en.ts';
import { es } from './dict/es.ts';
import { zhHans } from './dict/zh-Hans.ts';
import { zhHant } from './dict/zh-Hant.ts';
import { ko } from './dict/ko.ts';
import { vi } from './dict/vi.ts';
import { ru } from './dict/ru.ts';
import { ht } from './dict/ht.ts';
import { tl } from './dict/tl.ts';
import { pt } from './dict/pt.ts';
import { ar } from './dict/ar.ts';

export const DICTIONARIES: Record<LocaleId, Dictionary> = {
  en,
  es,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  ko,
  vi,
  ru,
  ht,
  tl,
  pt,
  ar,
};

/** Never throws — an unknown locale falls back to English. */
export function dictionary(locale: string | undefined | null): Dictionary {
  return isLocaleId(locale) ? DICTIONARIES[locale] : DICTIONARIES[DEFAULT_LOCALE];
}

/**
 * Look up and interpolate one string. The portal's entry point.
 *
 * A key missing from a locale falls back to English rather than rendering blank
 * — but `check.ts` fails the build on it, so the fallback is a seatbelt, not a
 * strategy.
 */
export function t(locale: LocaleId, key: StringKey, vars: Vars = {}): string {
  const dict = dictionary(locale);
  const template = dict.s[key] ?? en.s[key];
  return interpolate(template, vars, locale, dict.plural);
}

/**
 * The name a taxpayer sees for a checklist line.
 *
 * IRS form identifiers are returned untouched: "1099-DIV" is printed in Latin on
 * the paper the taxpayer is looking for, and translating it would make the
 * document harder to find, not easier.
 */
export function docCodeLabel(locale: LocaleId, docTypeId: string, fallback: string): string {
  const dict = dictionary(locale);
  return dict.docCode[docTypeId as DescriptorDocTypeId] ?? fallback;
}

/** Locales whose dictionary has been read and signed off by a person. */
export function reviewedLocales(): LocaleId[] {
  return (Object.keys(DICTIONARIES) as LocaleId[]).filter(
    (id) => DICTIONARIES[id].review !== 'machine',
  );
}
