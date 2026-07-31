/**
 * The firm timezone contract, as the chase engine depends on it.
 *
 *   node --experimental-strip-types --test web/src/lib/timezone.test.ts
 *
 * Deliberately dependency-free so it runs under plain node: no Firebase, no
 * bundler, no browser. The one thing it has to prove is that a firm can never
 * be provisioned into a zone the product does not schedule sends in, whatever
 * clock the person signing up happens to be sitting under.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FALLBACK_TIMEZONE,
  FIRM_TIMEZONES,
  defaultTimezone,
  isFirmTimezone,
  resolveFirmTimezone,
} from './timezone.ts';

/** Zones real people who sign up for a US tax product actually sit in. */
const FOREIGN = [
  'Asia/Calcutta', // the zone the critic saw on a brand-new firm
  'Asia/Kolkata',
  'UTC', // a VPN, a server-rendered kiosk, a locked-down laptop
  'Etc/UTC',
  'Europe/London',
  'Europe/Berlin',
  'Australia/Sydney',
  'America/Sao_Paulo',
  'Not/AZone',
  '',
];

describe('firm timezone', () => {
  it('offers only zones the chase engine can schedule US sends in', () => {
    for (const t of FIRM_TIMEZONES) {
      assert.ok(
        /^(America|Pacific)\//.test(t.value),
        `${t.value} is not a US zone, so quiet hours in it mean nothing here`,
      );
      // Throws for a zone Intl doesn't know — which is how the engine would fail.
      new Intl.DateTimeFormat('en-US', { timeZone: t.value }).format(new Date());
    }
  });

  it('keeps a zone the firm can actually pick', () => {
    for (const t of FIRM_TIMEZONES) {
      assert.equal(resolveFirmTimezone(t.value).timezone, t.value);
      assert.equal(resolveFirmTimezone(t.value).matched, true);
    }
  });

  it('never hands the chase engine a zone outside the offered list', () => {
    // `undefined` is excluded on purpose: it means "ask the browser", and this
    // process's own zone may legitimately be one of the seven.
    for (const zone of [...FOREIGN, null]) {
      const resolved = resolveFirmTimezone(zone);
      assert.ok(
        isFirmTimezone(resolved.timezone),
        `${String(zone)} resolved to ${resolved.timezone}, which is not one of the ${FIRM_TIMEZONES.length} zones a firm can pick`,
      );
      assert.equal(resolved.timezone, FALLBACK_TIMEZONE);
      assert.equal(resolved.matched, false);
    }
  });

  it('reports the browser zone it set aside, so the UI can say so', () => {
    const resolved = resolveFirmTimezone('Asia/Calcutta');
    assert.equal(resolved.browser, 'Asia/Calcutta');
    assert.equal(resolved.matched, false);
  });

  it('defaults to a pickable zone on this machine, whatever TZ says', () => {
    assert.ok(
      isFirmTimezone(defaultTimezone()),
      `defaultTimezone() returned ${defaultTimezone()} under TZ=${process.env.TZ ?? '(system)'}`,
    );
  });

  /**
   * Why the seven-zone constraint is worth having at all.
   *
   * `functions/src/chase/engine.ts` reads the firm's stored zone straight into
   * `isSendable`, whose quiet-hours check is `hourInTimeZone(d, tz)` — the same
   * `Intl` hour reproduced below, deliberately, so this file stays runnable
   * under plain node. A zone from outside the list is not a cosmetic label: it
   * slides the whole 8am–8pm window off the day of the people being chased.
   *
   * The yardstick is Eastern because that is where the fallback puts a firm we
   * had to guess for. It is not a claim about every offered zone — a Honolulu
   * firm legitimately sends at hours that read as night in New York.
   */
  it('stops a guessed zone from putting the send window in the middle of the night', () => {
    const QUIET = { start: 20, end: 8 };
    const hourIn = (d: Date, tz: string) =>
      Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).format(d)) % 24;
    const sendableHoursEastern = (firmTz: string): number[] => {
      const out: number[] = [];
      const wed = Date.UTC(2026, 1, 11);
      for (let h = 0; h < 24; h++) {
        const d = new Date(wed + h * 3_600_000);
        const local = hourIn(d, firmTz);
        if (!(local >= QUIET.start || local < QUIET.end)) out.push(hourIn(d, 'America/New_York'));
      }
      return out;
    };
    const overnight = (hours: number[]) => hours.filter((h) => h >= 0 && h < 6);

    // The bug, stated as a fact about taxpayers rather than about a string: a
    // firm carrying the browser's Mumbai zone may text at 3am Eastern.
    assert.deepEqual(
      overnight(sendableHoursEastern('Asia/Calcutta')),
      [0, 1, 2, 3, 4, 5],
      'the unresolved browser zone should permit six overnight Eastern hours — if it no longer does, this test has stopped testing anything',
    );

    // What we substitute instead does not.
    assert.deepEqual(overnight(sendableHoursEastern(resolveFirmTimezone('Asia/Calcutta').timezone)), []);
  });
});
