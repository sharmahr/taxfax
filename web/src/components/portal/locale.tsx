import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_LOCALE,
  effectiveLocale,
  isLocaleId,
  localeRecord,
  LOCALE_IDS,
  multilingualEnabled,
  t as translate,
  type ClientLanguage,
  type Direction,
  type Firm,
  type LocaleId,
  type StringKey,
  type Vars,
} from '@taxfax/shared';
import { setPortalLanguage } from './portalApi';

/**
 * The portal's whole i18n surface. A taxpayer who was chased in Spanish must not
 * land on an English page — so the list, the progress and the status of every
 * request render in their language, resolved in this order:
 *
 *   1. A choice they just made on the portal (this session).
 *   2. `Client.language`, which we already know: it was lifted off last year's
 *      Schedule LEP election, or a preparer set it. No competitor knows this.
 *   3. The browser's `Accept-Language`, mapped to a language we can write.
 *   4. English.
 *
 * A deliberate choice (1) is also persisted to the client doc with
 * `source: 'taxpayer'`, so it outranks detection and the *next* chase email
 * switches too — a switcher that only changed this page would be a bug.
 */
interface PortalLocaleValue {
  locale: LocaleId;
  dir: Direction;
  /** BCP-47 tag for the `lang` attribute. */
  lang: string;
  /** Interpolating lookup, bound to the active locale. */
  t: (key: StringKey, vars?: Vars) => string;
  /** A deliberate taxpayer choice: switch now, and persist so their mail follows. */
  setLocale: (id: LocaleId) => void;
  /** Feed the known client language once the client doc has loaded. */
  syncClientLanguage: (
    language: ClientLanguage | undefined,
    firm: Pick<Firm, 'multilingual'> | undefined,
  ) => void;
}

const PortalLocaleContext = createContext<PortalLocaleValue | null>(null);

/** Map a browser tag like `es-MX` or `zh-TW` onto a locale we actually ship. */
function mapBrowserTag(tag: string): LocaleId | null {
  if (isLocaleId(tag)) return tag;
  const lower = tag.toLowerCase();
  if (lower.startsWith('zh')) {
    return /hant|tw|hk|mo/.test(lower) ? 'zh-Hant' : 'zh-Hans';
  }
  const base = lower.split('-')[0]!;
  const direct = LOCALE_IDS.find((id) => id.toLowerCase() === base);
  if (direct) return direct;
  if (base === 'fil') return 'tl';
  return null;
}

function browserLocale(): LocaleId {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of tags) {
    const hit = tag ? mapBrowserTag(tag) : null;
    if (hit) return hit;
  }
  return DEFAULT_LOCALE;
}

export function PortalLocaleProvider({ children }: { children: ReactNode }) {
  // A choice made this session — highest precedence, and optimistic so the UI
  // switches the instant they pick, without waiting on the round-trip.
  const [override, setOverride] = useState<LocaleId | null>(null);
  // Resolved from `Client.language` once the client doc arrives.
  const [detected, setDetected] = useState<LocaleId | null>(null);
  const browser = useMemo(browserLocale, []);

  const locale = override ?? detected ?? browser;
  const record = localeRecord(locale);

  const setLocale = useCallback((id: LocaleId) => {
    setOverride(id);
    // Persist so the next chase email switches too. Best-effort: the optimistic
    // switch already happened, and on reload the persisted `Client.language`
    // drives the same result, so a dropped connection here is not fatal.
    void setPortalLanguage(id).catch(() => {});
  }, []);

  const syncClientLanguage = useCallback<PortalLocaleValue['syncClientLanguage']>(
    (language, firm) => {
      const next = effectiveLocale(language, multilingualEnabled(firm));
      setDetected((prev) => (prev === next ? prev : next));
    },
    [],
  );

  const value = useMemo<PortalLocaleValue>(
    () => ({
      locale,
      dir: record.dir,
      lang: record.bcp47,
      t: (key, vars) => translate(locale, key, vars ?? {}),
      setLocale,
      syncClientLanguage,
    }),
    [locale, record.dir, record.bcp47, setLocale, syncClientLanguage],
  );

  return <PortalLocaleContext.Provider value={value}>{children}</PortalLocaleContext.Provider>;
}

export function usePortalLocale(): PortalLocaleValue {
  const ctx = useContext(PortalLocaleContext);
  if (!ctx) throw new Error('usePortalLocale must be used within <PortalLocaleProvider>');
  return ctx;
}
