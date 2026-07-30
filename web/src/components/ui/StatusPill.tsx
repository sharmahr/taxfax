import type { ComponentProps } from 'react';
import {
  CLIENT_STAGE_LABEL,
  REQUEST_STATUS_LABEL,
  type ClientStage,
  type RequestStatus,
} from '@taxfax/shared';
import { cn } from '@/lib/cn';

export type StatusTone = 'neutral' | 'info' | 'warn' | 'success' | 'danger';

// Full class strings, not interpolated — Tailwind only sees complete tokens.
const TONE: Record<StatusTone, string> = {
  neutral: 'border-status-neutral/25 bg-status-neutral-wash text-status-neutral',
  info: 'border-status-info/25 bg-status-info-wash text-status-info',
  warn: 'border-status-warn/25 bg-status-warn-wash text-status-warn',
  success: 'border-status-success/25 bg-status-success-wash text-status-success',
  danger: 'border-status-danger/25 bg-status-danger-wash text-status-danger',
};

interface StatusPillProps extends ComponentProps<'span'> {
  tone: StatusTone;
  /** "Done-done" — reads heavier than any in-progress state. */
  solid?: boolean;
  /** Leading dot for fast scanning down a dense column. */
  dot?: boolean;
}

/** The status-pill primitive. Prefer the enum-driven wrappers below in product UI. */
export function StatusPill({
  tone,
  solid = false,
  dot = false,
  className,
  children,
  ...props
}: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2 py-0.5',
        'text-2xs font-medium',
        solid ? 'border-transparent bg-ink text-paper' : TONE[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

const STAGE_TONE: Record<ClientStage, StatusTone> = {
  not_started: 'neutral',
  awaiting: 'info',
  partial: 'warn',
  in_review: 'info',
  blocked: 'danger',
  ready: 'success',
  filed: 'neutral', // rendered solid instead
};

/** The single most-scanned field in the product. `filed` reads as done-done. */
export function ClientStagePill({
  stage,
  className,
  ...props
}: { stage: ClientStage } & ComponentProps<'span'>) {
  return (
    <StatusPill
      tone={STAGE_TONE[stage]}
      solid={stage === 'filed'}
      dot={stage !== 'filed'}
      className={className}
      {...props}
    >
      {CLIENT_STAGE_LABEL[stage]}
    </StatusPill>
  );
}

const REQUEST_TONE: Record<RequestStatus, StatusTone> = {
  pending: 'neutral',
  received: 'info',
  accepted: 'success',
  rejected: 'danger',
  waived: 'neutral',
};

/** One checklist line's status. */
export function RequestStatusPill({
  status,
  className,
  ...props
}: { status: RequestStatus } & ComponentProps<'span'>) {
  return (
    <StatusPill tone={REQUEST_TONE[status]} className={className} {...props}>
      {REQUEST_STATUS_LABEL[status]}
    </StatusPill>
  );
}
