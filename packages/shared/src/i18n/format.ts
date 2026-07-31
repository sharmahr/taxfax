/**
 * Formatting primitives. Everything here is `Intl` plus about eighty lines of
 * glue — no i18n framework, no ICU message parser, no runtime translation call.
 *
 * Three things the platform does not do for us and that matter enough to write:
 *   1. **Plural selection against a dictionary.** `Intl.PluralRules` hands back
 *      the CLDR category; picking the right word for it is ours. Russian needs
 *      four forms, Arabic six. Getting this wrong is what makes a product read
 *      like it was pasted through a machine.
 *   2. **SMS segmentation.** A single non-Latin character drops a text from
 *      GSM-7's 160 characters a segment to UCS-2's 70. Every Chinese, Korean,
 *      Russian and Arabic message pays that, and a chase text that silently
 *      becomes four billed segments is a cost bug, not a cosmetic one.
 *   3. **Bidi isolation.** An Arabic sentence with a URL, a form code or a
 *      dollar amount spliced into it renders scrambled unless the LTR run is
 *      isolated. `U+2068 FSI … U+2069 PDI` is the correct mechanism, and it is
 *      applied only in RTL locales so English stays byte-identical and GSM-7.
 */

import { localeRecord, type Direction, type LocaleId } from './locales.ts';

// ── Bidi ─────────────────────────────────────────────────────────────────────

/** First-strong isolate: the embedded run picks its own direction. */
export const FSI = '\u2068';
/** Pop directional isolate. */
export const PDI = '\u2069';
/** Right-to-left mark — forces a neutral-leading line (a bullet) to lay out RTL. */
export const RLM = '\u200F';

/**
 * A strong left-to-right letter — the thing that actually reorders an RTL
 * sentence when it is spliced in. RTL scripts are excluded because they need no
 * isolation inside an RTL sentence, and digits are excluded because the bidi
 * algorithm already resolves them correctly between two Arabic runs. Written as
 * "any letter that is not an RTL-script letter" so a Chinese firm name in an
 * Arabic message is isolated too.
 */
const LTR_STRONG =
  /[^\P{L}\p{sc=Arabic}\p{sc=Hebrew}\p{sc=Syriac}\p{sc=Thaana}\p{sc=Nko}\p{sc=Adlam}]/u;

/**
 * Isolate an interpolated value so it cannot reorder the sentence around it.
 * A no-op in LTR locales: English must stay byte-identical, and a control
 * character would knock every SMS out of GSM-7 and halve its capacity. Also a
 * no-op for a value that carries no LTR letters, which keeps four bytes of
 * pure overhead out of every Arabic text message.
 */
export function isolate(value: string, dir: Direction): string {
  if (dir !== 'rtl') return value;
  // Already prepared. A list whose members were isolated one by one keeps its
  // connector — Arabic's «و» — *outside* the isolates; wrapping the whole run
  // again would make the list itself lay out left-to-right and put the first
  // payer on the wrong end of the sentence.
  if (value.includes(FSI)) return value;
  return LTR_STRONG.test(value) ? FSI + value + PDI : value;
}

/** Strip the isolate marks — for logs, previews, and length maths on raw copy. */
export function stripBidi(s: string): string {
  return s.replace(/[\u2066-\u2069\u200e\u200f]/g, '');
}

// ── Intl caches ──────────────────────────────────────────────────────────────

const cache = <T>(make: (key: string) => T) => {
  const map = new Map<string, T>();
  return (key: string): T => {
    let v = map.get(key);
    if (v === undefined) {
      v = make(key);
      map.set(key, v);
    }
    return v;
  };
};

const pluralRules = cache((tag: string) => new Intl.PluralRules(tag));
const numberFormat = cache((tag: string) => new Intl.NumberFormat(tag));
const listFormat = cache((tag: string) => new Intl.ListFormat(tag, { type: 'conjunction' }));
const monthDayFormat = cache(
  (tag: string) => new Intl.DateTimeFormat(tag, { month: 'long', day: 'numeric' }),
);

// ── Plurals ──────────────────────────────────────────────────────────────────

/** The six CLDR categories. `other` is the only one every language has. */
export interface PluralForms {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

/**
 * Pick the form CLDR says applies to `n`. Falls back through `other`, so a
 * dictionary that only fills the categories its language actually uses is
 * complete rather than lossy — Chinese and Korean need one form, Russian four,
 * Arabic six.
 */
export function plural(locale: LocaleId, n: number, forms: PluralForms): string {
  const category = pluralRules(localeRecord(locale).bcp47).select(n);
  return forms[category] ?? forms.other;
}

// ── Numbers, lists, dates ────────────────────────────────────────────────────

export function formatNumber(locale: LocaleId, n: number): string {
  return numberFormat(localeRecord(locale).bcp47).format(n);
}

/**
 * "A, B and C". `Intl.ListFormat` everywhere it has data; the locale record's
 * `conjunction` covers the one language (Haitian Creole) ICU silently resolves
 * to English.
 */
export function formatList(locale: LocaleId, items: string[]): string {
  const rec = localeRecord(locale);
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  if (rec.conjunction) {
    return `${items.slice(0, -1).join(', ')} ${rec.conjunction} ${items[items.length - 1]}`;
  }
  return listFormat(rec.listLocale ?? rec.bcp47).format(items);
}

/** "April 15" / "15 avril" / "١٥ أبريل" — the filing-deadline date in a sentence. */
export function formatMonthDay(locale: LocaleId, date: Date): string {
  return monthDayFormat(localeRecord(locale).bcp47).format(date);
}

/**
 * A list of proper names — payers, employers, brokers — for splicing into a
 * sentence.
 *
 * Same as `formatList`, except each name is bidi-isolated *before* the join
 * rather than the finished list being isolated afterwards. "Acme Corporation
 * وNorthwind Logistics LLC" has to read right-to-left as a list of two
 * left-to-right names; isolating the whole run instead would hand the list to
 * the LTR algorithm and reverse which payer the reader sees first.
 */
export function formatNames(locale: LocaleId, items: string[]): string {
  const dir = localeRecord(locale).dir;
  return formatList(
    locale,
    items.map((n) => isolate(n, dir)),
  );
}

// ── Template interpolation ───────────────────────────────────────────────────

export type Vars = Record<string, string | number>;

/**
 * `{name}` substitutes a value; `{name#key}` substitutes the plural form of
 * `key` chosen by the *number* in `name`. That is the whole syntax — deliberately
 * short of ICU MessageFormat, because `Intl.PluralRules` plus two slot shapes
 * covers every string in the product and an ICU parser does not pay for itself.
 *
 * An unresolved slot is left verbatim rather than blanked, so `check.ts` fails
 * the build on it instead of a taxpayer reading `{firmName}`.
 */
export function interpolate(
  template: string,
  vars: Vars,
  locale: LocaleId,
  plurals: Record<string, PluralForms> = {},
): string {
  const dir = localeRecord(locale).dir;
  return template.replace(/\{(\w+)(?:#(\w+))?\}/g, (whole, name: string, pluralKey?: string) => {
    const raw = vars[name];
    if (raw === undefined) return whole;
    if (pluralKey) {
      const forms = plurals[pluralKey];
      if (!forms) return whole;
      return plural(locale, Number(raw), forms);
    }
    const text = typeof raw === 'number' ? formatNumber(locale, raw) : raw;
    return isolate(text, dir);
  });
}

// ── SMS segmentation (GSM 03.38) ─────────────────────────────────────────────

/** The GSM-7 default alphabet. Anything outside it forces the whole message to UCS-2. */
const GSM7_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
);

/** Reachable only via an escape, so each of these costs two septets, not one. */
const GSM7_EXTENDED = new Set('\f^{}\\[~]|€');

export type SmsEncoding = 'gsm7' | 'ucs2';

export interface SmsCost {
  encoding: SmsEncoding;
  /** Septets for GSM-7, UTF-16 code units for UCS-2. */
  units: number;
  segments: number;
  /** Characters still free in the last segment. */
  remaining: number;
}

const LIMITS: Record<SmsEncoding, { single: number; multi: number }> = {
  gsm7: { single: 160, multi: 153 },
  ucs2: { single: 70, multi: 67 },
};

/**
 * What this text actually costs to send.
 *
 * Packing is greedy and refuses to split a two-unit character (a GSM-7 escape
 * pair, a UTF-16 surrogate pair) across a segment boundary, because carriers
 * don't either. That is the difference between a correct count and one that is
 * off by a segment on exactly the messages that matter.
 */
export function smsCost(text: string): SmsCost {
  const chars = [...text];
  const gsm7 = chars.every((c) => GSM7_BASIC.has(c) || GSM7_EXTENDED.has(c));
  const encoding: SmsEncoding = gsm7 ? 'gsm7' : 'ucs2';
  const widths = gsm7
    ? chars.map((c) => (GSM7_EXTENDED.has(c) ? 2 : 1))
    : chars.map((c) => (c.codePointAt(0)! > 0xffff ? 2 : 1));

  const units = widths.reduce((a, b) => a + b, 0);
  const { single, multi } = LIMITS[encoding];
  if (units <= single) return { encoding, units, segments: 1, remaining: single - units };

  let segments = 1;
  let used = 0;
  for (const w of widths) {
    if (used + w > multi) {
      segments += 1;
      used = 0;
    }
    used += w;
  }
  return { encoding, units, segments, remaining: multi - used };
}
