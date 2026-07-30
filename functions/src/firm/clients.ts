import { onCall } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import type { WithFieldValue } from 'firebase-admin/firestore';
import {
  paths,
  type Client,
  type ClientChaseState,
  type ClientProgress,
  type Contact,
  type EntityType,
  type FilingStatus,
  type Firm,
} from '@taxfax/shared';
import { db, FieldValue } from '../lib/admin.js';
import { requireFirmRole } from '../lib/guards.js';
import { exhausted, invalid, notFound } from '../lib/errors.js';
import { logActivity } from '../lib/activity.js';
import { callableOptions, triggerOptions } from '../lib/options.js';
import { cleanName, isPlainObject, normEmail, normPhone, normTags, optionalStr } from '../lib/validate.js';
import { tsMillis } from './util.js';

const IMPORT_MAX_ROWS = 2000;
const BATCH_SIZE = 400;
const ENTITY_WORDS = /\b(llc|inc|incorporated|corp|corporation|ltd|lp|llp|plc|co|company|trust|estate|foundation|partners|partnership|associates|group|holdings|enterprises|ventures)\b/i;

function coerceEntity(raw: unknown): EntityType {
  if (typeof raw !== 'string') return 'individual';
  const s = raw.toLowerCase();
  if (/1120-?s|s-?corp|s corp|subchapter s/.test(s)) return 's-corp';
  if (/1120|c-?corp|c corp/.test(s)) return 'c-corp';
  if (/1065|partnership|llc|partners|\blp\b|llp/.test(s)) return 'partnership';
  if (/1041|trust|estate|fiduciary/.test(s)) return 'trust';
  if (/990|non-?profit|not-for-profit|exempt|charity/.test(s)) return 'nonprofit';
  return 'individual';
}

function coerceFiling(raw: unknown): FilingStatus | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.toLowerCase().replace(/[^a-z ]/g, '');
  if (/mfj|married filing joint|joint/.test(s)) return 'mfj';
  if (/mfs|married filing separate|separate/.test(s)) return 'mfs';
  if (/hoh|head of house/.test(s)) return 'hoh';
  if (/qw|widow|surviving spouse/.test(s)) return 'qw';
  if (/single/.test(s)) return 'single';
  if (/entity|business|corp|partnership/.test(s)) return 'entity';
  return undefined;
}

/** Last-name-first for individuals, entity name otherwise; lower-cased so the roster sorts case-insensitively. */
function deriveSortName(displayName: string, entityType: EntityType): string {
  const name = displayName.replace(/\s+/g, ' ').trim();
  if (entityType !== 'individual' || ENTITY_WORDS.test(name)) return name.toLowerCase();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name.toLowerCase();
  const last = parts[parts.length - 1]!;
  const rest = parts.slice(0, -1).join(' ');
  return `${last} ${rest}`.toLowerCase();
}

function defaultProgress(): ClientProgress {
  return { total: 0, received: 0, accepted: 0, rejected: 0, overdue: 0, percent: 0 };
}

function defaultChaseState(): ClientChaseState {
  return { status: 'idle', stepIndex: 0, sentCount: 0 };
}

function buildContact(name: string, email: string | null, phone: string | null): Contact {
  return { name, ...(email ? { email } : {}), ...(phone ? { phone } : {}) } as Contact;
}

// ── createClient ────────────────────────────────────────────────────────────
// Direct client creation is allowed by the rules; this callable exists for the
// derived state the client can't compute — sortName, the initial progress
// counters, and the initial chase state — plus contact validation.
export const createClient = onCall(callableOptions, async (req) => {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const firmId = typeof data.firmId === 'string' ? data.firmId : '';
  if (!firmId) throw invalid('Missing the workspace this client belongs to.');

  const caller = requireFirmRole(req, firmId, 'preparer');

  const displayName = cleanName(data.displayName, 1, 200);
  if (!displayName) throw invalid("Give the client a name — that's all we need to start.");

  const primary = isPlainObject(data.primaryContact) ? data.primaryContact : {};
  const primaryName = cleanName(primary.name, 1, 200) ?? displayName;
  const primaryEmail = normEmail(primary.email);
  if (primary.email !== undefined && primary.email !== '' && !primaryEmail) {
    throw invalid("That primary contact email doesn't look right. Fix it or leave it blank.");
  }
  const primaryPhone = normPhone(primary.phone);

  let secondary: Contact | undefined;
  if (isPlainObject(data.secondaryContact)) {
    const sName = cleanName(data.secondaryContact.name, 1, 200);
    const sEmail = normEmail(data.secondaryContact.email);
    if (sName) secondary = buildContact(sName, sEmail, normPhone(data.secondaryContact.phone));
  }

  const entityType = coerceEntity(data.entityType);
  const filingStatus =
    coerceFiling(data.filingStatus) ?? (entityType === 'individual' ? undefined : 'entity');
  const tags = normTags(data.tags);
  const notes = optionalStr(data.notes);

  const firmSnap = await db.doc(paths.firm(firmId)).get();
  if (!firmSnap.exists) throw notFound('That workspace no longer exists.');
  const firm = firmSnap.data() as Firm;
  const taxYear = Number.isInteger(data.taxYear) ? (data.taxYear as number) : firm.taxYear;

  let assignedTo: string | undefined;
  if (typeof data.assignedTo === 'string' && data.assignedTo) {
    const memberSnap = await db.doc(paths.member(firmId, data.assignedTo)).get();
    if (!memberSnap.exists) throw invalid("You can only assign clients to someone on your team.");
    assignedTo = data.assignedTo;
  }

  const ref = db.collection(paths.clients(firmId)).doc();
  const client: WithFieldValue<Client> = {
    id: ref.id,
    firmId,
    taxYear,
    displayName,
    sortName: deriveSortName(displayName, entityType),
    entityType,
    filingStatus,
    primaryContact: buildContact(primaryName, primaryEmail, primaryPhone),
    secondaryContact: secondary,
    assignedTo,
    tags,
    stage: 'not_started',
    progress: defaultProgress(),
    chase: defaultChaseState(),
    notes,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(client);

  const actorName = cleanName(caller.token.name, 1, 120) ?? 'A teammate';
  await logActivity(firmId, {
    type: 'client_created',
    summary: `${actorName} added ${displayName} as a client.`,
    actor: { uid: caller.uid, name: actorName, kind: 'staff' },
    clientId: ref.id,
  });

  return { clientId: ref.id };
});

// ── onClientWritten ─────────────────────────────────────────────────────────
// Keeps every client — however it was written — internally consistent: derives
// sortName, seeds progress/chase when absent, normalises entityType, and keeps
// updatedAt fresh. Loop-safe: it only writes fields that are actually stale, and
// never re-bumps updatedAt when the writer already set it.
export const onClientWritten = onDocumentWritten(
  { ...triggerOptions, document: 'firms/{firmId}/clients/{clientId}' },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;

    const data = after.data()!;
    const before = event.data?.before;
    const beforeData = before?.exists ? before.data()! : null;

    const patch: Record<string, unknown> = {};

    const displayName = typeof data.displayName === 'string' ? data.displayName : '';
    const entityType = coerceEntity(data.entityType);
    if (data.entityType !== entityType) patch.entityType = entityType;

    if (displayName) {
      const sortName = deriveSortName(displayName, entityType);
      if (data.sortName !== sortName) patch.sortName = sortName;
    }
    if (!data.progress) patch.progress = defaultProgress();
    if (!data.chase) patch.chase = defaultChaseState();
    if (typeof data.stage !== 'string') patch.stage = 'not_started';
    if (!Array.isArray(data.tags)) patch.tags = [];
    if (typeof data.taxYear !== 'number') {
      const firmSnap = await db.doc(paths.firm(event.params.firmId)).get();
      patch.taxYear = firmSnap.exists ? (firmSnap.data() as Firm).taxYear : 0;
    }

    const writerSetUpdatedAt = beforeData
      ? tsMillis(data.updatedAt) !== tsMillis(beforeData.updatedAt)
      : data.updatedAt != null;

    const managed = new Set(['sortName', 'progress', 'chase', 'updatedAt', 'entityType']);
    let contentChanged = !beforeData;
    if (beforeData) {
      const keys = new Set([...Object.keys(beforeData), ...Object.keys(data)]);
      for (const key of keys) {
        if (managed.has(key)) continue;
        if (JSON.stringify(beforeData[key]) !== JSON.stringify(data[key])) {
          contentChanged = true;
          break;
        }
      }
    }
    if (contentChanged && !writerSetUpdatedAt) patch.updatedAt = FieldValue.serverTimestamp();

    if (Object.keys(patch).length === 0) return;
    await after.ref.set(patch, { merge: true });
  },
);

// ── importClients ───────────────────────────────────────────────────────────
interface ImportRow {
  displayName?: unknown;
  email?: unknown;
  phone?: unknown;
  entityType?: unknown;
  filingStatus?: unknown;
  tags?: unknown;
  assignedTo?: unknown;
}

export const importClients = onCall(callableOptions, async (req) => {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const firmId = typeof data.firmId === 'string' ? data.firmId : '';
  if (!firmId) throw invalid('Missing the workspace to import into.');

  const caller = requireFirmRole(req, firmId, 'preparer');

  const rows = Array.isArray(data.rows) ? (data.rows as ImportRow[]) : null;
  if (!rows) throw invalid('Nothing to import — send an array of client rows.');
  if (rows.length === 0) throw invalid("That file didn't have any rows we could read.");
  if (rows.length > IMPORT_MAX_ROWS) {
    throw exhausted(
      `That's ${rows.length} clients in one go — the limit is ${IMPORT_MAX_ROWS}. Split the file and import again; we'll dedupe across both.`,
    );
  }

  const firmSnap = await db.doc(paths.firm(firmId)).get();
  if (!firmSnap.exists) throw notFound('That workspace no longer exists.');
  const firm = firmSnap.data() as Firm;
  const taxYear = Number.isInteger(data.taxYear) ? (data.taxYear as number) : firm.taxYear;

  // Resolve assignees by uid or email; anything unrecognised is left unassigned.
  const membersSnap = await db.collection(paths.members(firmId)).get();
  const memberUids = new Set<string>();
  const emailToUid = new Map<string, string>();
  for (const doc of membersSnap.docs) {
    memberUids.add(doc.id);
    const email = normEmail((doc.data() as { email?: unknown }).email);
    if (email) emailToUid.set(email, doc.id);
  }
  const resolveAssignee = (raw: unknown): string | undefined => {
    if (typeof raw !== 'string' || !raw.trim()) return undefined;
    const v = raw.trim();
    if (memberUids.has(v)) return v;
    return emailToUid.get(v.toLowerCase());
  };
  const defaultAssignee = resolveAssignee(data.defaultAssignedTo);

  // Existing emails for this season, so re-importing the same CSV is a no-op.
  const existingSnap = await db
    .collection(paths.clients(firmId))
    .where('taxYear', '==', taxYear)
    .select('primaryContact.email')
    .get();
  const existingEmails = new Set<string>();
  for (const doc of existingSnap.docs) {
    const email = normEmail((doc.data() as { primaryContact?: { email?: unknown } }).primaryContact?.email);
    if (email) existingEmails.add(email);
  }

  const seen = new Set<string>();
  const errors: { row: number; reason: string }[] = [];
  const toCreate: { ref: FirebaseFirestore.DocumentReference; client: WithFieldValue<Client> }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!isPlainObject(row)) {
      errors.push({ row: i, reason: 'That row was empty or malformed.' });
      continue;
    }
    const displayName = cleanName(row.displayName, 1, 200);
    if (!displayName) {
      errors.push({ row: i, reason: 'Missing a client name.' });
      continue;
    }
    const email = normEmail(row.email);
    if (email) {
      if (existingEmails.has(email) || seen.has(email)) continue;
      seen.add(email);
    }

    const entityType = coerceEntity(row.entityType);
    const ref = db.collection(paths.clients(firmId)).doc();
    toCreate.push({
      ref,
      client: {
        id: ref.id,
        firmId,
        taxYear,
        displayName,
        sortName: deriveSortName(displayName, entityType),
        entityType,
        filingStatus: coerceFiling(row.filingStatus) ?? (entityType === 'individual' ? undefined : 'entity'),
        primaryContact: buildContact(displayName, email, normPhone(row.phone)),
        assignedTo: resolveAssignee(row.assignedTo) ?? defaultAssignee,
        tags: normTags(row.tags),
        stage: 'not_started',
        progress: defaultProgress(),
        chase: defaultChaseState(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
    });
  }

  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const { ref, client } of toCreate.slice(i, i + BATCH_SIZE)) batch.set(ref, client);
    await batch.commit();
  }

  const created = toCreate.length;
  const skipped = rows.length - created - errors.length;

  if (created > 0) {
    const actorName = cleanName(caller.token.name, 1, 120) ?? 'A teammate';
    await logActivity(firmId, {
      type: 'client_imported',
      summary: `${actorName} imported ${created} ${created === 1 ? 'client' : 'clients'}.`,
      actor: { uid: caller.uid, name: actorName, kind: 'staff' },
      meta: { created, skipped, errors: errors.length },
    });
  }

  return { created, skipped, errors };
});
