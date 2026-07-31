/**
 * Which timezone a firm's reminders are scheduled in.
 *
 * TaxFax chases US taxpayers about US filing deadlines, so the zone attached to
 * a firm is not decoration: `functions/src/chase/engine.ts` evaluates quiet
 * hours and the weekend rule in it. A zone the product does not offer is a
 * zone nobody has reasoned about — a firm whose laptop says `Asia/Calcutta`
 * would have its 8am–9pm window land overnight for the people it is chasing.
 */

/** The zones a firm can choose. US filing product, US zones. */
export const FIRM_TIMEZONES: { value: string; label: string }[] = [
  { value: 'America/New_York', label: 'Eastern — New York' },
  { value: 'America/Chicago', label: 'Central — Chicago' },
  { value: 'America/Denver', label: 'Mountain — Denver' },
  { value: 'America/Phoenix', label: 'Mountain (no DST) — Phoenix' },
  { value: 'America/Los_Angeles', label: 'Pacific — Los Angeles' },
  { value: 'America/Anchorage', label: 'Alaska — Anchorage' },
  { value: 'Pacific/Honolulu', label: 'Hawaii — Honolulu' },
];

export const FALLBACK_TIMEZONE = 'America/New_York';

export function isFirmTimezone(zone: string | null | undefined): boolean {
  return FIRM_TIMEZONES.some((t) => t.value === zone);
}

/** The IANA zone this browser thinks it is in, or null if it won't say. */
export function browserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export interface ResolvedTimezone {
  /** Always one of `FIRM_TIMEZONES` — safe to hand the chase engine. */
  timezone: string;
  /** What the browser claimed, kept so the UI can explain a substitution. */
  browser: string | null;
  /** False when we substituted, i.e. the browser zone was not on offer. */
  matched: boolean;
}

/**
 * Resolves a browser zone to one the firm can actually pick.
 *
 * The browser's zone is a guess about where the *person* is sitting, not about
 * where the firm files. Signing up from London or Mumbai is a real thing a real
 * person does — it is not an error case — so it resolves to the product default
 * rather than being rejected, and `matched: false` is returned so the caller can
 * say "we guessed Eastern; change it if that's wrong" instead of silently
 * scheduling a firm's reminders in a zone nobody chose.
 *
 * There is deliberately no nearest-offset guessing: a wrong-but-plausible zone
 * is harder to notice than an obvious default, and every one of these lands in
 * front of a human on the very next screen.
 */
export function resolveFirmTimezone(
  zone: string | null | undefined = browserTimezone(),
): ResolvedTimezone {
  const browser = zone && zone.length > 0 ? zone : null;
  const matched = isFirmTimezone(browser);
  return {
    timezone: matched ? (browser as string) : FALLBACK_TIMEZONE,
    browser,
    matched,
  };
}

export function defaultTimezone(): string {
  return resolveFirmTimezone().timezone;
}
