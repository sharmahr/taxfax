import type { ComponentType } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Eye,
  FileCheck2,
  ListChecks,
  MailWarning,
  Send,
} from 'lucide-react';
import { CHASE_PROFILES, type StoredDocument } from '@taxfax/shared';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { ChannelBadges, RelTime } from '../bits';
import {
  CHASE_HEALTH_TONE,
  buildTimeline,
  type ChaseSummary,
  type ClientDoc,
  type TimelineEntry,
  type TimelineKind,
} from '../model';
import type { StatusTone } from '@/components/ui/StatusPill';

type Doc = StoredDocument & { id: string };

const KIND_META: Record<TimelineKind, { Icon: ComponentType<{ className?: string }>; tone: StatusTone }> = {
  generated: { Icon: ListChecks, tone: 'neutral' },
  reminder: { Icon: Send, tone: 'info' },
  opened: { Icon: Eye, tone: 'warn' },
  received: { Icon: FileCheck2, tone: 'success' },
  bounced: { Icon: MailWarning, tone: 'danger' },
  escalated: { Icon: AlertTriangle, tone: 'danger' },
  scheduled: { Icon: CalendarClock, tone: 'neutral' },
};

const TONE_ICON: Record<StatusTone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted',
  info: 'bg-status-info-wash text-status-info',
  warn: 'bg-status-warn-wash text-status-warn',
  success: 'bg-status-success-wash text-status-success',
  danger: 'bg-status-danger-wash text-status-danger',
};

interface ChasePanelProps {
  client: ClientDoc;
  chase: ChaseSummary;
  documents: Doc[];
  profileId: string;
  chaseable: boolean;
  busy: boolean;
  onStart: () => void;
  onSendChase: () => void;
  onPause: () => void;
  onResume: () => void;
}

export function ChasePanel({
  client,
  chase,
  documents,
  profileId,
  chaseable,
  busy,
  onStart,
  onSendChase,
  onPause,
  onResume,
}: ChasePanelProps) {
  const timeline = buildTimeline(client, documents, profileId);
  const profile = CHASE_PROFILES[profileId as keyof typeof CHASE_PROFILES] ?? CHASE_PROFILES.standard;
  const status = client.chase?.status;

  return (
    <section aria-label="Chase history" className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="border-b border-line p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Chase</h2>
          <StatusPill tone={CHASE_HEALTH_TONE[chase.health]} dot>
            {chase.line}
          </StatusPill>
        </div>
        <p className="mt-2 text-2xs text-ink-muted">
          <span className="font-medium text-ink-muted">{profile.label}</span> cadence
          {chase.sentCount > 0 ? ` · ${chase.sentCount} sent` : ''}
          {chase.nextDueAt ? (
            <>
              {' · next '}
              <RelTime at={chase.nextDueAt} />
            </>
          ) : null}
        </p>
        {chase.pausedReason ? (
          <p className="mt-2 rounded-lg border border-status-danger/20 bg-status-danger-wash px-2.5 py-1.5 text-2xs text-status-danger">
            {chase.pausedReason}
          </p>
        ) : null}

        {chaseable ? (
          <div className="mt-3 flex items-center gap-2">
            {status === 'idle' ? (
              <Button size="sm" variant="primary" className="flex-1" onClick={onStart} disabled={busy}>
                <Send className="size-3.5" />
                Start chasing
              </Button>
            ) : (
              <>
                <Button size="sm" variant="primary" className="flex-1" onClick={onSendChase} disabled={busy}>
                  <Send className="size-3.5" />
                  Send chase now
                </Button>
                {status === 'paused' ? (
                  <Button size="sm" variant="secondary" onClick={onResume} disabled={busy}>
                    Resume
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={onPause} disabled={busy}>
                    Snooze
                  </Button>
                )}
              </>
            )}
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-2xs text-status-success">
            <Check className="size-3.5" /> Collection complete — chasing stopped.
          </p>
        )}
      </div>

      {timeline.length > 0 ? (
        <ol className="p-4">
          {timeline.map((e, i) => (
            <TimelineRow key={e.id} entry={e} last={i === timeline.length - 1} />
          ))}
        </ol>
      ) : (
        <p className="p-4 text-2xs text-ink-faint">Nothing sent yet — the checklist hasn’t gone out.</p>
      )}
    </section>
  );
}

function TimelineRow({ entry, last }: { entry: TimelineEntry; last: boolean }) {
  const { Icon, tone } = KIND_META[entry.kind];
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last ? <span className="absolute left-3 top-7 bottom-0 w-px bg-line" aria-hidden /> : null}
      <span
        className={cn(
          'relative z-10 grid size-6 shrink-0 place-items-center rounded-full',
          TONE_ICON[tone],
          entry.future && 'border border-dashed border-line-strong bg-surface text-ink-faint',
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 -mt-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn('text-xs font-medium', entry.future ? 'text-ink-muted' : 'text-ink')}>
            {entry.title}
          </p>
          <span className="shrink-0 text-2xs text-ink-faint">
            {entry.future ? <span className="italic">scheduled </span> : null}
            <RelTime at={entry.at} className="text-ink-faint" />
          </span>
        </div>
        {entry.detail ? <p className="mt-0.5 text-2xs text-ink-muted">{entry.detail}</p> : null}
        {entry.channels || entry.toneLabel ? (
          <div className="mt-1 flex items-center gap-1.5">
            <ChannelBadges channels={entry.channels} />
            {entry.toneLabel ? <span className="text-2xs text-ink-faint">{entry.toneLabel} tone</span> : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
