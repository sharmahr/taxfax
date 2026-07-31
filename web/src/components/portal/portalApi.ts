import { httpsCallable } from 'firebase/functions';
import type { LocaleId } from '@taxfax/shared';
import { functions } from '@/lib/firebase';
import { firebaseErrorMessage } from '@/lib/errors';

/**
 * The two backend calls the taxpayer portal makes, plus one error translator.
 * Everything else the portal does is a plain Firestore/Storage SDK read or the
 * resumable-upload handshake — no bespoke API surface.
 */

export interface PortalIdentity {
  firmId: string;
  clientId: string;
  firmName: string;
  /** How many client files this email matched — >1 means a household/entity split. */
  matches: number;
}

/**
 * Exchanges a verified email-link sign-in for the `portal` custom claim.
 * Ownership of the inbox is the only credential; the server resolves which
 * client record the email belongs to. See functions/src/firm/portal.ts.
 */
export async function claimPortalAccess(hint?: {
  firmId?: string;
  clientId?: string;
}): Promise<PortalIdentity> {
  const call = httpsCallable<{ firmId?: string; clientId?: string }, PortalIdentity>(
    functions,
    'claimPortalAccess',
  );
  const res = await call(hint ?? {});
  return res.data;
}

export interface UploadSlot {
  documentId: string;
  storagePath: string;
}

export interface UploadSlotInput {
  firmId: string;
  clientId: string;
  fileName: string;
  contentType: string;
  taxYear: number;
  sizeBytes: number;
}

/**
 * Asks the server for a document id and the exact Storage path to upload to, so
 * the client never invents a tenancy path. Validates type, size and quota; the
 * path it returns is guaranteed legal against the Storage rules.
 */
export async function requestUploadSlot(input: UploadSlotInput): Promise<UploadSlot> {
  const call = httpsCallable<UploadSlotInput, UploadSlot>(functions, 'requestUploadSlot');
  const res = await call(input);
  return res.data;
}

/**
 * Withdraws a document the taxpayer uploaded by mistake. This is undo, not
 * delete: the server moves the record to `retracted` and reopens whatever
 * checklist request it satisfied — the Storage object is kept so the firm still
 * has the full record (functions/src/firm/portal.ts). It is idempotent, and it
 * refuses (with a taxpayer-facing sentence) once a preparer has accepted the
 * document or the 24-hour window has passed. Those sentences reach the UI
 * verbatim via portalErrorMessage below.
 */
export async function retractDocument(documentId: string): Promise<void> {
  const call = httpsCallable<{ documentId: string }, { ok: true }>(functions, 'retractDocument');
  await call({ documentId });
}

/**
 * Persists the taxpayer's own language choice to their client record, so the
 * *next* chase email and SMS also switch — not just the page in front of them.
 * It writes with `source: 'taxpayer'`, which outranks a Schedule-LEP detection
 * or a preparer's guess (see `preferLanguage` in @taxfax/shared). The portal
 * cannot write the client doc directly — the Firestore rules reserve that for
 * staff — so this goes through a portal-scoped callable that runs with admin
 * rights. See functions/src/firm/portal.ts.
 */
export async function setPortalLanguage(locale: LocaleId): Promise<void> {
  const call = httpsCallable<{ locale: LocaleId }, { ok: true }>(functions, 'setPortalLanguage');
  await call({ locale });
}

/**
 * A taxpayer must never see a raw Firebase error code. The callables already
 * carry a sentence written for taxpayers (functions/src/lib/errors.ts), so
 * prefer that; otherwise fall back to the shared code→English map, and finally
 * to a plain, calm default.
 */
export function portalErrorMessage(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  const serverMessage =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : '';

  // Storage SDK codes — resumable-upload failure modes, each with a recovery.
  switch (code) {
    case 'storage/unauthorized':
      return 'That upload was blocked. Open the secure link we sent you again, then retry.';
    case 'storage/canceled':
      return 'Upload canceled.';
    case 'storage/quota-exceeded':
    case 'storage/retry-limit-exceeded':
      return 'Your connection dropped before the file finished. Tap to try again.';
    case 'storage/unauthenticated':
      return 'Your session timed out. Open the secure link we sent you again.';
    case 'storage/object-not-found':
      return "That file didn't finish uploading. Tap to try again.";
  }

  // Callable errors: the server's own taxpayer-facing sentence is best.
  if (code.startsWith('functions/')) {
    const bareCode = code.slice('functions/'.length);
    const generic = /^(internal|unknown|deadline-exceeded)$/.test(bareCode);
    if (serverMessage && !generic && serverMessage.toUpperCase() !== 'INTERNAL') {
      return serverMessage;
    }
    if (code === 'functions/unavailable' || code === 'functions/deadline-exceeded') {
      return "We couldn't reach the server. Check your connection and try again.";
    }
    return firebaseErrorMessage(err);
  }

  if (code.startsWith('auth/')) return firebaseErrorMessage(err);

  return 'Something went wrong. Please try again.';
}
