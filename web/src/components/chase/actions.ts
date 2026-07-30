import { httpsCallable } from 'firebase/functions';
import type { ChaseChannel, ChaseTone } from '@taxfax/shared';
import { functions } from '@/lib/firebase';

/** Privileged chase writes go through callables — security rules block direct
 *  edits to `client.chase`, so pause/resume/send-now must round-trip a function. */

interface Target {
  firmId: string;
  clientId: string;
}

export interface PreviewResult {
  stepIndex: number;
  tone: ChaseTone;
  channels: ChaseChannel[];
  email: { subject: string; text: string; html: string } | null;
  sms: string | null;
  recipients: {
    emails: string[];
    phones: string[];
    emailSuppressed: boolean;
    smsSuppressed: boolean;
  };
  outstanding: string[];
  outstandingCount: number;
  totalCount: number;
  daysWaiting: number;
  daysToDeadline: number;
}

export type SendNowStatus =
  | 'sent'
  | 'nothing_outstanding'
  | 'blocked_quiet_hours'
  | 'no_reachable_channel';

export interface SendNowResult {
  status: SendNowStatus;
  escalated?: boolean;
  nextSlot?: string;
  emailSuppressed?: boolean;
  smsSuppressed?: boolean;
}

export function previewChase(target: Target & { stepIndex?: number }): Promise<PreviewResult> {
  return httpsCallable<Target & { stepIndex?: number }, PreviewResult>(
    functions,
    'previewChase',
  )(target).then((r) => r.data);
}

export function sendChaseNow(target: Target & { force?: boolean }): Promise<SendNowResult> {
  return httpsCallable<Target & { force?: boolean }, SendNowResult>(
    functions,
    'sendChaseNow',
  )(target).then((r) => r.data);
}

export function pauseChase(target: Target & { reason?: string }): Promise<{ ok: boolean }> {
  return httpsCallable<Target & { reason?: string }, { ok: boolean }>(
    functions,
    'pauseChase',
  )(target).then((r) => r.data);
}

export function resumeChase(target: Target): Promise<{ ok: boolean; nextDueAt: string }> {
  return httpsCallable<Target, { ok: boolean; nextDueAt: string }>(
    functions,
    'resumeChase',
  )(target).then((r) => r.data);
}

export function startChase(target: Target): Promise<{ ok: boolean }> {
  return httpsCallable<Target, { ok: boolean }>(functions, 'startChase')(target).then((r) => r.data);
}

/** Turns a callable rejection into a sentence a preparer can read. */
export function chaseErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = String((err as { message: unknown }).message);
    if (m && !/internal/i.test(m)) return m;
  }
  return 'Something went wrong. Try again in a moment.';
}
