import { format } from 'date-fns';
import type { SeasonClock } from './logic';

interface SeasonHeaderProps {
  firmName: string;
  clock: SeasonClock;
  headline: string;
}

/** The season a CPA would name out loud: the 2025 return is worked in 2026. */
function eyebrowFor(clock: SeasonClock): string {
  switch (clock.phase) {
    case 'filing':
      return `Filing season ${clock.seasonYear}`;
    case 'extension':
      return `Season ${clock.seasonYear} · On extension`;
    case 'preseason':
      return `Season ${clock.seasonYear} opens in January`;
    case 'offseason':
      return 'Between seasons';
  }
}

/**
 * Season-forward banner. The countdown is a sentence, not a KPI tile — and out
 * of season it counts toward the date that is genuinely next (the Oct 15
 * extended due date, then next April) instead of pretending it is February.
 */
export function SeasonHeader({ firmName, clock, headline }: SeasonHeaderProps) {
  const { today, deadline, deadlineLabel, daysToDeadline, phase, seasonYear } = clock;
  const days = `${daysToDeadline} ${daysToDeadline === 1 ? 'day' : 'days'} `;

  return (
    <header className="rule pb-6">
      <p className="label-eyebrow text-ink-faint">
        {firmName} · {eyebrowFor(clock)}
      </p>
      <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="display text-4xl leading-[0.95] text-ink sm:text-[3.25rem]">
            {phase === 'filing' && (
              <>
                {days}
                <span className="text-ink-faint">to file.</span>
              </>
            )}
            {phase === 'extension' && (
              <>
                {days}
                <span className="text-ink-faint">to the extended deadline.</span>
              </>
            )}
            {phase === 'preseason' && (
              <>
                Season {seasonYear} <span className="text-ink-faint">starts in January.</span>
              </>
            )}
            {phase === 'offseason' && (
              <>
                Season {seasonYear} <span className="text-ink-faint">is closed.</span>
              </>
            )}
          </h1>
          <p className="mt-3 max-w-xl text-pretty text-[15px] leading-relaxed text-ink-muted">{headline}</p>
        </div>
        <dl className="flex shrink-0 items-center gap-7 sm:gap-9">
          <div>
            <dt className="label-eyebrow text-ink-faint">{deadlineLabel}</dt>
            <dd className="mt-1 font-mono text-sm tabular-nums text-ink">{format(deadline, 'MMM d, yyyy')}</dd>
          </div>
          <div>
            <dt className="label-eyebrow text-ink-faint">Today</dt>
            <dd className="mt-1 font-mono text-sm tabular-nums text-ink">{format(today, 'EEE, MMM d')}</dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
