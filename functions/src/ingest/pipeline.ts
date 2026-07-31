/**
 * The ingestion pipeline: upload → extract → classify → rename → link.
 *
 * A taxpayer photographs a W-2 as `IMG_4821.HEIC`; by the time a preparer looks,
 * it is `Whitfield_2025_W2_AcmeCorp.pdf`, classified, and ticked off the
 * checklist. One Storage trigger does the automatic pass; four callables let a
 * preparer correct, accept, or reject, and hand the web client a safe upload slot.
 *
 * Loop safety (a rename inside an upload trigger is otherwise an infinite bill):
 *   1. Every object we write during a rename carries custom metadata
 *      `taxfaxProcessed: '1'`; the trigger returns immediately when it sees it.
 *   2. Naming is deterministic — re-running on an already-canonical object
 *      produces the same name, so no new object and therefore no new event is
 *      ever created. The pipeline is idempotent even if the marker is missed.
 */

import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  CLASSIFY_ACCEPT_THRESHOLD,
  CLASSIFY_REVIEW_THRESHOLD,
  DOC_TYPE_BY_ID,
  MAX_UPLOAD_BYTES,
  ROLE_RANK,
  canonicalName,
  docType,
  documentPath,
  formatBytes,
  isAcceptedUpload,
  parseDocumentPath,
  paths,
  requestSatisfied,
  type Classification,
  type DocumentState,
  type RequestStatus,
  type StoredDocument,
} from '@taxfax/shared';

import { FieldValue, bucket, db } from '../lib/admin.js';
import { denied, exhausted, invalid, notFound } from '../lib/errors.js';
import { logActivity, type ActivityInput } from '../lib/activity.js';
import { portalClaim, requireAuth, requireFirmRole, roleFor, type Caller } from '../lib/guards.js';
import { callableOptions, REGION } from '../lib/options.js';
import { optionalStr } from '../lib/validate.js';
import { classifyText, extractIssuer, extractTaxYear } from './classify.js';
import { extractDocument, type ExtractionResult } from './extract.js';

const ACCEPT = CLASSIFY_ACCEPT_THRESHOLD;
const REVIEW = CLASSIFY_REVIEW_THRESHOLD;
/** Custom-metadata key that marks an object we produced during a rename. */
const PROCESSED_MARKER = 'taxfaxProcessed';
/** A generous ceiling so a runaway client can't fill a firm's bucket. */
const MAX_DOCS_PER_CLIENT = 500;
/** Statuses whose request is still collecting documents. */
const OPEN_STATUSES: RequestStatus[] = ['pending', 'rejected', 'received'];

// ═══════════════════════════════════════════════════════════════════════════
// Storage trigger — the automatic pass
// ═══════════════════════════════════════════════════════════════════════════

export const onDocumentUploaded = onObjectFinalized(
  { region: REGION, memory: '1GiB', timeoutSeconds: 300, retry: false },
  async (event) => {
    const object = event.data;

    // (2) Loop guard: never reprocess an object we wrote during a rename.
    if (object.metadata?.[PROCESSED_MARKER] === '1') return;

    // (1) Only act on client documents; firm assets and stray paths are ignored.
    const name = object.name;
    if (!name) return;
    const parsed = parseDocumentPath(name);
    if (!parsed) return;

    await handleUpload(parsed, {
      name,
      contentType: object.contentType ?? 'application/octet-stream',
      sizeBytes: Number(object.size) || 0,
    });
  },
);

interface ObjectInfo {
  name: string;
  contentType: string;
  sizeBytes: number;
}

async function handleUpload(parsed: ParsedPath, object: ObjectInfo): Promise<void> {
  const { firmId, taxYear, clientId, documentId, fileName } = parsed;
  const docRef = db.doc(paths.document(firmId, clientId, documentId));

  try {
    const snap = await readDocWithRetry(docRef);
    const existing = snap?.data() as Partial<StoredDocument> | undefined;

    // Idempotency: this exact object is already the finalized, classified file.
    if (
      existing?.classification &&
      existing.storagePath === object.name &&
      existing.canonicalName === fileName &&
      existing.state != null &&
      existing.state !== 'scanning' &&
      existing.state !== 'uploading'
    ) {
      return;
    }

    const originalName = existing?.originalName || fileName;

    // (3) Mark the document as scanning (creating the record if the stub is
    // lagging behind the upload, so nothing is ever dropped).
    await docRef.set(
      {
        firmId,
        clientId,
        taxYear,
        storagePath: object.name,
        originalName,
        contentType: object.contentType,
        sizeBytes: object.sizeBytes,
        state: 'scanning' satisfies DocumentState,
        updatedAt: FieldValue.serverTimestamp(),
        ...(snap
          ? {}
          : { uploadedBy: 'system', uploadedVia: 'portal', uploadedAt: FieldValue.serverTimestamp() }),
      },
      { merge: true },
    );

    // (4) Extract text and classify.
    const extraction = await extractDocument({
      objectName: object.name,
      contentType: object.contentType,
      fileName,
    });
    const classification = classify(extraction, fileName);

    // (5–9) Name, rename, link, persist, log.
    await applyClassification({
      parsed,
      currentStoragePath: object.name,
      originalName,
      contentType: object.contentType,
      classification,
      pageCount: extraction.pageCount,
      actor: { kind: 'system', name: 'TaxFax' },
      forced: false,
    });
  } catch (err) {
    // (10) Any failure is surfaced as a human-readable error — and never leaves
    // the document stranded in `scanning`.
    await failDocument(docRef, err);
  }
}

function classify(extraction: ExtractionResult, fileName: string): Classification {
  const result = classifyText(extraction.text, fileName);
  result.method = extraction.method === 'ocr' ? 'ocr' : extraction.method === 'filename' ? 'filename' : 'text';
  result.issuer = extractIssuer(extraction.text, result.docTypeId);
  result.taxYear = extractTaxYear(extraction.text);
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared core — used by the trigger and by manual re-classification
// ═══════════════════════════════════════════════════════════════════════════

type ParsedPath = NonNullable<ReturnType<typeof parseDocumentPath>>;

interface ApplyInput {
  parsed: ParsedPath;
  currentStoragePath: string;
  originalName: string;
  contentType: string;
  classification: Classification;
  pageCount?: number;
  actor: ActivityInput['actor'];
  /** True when a preparer set the type by hand — always auto-accepts. */
  forced: boolean;
}

interface Decision {
  state: DocumentState;
  stored: Classification;
  /** The type id used for the filename (floored to `other` when unsure). */
  nameTypeId: string;
}

function decide(cls: Classification, forced: boolean): Decision {
  if (forced) return { state: 'classified', stored: cls, nameTypeId: cls.docTypeId };
  if (cls.docTypeId !== 'other' && cls.confidence >= ACCEPT) {
    return { state: 'classified', stored: cls, nameTypeId: cls.docTypeId };
  }
  if (cls.docTypeId !== 'other' && cls.confidence >= REVIEW) {
    return { state: 'needs_review', stored: cls, nameTypeId: cls.docTypeId };
  }
  // Too unsure to name: file as "Other" for review, but keep the best guess
  // visible as an alternate, and drop the issuer (a wrong one is worse than none).
  const stored: Classification = {
    ...cls,
    docTypeId: 'other',
    issuer: undefined,
    alternates:
      cls.docTypeId !== 'other'
        ? [{ docTypeId: cls.docTypeId, confidence: cls.confidence }, ...cls.alternates].slice(0, 3)
        : cls.alternates,
  };
  return { state: 'needs_review', stored, nameTypeId: 'other' };
}

async function applyClassification(input: ApplyInput): Promise<void> {
  const { parsed, currentStoragePath, originalName, contentType, classification, pageCount, actor, forced } = input;
  const { firmId, taxYear, clientId, documentId } = parsed;
  const docRef = db.doc(paths.document(firmId, clientId, documentId));

  const decision = decide(classification, forced);
  const issuer = decision.stored.issuer;
  const clientName = await getClientDisplayName(firmId, clientId);
  const sequence = await nextSequence(firmId, clientId, decision.nameTypeId, issuer, documentId);

  // (5) Canonical filename, e.g. Whitfield_2025_W2_AcmeCorp.pdf
  const canonical = canonicalName({
    clientDisplayName: clientName,
    taxYear,
    docTypeId: decision.nameTypeId,
    issuer,
    originalName,
    contentType,
    sequence,
  });
  const destPath = documentPath(firmId, taxYear, clientId, documentId, canonical);

  // (6) Rename: copy to the canonical name (carrying the loop-guard marker),
  // then delete the source — never an in-place overwrite (objects are immutable).
  await renameObject(currentStoragePath, destPath, contentType, {
    [PROCESSED_MARKER]: '1',
    taxfaxOriginalName: originalName,
    taxfaxDocumentId: documentId,
    taxfaxDocType: decision.stored.docTypeId,
  });

  // (7) Attach to a checklist request (creating an inferred one if unasked-for).
  const requestId = await linkRequest(firmId, clientId, taxYear, documentId, decision.stored.docTypeId, issuer);

  // (8) Persist the outcome. `state` follows confidence.
  await docRef.set(
    {
      state: decision.state,
      classification: decision.stored,
      canonicalName: canonical,
      storagePath: destPath,
      pageCount,
      requestId,
      processedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      error: FieldValue.delete(),
    },
    { merge: true },
  );

  // (9) A real sentence for a stressed preparer in March.
  await logActivity(firmId, {
    type: 'document_classified',
    clientId,
    actor,
    summary: summarize(clientName, decision, issuer, taxYear, forced),
    meta: {
      documentId,
      docTypeId: decision.stored.docTypeId,
      confidence: decision.stored.confidence,
      canonicalName: canonical,
      method: decision.stored.method,
    },
  });
}

function summarize(
  clientName: string,
  decision: Decision,
  issuer: string | undefined,
  taxYear: number,
  manual: boolean,
): string {
  const code = docType(decision.stored.docTypeId).code;
  const from = issuer ? ` from ${issuer}` : '';
  const docYear = decision.stored.taxYear;
  const yearWarn =
    docYear && docYear !== taxYear ? ` Heads up: it reads as a ${docYear} document, not ${taxYear}.` : '';

  if (manual) {
    return `Re-filed ${clientName}'s document as ${code}${from} after review.`;
  }
  if (decision.state === 'classified') {
    return `TaxFax filed ${clientName}'s ${code}${from} automatically.${yearWarn}`;
  }
  if (decision.nameTypeId === 'other') {
    return `A document from ${clientName} couldn't be identified — it's waiting for review.${yearWarn}`;
  }
  const pct = Math.round(decision.stored.confidence * 100);
  return `TaxFax thinks this is ${clientName}'s ${code}${from} (${pct}% sure) — a quick review will confirm it.${yearWarn}`;
}

// ── Storage rename ──────────────────────────────────────────────────────────

async function renameObject(
  currentPath: string,
  destPath: string,
  contentType: string,
  metadata: Record<string, string>,
): Promise<void> {
  if (currentPath === destPath) {
    // Already canonical (e.g. re-classified to the same name): just make sure
    // the loop-guard marker is present.
    await bucket
      .file(destPath)
      .setMetadata({ contentType, metadata })
      .catch(() => undefined);
    return;
  }
  const source = bucket.file(currentPath);
  await source.copy(bucket.file(destPath), { contentType, metadata });
  await source.delete({ ignoreNotFound: true });
}

// ── Checklist linking ───────────────────────────────────────────────────────

async function linkRequest(
  firmId: string,
  clientId: string,
  taxYear: number,
  documentId: string,
  docTypeId: string,
  issuer: string | undefined,
): Promise<string> {
  const col = db.collection(paths.requests(firmId, clientId));

  // Fully idempotent: if any request already references this document, reuse it.
  const linked = await col.where('documentIds', 'array-contains', documentId).limit(1).get();
  if (!linked.empty) {
    const ref = linked.docs[0]!.ref;
    await markReceived(ref, documentId);
    return ref.id;
  }

  // Otherwise attach to an open request of this type — the one with the fewest
  // documents so multi-issuer asks ("3 W-2s") fill evenly.
  const matches = await col.where('docTypeId', '==', docTypeId).get();
  const open = matches.docs
    .filter((d) => OPEN_STATUSES.includes(d.get('status') as RequestStatus))
    .sort(
      (a, b) =>
        ((a.get('documentIds') as unknown[])?.length ?? 0) - ((b.get('documentIds') as unknown[])?.length ?? 0) ||
        ((a.get('order') as number) ?? 0) - ((b.get('order') as number) ?? 0),
    );
  if (open.length > 0) {
    await markReceived(open[0]!.ref, documentId);
    return open[0]!.id;
  }

  // Nothing asked for it — capture it anyway rather than dropping it.
  const ref = col.doc();
  const now = FieldValue.serverTimestamp();
  const isOther = docTypeId === 'other';
  await ref.set({
    id: ref.id,
    firmId,
    clientId,
    taxYear,
    docTypeId,
    label: isOther ? 'Unsorted upload' : undefined,
    reason: 'Captured from a document the client sent without being asked.',
    source: 'inferred',
    priority: 'standard',
    expectedCount: 1,
    expectedIssuers: issuer ? [issuer] : undefined,
    status: 'received' satisfies RequestStatus,
    documentIds: [documentId],
    order: 950,
    createdAt: now,
    updatedAt: now,
    receivedAt: now,
  });
  return ref.id;
}

async function markReceived(ref: FirebaseFirestore.DocumentReference, documentId: string): Promise<void> {
  await ref.update({
    documentIds: FieldValue.arrayUnion(documentId),
    status: 'received' satisfies RequestStatus,
    receivedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Can this line honestly be called `accepted`? Only when the documents in hand
 * meet what was asked for — the same test the taxpayer's portal applies through
 * `requestSatisfied`, so the status the server writes and the progress the
 * portal shows can never say different things about the same row.
 *
 * `expectedCount` comes back off a stored document and requests written before
 * the field existed don't carry one, so anything that isn't a number counts as
 * a single document rather than poisoning the comparison.
 */
function countMet(documentIds: string[], expectedCount: unknown): boolean {
  return requestSatisfied({
    status: 'accepted',
    documentIds,
    expectedCount:
      typeof expectedCount === 'number' && Number.isFinite(expectedCount) ? expectedCount : 1,
  });
}

/**
 * A preparer's sign-off, applied to the line the document was filling.
 *
 * The signature is on the *document*; the line only closes when the last one it
 * asked for is in. Closing it on the first of two W-2s is silent — the roster
 * reads done, the chase stops, and the return is prepared against income nobody
 * ever sent — so a line that is still short stays in review instead.
 */
async function signOffOnRequest(
  firmId: string,
  clientId: string,
  requestId: string,
  documentId: string,
): Promise<void> {
  const ref = db.doc(paths.request(firmId, clientId, requestId));
  const snap = await ref.get();
  if (!snap.exists) return;

  // An earlier rejection pulled this id back out of the line; accepting it now
  // puts it back, or the count it is measured against could never be met.
  const documentIds = [...new Set([...((snap.get('documentIds') as string[]) ?? []), documentId])];
  const done = countMet(documentIds, snap.get('expectedCount'));

  await ref.update({
    documentIds,
    status: done ? ('accepted' satisfies RequestStatus) : ('received' satisfies RequestStatus),
    ...(done ? { acceptedAt: FieldValue.serverTimestamp() } : {}),
    rejectionReason: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ── Sequence / client helpers ───────────────────────────────────────────────

async function nextSequence(
  firmId: string,
  clientId: string,
  docTypeId: string,
  issuer: string | undefined,
  selfDocId: string,
): Promise<number> {
  const snap = await db
    .collection(paths.documents(firmId, clientId))
    .where('classification.docTypeId', '==', docTypeId)
    .get();
  const issuerKey = (issuer ?? '').toLowerCase();
  let count = 0;
  for (const d of snap.docs) {
    if (d.id === selfDocId) continue;
    const other = (d.get('classification.issuer') as string | undefined) ?? '';
    if (other.toLowerCase() === issuerKey) count++;
  }
  return count + 1;
}

async function getClientDisplayName(firmId: string, clientId: string): Promise<string> {
  const snap = await db.doc(paths.client(firmId, clientId)).get();
  const name = snap.get('displayName') as string | undefined;
  return name && name.trim().length > 0 ? name : 'this client';
}

async function readDocWithRetry(
  ref: FirebaseFirestore.DocumentReference,
): Promise<FirebaseFirestore.DocumentSnapshot | null> {
  const first = await ref.get();
  if (first.exists) return first;
  // The Firestore stub is normally written before the upload finalizes; allow a
  // brief moment for replication before we treat it as a headless upload.
  await new Promise((r) => setTimeout(r, 1_500));
  const second = await ref.get();
  return second.exists ? second : null;
}

async function failDocument(ref: FirebaseFirestore.DocumentReference, err: unknown): Promise<void> {
  const message = humanError(err);
  await ref
    .set(
      {
        state: 'failed' satisfies DocumentState,
        error: message,
        processedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    .catch(() => undefined);
}

function humanError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/password|encrypt/i.test(raw)) {
    return 'This file looks password-protected. Ask the client to remove the password and re-send it.';
  }
  if (/invalid|corrupt|xref|pdf/i.test(raw)) {
    return "We couldn't read this file — it may be corrupted. Ask the client to re-send it, or upload a clear photo.";
  }
  return "Something went wrong while reading this file. It's been flagged for a preparer to look at.";
}

// ═══════════════════════════════════════════════════════════════════════════
// Callables
// ═══════════════════════════════════════════════════════════════════════════

function str(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalid(`Missing "${field}".`);
  }
  return value;
}

function actorName(token: DecodedIdToken): string {
  return (token.name as string | undefined) ?? (token.email as string | undefined) ?? 'A teammate';
}

/** A preparer (or higher), or the taxpayer whose portal link this is. */
function requireClientAccess(req: CallableRequest, firmId: string, clientId: string): Caller {
  const caller = requireAuth(req);
  const role = roleFor(caller.token, firmId);
  if (role && ROLE_RANK[role] >= ROLE_RANK.preparer) return caller;
  const portal = portalClaim(caller.token);
  if (portal && portal.firmId === firmId && portal.clientId === clientId) return caller;
  throw denied("You don't have access to this client.");
}

/**
 * Hands the web client a document id and the exact Storage path to upload to,
 * so the client never invents a path. Validates type, size and a soft quota.
 */
export const requestUploadSlot = onCall(callableOptions, async (req) => {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const firmId = str(data.firmId, 'firmId');
  const clientId = str(data.clientId, 'clientId');
  const fileName = str(data.fileName, 'fileName');
  const contentType = str(data.contentType, 'contentType');
  const taxYear = data.taxYear;
  const sizeBytes = data.sizeBytes;

  requireClientAccess(req, firmId, clientId);

  if (typeof taxYear !== 'number' || !Number.isInteger(taxYear) || taxYear < 2000 || taxYear > 2100) {
    throw invalid('That tax year looks wrong.');
  }
  if (!isAcceptedUpload(contentType)) {
    throw invalid("That file type isn't supported. Upload a PDF, a photo, or a spreadsheet.");
  }
  if (typeof sizeBytes !== 'number' || !Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    throw invalid('That file appears to be empty.');
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    throw invalid(`That file is too large — the limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
  }

  const count = await db.collection(paths.documents(firmId, clientId)).count().get();
  if ((count.data().count ?? 0) >= MAX_DOCS_PER_CLIENT) {
    throw exhausted('This client already has a lot of files — archive some before adding more.');
  }

  const documentId = db.collection(paths.documents(firmId, clientId)).doc().id;
  const storagePath = documentPath(firmId, taxYear, clientId, documentId, safeName(fileName));
  return { documentId, storagePath };
});

function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'upload';
  const cleaned = base
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
  return cleaned.replace(/^[._]+/, '') || 'upload';
}

/**
 * A preparer corrects the type. Re-runs the rename with the chosen type, moves
 * the checklist link, and records it as a manual decision. One click, instant.
 */
export const reclassifyDocument = onCall(callableOptions, async (req) => {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const firmId = str(data.firmId, 'firmId');
  const clientId = str(data.clientId, 'clientId');
  const documentId = str(data.documentId, 'documentId');
  const docTypeId = str(data.docTypeId, 'docTypeId');
  const issuerOverride = optionalStr(data.issuer, 60);

  const caller = requireFirmRole(req, firmId, 'preparer');
  if (!DOC_TYPE_BY_ID[docTypeId]) throw invalid('That document type is not one we recognize.');

  const docRef = db.doc(paths.document(firmId, clientId, documentId));
  const snap = await docRef.get();
  if (!snap.exists) throw notFound('That document no longer exists.');
  const doc = snap.data() as StoredDocument;

  await detachFromRequest(firmId, clientId, documentId, doc.requestId, docTypeId);

  const cls: Classification = {
    docTypeId,
    confidence: 1,
    issuer: issuerOverride ?? doc.classification?.issuer,
    taxYear: doc.classification?.taxYear,
    evidence: [`Set by ${actorName(caller.token)} during review.`],
    alternates: [],
    method: 'manual',
  };

  await applyClassification({
    parsed: { firmId, taxYear: doc.taxYear, clientId, documentId, fileName: doc.canonicalName ?? doc.originalName },
    currentStoragePath: doc.storagePath,
    originalName: doc.originalName,
    contentType: doc.contentType,
    classification: cls,
    pageCount: doc.pageCount,
    actor: { uid: caller.uid, name: actorName(caller.token), kind: 'staff' },
    forced: true,
  });

  return { ok: true, docTypeId };
});

/** Removes a document from its old request when a preparer re-classifies it. */
async function detachFromRequest(
  firmId: string,
  clientId: string,
  documentId: string,
  requestId: string | undefined,
  newDocTypeId: string,
): Promise<void> {
  if (!requestId) return;
  const ref = db.doc(paths.request(firmId, clientId, requestId));
  const snap = await ref.get();
  if (!snap.exists || snap.get('docTypeId') === newDocTypeId) return;

  const remaining = ((snap.get('documentIds') as string[]) ?? []).filter((id) => id !== documentId);
  const status = snap.get('status') as RequestStatus;
  await ref.update({
    documentIds: FieldValue.arrayRemove(documentId),
    // A line that has just lost a document can no longer claim to be complete.
    status:
      remaining.length === 0
        ? ('pending' satisfies RequestStatus)
        : status === 'accepted' && !countMet(remaining, snap.get('expectedCount'))
          ? ('received' satisfies RequestStatus)
          : status,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** A preparer signs off on a document. */
export const acceptDocument = onCall(callableOptions, async (req) => {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const firmId = str(data.firmId, 'firmId');
  const clientId = str(data.clientId, 'clientId');
  const documentId = str(data.documentId, 'documentId');

  const caller = requireFirmRole(req, firmId, 'preparer');
  const docRef = db.doc(paths.document(firmId, clientId, documentId));
  const snap = await docRef.get();
  if (!snap.exists) throw notFound('That document no longer exists.');
  const doc = snap.data() as StoredDocument;

  await docRef.update({
    state: 'accepted' satisfies DocumentState,
    reviewedBy: caller.uid,
    reviewedAt: FieldValue.serverTimestamp(),
    rejectionReason: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (doc.requestId) {
    await signOffOnRequest(firmId, clientId, doc.requestId, documentId).catch(() => undefined);
  }

  const clientName = await getClientDisplayName(firmId, clientId);
  await logActivity(firmId, {
    type: 'document_accepted',
    clientId,
    actor: { uid: caller.uid, name: actorName(caller.token), kind: 'staff' },
    summary: `${actorName(caller.token)} accepted ${clientName}'s ${docType(doc.classification?.docTypeId ?? 'other').code}.`,
    meta: { documentId },
  });

  return { ok: true };
});

/** A preparer rejects a document; the taxpayer gets asked again. */
export const rejectDocument = onCall(callableOptions, async (req) => {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const firmId = str(data.firmId, 'firmId');
  const clientId = str(data.clientId, 'clientId');
  const documentId = str(data.documentId, 'documentId');
  const reason = optionalStr(data.reason, 300);
  if (!reason) throw invalid('Add a short reason so the client knows what to fix.');

  const caller = requireFirmRole(req, firmId, 'preparer');
  const docRef = db.doc(paths.document(firmId, clientId, documentId));
  const snap = await docRef.get();
  if (!snap.exists) throw notFound('That document no longer exists.');
  const doc = snap.data() as StoredDocument;

  await docRef.update({
    state: 'rejected' satisfies DocumentState,
    rejectionReason: reason,
    reviewedBy: caller.uid,
    reviewedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (doc.requestId) {
    await db
      .doc(paths.request(firmId, clientId, doc.requestId))
      .update({
        documentIds: FieldValue.arrayRemove(documentId),
        status: 'pending' satisfies RequestStatus,
        rejectionReason: reason,
        updatedAt: FieldValue.serverTimestamp(),
      })
      .catch(() => undefined);
  }

  const clientName = await getClientDisplayName(firmId, clientId);
  await logActivity(firmId, {
    type: 'document_rejected',
    clientId,
    actor: { uid: caller.uid, name: actorName(caller.token), kind: 'staff' },
    summary: `${actorName(caller.token)} asked ${clientName} to re-send their ${docType(doc.classification?.docTypeId ?? 'other').code}: “${reason}”`,
    meta: { documentId },
  });

  return { ok: true };
});
