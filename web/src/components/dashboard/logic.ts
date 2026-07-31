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
  /** Everything is in and a preparer has it — nobody is chasing these. */
  inReview: ClientDoc[];
  /** No checklist was ever sent. Invisible in season, the whole job out of it. */
  neverStarted: ClientDoc[];
  reviewCount: number;
  reviewClients: number;
  reviewTopClients: string[];
  headline: string;
  counts: {
    active: number;
    blocked: number;
    inMotion: number;
    inReview: number;
    ready: number;
    filed: number;
    notStarted: number;
    /** Everything that is not filed yet — the number that matters after Apr 15. */
    open: number;
    /** Unfiled 1065s and 1120-Ss. Their extended due date is Sep 15, not Oct 15. */
    passThroughOpen: number;
    total: number;
  };
}

export function deriveDashboard(
  clients: ClientDoc[],
  requests: RequestDoc[],
  reviewDocs: ReviewDoc[],
  now: Date,
  phase: SeasonPhase = 'filing',
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
  const inReview: ClientDoc[] = [];
  const neverStarted: ClientDoc[] = [];

  const counts = {
    active: 0,
    blocked: 0,
    inMotion: 0,
    inReview: 0,
    ready: 0,
    filed: 0,
    notStarted: 0,
    open: 0,
    passThroughOpen: 0,
    total: clients.length,
  };

  for (const client of clients) {
    const { stage, chase, progress } = client;
    if (stage === 'blocked') counts.blocked += 1;
    if (stage === 'ready') counts.ready += 1;
    if (stage === 'filed') {
      counts.filed += 1;
    } else {
      counts.open += 1;
      if (client.entityType === 'partnership' || client.entityType === 's-corp') counts.passThroughOpen += 1;
    }
    if (stage === 'not_started') {
      counts.notStarted += 1;
      neverStarted.push(client);
    }
    if (stage === 'in_review') {
      counts.inReview += 1;
      inReview.push(client);
    }
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
  inReview.sort((a, b) => a.sortName.localeCompare(b.sortName));
  neverStarted.sort((a, b) => a.sortName.localeCompare(b.sortName));

  const reviewClientIds = new Set(reviewDocs.map((d) => d.clientId));
  const nameById = new Map(clients.map((c) => [c.id, c.displayName] as const));
  const reviewTopClients = [...reviewClientIds]
    .map((id) => nameById.get(id))
    .filter((n): n is string => Boolean(n))
    .slice(0, 3);

  const headline = pickHeadline(phase, {
    needsYouNow,
    oneDocAway,
    silent,
    reviewCount: reviewDocs.length,
    counts,
  });

  return {
    needsYouNow,
    oneDocAway,
    silent,
    ready,
    inReview,
    neverStarted,
    reviewCount: reviewDocs.length,
    reviewClients: reviewClientIds.size,
    reviewTopClients,
    headline,
    counts,
  };
}

interface HeadlineInput {
  needsYouNow: TriageItem[];
  oneDocAway: TriageItem[];
  silent: TriageItem[];
  reviewCount: number;
  counts: DashboardModel['counts'];
}

/**
 * One sentence that says what to do next. The urgent facts read the same all
 * year — a bounced address is a bounced address in August — so only the closing
 * sentence, the one that frames a quiet screen, changes with the season.
 */
function pickHeadline(phase: SeasonPhase, m: HeadlineInput): string {
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
  return quietHeadline(phase, m.counts);
}

/** What a firm is actually looking at when nothing is on fire. */
function quietHeadline(phase: SeasonPhase, counts: DashboardModel['counts']): string {
  const open = counts.open;
  const never = counts.notStarted;

  switch (phase) {
    case 'extension':
      if (open === 0) return `Every return is filed. Nothing is riding on the October deadline.`;
      return `${open} ${open === 1 ? 'return is' : 'returns are'} still open with the extended deadline ahead. Nobody is waiting on you today.`;
    case 'offseason':
      if (open === 0) return `Every return is filed. The season is closed — next April is the only date left.`;
      return `${open} ${open === 1 ? 'return' : 'returns'} never got over the line. Worth a call before January.`;
    case 'preseason':
      if (never === 0) return `Every client has a checklist waiting. You are ready for January.`;
      return `${never} ${never === 1 ? 'client has' : 'clients have'} no checklist yet. The quiet weeks are when that list gets short.`;
    default:
      return `You're ahead of the chase. Nothing is blocking a return today.`;
  }
}

// ── The clock ────────────────────────────────────────────────────────────────

/**
 * Where the firm is in the year. Every phase is a real federal date, not a mood:
 * `filing` runs to Apr 15, `extension` to the Oct 15 extended due date, and the
 * two `offseason`/`preseason` ends of the year point at next April.
 */
export type SeasonPhase = 'preseason' | 'filing' | 'extension' | 'offseason';

export interface SeasonClock {
  /** The one date the whole screen reads from. In production, always today. */
  today: Date;
  phase: SeasonPhase;
  /** How a CPA names the season: the 2025 return is worked in season 2026. */
  seasonYear: number;
  /** The next federal date that constrains the firm. */
  deadline: Date;
  deadlineLabel: string;
  daysToDeadline: number;
}

/**
 * The season a firm is standing in, derived from the real calendar and nothing
 * else. It used to anchor the countdown to a hardcoded 12 February whenever the
 * clock fell outside Jan–Apr so the header stayed demonstrable; that shipped,
 * and for eight and a half months of the year the dashboard printed a date that
 * was not today next to worklist ages that were. A dashboard that states a
 * false date is worse than one that says "nothing is due" — so it says that
 * instead, and points at the deadline that is actually next.
 */
export function seasonClock(taxYear: number, now: Date = new Date()): SeasonClock {
  const seasonYear = taxYear + 1;
  const seasonStart = new Date(seasonYear, 0, 1);
  const filingDeadline = new Date(seasonYear, 3, 15);
  const extendedDeadline = new Date(seasonYear, 9, 15);
  const nextFilingDeadline = new Date(seasonYear + 1, 3, 15);

  const daysTo = (d: Date) => differenceInCalendarDays(d, now);

  let phase: SeasonPhase;
  let deadline: Date;
  let deadlineLabel: string;
  if (daysTo(seasonStart) > 0) {
    phase = 'preseason';
    deadline = filingDeadline;
    deadlineLabel = 'Filing deadline';
  } else if (daysTo(filingDeadline) >= 0) {
    phase = 'filing';
    deadline = filingDeadline;
    deadlineLabel = 'Deadline';
  } else if (daysTo(extendedDeadline) >= 0) {
    phase = 'extension';
    deadline = extendedDeadline;
    deadlineLabel = 'Extended deadline';
  } else {
    phase = 'offseason';
    deadline = nextFilingDeadline;
    deadlineLabel = 'Next deadline';
  }

  return {
    today: now,
    phase,
    seasonYear,
    deadline,
    deadlineLabel,
    daysToDeadline: Math.max(0, daysTo(deadline)),
  };
}

/**
 * The clock the dashboard runs on. Production gets the real one, always — this
 * is the only place a date enters the screen, so the header and the worklist
 * cannot disagree. In a dev build, and only there, `?asof=YYYY-MM-DD` moves the
 * whole screen together so in-season and out-of-season states can be built and
 * screenshotted from one machine in July.
 */
export function dashboardNow(asOf?: string | null): Date {
  if (import.meta.env.DEV && asOf && /^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    const [y, m, d] = asOf.split('-').map(Number);
    const shifted = new Date(y, m - 1, d, 9, 0, 0);
    if (!Number.isNaN(shifted.getTime())) return shifted;
  }
  return new Date();
}
