import { format } from 'date-fns';

interface SeasonHeaderProps {
  firmName: string;
  taxYear: number;
  daysToDeadline: number;
  deadline: Date;
  today: Date;
  headline: string;
}

/** Season-forward banner. The countdown is a sentence, not a KPI tile. */
export function SeasonHeader({ firmName, taxYear, daysToDeadline, deadline, today, headline }: SeasonHeaderProps) {
  return (
    <header className="rule pb-6">
      <p className="label-eyebrow text-ink-faint">
        {firmName} · Filing season {taxYear}
      </p>
      <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="display text-4xl leading-[0.95] text-ink sm:text-[3.25rem]">
            {daysToDeadline} {daysToDeadline === 1 ? 'day' : 'days'}{' '}
            <span className="text-ink-faint">to file.</span>
          </h1>
          <p className="mt-3 max-w-xl text-pretty text-[15px] leading-relaxed text-ink-muted">{headline}</p>
        </div>
        <dl className="flex shrink-0 items-center gap-7 sm:gap-9">
          <div>
            <dt className="label-eyebrow text-ink-faint">Deadline</dt>
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
