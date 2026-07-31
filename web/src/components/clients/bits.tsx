import type { ComponentProps, ReactNode } from 'react';
import {
  Building2,
  Landmark,
  Mail,
  MailWarning,
  MessageSquare,
  MessageSquareOff,
  User,
} from 'lucide-react';
import {
  type ChaseChannel,
  type EntityType,
  type RequestPriority,
  type Timestampish,
} from '@taxfax/shared';
import { cn } from '@/lib/cn';
import { fullDate, timeAgo, toDate } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import type { MemberDoc } from './hooks';

/** Small, shared presentational pieces used across the roster and the detail. */

export function EntityIcon({ type, className }: { type: EntityType; className?: string }) {
  const Icon = type === 'individual' ? User : type === 'trust' ? Landmark : Building2;
  return <Icon className={cn('size-3.5 text-ink-faint', className)} aria-hidden />;
}

/** An accepted-of-total meter that reads down a column at a glance. */
export function ProgressMeter({
  accepted,
  total,
  percent,
  inReview = 0,
  className,
}: {
  accepted: number;
  total: number;
  percent: number;
  inReview?: number;
  className?: string;
}) {
  const done = percent >= 100 && total > 0;
  const label =
    inReview > 0
      ? `${accepted} of ${total} accepted · ${inReview} in review`
      : `${accepted} of ${total} accepted`;
  return (
    <Tooltip content={label}>
      <div className={cn('flex items-center gap-2', className)} data-tabular>
        <div
          className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-sunken"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          <div
            className={cn('h-full rounded-full', done ? 'bg-status-success' : 'bg-ink')}
            style={{ width: `${total ? percent : 0}%` }}
          />
        </div>
        <span className="tabular-nums text-2xs text-ink-muted">
          {accepted}<span className="text-ink-faint">/{total}</span>
        </span>
      </div>
    </Tooltip>
  );
}

/** How long a client has been outstanding — the second question a preparer asks. */
export function WaitingIndicator({
  days,
  overdue,
  className,
}: {
  days: number;
  overdue: number;
  className?: string;
}) {
  if (days <= 0 && overdue === 0)
    return <span className={cn('text-2xs text-ink-faint', className)}>—</span>;
  const tone = overdue > 0 ? 'text-status-danger' : days >= 21 ? 'text-status-warn' : 'text-ink-muted';
  return (
    <div className={cn('flex items-center gap-1.5', className)} data-tabular>
      <span className={cn('tabular-nums text-sm font-medium', tone)}>{days}d</span>
      {overdue > 0 ? (
        <Tooltip content={`${overdue} critical ${overdue === 1 ? 'item is' : 'items are'} past due`}>
          <span className="rounded-sm border border-status-danger/25 bg-status-danger-wash px-1 py-px text-2xs font-medium text-status-danger">
            {overdue} overdue
          </span>
        </Tooltip>
      ) : null}
    </div>
  );
}

/** Deliverability flags — the reason a chase might not be landing. */
export function ContactFlags({
  emailBounced,
  smsOptOut,
  className,
}: {
  emailBounced: boolean;
  smsOptOut: boolean;
  className?: string;
}) {
  if (!emailBounced && !smsOptOut) return null;
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {emailBounced ? (
        <Tooltip content="Email is bouncing — the address needs updating">
          <span className="inline-flex text-status-danger">
            <MailWarning className="size-3.5" aria-label="Email bouncing" />
          </span>
        </Tooltip>
      ) : null}
      {smsOptOut ? (
        <Tooltip content="Opted out of SMS — texts are skipped for this client">
          <span className="inline-flex text-ink-faint">
            <MessageSquareOff className="size-3.5" aria-label="SMS opted out" />
          </span>
        </Tooltip>
      ) : null}
    </span>
  );
}

const TAG_LABEL: Record<string, string> = {
  'high-value': 'High value',
  'needs-attention': 'Watch',
  new: 'New',
  entity: 'Entity',
};

function tagLabel(tag: string): string {
  return TAG_LABEL[tag] ?? tag.replace(/-/g, ' ');
}

export function Tags({ tags, max = 2, className }: { tags: string[]; max?: number; className?: string }) {
  if (!tags?.length) return null;
  const shown = tags.slice(0, max);
  const rest = tags.length - shown.length;
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {shown.map((t) => (
        <Badge key={t} variant={t === 'high-value' ? 'stamp' : 'outline'} className="capitalize">
          {tagLabel(t)}
        </Badge>
      ))}
      {rest > 0 ? <span className="text-2xs text-ink-faint">+{rest}</span> : null}
    </span>
  );
}

export function Assignee({
  member,
  size = 'sm',
  showName = false,
}: {
  member?: MemberDoc;
  size?: ComponentProps<typeof Avatar>['size'];
  showName?: boolean;
}) {
  if (!member)
    return (
      <span className="inline-flex items-center gap-1.5 text-2xs text-ink-faint">
        <span className="grid size-6 place-items-center rounded-full border border-dashed border-line-strong">
          <User className="size-3" />
        </span>
        {showName ? 'Unassigned' : null}
      </span>
    );
  const chip = <Avatar name={member.name} size={size} />;
  return showName ? (
    <span className="inline-flex items-center gap-2">
      {chip}
      <span className="truncate text-sm text-ink">{member.name}</span>
    </span>
  ) : (
    <Tooltip content={member.name}>{chip}</Tooltip>
  );
}

const CHANNEL_META: Record<ChaseChannel, { Icon: typeof Mail; label: string }> = {
  email: { Icon: Mail, label: 'Email' },
  sms: { Icon: MessageSquare, label: 'SMS' },
};

export function ChannelBadges({ channels }: { channels?: ChaseChannel[] }) {
  if (!channels?.length) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {channels.map((c) => {
        const { Icon, label } = CHANNEL_META[c];
        return (
          <span
            key={c}
            className="inline-flex items-center gap-1 rounded-sm border border-line bg-surface-sunken px-1 py-px text-2xs text-ink-muted"
          >
            <Icon className="size-3" aria-hidden />
            {label}
          </span>
        );
      })}
    </span>
  );
}

const PRIORITY_META: Record<RequestPriority, { tone: string; label: string }> = {
  critical: { tone: 'bg-status-danger', label: 'Critical' },
  standard: { tone: 'bg-ink-faint', label: 'Standard' },
  optional: { tone: 'bg-line-strong', label: 'Optional' },
};

export function PriorityDot({ priority }: { priority: RequestPriority }) {
  const { tone, label } = PRIORITY_META[priority];
  return (
    <Tooltip content={`${label} priority`}>
      <span className={cn('inline-block size-1.5 rounded-full', tone)} aria-label={`${label} priority`} />
    </Tooltip>
  );
}

/** A relative time with the absolute date on hover. */
export function RelTime({ at, className }: { at?: Timestampish; className?: string }) {
  if (!at) return <span className={cn('text-ink-faint', className)}>—</span>;
  const d = toDate(at);
  return (
    <Tooltip content={fullDate(d)}>
      <time dateTime={d.toISOString()} className={cn('tabular-nums', className)}>
        {timeAgo(d)}
      </time>
    </Tooltip>
  );
}

/** A quiet metadata row: eyebrow label over a value. */
export function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="label-eyebrow">{label}</div>
      <div className="mt-1 text-ink">{children}</div>
    </div>
  );
}
