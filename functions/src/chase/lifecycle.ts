/**
 * Chase lifecycle — the buttons a firm presses and the triggers that keep the
 * cadence honest.
 *
 * Starting, pausing, resuming, previewing, and firing a step by hand; the
 * completion trigger that guarantees a finished client is never nagged again;
 * and the SMS opt-out path that keeps us on the right side of the TCPA.
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

import { CHASEABLE_STAGES, CLIENT_STAGE_LABEL, ROLE_RANK, groups, isLocaleId, localeRecord, paths, preferLanguage, smsCost } from '@taxfax/shared';
import type { Client, ClientLanguage, ClientStage, Contact, FirmRole } from '@taxfax/shared';

import { logActivity } from '../lib/activity.js';
import { FieldValue, Timestamp, db } from '../lib/admin.js';
import { requireAuth, requireFirmRole } from '../lib/guards.js';
import {
  buildCopyInput,
  completeChase,
  dispatchCount,
  firmContext,
  isSendable,
  loadOutstanding,
  renderStep,
  resolvePreparer,
  resolveRecipients,
  resolveSendTime,
  sendStep,
  textToHtml,
  toDate,
} from './engine.js';

const REGION = 'us-central1';
const CALL_OPTS = { region: REGION } as const;

// ── Input helpers ────────────────────────────────────────────────────────────

interface ClientTarget {
  firmId: string;
  clientId: string;
}

function requireString(v: unknown, name: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new HttpsError('invalid-argument', `${name} is required.`);
  return v.trim();
}

function requireTarget(data: unknown): ClientTarget {
  const d = (data ?? {}) as Record<string, unknown>;
  return { firmId: requireString(d.firmId, 'firmId'), clientId: requireString(d.clientId, 'clientId') };
}

function actorOf(request: CallableRequest<unknown>): { uid?: string; name: string; kind: 'staff' } {
  const t = (request.auth?.token ?? {}) as Record<string, unknown>;
  const name = (t.name as string) || (t.email as string) || 'A teammate';
  return { uid: request.auth?.uid, name, kind: 'staff' };
}

const STARTABLE_STAGES: ClientStage[] = ['not_started', 'awaiting', 'partial'];

// ── startChase ───────────────────────────────────────────────────────────────

export const startChase = onCall(CALL_OPTS, async (request) => {
  const { firmId, clientId } = requireTarget(request.data);
  await requireFirmRole(request, firmId, 'preparer');

  const now = new Date();
  const ref = db.doc(paths.client(firmId, clientId));
  const displayName = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'That client no longer exists.');
    const client = snap.data() as Client;
    if (client.archivedAt) throw new HttpsError('failed-precondition', 'This client is archived.');
    tx.update(ref, {
      'chase.status': 'active',
      'chase.stepIndex': 0,
      'chase.sentCount': 0,
      'chase.startedAt': Timestamp.fromDate(now),
      'chase.nextDueAt': Timestamp.fromDate(now),
      'chase.pausedReason': FieldValue.delete(),
      ...(client.stage === 'not_started' ? { stage: 'awaiting' as ClientStage } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return client.displayName;
  });

  await logActivity(firmId, {
    clientId,
    type: 'checklist_sent',
    summary: `Started chasing ${displayName}. The first reminder goes out shortly.`,
    actor: actorOf(request),
  });
  return { ok: true };
});

// ── startChaseBulk — the season kickoff, made obviously safe ─────────────────

interface BulkFilter {
  stage?: ClientStage;
  tag?: string;
  assignedTo?: string;
}

interface BulkSkip {
  clientId: string;
  displayName: string;
  reason: string;
}

function reachable(c: Client): boolean {
  const cs = [c.primaryContact, c.secondaryContact].filter((x): x is Contact => !!x);
  return cs.some((x) => (x.email && !x.emailOptOut) || (x.phone && !x.smsOptOut));
}

function hasAnyContact(c: Client): boolean {
  const cs = [c.primaryContact, c.secondaryContact].filter((x): x is Contact => !!x);
  return cs.some((x) => x.email || x.phone);
}

function bulkSkipReason(c: Client, firmEnabled: boolean): string | null {
  if (!firmEnabled) return 'Chase is switched off for this firm.';
  if (c.archivedAt) return 'Client is archived.';
  if (c.chase?.status === 'active') return 'Already being chased.';
  if (!STARTABLE_STAGES.includes(c.stage)) return `Stage is “${CLIENT_STAGE_LABEL[c.stage]}”.`;
  if ((c.progress?.total ?? 0) === 0) return 'No checklist has been built yet.';
  if (!hasAnyContact(c)) return 'No email or phone on file.';
  if (!reachable(c)) return 'Every contact has opted out.';
  return null;
}

export const startChaseBulk = onCall(CALL_OPTS, async (request) => {
  const data = (request.data ?? {}) as { firmId?: unknown; clientIds?: unknown; filter?: BulkFilter; dryRun?: unknown };
  const firmId = requireString(data.firmId, 'firmId');
  await requireFirmRole(request, firmId, 'preparer');

  const now = new Date();
  const ctx = await firmContext(firmId, now);
  if (!ctx) throw new HttpsError('not-found', 'Firm not found.');
  const dryRun = data.dryRun !== false; // default to a preview — this button is scary

  // Resolve the candidate set.
  const candidates: Client[] = [];
  if (Array.isArray(data.clientIds) && data.clientIds.length) {
    const ids = data.clientIds.filter((x): x is string => typeof x === 'string').slice(0, 5000);
    for (let i = 0; i < ids.length; i += 300) {
      const refs = ids.slice(i, i + 300).map((id) => db.doc(paths.client(firmId, id)));
      const snaps = await db.getAll(...refs);
      for (const s of snaps) if (s.exists) candidates.push({ id: s.id, ...(s.data() as Omit<Client, 'id'>) } as Client);
    }
  } else {
    const filter = data.filter ?? {};
    let q: FirebaseFirestore.Query = db.collection(paths.clients(firmId));
    if (filter.stage) q = q.where('stage', '==', filter.stage);
    if (filter.assignedTo) q = q.where('assignedTo', '==', filter.assignedTo);
    if (filter.tag) q = q.where('tags', 'array-contains', filter.tag);
    const snap = await q.get();
    snap.forEach((s) => candidates.push({ id: s.id, ...(s.data() as Omit<Client, 'id'>) } as Client));
  }

  const willContact: { clientId: string; displayName: string }[] = [];
  const skipped: BulkSkip[] = [];
  for (const c of candidates) {
    const reason = bulkSkipReason(c, ctx.settings.enabled);
    if (reason) skipped.push({ clientId: c.id, displayName: c.displayName, reason });
    else willContact.push({ clientId: c.id, displayName: c.displayName });
  }

  if (!dryRun && willContact.length) {
    const ts = Timestamp.fromDate(now);
    for (let i = 0; i < willContact.length; i += 400) {
      const batch = db.batch();
      for (const { clientId } of willContact.slice(i, i + 400)) {
        const c = candidates.find((x) => x.id === clientId)!;
        batch.update(db.doc(paths.client(firmId, clientId)), {
          'chase.status': 'active',
          'chase.stepIndex': 0,
          'chase.sentCount': 0,
          'chase.startedAt': ts,
          'chase.nextDueAt': ts,
          'chase.pausedReason': FieldValue.delete(),
          ...(c.stage === 'not_started' ? { stage: 'awaiting' as ClientStage } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
    await logActivity(firmId, {
      type: 'checklist_sent',
      summary: `Started chasing ${willContact.length} ${willContact.length === 1 ? 'client' : 'clients'} in bulk (${skipped.length} skipped).`,
      actor: actorOf(request),
      meta: { willContact: willContact.length, skipped: skipped.length },
    });
  }

  return {
    dryRun,
    counts: { willContact: willContact.length, skipped: skipped.length, considered: candidates.length },
    willContact,
    skipped,
  };
});

// ── pauseChase / resumeChase ─────────────────────────────────────────────────

export const pauseChase = onCall(CALL_OPTS, async (request) => {
  const { firmId, clientId } = requireTarget(request.data);
  await requireFirmRole(request, firmId, 'preparer');
  const reason = String((request.data as { reason?: unknown }).reason ?? '').trim().slice(0, 300) || 'Paused by a preparer.';

  const ref = db.doc(paths.client(firmId, clientId));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'That client no longer exists.');
    const status = (snap.get('chase') as Client['chase'] | undefined)?.status;
    if (status !== 'active' && status !== 'escalated') {
      throw new HttpsError('failed-precondition', 'This client isn’t being actively chased.');
    }
    tx.update(ref, {
      'chase.status': 'paused',
      'chase.pausedReason': reason,
      'chase.nextDueAt': FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await logActivity(firmId, { clientId, type: 'chase_paused', summary: `Paused chasing — ${reason}`, actor: actorOf(request) });
  return { ok: true };
});

export const resumeChase = onCall(CALL_OPTS, async (request) => {
  const { firmId, clientId } = requireTarget(request.data);
  await requireFirmRole(request, firmId, 'preparer');

  const now = new Date();
  const ctx = await firmContext(firmId, now);
  if (!ctx) throw new HttpsError('not-found', 'Firm not found.');
  const nextDue = resolveSendTime(now, ctx.settings, ctx.tz);

  const ref = db.doc(paths.client(firmId, clientId));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'That client no longer exists.');
    const chase = snap.get('chase') as Client['chase'] | undefined;
    if (chase?.status !== 'paused') throw new HttpsError('failed-precondition', 'This chase isn’t paused.');
    tx.update(ref, {
      'chase.status': 'active',
      'chase.pausedReason': FieldValue.delete(),
      'chase.nextDueAt': Timestamp.fromDate(nextDue),
      ...(toDate(chase.startedAt) ? {} : { 'chase.startedAt': Timestamp.fromDate(now) }),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await logActivity(firmId, { clientId, type: 'chase_resumed', summary: 'Resumed chasing.', actor: actorOf(request) });
  return { ok: true, nextDueAt: nextDue.toISOString() };
});

// ── sendChaseNow — fire the current step by hand ─────────────────────────────

export const sendChaseNow = onCall(CALL_OPTS, async (request) => {
  const { firmId, clientId } = requireTarget(request.data);
  await requireFirmRole(request, firmId, 'preparer');
  const force = (request.data as { force?: unknown }).force === true;

  const now = new Date();
  const ctx = await firmContext(firmId, now);
  if (!ctx) throw new HttpsError('not-found', 'Firm not found.');

  const ref = db.doc(paths.client(firmId, clientId));
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'That client no longer exists.');
  const client = { id: snap.id, ...(snap.data() as Omit<Client, 'id'>) } as Client;

  if (!CHASEABLE_STAGES.includes(client.stage)) {
    throw new HttpsError('failed-precondition', `Can’t chase a client that’s “${CLIENT_STAGE_LABEL[client.stage]}”.`);
  }
  const status = client.chase?.status;
  if (status !== 'active' && status !== 'paused') {
    throw new HttpsError('failed-precondition', 'Start or resume the chase before sending a step.');
  }

  const outstanding = await loadOutstanding(firmId, clientId, client.progress?.total);
  if (outstanding.requests.length === 0) {
    await completeChase(ref);
    return { status: 'nothing_outstanding' as const };
  }

  const stepIndex = Math.min(client.chase?.stepIndex ?? 0, ctx.profile.steps.length - 1);
  const step = ctx.profile.steps[stepIndex];

  // `force` bypasses the schedule and quiet hours — but never an opt-out.
  if (!force && !isSendable(now, ctx.settings, ctx.tz)) {
    return { status: 'blocked_quiet_hours' as const, nextSlot: resolveSendTime(now, ctx.settings, ctx.tz).toISOString() };
  }

  const recipients = resolveRecipients(client, step, ctx.settings);
  if (dispatchCount(recipients) === 0) {
    return { status: 'no_reachable_channel' as const, emailSuppressed: recipients.emailSuppressed, smsSuppressed: recipients.smsSuppressed };
  }

  const prep = await resolvePreparer(ctx, client.assignedTo);
  const copy = buildCopyInput(ctx, client, outstanding, prep.name, now);
  const rendered = renderStep(step, copy);

  const result = await sendStep({
    ctx,
    clientRef: ref,
    client,
    stepIndex,
    rendered,
    recipients,
    outstanding,
    now,
    requireDue: false,
    allowStatuses: ['active', 'paused'],
  });

  if (result.outcome === 'sent') {
    await logActivity(firmId, {
      clientId,
      type: 'chase_sent',
      summary: `Sent the “${step.tone}” reminder to ${client.displayName} by hand.`,
      actor: actorOf(request),
      meta: { stepIndex, tone: step.tone, dispatches: result.dispatches, escalated: result.escalated },
    });
  }
  return { status: result.outcome, escalated: result.outcome === 'sent' ? result.escalated : undefined };
});

// ── previewChase — show, to the character, what would go out ──────────────────

export const previewChase = onCall(CALL_OPTS, async (request) => {
  const { firmId, clientId } = requireTarget(request.data);
  await requireFirmRole(request, firmId, 'preparer');

  const now = new Date();
  const ctx = await firmContext(firmId, now);
  if (!ctx) throw new HttpsError('not-found', 'Firm not found.');

  const snap = await db.doc(paths.client(firmId, clientId)).get();
  if (!snap.exists) throw new HttpsError('not-found', 'That client no longer exists.');
  const client = { id: snap.id, ...(snap.data() as Omit<Client, 'id'>) } as Client;

  const outstanding = await loadOutstanding(firmId, clientId, client.progress?.total);
  const rawIndex = typeof (request.data as { stepIndex?: unknown }).stepIndex === 'number'
    ? (request.data as { stepIndex: number }).stepIndex
    : client.chase?.stepIndex ?? 0;
  const stepIndex = Math.min(Math.max(rawIndex, 0), ctx.profile.steps.length - 1);
  const step = ctx.profile.steps[stepIndex];

  const prep = await resolvePreparer(ctx, client.assignedTo);
  const copy = buildCopyInput(ctx, client, outstanding, prep.name, now);
  const rendered = renderStep(step, copy);
  const recipients = resolveRecipients(client, step, ctx.settings);

  return {
    stepIndex,
    tone: step.tone,
    channels: step.channels,
    locale: copy.locale,
    email: rendered.email
      ? {
          subject: rendered.email.subject,
          text: rendered.email.body,
          html: textToHtml(rendered.email.body, copy.locale),
        }
      : null,
    sms: rendered.sms,
    smsCost: rendered.sms ? smsCost(rendered.sms) : null,
    recipients: {
      emails: recipients.emails,
      phones: recipients.phones,
      emailSuppressed: recipients.emailSuppressed,
      smsSuppressed: recipients.smsSuppressed,
    },
    outstanding: copy.outstanding,
    outstandingCount: outstanding.requests.length,
    totalCount: outstanding.totalCount,
    daysWaiting: copy.daysWaiting,
    daysToDeadline: copy.daysToDeadline,
  };
});

// ── onChecklistComplete — the one bug we cannot ship ──────────────────────────

function looksComplete(c: Client | undefined): boolean {
  if (!c) return false;
  return (c.progress?.percent ?? 0) >= 100 || c.stage === 'in_review' || c.stage === 'ready' || c.stage === 'filed';
}

export const onChecklistComplete = onDocumentUpdated({ document: 'firms/{firmId}/clients/{clientId}', region: REGION }, async (event) => {
  const after = event.data?.after.data() as Client | undefined;
  if (!after) return;

  // Only ever stop something that's currently running. This gate also breaks
  // the self-trigger loop: our own write flips status to 'complete', and the
  // re-fired event falls straight through here.
  const status = after.chase?.status;
  if (status !== 'active' && status !== 'paused' && status !== 'escalated') return;
  if (!looksComplete(after)) return;

  await event.data!.after.ref.update({
    'chase.status': 'complete',
    'chase.nextDueAt': FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await logActivity(event.params.firmId, {
    clientId: event.params.clientId,
    type: 'stage_changed',
    summary: `${after.displayName} is all in — chasing stopped automatically.`,
    actor: { name: 'TaxFax', kind: 'system' },
  });
});

// ── SMS opt-out (TCPA) ───────────────────────────────────────────────────────
//
// The official twilio/send-message extension only SENDS; it has no inbound
// path. So opt-out arrives one of two ways:
//   1. handleSmsOptOut — fires when a carrier STOP reply lands in an `inboundSms`
//      collection. ASSUMPTION: the operator points a Twilio inbound webhook (or
//      Studio flow) at that collection, writing { from, to, body }. Documented
//      in the report; if that isn't wired, path (2) still fully covers opt-out.
//   2. optOutSms — a callable the portal invokes when a taxpayer flips the
//      "text me" switch off.
// Either way we set Contact.smsOptOut, which resolveRecipients honours forever.

const STOP_WORDS = new Set(['STOP', 'STOPALL', 'STOP ALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'REVOKE', 'OPTOUT', 'OPT OUT']);
const START_WORDS = new Set(['START', 'UNSTOP', 'YES', 'UNSUBSCRIBE STOP']);

async function setSmsOptOutByPhone(phone: string, value: boolean): Promise<number> {
  let touched = 0;
  for (const field of ['primaryContact', 'secondaryContact'] as const) {
    const snap = await db.collectionGroup(groups.clients).where(`${field}.phone`, '==', phone).get();
    for (const doc of snap.docs) {
      const c = doc.data() as Client;
      if (c[field]?.smsOptOut === value) continue;
      await doc.ref.update({ [`${field}.smsOptOut`]: value, updatedAt: FieldValue.serverTimestamp() });
      touched += 1;
      await logActivity(c.firmId, {
        clientId: doc.id,
        type: value ? 'chase_paused' : 'chase_resumed',
        summary: value
          ? `${c[field]?.name ?? 'A contact'} replied STOP — SMS turned off (TCPA). Email still on.`
          : `${c[field]?.name ?? 'A contact'} opted back in to text reminders.`,
        actor: { name: 'Taxpayer', kind: 'client' },
      });
    }
  }
  return touched;
}

export const handleSmsOptOut = onDocumentCreated({ document: 'inboundSms/{id}', region: REGION }, async (event) => {
  const d = event.data?.data() as { from?: string; body?: string } | undefined;
  if (!d?.from) return;
  const kw = String(d.body ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  const optOut = STOP_WORDS.has(kw);
  const optIn = START_WORDS.has(kw);
  if (!optOut && !optIn) return;

  const touched = await setSmsOptOutByPhone(d.from.trim(), optOut);
  logger.info('chase: inbound SMS opt-out processed', { keyword: kw, optOut, touched });
});

/** Portal-facing opt-out. Accepts the taxpayer (portal claim) or firm staff. */
export const optOutSms = onCall(CALL_OPTS, async (request) => {
  const { firmId, clientId } = requireTarget(request.data);
  await requireAuth(request);

  const token = (request.auth?.token ?? {}) as { portal?: { firmId?: string; clientId?: string }; firms?: Record<string, FirmRole> };
  const isPortal = token.portal?.firmId === firmId && token.portal?.clientId === clientId;
  const role = token.firms?.[firmId];
  const isStaff = !!role && ROLE_RANK[role] >= ROLE_RANK.preparer;
  if (!isPortal && !isStaff) throw new HttpsError('permission-denied', 'You can’t change this client’s messaging settings.');

  const data = request.data as { contact?: unknown; channel?: unknown; optOut?: unknown };
  const which = data.contact === 'secondary' ? 'secondaryContact' : 'primaryContact';
  const field = data.channel === 'email' ? 'emailOptOut' : 'smsOptOut';
  const value = data.optOut !== false; // default: opt out

  await db.doc(paths.client(firmId, clientId)).update({ [`${which}.${field}`]: value, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true, contact: which, channel: field === 'emailOptOut' ? 'email' : 'sms', optOut: value };
});

// ── setChaseLanguage — the human override ────────────────────────────────────

/**
 * Set the language a taxpayer is written to in.
 *
 * Accepts the taxpayer through their portal claim, or firm staff. Which one it
 * is decides the precedence: a taxpayer's own choice outranks the preparer's,
 * and both outrank whatever we detected on last year's Schedule LEP. The
 * taxpayer cannot write their client document directly (the rules forbid it),
 * which is exactly why this is a callable and not a client-side update.
 */
export const setChaseLanguage = onCall(CALL_OPTS, async (request) => {
  const { firmId, clientId } = requireTarget(request.data);
  await requireAuth(request);

  const token = (request.auth?.token ?? {}) as { portal?: { firmId?: string; clientId?: string }; firms?: Record<string, FirmRole> };
  const isPortal = token.portal?.firmId === firmId && token.portal?.clientId === clientId;
  const role = token.firms?.[firmId];
  const isStaff = !!role && ROLE_RANK[role] >= ROLE_RANK.preparer;
  if (!isPortal && !isStaff) throw new HttpsError('permission-denied', 'You can’t change this client’s messaging settings.');

  const locale = (request.data as { locale?: unknown }).locale;
  if (!isLocaleId(locale)) throw new HttpsError('invalid-argument', 'That language is not one we write in.');

  const next: ClientLanguage = {
    locale,
    source: isPortal ? 'taxpayer' : 'preparer',
    updatedAt: Timestamp.now(),
  };

  const ref = db.doc(paths.client(firmId, clientId));
  const applied = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'That client no longer exists.');
    const current = (snap.data() as Client).language;
    // Carry the Schedule LEP evidence forward: a human choosing a language does
    // not erase the fact that the IRS was told something different.
    const merged = preferLanguage(current, {
      ...next,
      ...(current?.lepCode ? { lepCode: current.lepCode } : {}),
      ...(current?.unsupported ? { unsupported: current.unsupported } : {}),
    });
    if (merged) tx.set(ref, { language: merged, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return merged ?? current ?? next;
  });

  return { ok: true, locale: applied.locale, source: applied.source, name: localeRecord(applied.locale).endonym };
});
