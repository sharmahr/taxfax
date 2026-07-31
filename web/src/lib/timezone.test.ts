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
  'UTC', // every GitHub Actions runner
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
});
