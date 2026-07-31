import { httpsCallable } from 'firebase/functions';
import type { ChaseChannel, ChaseTone } from '@taxfax/shared';
import { functions } from '@/lib/firebase';
import { firebaseErrorMessage } from '@/lib/errors';
import { toast } from '@/components/ui/Toast';

/**
 * Typed wrappers over the firm-scoped chase callables (functions/src/chase).
 * These are the real engine: a resolved promise here means a client was
 * actually contacted — or carries a concrete reason one wasn't — never an
 * optimistic toast. Shapes mirror functions/src/chase/lifecycle.ts exactly.
 */

export interface ChaseTarget {
  firmId: string;
  clientId: string;
}

export interface ChasePreview {
  stepIndex: number;
  tone: ChaseTone;
  channels: ChaseChannel[];
  email: { subject: string; text: string; html: string } | null;
  sms: string | null;
  recipients: { emails: string[]; phones: string[]; emailSuppressed: boolean; smsSuppressed: boolean };
  outstanding: string[];
  outstandingCount: number;
  totalCount: number;
  daysWaiting: number;
  daysToDeadline: number;
}

/** sendChaseNow doesn't throw for a business outcome — it reports which one. */
export type ChaseSendResult =
  | { status: 'sent'; escalated?: boolean }
  | { status: 'nothing_outstanding' }
  | { status: 'blocked_quiet_hours'; nextSlot: string }
  | { status: 'no_reachable_channel'; emailSuppressed: boolean; smsSuppressed: boolean }
  | { status: 'already_sent' | 'capped' };

export async function previewChase(input: ChaseTarget & { stepIndex?: number }): Promise<ChasePreview> {
  const callable = httpsCallable<ChaseTarget & { stepIndex?: number }, ChasePreview>(functions, 'previewChase');
  const res = await callable(input);
  return res.data;
}

export async function sendChaseNow(input: ChaseTarget & { force?: boolean }): Promise<ChaseSendResult> {
  const callable = httpsCallable<ChaseTarget & { force?: boolean }, ChaseSendResult>(functions, 'sendChaseNow');
  const res = await callable(input);
  return res.data;
}

export async function startChase(input: ChaseTarget): Promise<{ ok: true }> {
  const callable = httpsCallable<ChaseTarget, { ok: true }>(functions, 'startChase');
  const res = await callable(input);
  return res.data;
}

export async function pauseChase(input: ChaseTarget & { reason?: string }): Promise<{ ok: true }> {
  const callable = httpsCallable<ChaseTarget & { reason?: string }, { ok: true }>(functions, 'pauseChase');
  const res = await callable(input);
  return res.data;
}

export async function resumeChase(input: ChaseTarget): Promise<{ ok: true; nextDueAt: string }> {
  const callable = httpsCallable<ChaseTarget, { ok: true; nextDueAt: string }>(functions, 'resumeChase');
  const res = await callable(input);
  return res.data;
}

// The chase callables reject with a written, client-safe sentence for these
// codes; errors.ts collapses them to a generic line, so we surface the real one
// ("Can’t chase a client that’s “Filed”.", "That client no longer exists.").
const WRITTEN_REASON_CODES = new Set([
  'functions/failed-precondition',
  'functions/invalid-argument',
  'functions/not-found',
  'functions/resource-exhausted',
]);

export function chaseErrorMessage(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
  const message = err instanceof Error ? err.message.trim() : '';
  if (message && WRITTEN_REASON_CODES.has(code)) return message;
  return firebaseErrorMessage(err);
}

/** Toast wrapper for the fire-and-forget mutations (start / pause / resume). */
export async function runChase(work: Promise<unknown>, success: string): Promise<boolean> {
  try {
    await work;
    toast.success(success);
    return true;
  } catch (err) {
    toast.error(chaseErrorMessage(err));
    return false;
  }
}

/** pauseChase has no bulk form, so fan out and tally what actually paused. */
export async function bulkPause(
  firmId: string,
  clientIds: string[],
): Promise<{ paused: number; skipped: number }> {
  const results = await Promise.allSettled(clientIds.map((clientId) => pauseChase({ firmId, clientId })));
  const paused = results.filter((r) => r.status === 'fulfilled').length;
  return { paused, skipped: clientIds.length - paused };
}
