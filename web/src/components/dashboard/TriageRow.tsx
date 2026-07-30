import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Send } from 'lucide-react';
import { Button, toast } from '@/components/ui';
import { firstName } from '@/lib/format';
import { chaseErrorMessage, sendChaseNow } from '@/components/chase/actions';
import type { TriageItem } from './logic';

const DOT: Record<TriageItem['kind'], string> = {
  blocked: 'bg-status-danger',
  silent: 'bg-status-warn',
  oneAway: 'bg-status-info',
  ready: 'bg-status-success',
};

/** Fires the current chase step by hand and narrates the real outcome. */
function SendNowButton({ firmId, clientId, name }: { firmId: string; clientId: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const who = firstName(name);

  async function run() {
    setBusy(true);
    try {
      const r = await sendChaseNow({ firmId, clientId });
      switch (r.status) {
        case 'sent':
          toast.success(`Reminder sent to ${who}.`, {
            description: r.escalated ? 'Escalated to the next step in the cadence.' : undefined,
          });
          break;
        case 'nothing_outstanding':
          toast.message(`${who} already has everything in.`);
          break;
        case 'blocked_quiet_hours':
          toast.warning(`It's quiet hours for ${who}.`, {
            description: r.nextSlot ? `Next allowed send: ${new Date(r.nextSlot).toLocaleString()}` : undefined,
          });
          break;
        case 'no_reachable_channel':
          toast.error(`No way to reach ${who} right now.`, {
            description: 'Every channel is opted out or missing. Fix their contact details first.',
          });
          break;
      }
    } catch (err) {
      toast.error(chaseErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="secondary" loading={busy} onClick={run}>
      <Send /> Send now
    </Button>
  );
}

interface TriageRowProps {
  item: TriageItem;
  firmId: string;
  rank?: number;
}

export function TriageRow({ item, firmId, rank }: TriageRowProps) {
  const { client, kind, reason, daysWaiting } = item;

  return (
    <li>
      <div className="group/row -mx-2.5 flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-surface-sunken/60">
        {rank != null ? (
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-sunken font-mono text-2xs tabular-nums text-ink-muted">
            {rank}
          </span>
        ) : (
          <span className={`mt-1.5 size-2 shrink-0 self-start rounded-full ${DOT[kind]}`} aria-hidden />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <a
              href={`/clients/${client.id}`}
              className="truncate text-sm font-medium text-ink outline-none hover:underline focus-visible:underline"
            >
              {client.displayName}
            </a>
            {daysWaiting != null && daysWaiting > 0 && (
              <span className="shrink-0 font-mono text-2xs tabular-nums text-ink-faint">{daysWaiting}d</span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[13px] text-ink-muted">{reason}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 transition-opacity duration-100 sm:opacity-0 sm:group-focus-within/row:opacity-100 sm:group-hover/row:opacity-100">
          {kind === 'blocked' && (
            <Button size="sm" variant="secondary" asChild>
              <Link to="/chase" search={{ c: client.id }}>
                Open in chase
              </Link>
            </Button>
          )}
          {(kind === 'silent' || kind === 'oneAway') && (
            <SendNowButton firmId={firmId} clientId={client.id} name={client.displayName} />
          )}
          {kind === 'ready' && (
            <Button size="sm" variant="ghost" asChild>
              <a href={`/clients/${client.id}`}>
                Open <ArrowUpRight />
              </a>
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
