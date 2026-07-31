import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type FieldValue,
} from 'firebase/firestore';
import {
  paths,
  type ClientStage,
  type DocRequest,
  type RequestPriority,
  type RequestStatus,
} from '@taxfax/shared';
import { db } from '@/lib/firebase';
import { toast } from '@/components/ui/Toast';

/**
 * Every write is scoped to the current firm id passed by the caller (never a
 * bare URL param) and only touches fields the security rules let a firm member
 * change — derived counters and chase state stay server-owned. The chase engine
 * itself (send, snooze, resume) runs through firm-scoped callables in chase.ts,
 * never a faked client write.
 */

/** Toast around a write so every action reports success or a real failure. */
export async function run(
  work: Promise<unknown>,
  messages: { success: string; error?: string },
): Promise<boolean> {
  try {
    await work;
    toast.success(messages.success);
    return true;
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Please try again.';
    toast.error(messages.error ?? 'Couldn’t save that change', { description: detail });
    return false;
  }
}

// ── Client-level ──────────────────────────────────────────────────────────────

export function assignClient(firmId: string, clientId: string, uid: string | null): Promise<void> {
  return updateDoc(doc(db, paths.client(firmId, clientId)), {
    assignedTo: uid ?? null,
    updatedAt: serverTimestamp(),
  });
}

export function setStage(firmId: string, clientId: string, stage: ClientStage): Promise<void> {
  return updateDoc(doc(db, paths.client(firmId, clientId)), {
    stage,
    updatedAt: serverTimestamp(),
  });
}

export function addTag(firmId: string, clientId: string, tag: string): Promise<void> {
  return updateDoc(doc(db, paths.client(firmId, clientId)), {
    tags: arrayUnion(tag),
    updatedAt: serverTimestamp(),
  });
}

export function removeTag(firmId: string, clientId: string, tag: string): Promise<void> {
  return updateDoc(doc(db, paths.client(firmId, clientId)), {
    tags: arrayRemove(tag),
    updatedAt: serverTimestamp(),
  });
}

export function bulkAssign(firmId: string, ids: string[], uid: string | null): Promise<void> {
  const batch = writeBatch(db);
  for (const id of ids)
    batch.update(doc(db, paths.client(firmId, id)), {
      assignedTo: uid ?? null,
      updatedAt: serverTimestamp(),
    });
  return batch.commit();
}

export function bulkAddTag(firmId: string, ids: string[], tag: string): Promise<void> {
  const batch = writeBatch(db);
  for (const id of ids)
    batch.update(doc(db, paths.client(firmId, id)), {
      tags: arrayUnion(tag),
      updatedAt: serverTimestamp(),
    });
  return batch.commit();
}

// ── Checklist requests ────────────────────────────────────────────────────────

/** Sets a request's workflow state and the matching timestamp the UI reads. */
export function setRequestStatus(
  firmId: string,
  clientId: string,
  requestId: string,
  status: RequestStatus,
  extra?: { rejectionReason?: string },
): Promise<void> {
  const patch: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  if (status === 'received') patch.receivedAt = serverTimestamp();
  if (status === 'accepted') patch.acceptedAt = serverTimestamp();
  if (status === 'rejected') patch.rejectionReason = extra?.rejectionReason ?? 'Illegible or wrong document';
  return updateDoc(doc(db, paths.request(firmId, clientId, requestId)), patch);
}

export function deleteRequest(firmId: string, clientId: string, requestId: string): Promise<void> {
  return deleteDoc(doc(db, paths.request(firmId, clientId, requestId)));
}

export interface NewRequestInput {
  docTypeId: string;
  reason: string;
  priority: RequestPriority;
  expectedCount: number;
  taxYear: number;
  order: number;
}

export function createRequest(firmId: string, clientId: string, input: NewRequestInput): Promise<void> {
  const ref = doc(collection(db, paths.requests(firmId, clientId)));
  const request: Omit<DocRequest, 'createdAt' | 'updatedAt'> & {
    createdAt: FieldValue;
    updatedAt: FieldValue;
  } = {
    id: ref.id,
    firmId,
    clientId,
    taxYear: input.taxYear,
    docTypeId: input.docTypeId,
    reason: input.reason,
    source: 'manual',
    priority: input.priority,
    expectedCount: input.expectedCount,
    status: 'pending',
    documentIds: [],
    order: input.order,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  return setDoc(ref, request);
}
