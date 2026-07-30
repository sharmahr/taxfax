/**
 * The activity feed. Summaries are pre-rendered natural sentences so the feed
 * renders with zero joins — "Ava accepted Whitfield's W-2", never "doc:abc123".
 */
import { paths, type Activity, type ActivityType } from '@taxfax/shared';
import { db, FieldValue } from './admin.js';

export interface ActivityInput {
  type: ActivityType;
  /** A finished sentence, e.g. "Ava added the Whitfields as a client." */
  summary: string;
  actor: Activity['actor'];
  clientId?: string;
  meta?: Record<string, unknown>;
}

export async function logActivity(firmId: string, input: ActivityInput): Promise<void> {
  const ref = db.collection(paths.activity(firmId)).doc();
  await ref.set({
    id: ref.id,
    firmId,
    type: input.type,
    summary: input.summary,
    actor: input.actor,
    clientId: input.clientId,
    meta: input.meta,
    at: FieldValue.serverTimestamp(),
  });
}
