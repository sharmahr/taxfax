/**
 * Chase engine core — the shared machinery behind the scheduler, the lifecycle
 * callables, and the delivery mirrors.
 *
 * Everything user-facing (the actual words) lives in @taxfax/shared. This file
 * is the plumbing: turn a due client into the right message, to the right
 * people, at a decent hour, exactly once.
 */

import {
  CHASE_PROFILES,
  DEFAULT_CHASE_SETTINGS,
  TONE_LABEL,
  directionOf,
  docCodeLabel,
  docType,
  effectiveLocale,
  multilingualEnabled,
  nextSendableSlot,
  paths,
  renderEmail,
  renderSms,
  stepDueAt,
  t,
} from '@taxfax/shared';
import type {
  ChaseChannel,
  ChaseCopyInput,
  ChaseProfile,
  ChaseSettings,
  ChaseStep,
  ChaseTone,
  Client,
  ClientChaseState,
  Contact,
  DocRequest,
  Firm,
  FirmMember,
  LocaleId,
  RenderedMessage,
  RequestPriority,
  Timestampish,
} from '@taxfax/shared';

import { FieldValue, Timestamp, db } from '../lib/admin.js';
import { escapeHtml } from '../lib/mail.js';

// ── Tunables ─────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** At least this long between two messages to the same client, always. Stops a
 *  catch-up (a paused firm resuming, a backed-up sweep) from firing a burst. */
const MIN_STEP_GAP_MS = 18 * 60 * 60 * 1000;

/** A client that errored this sweep: retry next quarter-hour, not in a tight loop. */
export const ERROR_COOLDOWN_MS = 15 * 60 * 1000;

/** Hard ceiling on dispatches per firm per UTC day. Defence in depth: even if
 *  quiet hours and idempotency both fail, one firm can't blast the world. */
const DAILY_SEND_CAP = Number(process.env.CHASE_DAILY_SEND_CAP ?? 2500);

/** Verified sending identity. Replies are redirected per-firm via replyTo. */
const EMAIL_SENDER = process.env.CHASE_EMAIL_SENDER ?? 'no-reply@mail.taxfax.xyz';
const PORTAL_BASE = (process.env.PORTAL_BASE_URL ?? 'https://taxfax.xyz').replace(/\/+$/, '');

const PRIORITY_RANK: Record<RequestPriority, number> = { critical: 0, standard: 1, optional: 2 };

/** A checklist line the taxpayer still owes us. */
const OUTSTANDING_STATUSES = ['pending', 'rejected'] as const;

// ── Time helpers (IANA-timezone aware, via Intl — no date-fns-tz) ────────────

const HOUR_FMT_CACHE = new Map<string, Intl.DateTimeFormat>();
const DOW_FMT_CACHE = new Map<string, Intl.DateTimeFormat>();
const YMD_FMT_CACHE = new Map<string, Intl.DateTimeFormat>();

function hourFmt(tz: string): Intl.DateTimeFormat {
  let f = HOUR_FMT_CACHE.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false });
    HOUR_FMT_CACHE.set(tz, f);
  }
  return f;
}

const DOW_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function dowFmt(tz: string): Intl.DateTimeFormat {
  let f = DOW_FMT_CACHE.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
    DOW_FMT_CACHE.set(tz, f);
  }
  return f;
}

function ymdFmt(tz: string): Intl.DateTimeFormat {
  let f = YMD_FMT_CACHE.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    YMD_FMT_CACHE.set(tz, f);
  }
  return f;
}

/** Hour 0–23 at instant `d`, read in `tz`. Handles DST because it formats an
 *  absolute instant. `24` (some ICU builds render midnight as 24) folds to 0. */
export function hourInTimeZone(d: Date, tz: string): number {
  const h = Number(hourFmt(tz).format(d));
  return Number.isNaN(h) ? d.getUTCHours() : h % 24;
}

/** Day of week 0 (Sun) – 6 (Sat) at instant `d`, read in `tz`. */
export function dayInTimeZone(d: Date, tz: string): number {
  const wd = dowFmt(tz).format(d);
  return DOW_INDEX[wd] ?? d.getUTCDay();
}

function inQuietHours(hour: number, quiet: ChaseSettings['quietHours']): boolean {
  return quiet.start > quiet.end
    ? hour >= quiet.start || hour < quiet.end
    : hour >= quiet.start && hour < quiet.end;
}

/** Is `d` a decent, legal moment to deliver — outside quiet hours, off weekends
 *  (unless the firm allows them)? Evaluated in the firm's timezone. */
export function isSendable(d: Date, settings: Pick<ChaseSettings, 'quietHours' | 'sendOnWeekends'>, tz: string): boolean {
  if (inQuietHours(hourInTimeZone(d, tz), settings.quietHours)) return false;
  const day = dayInTimeZone(d, tz);
  if ((day === 0 || day === 6) && !settings.sendOnWeekends) return false;
  return true;
}

/**
 * The first sendable instant at or after `candidate`, in the firm's timezone.
 * Thin adapter over the shared `nextSendableSlot` — it supplies the IANA
 * hour/day accessors and does the boundary jump itself (quiet hours + weekends
 * in one call), so there is nothing to iterate here.
 */
export function resolveSendTime(candidate: Date, settings: ChaseSettings, tz: string): Date {
  return nextSendableSlot(candidate, settings, (d) => hourInTimeZone(d, tz), (d) => dayInTimeZone(d, tz));
}

/** Whole calendar days from today to the firm's filing deadline, in `tz`.
 *  Rolls to next year once this year's deadline has passed. Never negative. */
export function daysToDeadline(now: Date, deadlineMMDD: string, tz: string): number {
  const [mm, dd] = deadlineMMDD.split('-').map(Number);
  const todayStr = ymdFmt(tz).format(now); // YYYY-MM-DD
  const today = new Date(`${todayStr}T00:00:00Z`);
  const year = today.getUTCFullYear();
  let deadline = new Date(Date.UTC(year, (mm || 1) - 1, dd || 15));
  if (deadline.getTime() < today.getTime()) deadline = new Date(Date.UTC(year + 1, (mm || 1) - 1, dd || 15));
  return Math.max(0, Math.round((deadline.getTime() - today.getTime()) / DAY_MS));
}

export function toDate(v: Timestampish | undefined | null): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  if (typeof (v as Timestamp).toDate === 'function') return (v as Timestamp).toDate();
  if (typeof (v as { seconds: number }).seconds === 'number') return new Date((v as { seconds: number }).seconds * 1000);
  return null;
}

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

// ── Firm context (cached once per sweep) ─────────────────────────────────────

interface Preparer {
  name: string;
  email: string | null;
  phone?: string;
}

export interface FirmContext {
  firmId: string;
  firm: Firm;
  settings: ChaseSettings;
  profile: ChaseProfile;
  tz: string;
  counterRef: FirebaseFirestore.DocumentReference;
  dailyBase: number;
  dailySpent: number;
  capNotified: boolean;
  members: Map<string, Preparer>;
}

export type FirmCache = Map<string, FirmContext | null>;

export function firmSettings(firm: Firm): ChaseSettings {
  return { ...DEFAULT_CHASE_SETTINGS, ...(firm.chase ?? {}) };
}

export function profileFor(settings: ChaseSettings): ChaseProfile {
  return CHASE_PROFILES[settings.profile] ?? CHASE_PROFILES.standard;
}

/** Load a firm once per sweep, along with today's send-cap counter. */
export async function loadFirmContext(firmId: string, cache: FirmCache, now: Date): Promise<FirmContext | null> {
  const cached = cache.get(firmId);
  if (cached !== undefined) return cached;

  const firmSnap = await db.doc(paths.firm(firmId)).get();
  if (!firmSnap.exists) {
    cache.set(firmId, null);
    return null;
  }
  const firm = { id: firmSnap.id, ...(firmSnap.data() as Omit<Firm, 'id'>) } as Firm;
  const settings = firmSettings(firm);
  const counterRef = db.doc(`${paths.firm(firmId)}/chaseMeta/${utcDayKey(now)}`);
  const counterSnap = await counterRef.get();

  const ctx: FirmContext = {
    firmId,
    firm,
    settings,
    profile: profileFor(settings),
    tz: firm.timezone || 'America/Chicago',
    counterRef,
    dailyBase: Number(counterSnap.get('sends') ?? 0),
    dailySpent: 0,
    capNotified: false,
    members: new Map(),
  };
  cache.set(firmId, ctx);
  return ctx;
}

/** Build a firm context on demand (callables, triggers) without a shared cache. */
export async function firmContext(firmId: string, now: Date): Promise<FirmContext | null> {
  return loadFirmContext(firmId, new Map(), now);
}

export async function resolvePreparer(ctx: FirmContext, uid: string | undefined): Promise<Preparer> {
  const fallback: Preparer = {
    name: ctx.firm.branding?.displayName || ctx.firm.name,
    email: ctx.firm.branding?.replyToEmail ?? null,
    phone: ctx.firm.branding?.supportPhone,
  };
  if (!uid) return fallback;
  const cached = ctx.members.get(uid);
  if (cached) return cached;
  const snap = await db.doc(paths.member(ctx.firmId, uid)).get();
  const m = snap.data() as FirmMember | undefined;
  const p: Preparer = m ? { name: m.name, email: m.email } : fallback;
  ctx.members.set(uid, p);
  return p;
}

export function remainingDailyBudget(ctx: FirmContext): number {
  return DAILY_SEND_CAP - ctx.dailyBase - ctx.dailySpent;
}

// ── Recipients ───────────────────────────────────────────────────────────────

export interface Recipients {
  emails: string[];
  phones: string[];
  /** Channel was called for by the step, a contact exists on it, all opted out. */
  emailSuppressed: boolean;
  smsSuppressed: boolean;
}

function contactsOf(client: Client): Contact[] {
  return [client.primaryContact, client.secondaryContact].filter((c): c is Contact => !!c);
}

export function resolveRecipients(client: Client, step: ChaseStep, settings: ChaseSettings): Recipients {
  const contacts = contactsOf(client);
  const wantEmail = step.channels.includes('email');
  const wantSms = step.channels.includes('sms') && settings.smsEnabled;

  const emails = wantEmail
    ? [...new Set(contacts.filter((c) => c.email && !c.emailOptOut).map((c) => c.email.trim()))]
    : [];
  const phones = wantSms
    ? [...new Set(contacts.filter((c) => c.phone && !c.smsOptOut).map((c) => c.phone!.trim()))]
    : [];

  return {
    emails,
    phones,
    emailSuppressed: wantEmail && emails.length === 0 && contacts.some((c) => c.email),
    smsSuppressed: wantSms && phones.length === 0 && contacts.some((c) => c.phone),
  };
}

export function dispatchCount(rec: Recipients): number {
  return (rec.emails.length > 0 ? 1 : 0) + rec.phones.length;
}

// ── Outstanding checklist items ──────────────────────────────────────────────

export interface Outstanding {
  requests: DocRequest[];
  totalCount: number;
}

/** The lines the client still owes, most important first, plus the checklist
 *  total (excluding waived items). One indexed read per due client. */
export async function loadOutstanding(firmId: string, clientId: string, progressTotal?: number): Promise<Outstanding> {
  const snap = await db.collection(paths.requests(firmId, clientId)).get();
  let total = 0;
  const requests: DocRequest[] = [];
  snap.forEach((doc) => {
    const r = { id: doc.id, ...(doc.data() as Omit<DocRequest, 'id'>) } as DocRequest;
    if (r.status === 'waived') return;
    total += 1;
    if ((OUTSTANDING_STATUSES as readonly string[]).includes(r.status)) requests.push(r);
  });
  requests.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.order ?? 0) - (b.order ?? 0));
  return { requests, totalCount: progressTotal && progressTotal > total ? progressTotal : total };
}

/** Human, recognisable name for a missing item: the preparer's own label wins;
 *  else the form code with its known issuers; else the code and full name.
 *
 *  IRS identifiers are never translated. "1099-DIV" is printed in Latin on the
 *  paper the taxpayer is hunting for in a drawer; a Korean paraphrase of it
 *  makes the document harder to find, not easier. Only the plain-language
 *  descriptors ("Property tax", "Mileage") change language. */
export function outstandingLabel(r: DocRequest, locale: LocaleId): string {
  if (r.label && r.label.trim()) return r.label.trim();
  const dt = docType(r.docTypeId);
  const code = locale === 'en' ? dt.code : docCodeLabel(locale, r.docTypeId, dt.code);
  if (r.expectedIssuers && r.expectedIssuers.length)
    return t(locale, 'item.fromIssuer', { code, issuers: r.expectedIssuers.join(', ') });
  if (locale !== 'en') return code;
  return dt.code === dt.label ? dt.code : `${dt.label} (${dt.code})`;
}

export function outstandingCodes(requests: DocRequest[]): string[] {
  return [...new Set(requests.map((r) => docType(r.docTypeId).code))];
}

export function portalUrl(firm: Firm): string {
  return `${PORTAL_BASE}/p/${firm.slug}`;
}

/**
 * The language this client's messages go out in. A firm that has switched
 * multilingual off is back on English for everyone, immediately, without any
 * per-client data being touched.
 */
export function clientLocale(ctx: FirmContext, client: Client): LocaleId {
  return effectiveLocale(client.language, multilingualEnabled(ctx.firm));
}

// ── Copy assembly + rendering ────────────────────────────────────────────────

export function buildCopyInput(
  ctx: FirmContext,
  client: Client,
  outstanding: Outstanding,
  preparerName: string,
  now: Date,
): LocalizedCopy {
  const startedAt = toDate(client.chase?.startedAt) ?? now;
  const firstName = (client.primaryContact?.name || client.displayName || 'there').trim().split(/\s+/)[0];
  const locale = clientLocale(ctx, client);
  return {
    clientFirstName: firstName,
    firmName: ctx.firm.branding?.displayName || ctx.firm.name,
    preparerName,
    outstanding: outstanding.requests.map((r) => outstandingLabel(r, locale)),
    outstandingCount: outstanding.requests.length,
    totalCount: outstanding.totalCount,
    portalUrl: portalUrl(ctx.firm),
    daysWaiting: Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / DAY_MS)),
    daysToDeadline: daysToDeadline(now, ctx.settings.deadline, ctx.tz),
    signature: ctx.settings.signature || '',
    locale,
  };
}

/**
 * A copy input whose locale has already been resolved. `ChaseCopyInput.locale`
 * is optional so English callers can omit it; once `buildCopyInput` has run it
 * is always set, and requiring it here means no downstream renderer can quietly
 * fall back to English on a client who elected another language.
 */
export type LocalizedCopy = ChaseCopyInput & { locale: LocaleId };

export interface RenderedStep {
  step: ChaseStep;
  tone: ChaseTone;
  email: RenderedMessage | null;
  sms: string | null;
  copy: LocalizedCopy;
}

export function renderStep(step: ChaseStep, copy: LocalizedCopy): RenderedStep {
  return {
    step,
    tone: step.tone,
    email: step.channels.includes('email') ? renderEmail(step.tone, copy) : null,
    sms: step.channels.includes('sms') ? renderSms(step.tone, copy) : null,
    copy,
  };
}

// ── HTML email body ──────────────────────────────────────────────────────────

/**
 * The plain-text body carries Unicode isolates (FSI…PDI) around interpolated
 * LTR runs. In HTML the equivalent is `<bdi>`, which every mail client that can
 * render Arabic already understands, so they are converted rather than escaped
 * into visible mojibake. The RLMs that pin bullet lines are dropped: `dir` on
 * the container does that job in HTML.
 *
 * The linkifier runs *after* `escapeHtml`, and depends on it encoding quotes:
 * the body carries client and issuer names, so a name shaped like a URL is one
 * unencoded `"` away from breaking out of the `href` it lands in.
 */
export function textToHtml(text: string, locale: LocaleId): string {
  const rtl = directionOf(locale) === 'rtl';
  const linked = escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2563eb">$1</a>')
    .replace(/[\u2066-\u2068]/g, '<bdi>')
    .replace(/\u2069/g, '</bdi>')
    .replace(/\u200f/g, '');
  return (
    `<div${rtl ? ' dir="rtl"' : ''} style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;` +
    `font-size:15px;line-height:1.55;color:#1a1a1a;white-space:pre-wrap${rtl ? ';text-align:right' : ''}">` +
    linked +
    '</div>'
  );
}

function senderFrom(firm: Firm): string {
  const name = (firm.branding?.displayName || firm.name).replace(/[",<>]/g, ' ').trim();
  return `${name} via TaxFax <${EMAIL_SENDER}>`;
}

// ── Extension queue writers (idempotent) ─────────────────────────────────────

interface ChaseRef {
  firmId: string;
  clientId: string;
  messageId: string;
}

/** Deterministic id so a re-write can never enqueue the same physical message
 *  twice. `.create` throws on collision, which we treat as already-queued. */
async function createOnce(ref: FirebaseFirestore.DocumentReference, data: FirebaseFirestore.DocumentData): Promise<boolean> {
  try {
    await ref.create(data);
    return true;
  } catch (err) {
    if ((err as { code?: number }).code === 6 /* ALREADY_EXISTS */) return false;
    throw err;
  }
}

async function queueEmail(
  firm: Firm,
  to: string[],
  message: RenderedMessage,
  docId: string,
  chase: ChaseRef,
  locale: LocaleId,
): Promise<string> {
  const ref = db.collection(paths.mail()).doc(docId);
  await createOnce(ref, {
    to,
    from: senderFrom(firm),
    replyTo: firm.branding?.replyToEmail ?? EMAIL_SENDER,
    message: { subject: message.subject, text: message.body, html: textToHtml(message.body, locale) },
    chase,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function queueSms(to: string, body: string, docId: string, chase: ChaseRef): Promise<string> {
  const ref = db.collection(paths.sms()).doc(docId);
  await createOnce(ref, { to, body, chase, createdAt: FieldValue.serverTimestamp() });
  return ref.id;
}

/** Staff notifications (heads-up + escalation) go through the same mail queue,
 *  but without a `chase` ref so the delivery mirror ignores them. */
async function queueStaffEmail(firm: Firm, to: string, message: RenderedMessage, docId: string): Promise<void> {
  await createOnce(db.collection(paths.mail()).doc(docId), {
    to: [to],
    from: senderFrom(firm),
    replyTo: firm.branding?.replyToEmail ?? EMAIL_SENDER,
    message: { subject: message.subject, text: message.body, html: textToHtml(message.body, 'en') },
    createdAt: FieldValue.serverTimestamp(),
  });
}

export interface ChaseMessageRecord {
  firmId: string;
  clientId: string;
  stepIndex: number;
  channel: ChaseChannel;
  tone: ChaseTone;
  to: string;
  subject?: string;
  body: string;
  outstanding: string[];
  deliveryRef: string;
  locale: LocaleId;
}

async function writeChaseMessage(rec: ChaseMessageRecord, docId: string): Promise<void> {
  const ref = db.collection(paths.chaseMessages(rec.firmId, rec.clientId)).doc(docId);
  await ref.set({
    id: ref.id,
    firmId: rec.firmId,
    clientId: rec.clientId,
    stepIndex: rec.stepIndex,
    channel: rec.channel,
    tone: rec.tone,
    to: rec.to,
    ...(rec.subject ? { subject: rec.subject } : {}),
    body: rec.body,
    locale: rec.locale,
    outstanding: rec.outstanding,
    status: 'queued',
    deliveryRef: rec.deliveryRef,
    createdAt: FieldValue.serverTimestamp(),
  });
}

// ── Chase-state mutators ─────────────────────────────────────────────────────

export async function deferClient(ref: FirebaseFirestore.DocumentReference, when: Date): Promise<void> {
  await ref.update({ 'chase.nextDueAt': Timestamp.fromDate(when), updatedAt: FieldValue.serverTimestamp() });
}

export async function completeChase(ref: FirebaseFirestore.DocumentReference): Promise<void> {
  await ref.update({ 'chase.status': 'complete', 'chase.nextDueAt': FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
}

export async function pauseForBlocked(ref: FirebaseFirestore.DocumentReference, reason: string): Promise<void> {
  await ref.update({
    'chase.status': 'paused',
    'chase.pausedReason': reason,
    'chase.nextDueAt': FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** Terminal hand-off to a human: stop chasing and email the assigned preparer. */
export async function escalateClient(
  ctx: FirmContext,
  client: Client,
  ref: FirebaseFirestore.DocumentReference,
  reason: 'exhausted' | 'unreachable',
  outstanding: DocRequest[],
): Promise<void> {
  await ref.update({
    'chase.status': 'escalated',
    'chase.nextDueAt': FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await notifyPreparerEscalated(ctx, client, reason, outstanding);
}

// ── Escalation + staff heads-up copy (written for a busy preparer) ────────────

function contactLine(client: Client): string {
  const c = client.primaryContact;
  const bits = [c?.email, c?.phone].filter(Boolean);
  return bits.length ? bits.join(' · ') : 'no contact details on file';
}

export async function notifyPreparerEscalated(
  ctx: FirmContext,
  client: Client,
  reason: 'exhausted' | 'unreachable',
  outstanding: DocRequest[],
): Promise<void> {
  const prep = await resolvePreparer(ctx, client.assignedTo);
  if (!prep.email) return;
  // Staff surface: the preparer reads this, not the taxpayer, so it stays English.
  const items = outstanding.map((r) => `  •  ${outstandingLabel(r, 'en')}`).join('\n') || '  •  (checklist now empty)';
  const lede =
    reason === 'unreachable'
      ? `We couldn't reach ${client.displayName} on any channel — every email and phone we have is opted out or missing.`
      : `The automated cadence for ${client.displayName} is finished and the documents still aren't in.`;
  const subject =
    reason === 'unreachable'
      ? `Can't reach ${client.displayName} — needs a personal call`
      : `Chase exhausted: ${client.displayName} still owes ${outstanding.length} ${outstanding.length === 1 ? 'item' : 'items'}`;
  const body = `${lede}

Still outstanding:
${items}

Reach them directly: ${contactLine(client)}

This is where a person does better than a reminder. TaxFax has stopped chasing this client automatically.

— TaxFax`;
  await queueStaffEmail(ctx.firm, prep.email, { subject, body }, `esc__${ctx.firmId}__${client.id}__${client.chase?.stepIndex ?? 0}`);
}

async function notifyPreparerHeadsUp(ctx: FirmContext, client: Client, tone: ChaseTone, outstanding: DocRequest[], daysWaiting: number): Promise<void> {
  const prep = await resolvePreparer(ctx, client.assignedTo);
  if (!prep.email) return;
  const items = outstanding.map((r) => `  •  ${outstandingLabel(r, 'en')}`).join('\n');
  const subject = `${client.displayName}: now at "${TONE_LABEL[tone]}", ${outstanding.length} still missing`;
  const body = `Heads up — ${client.displayName} has been in the queue ${daysWaiting} days and we've just sent the "${TONE_LABEL[tone]}" reminder. Still waiting on:
${items}

Reach them directly: ${contactLine(client)}

No action needed yet; TaxFax is still chasing. — TaxFax`;
  await queueStaffEmail(ctx.firm, prep.email, { subject, body }, `hu__${ctx.firmId}__${client.id}__${client.chase?.stepIndex ?? 0}`);
}

// ── The one-step send: claim first (idempotent), then dispatch ───────────────

export interface SendStepInput {
  ctx: FirmContext;
  clientRef: FirebaseFirestore.DocumentReference;
  client: Client;
  stepIndex: number;
  rendered: RenderedStep;
  recipients: Recipients;
  outstanding: Outstanding;
  now: Date;
  /** Sweep sends only when actually due; manual sends bypass the schedule. */
  requireDue: boolean;
  /** Statuses from which a send may be claimed. Sweep: active only. Manual
   *  (sendChaseNow) also allows paused, and the send resumes the cadence. */
  allowStatuses?: Array<ClientChaseState['status']>;
}

export type SendStepResult =
  | { outcome: 'sent'; dispatches: number; escalated: boolean; nextDueAt: Date | null }
  | { outcome: 'already_sent' }
  | { outcome: 'capped' };

/**
 * Sends exactly one cadence step. The step index is *claimed* inside a
 * transaction that re-reads `chase.stepIndex`; only the winner advances the
 * state and goes on to enqueue mail/SMS. A second concurrent sweep — or a retry
 * of this one — sees the advanced index and does nothing. That is the whole
 * idempotency guarantee.
 */
export async function sendStep(input: SendStepInput): Promise<SendStepResult> {
  const { ctx, clientRef, client, stepIndex, rendered, recipients, outstanding, now, requireDue } = input;

  const dispatches = dispatchCount(recipients);
  if (dispatches > remainingDailyBudget(ctx)) return { outcome: 'capped' };

  const nextIndex = stepIndex + 1;
  const escalated = nextIndex > ctx.settings.escalateAfterStep || nextIndex >= ctx.profile.steps.length;

  // Compute the next slot up front (pure); the claim writes it.
  let nextDueAt: Date | null = null;
  if (!escalated) {
    const dtd = daysToDeadline(now, ctx.settings.deadline, ctx.tz);
    const startedAt = toDate(client.chase?.startedAt) ?? now;
    const raw = stepDueAt(startedAt, ctx.profile.steps[nextIndex].dayOffset, dtd);
    const floor = new Date(now.getTime() + MIN_STEP_GAP_MS);
    const candidate = raw.getTime() < floor.getTime() ? floor : raw;
    nextDueAt = resolveSendTime(candidate, ctx.settings, ctx.tz);
  }

  const sentTs = Timestamp.fromDate(now);
  const allowStatuses = input.allowStatuses ?? ['active'];
  const claimed = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(clientRef);
    const state = fresh.get('chase') as ClientChaseState | undefined;
    if (!state || !allowStatuses.includes(state.status)) return false;
    if ((state.stepIndex ?? 0) !== stepIndex) return false; // someone already advanced ⇒ don't double-send
    if (requireDue) {
      const due = toDate(state.nextDueAt);
      if (due && due.getTime() > now.getTime()) return false; // rescheduled out from under us
    }
    const patch: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
      'chase.lastSentAt': sentTs,
      'chase.sentCount': FieldValue.increment(dispatches),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (escalated) {
      patch['chase.status'] = 'escalated';
      patch['chase.stepIndex'] = nextIndex;
      patch['chase.nextDueAt'] = FieldValue.delete();
    } else {
      patch['chase.status'] = 'active'; // a manual send from `paused` resumes the cadence
      patch['chase.stepIndex'] = nextIndex;
      patch['chase.nextDueAt'] = Timestamp.fromDate(nextDueAt as Date);
      patch['chase.pausedReason'] = FieldValue.delete();
    }
    tx.update(clientRef, patch);
    return true;
  });

  if (!claimed) return { outcome: 'already_sent' };

  // ── Side effects (post-claim, so at-most-once) ──
  ctx.dailySpent += dispatches;
  void ctx.counterRef
    .set({ sends: FieldValue.increment(dispatches), day: utcDayKey(now), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    .catch(() => undefined);

  const codes = outstandingCodes(outstanding.requests);
  const base = `${ctx.firmId}__${client.id}__${stepIndex}`;
  const locale = rendered.copy.locale;

  if (rendered.email && recipients.emails.length > 0) {
    const deliveryRef = await queueEmail(
      ctx.firm,
      recipients.emails,
      rendered.email,
      `${base}__email`,
      { firmId: ctx.firmId, clientId: client.id, messageId: `${stepIndex}-email` },
      locale,
    );
    await writeChaseMessage(
      {
        firmId: ctx.firmId,
        clientId: client.id,
        stepIndex,
        channel: 'email',
        tone: rendered.tone,
        to: recipients.emails.join(', '),
        subject: rendered.email.subject,
        body: rendered.email.body,
        outstanding: codes,
        deliveryRef,
        locale,
      },
      `${stepIndex}-email`,
    );
  }

  if (rendered.sms) {
    for (let i = 0; i < recipients.phones.length; i++) {
      const phone = recipients.phones[i];
      const deliveryRef = await queueSms(phone, rendered.sms, `${base}__sms__${i}`, {
        firmId: ctx.firmId,
        clientId: client.id,
        messageId: `${stepIndex}-sms-${i}`,
      });
      await writeChaseMessage(
        {
          firmId: ctx.firmId,
          clientId: client.id,
          stepIndex,
          channel: 'sms',
          tone: rendered.tone,
          to: phone,
          body: rendered.sms,
          outstanding: codes,
          deliveryRef,
          locale,
        },
        `${stepIndex}-sms-${i}`,
      );
    }
  }

  if (escalated) {
    await notifyPreparerEscalated(ctx, client, 'exhausted', outstanding.requests);
  } else if (rendered.step.notifyStaff) {
    await notifyPreparerHeadsUp(ctx, client, rendered.tone, outstanding.requests, rendered.copy.daysWaiting);
  }

  return { outcome: 'sent', dispatches, escalated, nextDueAt };
}
