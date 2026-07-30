import type { Activity } from '@taxfax/shared';
import { timeAgo } from '@/lib/format';
import type { WithId } from './logic';

const ACTOR_DOT: Record<Activity['actor']['kind'], string> = {
  staff: 'bg-ink',
  client: 'bg-status-info',
  system: 'bg-ink-faint',
};

const ACTOR_LABEL: Record<Activity['actor']['kind'], string> = {
  staff: 'Staff',
  client: 'Client',
  system: 'TaxFax',
};

/** The live rail — what the firm has been doing, newest first. */
export function ActivityRail({ items }: { items: WithId<Activity>[] }) {
  return (
    <div className="lg:sticky lg:top-2">
      <h2 className="label-eyebrow text-ink-faint">Latest activity</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-faint">Nothing yet today.</p>
      ) : (
        <ol className="relative mt-3.5">
          <span className="absolute bottom-2 left-[3.5px] top-2 w-px bg-line" aria-hidden />
          {items.map((a) => (
            <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
              <span
                className={`relative z-10 mt-1 size-2 shrink-0 rounded-full ring-4 ring-paper ${ACTOR_DOT[a.actor.kind]}`}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-pretty text-[13px] leading-snug text-ink">{a.summary}</p>
                <p className="mt-0.5 text-2xs text-ink-faint">
                  <span className="text-ink-muted">{a.actor.kind === 'staff' ? a.actor.name : ACTOR_LABEL[a.actor.kind]}</span>
                  {' · '}
                  {timeAgo(a.at)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
