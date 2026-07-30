import { differenceInCalendarDays } from 'date-fns';
import {
  docType,
  type Client,
  type DocRequest,
  type RequestPriority,
  type StoredDocument,
  type Timestampish,
} from '@taxfax/shared';
import { toDate } from '@/lib/format';

export type WithId<T> = T & { id: string };
export type ClientDoc = WithId<Client>;
export type RequestDoc = WithId<DocRequest>;
export type ReviewDoc = WithId<StoredDocument>;

/** Why a client is on the worklist, and what to do about it. */
export type TriageKind = 'blocked' | 'silent' | 'oneAway' | 'ready';

export interface TriageItem {
  client: ClientDoc;
  kind: TriageKind;
  /** The single actionable fact, e.g. "Only the K-1 left" or "Email bouncing". */
  reason: string;
  /** Named outstanding documents, most important first. */
  outstanding: string[];
  outstandingCount: number;
  daysWaiting: number | null;
  severity: number;
}

const PRIORITY_RANK: Record<RequestPriority, number> = { critical: 0, standard: 1, optional: 2 };

function daysSince(ts: Timestampish | undefined, now: Date): number | null {
  if (!ts) return null;
  return Math.max(0, differenceInCalendarDays(now, toDate(ts)));
}

/** Mirrors the chase engine: a client is reachable if any un-suppressed channel exists. */
export function isReachable(c: Client): boolean {
  const p = c.primaryContact;
  const s = c.secondaryContact;
  const emailOk = (!!p.email && !p.emailOptOut) || (!!s?.email && !s.emailOptOut);
  const smsOk = (!!p.phone && !p.smsOptOut) || (!!s?.phone && !s.smsOptOut);
  return emailOk || smsOk;
}

/** A bounced address is encoded on the paused/escalated reason, not the contact. */
function bounceReason(c: Client): string | null {
  const r = c.chase?.pausedReason;
  return r && /bounc/i.test(r) ? r : null;
}

function labelFor(r: DocRequest): string {
  const code = r.label ?? docType(r.docTypeId).code;
  const issuer = r.expectedIssuers?.[0];
  return issuer ? `${code} · ${issuer}` : code;
}

/** Outstanding (not-yet-received) request labels for a client, most important first. */
function outstandingFor(reqByClient: Map<string, RequestDoc[]>, clientId: string): string[] {
  const reqs = reqByClient.get(clientId);
  if (!reqs) return [];
  return reqs
    .filter((r) => r.status === 'pending' || r.status === 'rejected')
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.order - b.order)
    .map(labelFor);
}

export interface DashboardModel {
  needsYouNow: TriageItem[];
  oneDocAway: TriageItem[];
  silent: TriageItem[];
  ready: ClientDoc[];
  reviewCount: number;
  reviewClients: number;
  reviewTopClients: string[];
  headline: string;
  counts: {
    active: number;
    blocked: number;
    inMotion: number;
    ready: number;
    filed: number;
    notStarted: number;
    total: number;
  };
}

export function deriveDashboard(
  clients: ClientDoc[],
  requests: RequestDoc[],
  reviewDocs: ReviewDoc[],
  now: Date,
): DashboardModel {
  const reqByClient = new Map<string, RequestDoc[]>();
  for (const r of requests) {
    const list = reqByClient.get(r.clientId);
    if (list) list.push(r);
    else reqByClient.set(r.clientId, [r]);
  }

  const needsYouNow: TriageItem[] = [];
  const oneDocAway: TriageItem[] = [];
  const silent: TriageItem[] = [];
  const ready: ClientDoc[] = [];

  const counts = {
    active: 0,
    blocked: 0,
    inMotion: 0,
    ready: 0,
    filed: 0,
    notStarted: 0,
    total: clients.length,
  };

  for (const client of clients) {
    const { stage, chase, progress } = client;
    if (stage === 'blocked') counts.blocked += 1;
    if (stage === 'ready') counts.ready += 1;
    if (stage === 'filed') counts.filed += 1;
    if (stage === 'not_started') counts.notStarted += 1;
    if (stage === 'awaiting' || stage === 'partial') counts.inMotion += 1;
    if (chase?.status === 'active' || chase?.status === 'escalated') counts.active += 1;

    const outstanding = outstandingFor(reqByClient, client.id);
    const outstandingCount = outstanding.length || Math.max(0, progress.total - progress.received);
    const startedAt = chase?.startedAt ?? progress.firstRequestedAt;
    const daysWaiting = daysSince(startedAt, now);
    const lastOpened = daysSince(chase?.lastOpenedAt, now);
    const bounce = bounceReason(client);
    const reachable = isReachable(client);

    // ── Needs a person now ────────────────────────────────────────────────
    if (stage === 'blocked' || chase?.status === 'escalated' || (!reachable && chase?.status === 'active')) {
      let reason: string;
      let severity: number;
      if (bounce) {
        reason = bounce;
        severity = 30;
      } else if (!reachable) {
        reason = 'No working way to reach them — every channel is off';
        severity = 28;
      } else if (progress.overdue > 0) {
        reason = `${progress.overdue} critical ${progress.overdue === 1 ? 'document is' : 'documents are'} overdue`;
        severity = 22;
      } else {
        reason = 'Escalated — needs a decision from you';
        severity = 20;
      }
      needsYouNow.push({ client, kind: 'blocked', reason, outstanding, outstandingCount, daysWaiting, severity });
      continue;
    }

    // ── Ready to prepare ──────────────────────────────────────────────────
    if (stage === 'ready') {
      ready.push(client);
      continue;
    }

    const activeChase = chase?.status === 'active';

    // ── One document from done ────────────────────────────────────────────
    if (activeChase && outstandingCount === 1) {
      oneDocAway.push({
        client,
        kind: 'oneAway',
        reason: outstanding[0] ? `Only ${outstanding[0]} left` : 'One last document to collect',
        outstanding,
        outstandingCount,
        daysWaiting,
        severity: 100 - (daysWaiting ?? 0),
      });
      continue;
    }

    // ── Gone silent past the cadence ──────────────────────────────────────
    if (activeChase && outstandingCount > 0 && (daysWaiting ?? 0) >= 14 && (lastOpened === null || lastOpened >= 7)) {
      const opened =
        lastOpened === null
          ? `${chase?.sentCount ?? 0} reminders, never opened`
          : `opened ${lastOpened}d ago, nothing since`;
      const base = outstanding.length ? `Waiting on ${outstanding.slice(0, 2).join(', ')}` : 'Still collecting';
      silent.push({
        client,
        kind: 'silent',
        reason: `${base} · ${opened}`,
        outstanding,
        outstandingCount,
        daysWaiting,
        severity: (daysWaiting ?? 0) * 10 + (lastOpened === null ? 5 : 0),
      });
    }
  }

  needsYouNow.sort((a, b) => b.severity - a.severity || b.outstandingCount - a.outstandingCount);
  oneDocAway.sort((a, b) => (b.daysWaiting ?? 0) - (a.daysWaiting ?? 0));
  silent.sort((a, b) => b.severity - a.severity);
  ready.sort((a, b) => a.sortName.localeCompare(b.sortName));

  const reviewClientIds = new Set(reviewDocs.map((d) => d.clientId));
  const nameById = new Map(clients.map((c) => [c.id, c.displayName] as const));
  const reviewTopClients = [...reviewClientIds]
    .map((id) => nameById.get(id))
    .filter((n): n is string => Boolean(n))
    .slice(0, 3);

  const headline = pickHeadline({
    needsYouNow,
    oneDocAway,
    silent,
    reviewCount: reviewDocs.length,
  });

  return {
    needsYouNow,
    oneDocAway,
    silent,
    ready,
    reviewCount: reviewDocs.length,
    reviewClients: reviewClientIds.size,
    reviewTopClients,
    headline,
    counts,
  };
}

function pickHeadline(m: {
  needsYouNow: TriageItem[];
  oneDocAway: TriageItem[];
  silent: TriageItem[];
  reviewCount: number;
}): string {
  const n = m.needsYouNow.length;
  if (n > 0) {
    const first = m.needsYouNow[0].client.displayName;
    return n === 1
      ? `${first} needs a person before anything else.`
      : `${n} returns need a person right now — start with ${first}.`;
  }
  if (m.oneDocAway.length > 0) {
    const k = m.oneDocAway.length;
    return `${k} ${k === 1 ? 'return is' : 'returns are'} one document from done. Close them out.`;
  }
  if (m.reviewCount > 0) {
    return `${m.reviewCount} ${m.reviewCount === 1 ? 'document is' : 'documents are'} waiting on your decision.`;
  }
  if (m.silent.length > 0) {
    const k = m.silent.length;
    return `${k} ${k === 1 ? 'client has' : 'clients have'} gone quiet past their cadence.`;
  }
  return `You're ahead of the chase. Nothing is blocking a return today.`;
}

/**
 * The filing deadline is April 15 of the year after the tax year. When the real
 * clock is outside the Jan–Apr filing window (e.g. a dev machine in July) we
 * anchor the countdown to mid-February so the season-aware header stays
 * demonstrable; during real in-season use this is a no-op and the true clock wins.
 */
export function seasonClock(
  taxYear: number,
  realNow = new Date(),
): { today: Date; deadline: Date; daysToDeadline: number } {
  const deadline = new Date(taxYear + 1, 3, 15);
  const seasonStart = new Date(taxYear + 1, 0, 1);
  const inSeason = realNow >= seasonStart && realNow <= deadline;
  const today = inSeason ? realNow : new Date(taxYear + 1, 1, 12);
  const daysToDeadline = Math.max(0, differenceInCalendarDays(deadline, today));
  return { today, deadline, daysToDeadline };
}
