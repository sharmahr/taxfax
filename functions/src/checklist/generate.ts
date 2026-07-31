/**
 * Checklist materialisation — turning a parsed prior-year return into the
 * `DocRequest` documents a client actually sees, and keeping them in sync as
 * returns are re-parsed or preparers edit the list by hand.
 *
 * The magic moment lives in `onPriorYearReturnUploaded`: a preparer drops last
 * year's return into a client, the ingest pipeline classifies it, and this
 * trigger turns it into a personalised checklist without anyone lifting a
 * finger.
 */
import { onCall } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import type { WithFieldValue } from 'firebase-admin/firestore';
import {
  DOC_TYPES,
  STARTER_CHECKLIST,
  docType,
  emptyPriorYear,
  generateChecklist as buildChecklist,
  localeRecord,
  paths,
  preferLanguage,
  resolveLepCode,
  type Activity,
  type Client,
  type ClientLanguage,
  type DocRequest,
  type PriorYearReturn,
  type RequestPriority,
  type RequestSource,
  type StoredDocument,
} from '@taxfax/shared';
import { FieldValue, Timestamp, bucket, db } from '../lib/admin.js';
import { requireFirmRole } from '../lib/guards.js';
import { invalid, notFound } from '../lib/errors.js';
import { callableOptions, triggerOptions } from '../lib/options.js';
import { optionalStr } from '../lib/validate.js';
import { logActivity } from '../lib/activity.js';
import { parsePriorYearReturnFromPdf } from './parsePriorYearReturn.js';
import { planChecklist, type MaterialItem } from './plan.js';
import { checklistSort, dueDateFor, requireId, staffActor, systemActor } from './util.js';

const KNOWN_DOC_TYPES = new Set(DOC_TYPES.map((d) => d.id));

export interface MaterializeResult {
  created: number;
  updated: number;
  removed: number;
  preserved: number;
  total: number;
}

// ── Core merge ────────────────────────────────────────────────────────────────

/**
 * Reconciles the desired checklist against what already exists. Deterministic
 * request ids (one per doc type) mean re-running never duplicates. The rule is
 * simple and safe: never destroy a preparer's work.
 *   • new item            → created
 *   • pending & empty item → refreshed in place (reason/priority/order)
 *   • has uploads or a set status → left exactly as-is
 *   • stale auto item, pending & empty → removed (only when `prune`)
 *   • stale item with uploads or added by hand → kept, never deleted
 *
 * `prune` is on for a full regenerate (obsolete auto items disappear) and off
 * for a template overlay (items are only ever added, never removed).
 */
export async function materialize(
  firmId: string,
  clientId: string,
  items: MaterialItem[],
  source: RequestSource,
  priorYear: Client['priorYear'] | undefined,
  prune: boolean,
  language?: ClientLanguage,
): Promise<{ result: MaterializeResult; client: Client; language: ClientLanguage | null }> {
  const clientRef = db.doc(paths.client(firmId, clientId));
  const requestsRef = db.collection(paths.requests(firmId, clientId));

  return await db.runTransaction(async (tx) => {
    const clientSnap = await tx.get(clientRef);
    if (!clientSnap.exists) throw notFound("We couldn't find that client.");
    const client = clientSnap.data() as Client;

    const existingSnap = await tx.get(requestsRef);
    const existing = new Map<string, DocRequest>();
    existingSnap.forEach((d) => existing.set(d.id, d.data() as DocRequest));

    const desired = [...items].sort(checklistSort);
    const desiredIds = new Set(desired.map((i) => i.docTypeId));

    let created = 0;
    let updated = 0;
    let removed = 0;
    let preserved = 0;

    desired.forEach((item, index) => {
      const id = item.docTypeId;
      const order = index * 10;
      const prev = existing.get(id);
      const dueDate = dueDateFor(item.priority);
      const expectedCount = Math.max(1, Math.round(item.quantity));
      const expectedIssuers = item.issuers.length ? item.issuers : undefined;

      if (!prev) {
        const request: WithFieldValue<DocRequest> = {
          id,
          firmId,
          clientId,
          taxYear: client.taxYear,
          docTypeId: item.docTypeId,
          reason: item.reason,
          source,
          priority: item.priority,
          expectedCount,
          expectedIssuers,
          status: 'pending',
          documentIds: [],
          dueDate,
          order,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
        tx.set(requestsRef.doc(id), request);
        created += 1;
      } else if (prev.status === 'pending' && prev.documentIds.length === 0) {
        const patch: WithFieldValue<Partial<DocRequest>> = {
          reason: item.reason,
          source,
          priority: item.priority,
          expectedCount,
          expectedIssuers: expectedIssuers ?? FieldValue.delete(),
          dueDate,
          order,
          updatedAt: FieldValue.serverTimestamp(),
        };
        tx.set(requestsRef.doc(id), patch, { merge: true });
        updated += 1;
      } else {
        preserved += 1;
      }
    });

    existing.forEach((prev, id) => {
      if (desiredIds.has(id)) return;
      if (!prune) {
        preserved += 1;
        return;
      }
      const isAuto =
        prev.source === 'prior_year' || prev.source === 'template' || prev.source === 'inferred';
      if (isAuto && prev.status === 'pending' && prev.documentIds.length === 0) {
        tx.delete(requestsRef.doc(id));
        removed += 1;
      } else {
        preserved += 1;
      }
    });

    // A detection may never overwrite a human's choice, so the merge runs
    // against the value read inside this transaction rather than blind-writing.
    const languagePatch = language ? preferLanguage(client.language, language) : null;

    if (priorYear || languagePatch) {
      const patch: WithFieldValue<Partial<Client>> = {
        ...(priorYear ? { priorYear } : {}),
        ...(languagePatch ? { language: languagePatch } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      };
      tx.set(clientRef, patch, { merge: true });
    }

    return {
      result: { created, updated, removed, preserved, total: created + updated + preserved },
      client,
      language: languagePatch,
    };
  });
}

// ── Public entry points (internal, invoked by callables and triggers) ─────────

/**
 * Runs the shared rule engine against a parsed return and materialises the
 * result. `sourceDocumentId` is recorded on the client so a later regenerate
 * knows which upload the checklist came from.
 */
export async function generateChecklistForClient(
  firmId: string,
  clientId: string,
  opts: { prior: PriorYearReturn; sourceDocumentId?: string; actor: Activity['actor'] },
): Promise<MaterializeResult> {
  const { prior, sourceDocumentId, actor } = opts;
  const hits = buildChecklist({ prior, taxYear: prior.taxYear + 1 });
  const items: MaterialItem[] = hits.map((h) => ({
    docTypeId: h.docTypeId,
    reason: h.reason,
    priority: h.priority,
    quantity: h.quantity,
    issuers: h.issuers,
  }));

  const priorYear: Client['priorYear'] | undefined = sourceDocumentId
    ? {
        sourceDocumentId,
        taxYear: prior.taxYear,
        parsedAt: Timestamp.now(),
        confidence: prior.confidence,
      }
    : undefined;

  /**
   * Schedule LEP was in last year's package: the taxpayer already told the IRS
   * which language to write to them in, so the firm never has to ask. An
   * election we can't honor is recorded too — the firm gets told rather than
   * quietly served English.
   */
  const elected = prior.lepCode ? resolveLepCode(prior.lepCode) : null;
  const detected: ClientLanguage | undefined =
    elected && elected.kind !== 'unknown'
      ? {
          locale: elected.locale,
          source: 'detected',
          lepCode: elected.code,
          ...(elected.kind === 'unsupported'
            ? { unsupported: { code: elected.code, language: elected.language } }
            : {}),
          updatedAt: Timestamp.now(),
        }
      : undefined;

  const { result, client, language } = await materialize(
    firmId,
    clientId,
    items,
    'prior_year',
    priorYear,
    true,
    detected,
  );

  await logActivity(firmId, {
    type: 'checklist_generated',
    summary: `Built a ${result.total}-item checklist for ${client.displayName} from their ${prior.taxYear} return.`,
    actor,
    clientId,
    meta: {
      source: 'prior_year',
      total: result.total,
      created: result.created,
      taxYear: prior.taxYear,
      confidence: prior.confidence,
    },
  });

  if (elected && elected.kind !== 'unknown' && language) {
    const inUse = localeRecord(language.locale).englishName;
    await logActivity(firmId, {
      type: 'language_detected',
      summary:
        elected.kind === 'unsupported'
          ? `${client.displayName} elected ${elected.language} on their ${prior.taxYear} Schedule LEP. TaxFax can't write ${elected.language} yet, so their messages stay in English.`
          : language.locale === elected.locale
            ? `${client.displayName} elected ${elected.language} on their ${prior.taxYear} Schedule LEP — their messages will go out in ${elected.language}.`
            : `${client.displayName} elected ${elected.language} on their ${prior.taxYear} Schedule LEP, but you have them set to ${inUse}. Your setting stands.`,
      actor,
      clientId,
      meta: {
        lepCode: elected.code,
        electedLanguage: elected.language,
        locale: language.locale,
        supported: elected.kind === 'supported',
      },
    });
  }

  return result;
}

/** Materialises the short starter list for a client with no prior-year return. */
export async function applyStarterChecklist(
  firmId: string,
  clientId: string,
  opts: { actor: Activity['actor'] },
): Promise<MaterializeResult> {
  const items: MaterialItem[] = STARTER_CHECKLIST.map((s) => ({
    docTypeId: s.docTypeId,
    reason: s.reason,
    priority: s.priority,
    quantity: 1,
    issuers: [],
  }));

  const { result, client } = await materialize(firmId, clientId, items, 'template', undefined, true);

  await logActivity(firmId, {
    type: 'checklist_generated',
    summary: `Set up a starter checklist for ${client.displayName}.`,
    actor: opts.actor,
    clientId,
    meta: { source: 'starter', total: result.total },
  });

  return result;
}

/**
 * Downloads the object behind a prior-return document, parses it, and either
 * generates from the parse or falls back to the starter list when the parse is
 * too weak to trust. Never throws — a bad PDF still yields a usable checklist.
 */
async function generateFromDocument(
  firmId: string,
  clientId: string,
  documentId: string,
  document: StoredDocument,
  actor: Activity['actor'],
): Promise<{ result: MaterializeResult; confidence: number; usedStarter: boolean }> {
  let prior: PriorYearReturn;
  try {
    const [buffer] = await bucket.file(document.storagePath).download();
    prior = await parsePriorYearReturnFromPdf(buffer);
  } catch {
    prior = emptyPriorYear(new Date().getUTCFullYear() - 1);
  }

  if (planChecklist(prior).source === 'prior_year') {
    const result = await generateChecklistForClient(firmId, clientId, {
      prior,
      sourceDocumentId: documentId,
      actor,
    });
    return { result, confidence: prior.confidence, usedStarter: false };
  }

  const result = await applyStarterChecklist(firmId, clientId, { actor });
  return { result, confidence: prior.confidence, usedStarter: true };
}

async function findPriorReturnDocument(
  firmId: string,
  clientId: string,
): Promise<{ id: string; document: StoredDocument } | undefined> {
  const snap = await db
    .collection(paths.documents(firmId, clientId))
    .where('classification.docTypeId', '==', 'prior-return')
    .limit(10)
    .get();
  if (snap.empty) return undefined;

  const docs = snap.docs.map((d) => ({ id: d.id, document: d.data() as StoredDocument }));
  const ready = docs.find(
    (d) => d.document.state === 'classified' || d.document.state === 'accepted',
  );
  return ready ?? docs[0];
}

// ── Callables ─────────────────────────────────────────────────────────────────

function normalizePriority(value: unknown): RequestPriority {
  return value === 'critical' || value === 'standard' || value === 'optional' ? value : 'standard';
}

function clampCount(value: unknown): number {
  const n = typeof value === 'number' ? Math.round(value) : 1;
  return Number.isFinite(n) ? Math.min(50, Math.max(1, n)) : 1;
}

/** Regenerate a client's checklist on demand from their prior-year return. */
export const generateChecklist = onCall(callableOptions, async (req) => {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const firmId = requireId(data.firmId, 'firmId');
  const clientId = requireId(data.clientId, 'clientId');
  const caller = requireFirmRole(req, firmId, 'preparer');
  const actor = staffActor(caller);

  const clientSnap = await db.doc(paths.client(firmId, clientId)).get();
  if (!clientSnap.exists) throw notFound("We couldn't find that client.");
  const client = clientSnap.data() as Client;

  const explicitId = optionalStr(data.sourceDocumentId);
  let documentId = explicitId ?? client.priorYear?.sourceDocumentId;
  let document: StoredDocument | undefined;

  if (documentId) {
    const docSnap = await db.doc(paths.document(firmId, clientId, documentId)).get();
    if (docSnap.exists) {
      document = docSnap.data() as StoredDocument;
    } else if (explicitId) {
      // The caller named a specific document that isn't there — that's an error.
      throw notFound("That prior-year return has been removed. Upload it again to regenerate.");
    } else {
      // A stale id recorded on the client — fall back to whatever's on file.
      documentId = undefined;
    }
  }

  if (!document) {
    const found = await findPriorReturnDocument(firmId, clientId);
    if (found) {
      documentId = found.id;
      document = found.document;
    }
  }

  if (!documentId || !document) {
    const result = await applyStarterChecklist(firmId, clientId, { actor });
    return { source: 'starter' as const, confidence: 0, ...result };
  }

  const { result, confidence, usedStarter } = await generateFromDocument(
    firmId,
    clientId,
    documentId,
    document,
    actor,
  );
  return { source: usedStarter ? ('starter' as const) : ('prior_year' as const), confidence, ...result };
});

/** Manually add a request the rules didn't infer. */
export const addRequest = onCall(callableOptions, async (req) => {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const firmId = requireId(data.firmId, 'firmId');
  const clientId = requireId(data.clientId, 'clientId');
  const caller = requireFirmRole(req, firmId, 'preparer');
  const actor = staffActor(caller);

  const docTypeId = optionalStr(data.docTypeId);
  if (!docTypeId || !KNOWN_DOC_TYPES.has(docTypeId)) {
    throw invalid('Choose a document type to request.');
  }
  const def = docType(docTypeId);
  const priority = normalizePriority(data.priority);
  const reason = optionalStr(data.reason) ?? def.hint;
  const expectedCount = clampCount(data.expectedCount);
  const instructions = optionalStr(data.instructions);

  const clientSnap = await db.doc(paths.client(firmId, clientId)).get();
  if (!clientSnap.exists) throw notFound("We couldn't find that client.");
  const client = clientSnap.data() as Client;

  const requestsRef = db.collection(paths.requests(firmId, clientId));
  const countSnap = await requestsRef.count().get();
  const ref = requestsRef.doc();
  const request: WithFieldValue<DocRequest> = {
    id: ref.id,
    firmId,
    clientId,
    taxYear: client.taxYear,
    docTypeId,
    reason,
    source: 'manual',
    priority,
    expectedCount,
    status: 'pending',
    documentIds: [],
    dueDate: dueDateFor(priority),
    instructions,
    order: countSnap.data().count * 10,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(request);

  await logActivity(firmId, {
    type: 'request_added',
    summary: `${actor.name} added ${def.code} to ${client.displayName}'s checklist.`,
    actor,
    clientId,
    meta: { docTypeId, requestId: ref.id },
  });

  return { id: ref.id };
});

/** Mark a request as not needed this year, with a reason shown to the client. */
export const waiveRequest = onCall(callableOptions, async (req) => {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const firmId = requireId(data.firmId, 'firmId');
  const clientId = requireId(data.clientId, 'clientId');
  const requestId = requireId(data.requestId, 'requestId');
  const caller = requireFirmRole(req, firmId, 'preparer');
  const actor = staffActor(caller);

  const reason = optionalStr(data.reason);
  if (!reason) throw invalid('Add a short reason so the client knows why it was skipped.');

  const ref = db.doc(paths.request(firmId, clientId, requestId));
  const snap = await ref.get();
  if (!snap.exists) throw notFound('That request no longer exists.');
  const request = snap.data() as DocRequest;

  const patch: WithFieldValue<Partial<DocRequest>> = {
    status: 'waived',
    instructions: reason,
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(patch, { merge: true });

  const clientSnap = await db.doc(paths.client(firmId, clientId)).get();
  const clientName = clientSnap.exists ? (clientSnap.data() as Client).displayName : 'the client';

  await logActivity(firmId, {
    type: 'request_waived',
    summary: `${actor.name} marked ${docType(request.docTypeId).code} as not needed for ${clientName}.`,
    actor,
    clientId,
    meta: { requestId, reason },
  });

  return { ok: true };
});

/** Persist a preparer's manual ordering of the checklist. */
export const reorderRequests = onCall(callableOptions, async (req) => {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const firmId = requireId(data.firmId, 'firmId');
  const clientId = requireId(data.clientId, 'clientId');
  requireFirmRole(req, firmId, 'preparer');

  const ids = Array.isArray(data.order)
    ? data.order.filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, 500)
    : [];
  if (ids.length === 0) throw invalid('Send the request ids in their new order.');

  const batch = db.batch();
  ids.forEach((id, index) => {
    batch.update(db.doc(paths.request(firmId, clientId, id)), {
      order: index * 10,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();

  return { ok: true, count: ids.length };
});

// ── Trigger: the magic moment ─────────────────────────────────────────────────

/**
 * Fires when a document is classified as a prior-year return. Generates the
 * personalised checklist automatically. Wrapped so a malformed PDF logs and
 * exits rather than throwing into an infinite retry.
 */
export const onPriorYearReturnUploaded = onDocumentUpdated(
  { ...triggerOptions, document: 'firms/{firmId}/clients/{clientId}/documents/{documentId}' },
  async (event) => {
    const before = event.data?.before.data() as StoredDocument | undefined;
    const after = event.data?.after.data() as StoredDocument | undefined;
    if (!after) return;

    const isReady =
      after.state === 'classified' && after.classification?.docTypeId === 'prior-return';
    const wasReady =
      before?.state === 'classified' && before?.classification?.docTypeId === 'prior-return';
    if (!isReady || wasReady) return;

    const { firmId, clientId, documentId } = event.params;
    try {
      await generateFromDocument(firmId, clientId, documentId, after, systemActor);
    } catch (err) {
      console.error(
        `onPriorYearReturnUploaded failed for ${firmId}/${clientId}/${documentId}:`,
        err,
      );
    }
  },
);
