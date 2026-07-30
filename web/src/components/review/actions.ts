import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

/** Adjudication writes go through callables — security rules forbid a preparer
 *  from touching `document.classification` directly. */

interface DocTarget {
  firmId: string;
  clientId: string;
  documentId: string;
}

export function acceptDocument(t: DocTarget): Promise<{ ok: boolean }> {
  return httpsCallable<DocTarget, { ok: boolean }>(functions, 'acceptDocument')(t).then((r) => r.data);
}

export function rejectDocument(t: DocTarget & { reason: string }): Promise<{ ok: boolean }> {
  return httpsCallable<DocTarget & { reason: string }, { ok: boolean }>(functions, 'rejectDocument')(t).then(
    (r) => r.data,
  );
}

export function reclassifyDocument(
  t: DocTarget & { docTypeId: string; issuer?: string },
): Promise<{ ok: boolean; docTypeId: string }> {
  return httpsCallable<DocTarget & { docTypeId: string; issuer?: string }, { ok: boolean; docTypeId: string }>(
    functions,
    'reclassifyDocument',
  )(t).then((r) => r.data);
}

/** Correcting a type is the preparer asserting it's right — file it in one move. */
export async function reclassifyAndAccept(t: DocTarget & { docTypeId: string; issuer?: string }): Promise<void> {
  await reclassifyDocument(t);
  await acceptDocument({ firmId: t.firmId, clientId: t.clientId, documentId: t.documentId });
}

export function reviewErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = String((err as { message: unknown }).message);
    if (m && !/internal/i.test(m)) return m;
  }
  return 'That didn’t go through. Try again.';
}
