import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { collection, orderBy, query } from 'firebase/firestore';
import { AlertTriangle, ArrowUpRight, Clock, Pause, Play, Send, Timer } from 'lucide-react';
import { ROLE_RANK, TONE_LABEL, type ChaseSettings, type FirmRole } from '@taxfax/shared';
import { db } from '@/lib/firebase';
import { useCollection } from '@/lib/firestore';
import { cn } from '@/lib/cn';
import { firstName, fullDate, timeAgo } from '@/lib/format';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  StatusPill,
  Textarea,
  toast,
  Skeleton,
} from '@/components/ui';
import { ChannelIcon, MessageStatusBadge } from './chaseUi';
import { MessagePreview } from './MessagePreview';
import { formatSlot, legalSendSlot } from './sendWindow';
import { chaseErrorMessage, pauseChase, previewChase, resumeChase, sendChaseNow, startChase, type PreviewResult } from './actions';
import type { ChaseMessageDoc, ChaseRow } from './useChaseData';

type Busy = 'send' | 'pause' | 'resume' | 'start' | null;

interface ChaseDetailProps {
  row: ChaseRow;
  firmId: string;
  firmName: string;
  settings: ChaseSettings;
  timezone: string;
  role: FirmRole;
}

export function ChaseDetail({ row, firmId, firmName, settings, timezone, role }: ChaseDetailProps) {
  const clientId = row.client.id;
  const canManage = ROLE_RANK[role] >= ROLE_RANK.preparer;
  const { status } = row;

  const messages = useCollection<ChaseMessageDoc>(
    query(collection(db, `firms/${firmId}/clients/${clientId}/chaseMessages`), orderBy('createdAt', 'desc')),
  );

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewState, setPreviewState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<Busy>(null);

  const wantsPreview = canManage && (status === 'active' || status === 'escalated' || status === 'paused');

  useEffect(() => {
    if (!wantsPreview) return;
    let cancelled = false;
    setPreviewState('loading');
    setPreview(null);
    previewChase({ firmId, clientId })
      .then((p) => {
        if (!cancelled) {
          setPreview(p);
          setPreviewState('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [firmId, clientId, wantsPreview, status, row.stepIndex]);

  async function run(kind: Exclude<Busy, null>, fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
    } catch (err) {
      toast.error(chaseErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const onSend = () =>
    run('send', async () => {
      const r = await sendChaseNow({ firmId, clientId, force: true });
      if (r.status === 'sent') toast.success(`Sent to ${firstName(row.client.displayName)}.${r.escalated ? ' Cadence escalated.' : ''}`);
      else if (r.status === 'nothing_outstanding') toast.message('Nothing to chase — every document is in.');
      else if (r.status === 'no_reachable_channel') toast.error('No reachable channel. Fix the contact details first.');
      else toast.warning('Held by quiet hours.');
    });

  const onResume = () =>
    run('resume', async () => {
      const r = await resumeChase({ firmId, clientId });
      toast.success(`Resumed. Next reminder ${formatSlot(new Date(r.nextDueAt), timezone)}.`);
    });

  const onStart = () =>
    run('start', async () => {
      await startChase({ firmId, clientId });
      toast.success(`Chasing ${firstName(row.client.displayName)}.`);
    });

  const onPause = (reason: string) => run('pause', async () => {
    await pauseChase({ firmId, clientId, reason });
    toast.success('Paused.');
  });

  return (
    <section aria-label={`Chase for ${row.client.displayName}`} className="flex h-full min-h-0 flex-col">
      <DetailHeader row={row} />

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <NextSendBanner row={row} settings={settings} timezone={timezone} />

        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            {(status === 'active' || status === 'paused') && (
              <Button variant="primary" onClick={onSend} loading={busy === 'send'} disabled={busy !== null}>
                <Send /> Send now
              </Button>
            )}
            {status === 'paused' && (
              <Button variant="secondary" onClick={onResume} loading={busy === 'resume'} disabled={busy !== null}>
                <Play /> Resume
              </Button>
            )}
            {status === 'idle' && (
              <Button variant="primary" onClick={onStart} loading={busy === 'start'} disabled={busy !== null}>
                <Send /> Start chasing
              </Button>
            )}
            {(status === 'active' || status === 'escalated') && (
              <>
                <PausePopover onPause={onPause} busy={busy === 'pause'} />
                <SnoozeMenu onSnooze={onPause} disabled={busy !== null} />
              </>
            )}
          </div>
        ) : (
          <p className="rounded-lg border border-line bg-surface-sunken/50 px-3 py-2 text-2xs text-ink-muted">
            You have view-only access. Ask an admin to send or pause chases.
          </p>
        )}

        {wantsPreview && (
          <div>
            <h3 className="label-eyebrow mb-2 text-ink-faint">The next message, exactly as it sends</h3>
            {previewState === 'loading' && <PreviewLoading />}
            {previewState === 'error' && (
              <p className="rounded-lg border border-line bg-surface-sunken/40 px-3 py-3 text-[13px] text-ink-muted">
                Couldn't build the preview. It reappears once the connection is back.
              </p>
            )}
            {previewState === 'ready' && preview && <MessagePreview preview={preview} firmName={firmName} />}
          </div>
        )}

        <DeliveryHistory messages={messages.data} loading={messages.loading} />
      </div>
    </section>
  );
}

function DetailHeader({ row }: { row: ChaseRow }) {
  const c = row.client;
  const email = c.primaryContact.email;
  const phone = c.primaryContact.phone;
  return (
    <header className="border-b border-line px-5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/clients/$clientId" params={{ clientId: c.id }} className="text-sm font-semibold text-ink hover:underline">
            {c.displayName}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs">
            <ContactChip suppressed={row.emailSuppressed} value={email} kind="email" />
            <ContactChip suppressed={row.smsSuppressed} value={phone ?? 'No number'} kind="sms" />
          </div>
        </div>
        <StatusPill tone={STATUS_TONE[row.status]} dot>
          {STATUS_LABEL[row.status]}
        </StatusPill>
      </div>
    </header>
  );
}

const STATUS_LABEL: Record<ChaseRow['status'], string> = {
  idle: 'Not chasing',
  active: 'Active',
  paused: 'Paused',
  escalated: 'Escalated',
  complete: 'Complete',
};
const STATUS_TONE = {
  idle: 'neutral',
  active: 'info',
  paused: 'neutral',
  escalated: 'danger',
  complete: 'success',
} as const;

function ContactChip({ value, kind, suppressed }: { value: string; kind: 'email' | 'sms'; suppressed: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1', suppressed ? 'text-status-danger' : 'text-ink-muted')}>
      <ChannelIcon channel={kind} />
      <span className="ticket truncate">{value}</span>
      {suppressed && <span className="text-2xs">· suppressed</span>}
    </span>
  );
}

function NextSendBanner({ row, settings, timezone }: { row: ChaseRow; settings: ChaseSettings; timezone: string }) {
  if (row.status === 'escalated') {
    return (
      <Banner tone="danger" icon={AlertTriangle}>
        <p className="font-medium">Cadence exhausted — this one needs you.</p>
        <p className="text-ink-muted">
          The engine stopped after the final step.{' '}
          <Link to="/clients/$clientId" params={{ clientId: row.client.id }} className="inline-flex items-center gap-0.5 text-ink hover:underline">
            Open the file <ArrowUpRight className="size-3" />
          </Link>
        </p>
      </Banner>
    );
  }
  if (row.status === 'paused') {
    return (
      <Banner tone="neutral" icon={Pause}>
        <p className="font-medium">Chasing is paused.</p>
        {row.client.chase.pausedReason && <p className="text-ink-muted">{row.client.chase.pausedReason}</p>}
      </Banner>
    );
  }
  if (row.status === 'complete') {
    return (
      <Banner tone="success" icon={Clock}>
        <p className="font-medium">Every requested document is in.</p>
      </Banner>
    );
  }
  if (row.status === 'active' && row.nextDueAt) {
    const slot = legalSendSlot(row.nextDueAt, settings, timezone);
    return (
      <Banner tone="info" icon={Timer}>
        <p className="font-medium text-ink">Next reminder · {formatSlot(slot.at, timezone)}</p>
        <p className="text-ink-muted">
          {slot.shifted
            ? `Held out of ${slot.reason === 'weekend' ? 'the weekend' : 'quiet hours'} — sends at the next allowed moment in the client's timezone.`
            : `Inside business hours, ${timezone.replace('_', ' ')}.`}
        </p>
      </Banner>
    );
  }
  return (
    <Banner tone="neutral" icon={Clock}>
      <p className="font-medium">Not being chased yet.</p>
    </Banner>
  );
}

function Banner({ tone, icon: Icon, children }: { tone: 'info' | 'danger' | 'success' | 'neutral'; icon: typeof Clock; children: React.ReactNode }) {
  const tones = {
    info: 'border-status-info/25 bg-status-info-wash',
    danger: 'border-status-danger/25 bg-status-danger-wash',
    success: 'border-status-success/25 bg-status-success-wash',
    neutral: 'border-line bg-surface-sunken/50',
  } as const;
  const iconTone = {
    info: 'text-status-info',
    danger: 'text-status-danger',
    success: 'text-status-success',
    neutral: 'text-ink-faint',
  } as const;
  return (
    <div className={cn('flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px]', tones[tone])}>
      <Icon className={cn('mt-px size-4 shrink-0', iconTone[tone])} />
      <div className="min-w-0 space-y-0.5">{children}</div>
    </div>
  );
}

function PausePopover({ onPause, busy }: { onPause: (reason: string) => void; busy: boolean }) {
  const [reason, setReason] = useState('');
  const presets = ['Waiting on a third party', 'Client asked us to hold', 'Bad contact info'];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" loading={busy}>
          <Pause /> Pause
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-2.5">
        <p className="text-2xs font-medium text-ink">Why pause? This shows in the client's history.</p>
        <Textarea
          autoFocus
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional reason…"
          className="resize-none text-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setReason(p)}
              className="rounded-md border border-line bg-surface px-2 py-1 text-2xs text-ink-muted hover:border-line-strong hover:text-ink"
            >
              {p}
            </button>
          ))}
        </div>
        <PopoverClose asChild>
          <Button variant="primary" size="sm" className="w-full" onClick={() => onPause(reason.trim() || 'Paused by a preparer.')}>
            Pause chasing
          </Button>
        </PopoverClose>
      </PopoverContent>
    </Popover>
  );
}

function SnoozeMenu({ onSnooze, disabled }: { onSnooze: (reason: string) => void; disabled: boolean }) {
  const options = [
    { label: '3 days', days: 3 },
    { label: '1 week', days: 7 },
    { label: '2 weeks', days: 14 },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" disabled={disabled}>
          <Timer /> Snooze
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {options.map((o) => {
          const until = new Date(Date.now() + o.days * 86400000);
          return (
            <DropdownMenuItem key={o.label} onSelect={() => onSnooze(`Snoozed until ${fullDate(until)}`)}>
              <span>{o.label}</span>
              <span className="ml-auto text-2xs text-ink-faint">{fullDate(until)}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeliveryHistory({ messages, loading }: { messages: ChaseMessageDoc[]; loading: boolean }) {
  return (
    <div>
      <h3 className="label-eyebrow mb-2 text-ink-faint">Delivery history</h3>
      {loading && messages.length === 0 ? (
        <p className="text-[13px] text-ink-faint">Loading…</p>
      ) : messages.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[13px] text-ink-muted">
          No messages sent yet.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {messages.map((m) => (
            <li key={m.id} className="rounded-lg border border-line px-3 py-2.5">
              <div className="flex items-center gap-2">
                <ChannelIcon channel={m.channel} className="text-ink-faint" />
                <span className="text-2xs font-medium text-ink">{TONE_LABEL[m.tone]}</span>
                <MessageStatusBadge status={m.status} />
                <time className="ml-auto shrink-0 text-2xs text-ink-faint">{timeAgo(m.createdAt)}</time>
              </div>
              <p className="ticket mt-1 truncate text-ink-muted">{m.to}</p>
              {m.status === 'failed' && m.error && (
                <p className="mt-1 flex items-center gap-1 text-2xs text-status-danger">
                  <AlertTriangle className="size-3 shrink-0" /> {m.error}
                </p>
              )}
              {m.status === 'skipped' && m.skipReason && <p className="mt-1 text-2xs text-ink-faint">Skipped · {m.skipReason}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PreviewLoading() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
