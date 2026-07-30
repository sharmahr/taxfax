/**
 * Firm checklist templates. A firm saves a client's checklist as a reusable
 * list and applies it to one client or a filtered set. Deliberately minimal —
 * no versioning, no inheritance — because a template is just a named bundle of
 * requests, and the prior-year parser does the clever part.
 */
import { onCall } from 'firebase-functions/v2/https';
import type { WithFieldValue } from 'firebase-admin/firestore';
import {
  paths,
  type Client,
  type DocRequest,
  type RequestPriority,
  type Timestampish,
} from '@taxfax/shared';
import { FieldValue, db } from '../lib/admin.js';
import { requireFirmRole } from '../lib/guards.js';
import { invalid, notFound } from '../lib/errors.js';
import { callableOptions } from '../lib/options.js';
import { cleanName, optionalStr } from '../lib/validate.js';
import { logActivity } from '../lib/activity.js';
import { materialize } from './generate.js';
import { type MaterialItem } from './plan.js';
import { checklistSort, requireId, staffActor } from './util.js';

const MAX_BULK = 200;

interface TemplateItem {
  docTypeId: string;
  priority: RequestPriority;
  reason: string;
  expectedCount: number;
}

interface ChecklistTemplate {
  id: string;
  firmId: string;
  name: string;
  items: TemplateItem[];
  createdBy: string;
  createdAt: Timestampish;
  updatedAt: Timestampish;
}

function toMaterialItems(items: TemplateItem[]): MaterialItem[] {
  return items.map((i) => ({
    docTypeId: i.docTypeId,
    reason: i.reason,
    priority: i.priority,
    quantity: i.expectedCount,
    issuers: [],
  }));
}

/** Save a client's current checklist as a firm template. */
export const saveChecklistTemplate = onCall(callableOptions, async (req) => {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const firmId = requireId(data.firmId, 'firmId');
  const clientId = requireId(data.clientId, 'clientId');
  const caller = requireFirmRole(req, firmId, 'admin');
  const actor = staffActor(caller);

  const name = cleanName(data.name, 2, 100);
  if (!name) throw invalid('Give the template a name between 2 and 100 characters.');

  const requestsSnap = await db.collection(paths.requests(firmId, clientId)).get();
  const items: TemplateItem[] = requestsSnap.docs
    .map((d) => d.data() as DocRequest)
    .filter((r) => r.status !== 'waived')
    .sort(checklistSort)
    .map((r) => ({
      docTypeId: r.docTypeId,
      priority: r.priority,
      reason: r.reason,
      expectedCount: Math.max(1, r.expectedCount ?? 1),
    }));

  if (items.length === 0) {
    throw invalid("This client has no checklist to save yet. Generate one first.");
  }

  const ref = db.collection(paths.templates(firmId)).doc();
  const template: WithFieldValue<ChecklistTemplate> = {
    id: ref.id,
    firmId,
    name,
    items,
    createdBy: caller.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(template);

  await logActivity(firmId, {
    type: 'checklist_generated',
    summary: `${actor.name} saved the "${name}" checklist template.`,
    actor,
    meta: { templateId: ref.id, items: items.length },
  });

  return { id: ref.id, items: items.length };
});

async function resolveTargets(
  firmId: string,
  data: Record<string, unknown>,
): Promise<string[]> {
  const single = optionalStr(data.clientId);
  if (single) return [single];

  if (Array.isArray(data.clientIds)) {
    const ids = data.clientIds.filter((x): x is string => typeof x === 'string' && x.length > 0);
    return [...new Set(ids)].slice(0, MAX_BULK);
  }

  const tag = optionalStr(data.tag);
  if (tag) {
    const snap = await db
      .collection(paths.clients(firmId))
      .where('tags', 'array-contains', tag)
      .limit(MAX_BULK)
      .get();
    return snap.docs.map((d) => d.id);
  }

  return [];
}

/** Apply a saved template to one client or a filtered set. Additive — never removes existing requests. */
export const applyTemplate = onCall(callableOptions, async (req) => {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const firmId = requireId(data.firmId, 'firmId');
  const templateId = requireId(data.templateId, 'templateId');
  const caller = requireFirmRole(req, firmId, 'admin');
  const actor = staffActor(caller);

  const templateSnap = await db.doc(`${paths.templates(firmId)}/${templateId}`).get();
  if (!templateSnap.exists) throw notFound('That template no longer exists.');
  const template = templateSnap.data() as ChecklistTemplate;
  const items = toMaterialItems(template.items ?? []);
  if (items.length === 0) throw invalid('That template is empty.');

  const targets = await resolveTargets(firmId, data);
  if (targets.length === 0) {
    throw invalid('Choose a client, a set of clients, or a tag to apply the template to.');
  }

  let applied = 0;
  let lastClient: Client | undefined;
  for (const clientId of targets) {
    try {
      const { client } = await materialize(firmId, clientId, items, 'template', undefined, false);
      lastClient = client;
      applied += 1;
    } catch (err) {
      console.error(`applyTemplate: skipped ${firmId}/${clientId}:`, err);
    }
  }

  if (applied === 0) throw notFound('None of the chosen clients could be updated.');

  if (applied === 1 && lastClient) {
    await logActivity(firmId, {
      type: 'checklist_generated',
      summary: `${actor.name} applied the "${template.name}" template to ${lastClient.displayName}.`,
      actor,
      clientId: targets[0],
      meta: { templateId, source: 'template', items: items.length },
    });
  } else {
    await logActivity(firmId, {
      type: 'checklist_generated',
      summary: `${actor.name} applied the "${template.name}" template to ${applied} clients.`,
      actor,
      meta: { templateId, source: 'template', items: items.length, clients: applied },
    });
  }

  return { applied, items: items.length };
});
