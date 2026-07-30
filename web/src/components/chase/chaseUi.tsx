import { Mail, MessageSquare } from 'lucide-react';
import { TONE_LABEL, type ChaseChannel, type ChaseMessage, type ChaseTone } from '@taxfax/shared';
import { StatusPill, type StatusTone } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { AttentionReason } from './useChaseData';

const TONE_INTENSITY: Record<ChaseTone, number> = { warm: 1, neutral: 2, firm: 3, urgent: 4, final: 5 };

/** An escalation meter in ink — louder means *shorter and more specific*, not coloured. */
export function ToneBadge({ tone, className }: { tone: ChaseTone; className?: string }) {
  const intensity = TONE_INTENSITY[tone];
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="flex items-center gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={cn('h-2.5 w-0.5 rounded-full', n <= intensity ? 'bg-ink' : 'bg-line')} />
        ))}
      </span>
      <span className="text-2xs font-medium text-ink-muted">{TONE_LABEL[tone]}</span>
    </span>
  );
}

export function ChannelIcon({ channel, className }: { channel: ChaseChannel; className?: string }) {
  const Icon = channel === 'email' ? Mail : MessageSquare;
  return <Icon className={cn('size-3.5', className)} aria-hidden />;
}

const ATTENTION_META: Record<AttentionReason, { label: string; tone: StatusTone }> = {
  bounced: { label: 'Email bounced', tone: 'danger' },
  delivery_failed: { label: 'Delivery failed', tone: 'danger' },
  no_channel: { label: 'No way to reach', tone: 'warn' },
  opted_out: { label: 'Opted out', tone: 'warn' },
  escalated: { label: 'Escalated to you', tone: 'warn' },
};

export function AttentionBadge({ reason }: { reason: AttentionReason }) {
  const m = ATTENTION_META[reason];
  return (
    <StatusPill tone={m.tone} dot>
      {m.label}
    </StatusPill>
  );
}

const MESSAGE_STATUS_META: Record<ChaseMessage['status'], { label: string; tone: StatusTone }> = {
  queued: { label: 'Queued', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'info' },
  delivered: { label: 'Delivered', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  skipped: { label: 'Skipped', tone: 'neutral' },
};

export function MessageStatusBadge({ status }: { status: ChaseMessage['status'] }) {
  const m = MESSAGE_STATUS_META[status];
  return <StatusPill tone={m.tone}>{m.label}</StatusPill>;
}
