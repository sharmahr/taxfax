import type { Activity, ActivityType } from '@taxfax/shared';
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

/**
 * How a run of identical events reads once it is a single line. The chase engine
 * sends on a cadence, so a firm's feed is mostly reminders — eight rows of
 * "Reminder 3 sent to …" is eight rows saying one thing, and it buries the
 * upload and the bounce that were worth reading.
 */
const ROLLUP_VERB: Partial<Record<ActivityType, (n: number) => string>> = {
  chase_sent: (n) => `${n} reminders sent`,
  document_uploaded: (n) => `${n} documents uploaded`,
  document_accepted: (n) => `${n} documents accepted`,
  document_classified: (n) => `${n} documents filed automatically`,
  client_viewed_portal: (n) => `${n} clients opened their portal`,
  checklist_sent: (n) => `${n} checklists sent`,
  checklist_generated: (n) => `${n} checklists built`,
  client_imported: (n) => `${n} clients imported`,
};

/** A run of same-type events is only worth collapsing once it crowds the rail. */
const ROLLUP_AT = 3;

interface Entry {
  key: string;
  text: string;
  who: string;
  kind: Activity['actor']['kind'];
  at: Activity['at'];
}

/** Names carry the information a bare count would throw away. */
function nameList(names: string[]): string {
  if (names.length === 0) return '';
  const shown = names.slice(0, 2);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} and ${rest} ${rest === 1 ? 'other' : 'others'}`;
  return shown.length === 2 ? `${shown[0]} and ${shown[1]}` : shown[0];
}

function collapse(items: WithId<Activity>[], clientName: (id: string) => string | undefined): Entry[] {
  const entry = (a: WithId<Activity>, text: string): Entry => ({
    key: a.id,
    text,
    who: a.actor.kind === 'staff' ? a.actor.name : ACTOR_LABEL[a.actor.kind],
    kind: a.actor.kind,
    at: a.at,
  });

  const out: Entry[] = [];
  for (let i = 0; i < items.length; ) {
    const head = items[i];
    let j = i + 1;
    while (j < items.length && items[j].type === head.type) j++;
    const run = items.slice(i, j);
    const verb = ROLLUP_VERB[head.type];

    if (run.length >= ROLLUP_AT && verb) {
      const names = run
        .map((a) => (a.clientId ? clientName(a.clientId) : undefined))
        .filter((n): n is string => Boolean(n));
      const unique = [...new Set(names)];
      out.push(entry(head, unique.length > 0 ? `${verb(run.length)} — ${nameList(unique)}` : verb(run.length)));
    } else {
      for (const a of run) out.push(entry(a, a.summary));
    }
    i = j;
  }
  return out;
}

interface ActivityRailProps {
  items: WithId<Activity>[];
  /** Resolves a client id to the name a preparer knows them by. */
  clientName?: (id: string) => string | undefined;
  limit?: number;
}

/** The live rail — what the firm has been doing, newest first. */
export function ActivityRail({ items, clientName = () => undefined, limit = 10 }: ActivityRailProps) {
  const entries = collapse(items, clientName).slice(0, limit);

  return (
    <div className="lg:sticky lg:top-2">
      <h2 className="label-eyebrow text-ink-faint">Latest activity</h2>
      {entries.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-faint">Nothing yet today.</p>
      ) : (
        <ol className="relative mt-3.5">
          <span className="absolute bottom-2 left-[3.5px] top-2 w-px bg-line" aria-hidden />
          {entries.map((e) => (
            <li key={e.key} className="relative flex gap-3 pb-4 last:pb-0">
              <span
                className={`relative z-10 mt-1 size-2 shrink-0 rounded-full ring-4 ring-paper ${ACTOR_DOT[e.kind]}`}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-pretty text-[13px] leading-snug text-ink">{e.text}</p>
                <p className="mt-0.5 text-2xs text-ink-faint">
                  <span className="text-ink-muted">{e.who}</span>
                  {' · '}
                  {timeAgo(e.at)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
