import { format, isBefore } from 'date-fns';
import type { DashboardModel, SeasonClock } from './logic';

/**
 * Out of season the worklist is short by design, and a short worklist is not
 * the same as an empty product. This is the question a firm actually asks in
 * August: of the book we took on, what is still open, and where is it stuck?
 * Every number here is a stage count that already exists on the roster.
 */
export function SeasonStanding({ clock, counts }: { clock: SeasonClock; counts: DashboardModel['counts'] }) {
  const stillCollecting = counts.inMotion + counts.blocked;
  const passThroughDue = new Date(clock.seasonYear, 8, 15);
  const passThroughNote =
    clock.phase === 'extension' &&
    counts.passThroughOpen > 0 &&
    isBefore(clock.today, passThroughDue);

  return (
    <section className="rounded-xl border border-line bg-surface px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-ink">Where season {clock.seasonYear} stands</h2>
        <p className="text-2xs text-ink-faint">
          <span className="tabular-nums">{counts.open}</span> of{' '}
          <span className="tabular-nums">{counts.total}</span> returns still open
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
        <Stat label="Filed" value={counts.filed} muted />
        <Stat label="Ready to prepare" value={counts.ready} />
        <Stat label="In review" value={counts.inReview} />
        <Stat label="Still collecting" value={stillCollecting} />
        <Stat label="No checklist" value={counts.notStarted} />
      </dl>

      {passThroughNote ? (
        <p className="mt-4 border-t border-line pt-3 text-2xs leading-relaxed text-ink-muted">
          <span className="tabular-nums font-medium text-ink">{counts.passThroughOpen}</span>{' '}
          {counts.passThroughOpen === 1 ? 'return is' : 'returns are'} a 1065 or 1120-S — those are due{' '}
          {format(passThroughDue, 'MMM d')}, a month before the individuals.
        </p>
      ) : null}
    </section>
  );
}

function Stat({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <dd className={`display text-2xl tabular-nums ${muted || value === 0 ? 'text-ink-muted' : 'text-ink'}`}>
        {value}
      </dd>
      <dt className="mt-0.5 text-2xs leading-tight text-ink-faint">{label}</dt>
    </div>
  );
}
