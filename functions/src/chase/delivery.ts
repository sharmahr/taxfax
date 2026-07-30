/**
 * Delivery mirror — turn the extension's raw delivery state into something a
 * stressed accountant understands on the activity feed: "delivered 3:04pm",
 * "bounced", "failed: invalid number".
 *
 * The `firestore-send-email` and `twilio/send-message` extensions both stamp a
 * `delivery` map back onto the queue document they processed. We wrote a
 * `chase: { firmId, clientId, messageId }` back-reference onto that same
 * document when we enqueued it, so mirroring the status is an O(1) hop straight
 * to the ChaseMessage — no scans.
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

import { paths } from '@taxfax/shared';
import type { ChaseMessage } from '@taxfax/shared';

import { FieldValue, db } from '../lib/admin.js';

const REGION = 'us-central1';

interface ChaseRef {
  firmId: string;
  clientId: string;
  messageId: string;
}

type MirrorStatus = ChaseMessage['status']; // 'queued' | 'sent' | 'delivered' | 'failed' | 'skipped'

/** Both extensions write this shape; Twilio additionally fills `info.status`
 *  with the carrier's own status as it firms up (queued → sent → delivered). */
interface DeliveryField {
  state?: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
  error?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  info?: { status?: string; messageSid?: string; accepted?: string[]; rejected?: string[] } | null;
}

/** Once a message is delivered or failed, nothing walks it back. */
const TERMINAL: ReadonlySet<MirrorStatus> = new Set<MirrorStatus>(['delivered', 'failed']);

function readChaseRef(v: unknown): ChaseRef | null {
  const c = v as Partial<ChaseRef> | undefined;
  if (c && typeof c.firmId === 'string' && typeof c.clientId === 'string' && typeof c.messageId === 'string') {
    return { firmId: c.firmId, clientId: c.clientId, messageId: c.messageId };
  }
  return null;
}

/** Email (firestore-send-email): SUCCESS means the SMTP server accepted it. */
function mapEmail(d: DeliveryField): { status: MirrorStatus; error?: string } | null {
  switch (d.state) {
    case 'SUCCESS':
      return { status: 'delivered' };
    case 'ERROR':
      return { status: 'failed', error: d.error || d.errorMessage || 'The email server rejected this message.' };
    case 'PROCESSING':
    case 'PENDING':
      return { status: 'sent' };
    default:
      return null;
  }
}

/** SMS (twilio/send-message): `state` reflects the API call; the true carrier
 *  outcome lands later in `info.status` via Twilio's status callback. */
function mapSms(d: DeliveryField): { status: MirrorStatus; error?: string } | null {
  const carrier = d.info?.status?.toLowerCase();
  if (carrier === 'delivered') return { status: 'delivered' };
  if (carrier === 'undelivered' || carrier === 'failed') {
    return { status: 'failed', error: smsError(d) };
  }
  switch (d.state) {
    case 'ERROR':
      return { status: 'failed', error: smsError(d) };
    case 'SUCCESS': // accepted by Twilio; not yet confirmed on the handset
    case 'PROCESSING':
    case 'PENDING':
      return { status: 'sent' };
    default:
      return null;
  }
}

function smsError(d: DeliveryField): string {
  const parts = [d.errorMessage, d.errorCode ? `(code ${d.errorCode})` : ''].filter(Boolean);
  return parts.join(' ') || 'The carrier could not deliver this text.';
}

/** Advance the ChaseMessage forward only — never clobber a terminal state, and
 *  never write the same status twice. Idempotent under out-of-order events. */
async function mirror(ref: ChaseRef, next: { status: MirrorStatus; error?: string }): Promise<void> {
  const docRef = db.collection(paths.chaseMessages(ref.firmId, ref.clientId)).doc(ref.messageId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) return;
    const current = snap.get('status') as MirrorStatus | undefined;
    if (current && TERMINAL.has(current)) return; // already settled
    if (current === next.status) return; // no change
    const patch: Record<string, unknown> = { status: next.status };
    if (next.error) patch.error = next.error;
    if (next.status === 'delivered') patch.deliveredAt = FieldValue.serverTimestamp();
    if (next.status === 'failed') patch.failedAt = FieldValue.serverTimestamp();
    tx.update(docRef, patch);
  });
}

export const mirrorEmailDelivery = onDocumentUpdated({ document: 'mail/{id}', region: REGION }, async (event) => {
  const after = event.data?.after;
  if (!after) return;
  const ref = readChaseRef(after.get('chase'));
  if (!ref) return; // staff notifications carry no chase ref — nothing to mirror

  const before = event.data?.before;
  if (before && before.get('delivery.state') === after.get('delivery.state')) return; // no state change

  const mapped = mapEmail((after.get('delivery') as DeliveryField) ?? {});
  if (!mapped) return;
  await mirror(ref, mapped);
  logger.debug('chase: mirrored email delivery', { ...ref, status: mapped.status });
});

export const mirrorSmsDelivery = onDocumentUpdated({ document: 'messages/{id}', region: REGION }, async (event) => {
  const after = event.data?.after;
  if (!after) return;
  const ref = readChaseRef(after.get('chase'));
  if (!ref) return;

  const before = event.data?.before;
  const stateSame = before && before.get('delivery.state') === after.get('delivery.state');
  const carrierSame = before && before.get('delivery.info.status') === after.get('delivery.info.status');
  if (stateSame && carrierSame) return; // neither the API state nor the carrier status moved

  const mapped = mapSms((after.get('delivery') as DeliveryField) ?? {});
  if (!mapped) return;
  await mirror(ref, mapped);
  logger.debug('chase: mirrored sms delivery', { ...ref, status: mapped.status });
});
