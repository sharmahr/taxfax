/**
 * D3 guard — the dashboard must never state a date that is not today, and the
 * header and the worklist must read the same clock.
 *
 * The failure this exists to catch was live on 31 July 2026: the header said
 * "62 days to file · TODAY Thu, Feb 12" while the worklist beside it aged
 * clients from the real date. Two facts on one screen that cannot both be true.
 *
 * Run from `web/`:
 *   node --experimental-strip-types src/components/dashboard/clock.check.ts
 *
 * It renders the real SeasonHeader through Vite (so the aliases and JSX resolve
 * exactly as the app does), reads the date off the rendered markup, and compares
 * it with the date the worklist ages imply.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { addDays, format, subDays } from 'date-fns';
import { createServer } from 'vite';
import type { ClientDoc, RequestDoc } from './logic.ts';

const TAX_YEAR = 2025; // the 2025 return, filed in the 2026 season
const WAITING_DAYS = 38;
const DATE_RE = /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), [A-Z][a-z]{2} \d{1,2}/;

const root = fileURLToPath(new URL('../../..', import.meta.url));

function client(daysWaiting: number, now: Date): ClientDoc {
  const startedAt = subDays(now, daysWaiting);
  return {
    id: 'isaiah-bergen',
    firmId: 'whitfield-rowe',
    taxYear: TAX_YEAR,
    displayName: 'Isaiah Bergen',
    sortName: 'Bergen, Isaiah',
    entityType: 'individual',
    filingStatus: 'mfj',
    primaryContact: { name: 'Isaiah Bergen', email: 'isaiah.bergen@gmail.com', phone: '+15125550118' },
    tags: [],
    stage: 'partial',
    progress: { total: 6, received: 1, accepted: 1, rejected: 0, overdue: 0, percent: 17, firstRequestedAt: startedAt },
    chase: { status: 'active', stepIndex: 4, startedAt, sentCount: 5 },
    createdAt: startedAt,
    updatedAt: now,
  } as ClientDoc;
}

const requests: RequestDoc[] = [];

async function main(): Promise<void> {
  const server = await createServer({
    root,
    configFile: `${root}/vite.config.ts`,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  });

  const failures: string[] = [];
  const fail = (msg: string) => failures.push(msg);
  const check = (label: string, fn: () => void) => {
    try {
      fn();
      console.log(`  ok   ${label}`);
    } catch (err) {
      console.log(`  FAIL ${label}`);
      console.log(`       ${(err as Error).message.split('\n')[0]}`);
      fail(label);
    }
  };

  try {
    const logic = (await server.ssrLoadModule('/src/components/dashboard/logic.ts')) as typeof import('./logic.ts');
    const header = (await server.ssrLoadModule(
      '/src/components/dashboard/SeasonHeader.tsx',
    )) as typeof import('./SeasonHeader.tsx');

    /** Renders the real header for a clock and returns the date it puts on screen. */
    const renderedDate = (clock: Record<string, unknown>): string => {
      const props = { firmName: 'Whitfield & Rowe', taxYear: TAX_YEAR, headline: 'Someone needs a person.', clock, ...clock };
      const html = renderToStaticMarkup(createElement(header.SeasonHeader as never, props as never));
      const match = DATE_RE.exec(html.replace(/<[^>]+>/g, ' '));
      assert.ok(match, `the header rendered no date at all:\n${html}`);
      return match[0];
    };

    // ── 1. Out of season, the clock is the real clock ────────────────────────
    console.log('out of season (31 Jul 2026):');
    const july = new Date(2026, 6, 31, 9, 0, 0);
    check('seasonClock does not fabricate a date', () => {
      const { today } = logic.seasonClock(TAX_YEAR, july);
      assert.equal(
        format(today, 'yyyy-MM-dd'),
        format(july, 'yyyy-MM-dd'),
        `the dashboard clock reads ${format(today, 'EEE, MMM d yyyy')} when the real date is ${format(july, 'EEE, MMM d yyyy')}`,
      );
    });

    check('the header shows the real date', () => {
      const clock = logic.seasonClock(TAX_YEAR, july) as unknown as Record<string, unknown>;
      assert.equal(renderedDate(clock), format(july, 'EEE, MMM d'));
    });

    // ── 2. Header and worklist agree — the whole point ───────────────────────
    // Production wiring: the worklist ages come from the real clock. If the
    // header is anchored anywhere else, the same screen states two dates.
    check('the header date equals the date the worklist ages are measured from', () => {
      const now = new Date();
      const headerDate = renderedDate(logic.seasonClock(TAX_YEAR) as unknown as Record<string, unknown>);
      const model = logic.deriveDashboard([client(WAITING_DAYS, now)], requests, [], now);
      const item = [...model.needsYouNow, ...model.oneDocAway, ...model.silent][0];
      assert.ok(item, 'the fixture client fell off the worklist — the check can no longer compare ages');
      assert.equal(item.daysWaiting, WAITING_DAYS);
      const worklistDate = format(addDays(item.client.chase.startedAt as Date, item.daysWaiting ?? 0), 'EEE, MMM d');
      assert.equal(
        headerDate,
        worklistDate,
        `the header says ${headerDate} while "${item.daysWaiting}d outstanding" is measured from ${worklistDate}`,
      );
    });

    // ── 3. One clock, one call site ──────────────────────────────────────────
    check('the route does not mint a second clock for the worklist', () => {
      const src = readFileSync(`${root}/src/routes/_app/dashboard.tsx`, 'utf8');
      const call = /deriveDashboard\([\s\S]*?\)/.exec(src);
      assert.ok(call, 'the dashboard route no longer calls deriveDashboard');
      assert.ok(
        !/new Date\(\)/.test(call[0]),
        `the route passes a fresh clock to the worklist instead of the header's: ${call[0].replace(/\s+/g, ' ')}`,
      );
    });

    // ── 4. In season, nothing changes ────────────────────────────────────────
    console.log('in season (12 Feb 2026):');
    const feb = new Date(2026, 1, 12, 9, 0, 0);
    check('the countdown and the date are the real ones', () => {
      const clock = logic.seasonClock(TAX_YEAR, feb);
      assert.equal(format(clock.today, 'yyyy-MM-dd'), '2026-02-12');
      assert.equal(clock.daysToDeadline, 62);
      assert.equal(renderedDate(clock as unknown as Record<string, unknown>), 'Thu, Feb 12');
    });
  } finally {
    await server.close();
  }

  console.log('');
  if (failures.length > 0) {
    console.log(`${failures.length} check(s) failed:`);
    for (const f of failures) console.log(`  · ${f}`);
    process.exitCode = 1;
    return;
  }
  console.log('all clock checks passed');
}

await main();
