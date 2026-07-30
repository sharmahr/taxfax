/**
 * Small shared helpers for the checklist engine: how a checklist is ordered,
 * when each item is due, and how a caller/trigger identifies itself in the
 * activity feed.
 */
import { DOC_CATEGORY_ORDER, docType, type Activity, type RequestPriority } from '@taxfax/shared';
import { Timestamp } from '../lib/admin.js';
import { invalid } from '../lib/errors.js';
import type { Caller } from '../lib/guards.js';

const PRIORITY_RANK: Record<RequestPriority, number> = { critical: 0, standard: 1, optional: 2 };

/** Days a taxpayer gets before an item is chased — the critical few come first. */
const DUE_DAYS: Record<RequestPriority, number> = { critical: 14, standard: 30, optional: 45 };

/** A required Firestore id from callable input: non-empty, no path separators. */
export function requireId(value: unknown, field: string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0 && trimmed.length <= 1500 && !trimmed.includes('/')) return trimmed;
  }
  throw invalid(`Missing or invalid ${field}.`);
}

export function dueDateFor(priority: RequestPriority, from: Date = new Date()): Timestamp {
  const due = new Date(from);
  due.setUTCDate(due.getUTCDate() + DUE_DAYS[priority]);
  return Timestamp.fromDate(due);
}

/** Reads top-to-bottom in `DOC_CATEGORY_ORDER`, most urgent first within a category. */
export function checklistSort(
  a: { docTypeId: string; priority: RequestPriority },
  b: { docTypeId: string; priority: RequestPriority },
): number {
  const ca = DOC_CATEGORY_ORDER.indexOf(docType(a.docTypeId).category);
  const cb = DOC_CATEGORY_ORDER.indexOf(docType(b.docTypeId).category);
  if (ca !== cb) return ca - cb;
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

export function staffActor(caller: Caller): Activity['actor'] {
  const name =
    (caller.token.name as string | undefined) ?? caller.token.email ?? 'A teammate';
  return { uid: caller.uid, name, kind: 'staff' };
}

/** The parser runs on a Storage trigger with no signed-in user behind it. */
export const systemActor: Activity['actor'] = { name: 'TaxFax', kind: 'system' };
