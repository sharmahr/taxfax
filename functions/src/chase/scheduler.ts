/**
 * The cadence sweep — the cron that actually moves the chase forward.
 *
 * Every 15 minutes it drains the set of clients whose next message is due,
 * firm by firm, and sends at most one step to each. It is built to page through
 * tens of thousands of clients without holding them in memory, to never send
 * during quiet hours or on weekends, and — above all — to never send twice.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';

import { CHASEABLE_STAGES, groups } from '@taxfax/shared';
import type { Client } from '@taxfax/shared';

import { logActivity } from '../lib/activity.js';
import { db } from '../lib/admin.js';
import {
  ERROR_COOLDOWN_MS,
  type FirmCache,
  buildCopyInput,
  completeChase,
  deferClient,
  dispatchCount,
  escalateClient,
  isSendable,
  loadFirmContext,
  loadOutstanding,
  pauseForBlocked,
  remainingDailyBudget,
  renderStep,
  resolvePreparer,
  resolveRecipients,
  resolveSendTime,
  sendStep,
} from './engine.js';

const PAGE_SIZE = 200;
const MAX_PAGES = 250; // 50k clients/sweep ceiling — a hard stop, not an expectation
const TIME_BUDGET_MS = 500_000; // leave headroom under the 540s timeout
const FIRM_DISABLED_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export const runChaseSweep = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'Etc/UTC',
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '512MiB',
    retryCount: 0, // the next quarter-hour catches up; retries would only pile on
  },
  async () => {
    const startedMs = Date.now();
    const now = new Date();
    const cache: FirmCache = new Map();
    const tally: Record<string, number> = {};

    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    let pages = 0;

    for (; pages < MAX_PAGES; pages++) {
      let q = db
        .collectionGroup(groups.clients)
        .where('chase.status', '==', 'active')
        .where('chase.nextDueAt', '<=', now)
        .orderBy('chase.nextDueAt', 'asc')
        .limit(PAGE_SIZE);
      if (cursor) q = q.startAfter(cursor);

      const snap = await q.get();
      if (snap.empty) break;

      for (const doc of snap.docs) {
        try {
          const outcome = await processDueClient(doc, now, cache);
          tally[outcome] = (tally[outcome] ?? 0) + 1;
        } catch (err) {
          tally.error = (tally.error ?? 0) + 1;
          logger.error('chase sweep: client failed', { path: doc.ref.path, error: (err as Error).message });
          // Don't let one bad client jam the queue — nudge it forward and move on.
          await doc.ref
            .update({ 'chase.nextDueAt': new Date(now.getTime() + ERROR_COOLDOWN_MS) })
            .catch(() => undefined);
        }
      }

      cursor = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGE_SIZE) break;
      if (Date.now() - startedMs > TIME_BUDGET_MS) {
        logger.warn('chase sweep: time budget reached, yielding', { pages, tally });
        break;
      }
    }

    logger.info('chase sweep complete', { pages, durationMs: Date.now() - startedMs, ...tally });
  },
);

async function processDueClient(
  snap: FirebaseFirestore.QueryDocumentSnapshot,
  now: Date,
  cache: FirmCache,
): Promise<string> {
  const client = { id: snap.id, ...(snap.data() as Omit<Client, 'id'>) } as Client;
  const ref = snap.ref;

  const ctx = await loadFirmContext(client.firmId, cache, now);
  if (!ctx) {
    await deferClient(ref, new Date(now.getTime() + FIRM_DISABLED_COOLDOWN_MS));
    return 'no_firm';
  }

  // ── Skip: firm has chase switched off ──
  if (!ctx.settings.enabled) {
    await deferClient(ref, new Date(now.getTime() + FIRM_DISABLED_COOLDOWN_MS));
    return 'firm_disabled';
  }

  // ── Skip: client isn't in a stage we're allowed to chase ──
  if (!CHASEABLE_STAGES.includes(client.stage)) {
    if (client.stage === 'in_review' || client.stage === 'ready' || client.stage === 'filed') {
      await completeChase(ref);
      return 'settled_complete';
    }
    if (client.stage === 'blocked') {
      await pauseForBlocked(ref, 'Client is blocked — a preparer needs to step in.');
      return 'settled_blocked';
    }
    await completeChase(ref); // not_started etc. — shouldn't be active; stop requerying
    return 'settled_other';
  }

  // ── Stop forever: nothing left outstanding ──
  const outstanding = await loadOutstanding(client.firmId, client.id, client.progress?.total);
  if (outstanding.requests.length === 0) {
    await completeChase(ref);
    return 'complete';
  }

  // ── Ran out of profile steps → hand to a human ──
  const stepIndex = client.chase?.stepIndex ?? 0;
  const step = ctx.profile.steps[stepIndex];
  if (!step) {
    await escalateClient(ctx, client, ref, 'exhausted', outstanding.requests);
    return 'escalated_exhausted';
  }

  // ── Quiet hours / weekend → defer to the next decent slot (firm timezone) ──
  if (!isSendable(now, ctx.settings, ctx.tz)) {
    await deferClient(ref, resolveSendTime(now, ctx.settings, ctx.tz));
    return 'quiet_hours';
  }

  // ── No reachable channel (all opted out / missing) → escalate, don't ghost ──
  const recipients = resolveRecipients(client, step, ctx.settings);
  if (dispatchCount(recipients) === 0) {
    await escalateClient(ctx, client, ref, 'unreachable', outstanding.requests);
    return 'escalated_unreachable';
  }

  // ── Send cap: defer into tomorrow's budget rather than blast ──
  if (dispatchCount(recipients) > remainingDailyBudget(ctx)) {
    await deferClient(ref, resolveSendTime(new Date(now.getTime() + 16 * 60 * 60 * 1000), ctx.settings, ctx.tz));
    if (!ctx.capNotified) {
      ctx.capNotified = true;
      logger.warn('chase sweep: firm hit daily send cap', { firmId: ctx.firmId });
    }
    return 'capped';
  }

  const prep = await resolvePreparer(ctx, client.assignedTo);
  const copy = buildCopyInput(ctx, client, outstanding, prep.name, now);
  const rendered = renderStep(step, copy);

  const result = await sendStep({
    ctx,
    clientRef: ref,
    client,
    stepIndex,
    rendered,
    recipients,
    outstanding,
    now,
    requireDue: true,
  });

  if (result.outcome === 'sent') {
    await logActivity(ctx.firmId, {
      clientId: client.id,
      type: 'chase_sent',
      summary: `Sent the “${step.tone}” reminder to ${client.displayName} (${recipients.emails.length ? 'email' : ''}${
        recipients.emails.length && recipients.phones.length ? ' + ' : ''
      }${recipients.phones.length ? 'SMS' : ''}) — ${outstanding.requests.length} still outstanding.`,
      actor: { name: 'TaxFax', kind: 'system' },
      meta: { stepIndex, tone: step.tone, dispatches: result.dispatches, escalated: result.escalated },
    });
    return result.escalated ? 'sent_then_escalated' : 'sent';
  }

  return result.outcome; // already_sent | capped
}
