/**
 * Progress rollups. The roster shows one number per client — percent complete —
 * and a stage in the collection funnel. Both are denormalised onto the client
 * doc by these triggers so the roster is a single read per client, never a fan
 * out across every request.
 */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import type { WithFieldValue } from 'firebase-admin/firestore';
import {
  groups,
  paths,
  type Client,
  type ClientProgress,
  type ClientStage,
  type DocRequest,
  type Timestampish,
} from '@taxfax/shared';
import { FieldValue, Timestamp, db } from '../lib/admin.js';
import { triggerOptions } from '../lib/options.js';

function toMillis(ts: Timestampish | undefined): number | undefined {
  if (ts == null) return undefined;
  if (typeof ts === 'number') return ts;
  if (ts instanceof Date) return ts.getTime();
  const maybe = ts as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
  if (typeof maybe.toMillis === 'function') return maybe.toMillis();
  if (typeof maybe.seconds === 'number') {
    return maybe.seconds * 1000 + Math.floor((maybe.nanoseconds ?? 0) / 1e6);
  }
  return undefined;
}

interface Counts {
  all: number;
  activeTotal: number;
  accepted: number;
  received: number;
  rejected: number;
  pending: number;
  overdue: number;
  percent: number;
}

function tally(requests: DocRequest[], nowMs: number): Counts {
  let waived = 0;
  let accepted = 0;
  let received = 0;
  let rejected = 0;
  let pending = 0;
  let overdue = 0;

  for (const r of requests) {
    switch (r.status) {
      case 'waived':
        waived += 1;
        break;
      case 'accepted':
        accepted += 1;
        break;
      case 'received':
        received += 1;
        break;
      case 'rejected':
        rejected += 1;
        break;
      default: {
        pending += 1;
        const due = toMillis(r.dueDate);
        if (due !== undefined && due < nowMs) overdue += 1;
      }
    }
  }

  const all = requests.length;
  const activeTotal = all - waived;
  const percent = all === 0 ? 0 : activeTotal === 0 ? 100 : Math.round((accepted / activeTotal) * 100);
  return { all, activeTotal, accepted, received, rejected, pending, overdue, percent };
}

/**
 * The collection funnel. `blocked` and `filed` are set by humans and never
 * overwritten here. Waived items don't count against completion, so a client
 * whose remaining items are all waived reads as ready.
 */
function deriveStage(current: ClientStage, c: Counts): ClientStage {
  if (current === 'filed' || current === 'blocked') return current;
  if (c.all === 0) return 'not_started';
  if (c.activeTotal === 0 || c.accepted === c.activeTotal) return 'ready';
  if (c.pending === 0 && c.rejected === 0) return 'in_review';
  if (c.received > 0 || c.accepted > 0 || c.rejected > 0) return 'partial';
  return 'awaiting';
}

/** True when the roster-visible numbers are unchanged, so we can skip the write. */
function unchanged(prev: ClientProgress | undefined, c: Counts, prevStage: ClientStage, stage: ClientStage): boolean {
  return (
    !!prev &&
    prev.total === c.activeTotal &&
    prev.received === c.received &&
    prev.accepted === c.accepted &&
    prev.rejected === c.rejected &&
    prev.overdue === c.overdue &&
    prev.percent === c.percent &&
    prevStage === stage
  );
}

/**
 * Recomputes a client's progress and stage from a single aggregate read of its
 * requests, and writes only when something the roster shows actually changed —
 * which collapses the burst of writes from materialising a whole checklist into
 * one client update.
 */
export async function recomputeProgress(firmId: string, clientId: string): Promise<void> {
  const clientRef = db.doc(paths.client(firmId, clientId));
  const requestsRef = db.collection(paths.requests(firmId, clientId));

  await db.runTransaction(async (tx) => {
    const clientSnap = await tx.get(clientRef);
    if (!clientSnap.exists) return;
    const client = clientSnap.data() as Client;

    const requestsSnap = await tx.get(requestsRef);
    const requests = requestsSnap.docs.map((d) => d.data() as DocRequest);

    const counts = tally(requests, Date.now());
    const stage = deriveStage(client.stage, counts);
    if (unchanged(client.progress, counts, client.stage, stage)) return;

    const progress: WithFieldValue<ClientProgress> = {
      total: counts.activeTotal,
      received: counts.received,
      accepted: counts.accepted,
      rejected: counts.rejected,
      overdue: counts.overdue,
      percent: counts.percent,
      lastActivityAt: FieldValue.serverTimestamp(),
      firstRequestedAt:
        client.progress?.firstRequestedAt ?? (counts.all > 0 ? FieldValue.serverTimestamp() : undefined),
      completedAt: stage === 'ready' ? client.progress?.completedAt ?? FieldValue.serverTimestamp() : undefined,
    };

    tx.update(clientRef, { progress, stage, updatedAt: FieldValue.serverTimestamp() });
  });
}

/** Keep progress and stage current as requests are created, filled, and reviewed. */
export const onRequestWritten = onDocumentWritten(
  { ...triggerOptions, document: 'firms/{firmId}/clients/{clientId}/requests/{requestId}' },
  async (event) => {
    const { firmId, clientId } = event.params;
    await recomputeProgress(firmId, clientId);
  },
);

/**
 * A pending request only becomes overdue as the clock passes its due date — no
 * write fires at that moment, so a daily sweep refreshes the overdue counts of
 * every client that now has a past-due item.
 */
export const markOverdue = onSchedule(
  { ...triggerOptions, schedule: 'every day 06:00', timeZone: 'America/New_York' },
  async () => {
    const snap = await db
      .collectionGroup(groups.requests)
      .where('status', '==', 'pending')
      .where('dueDate', '<', Timestamp.now())
      .get();

    const clients = new Map<string, { firmId: string; clientId: string }>();
    snap.forEach((doc) => {
      const r = doc.data() as DocRequest;
      const key = `${r.firmId}/${r.clientId}`;
      if (!clients.has(key)) clients.set(key, { firmId: r.firmId, clientId: r.clientId });
    });

    for (const { firmId, clientId } of clients.values()) {
      try {
        await recomputeProgress(firmId, clientId);
      } catch (err) {
        console.error(`markOverdue: failed to refresh ${firmId}/${clientId}:`, err);
      }
    }
  },
);
