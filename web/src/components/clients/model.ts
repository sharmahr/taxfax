import { differenceInCalendarDays } from 'date-fns';
import {
  CHASE_PROFILES,
  CLIENT_STAGE_LABEL,
  ENTITY_TYPE_LABEL,
  FILING_STATUS_LABEL,
  TONE_LABEL,
  docType,
  type ChaseChannel,
  type ChaseProfile,
  type ChaseTone,
  type Client,
  type StoredDocument,
} from '@taxfax/shared';
import { toDate } from '@/lib/format';
import type { StatusTone } from '@/components/ui/StatusPill';

/**
 * All roster + detail logic lives here as pure functions, so the React layer
 * stays about presentation and the "who do I chase today" question has exactly
 * one answer the whole surface agrees on.
 */

export type ClientDoc = Client & { id: string };

// ── Workflow bands ────────────────────────────────────────────────────────────
// The default roster groups the book into the order a preparer actually works
// it in February: fires first, then the long tail of chasing, then done.

export type Band = 'attention' | 'to_start' | 'chasing' | 'review' | 'ready' | 'filed';

export const BAND_ORDER: Band[] = ['attention', 'to_start', 'chasing', 'review', 'ready', 'filed'];

export const BAND_META: Record<Band, { label: string; hint: string; tone: StatusTone }> = {
  attention: { label: 'Needs you', hint: 'Blocked, escalated, or overdue', tone: 'danger' },
  to_start: { label: 'To start', hint: 'No checklist sent yet', tone: 'neutral' },
  chasing: { label: 'Chasing', hint: 'Waiting on the client', tone: 'warn' },
  review: { label: 'In review', hint: 'Documents in, your turn', tone: 'info' },
  ready: { label: 'Ready to prepare', hint: 'Complete and accepted', tone: 'success' },
  filed: { label: 'Filed', hint: 'Done for the season', tone: 'neutral' },
};

// ── Lenses ────────────────────────────────────────────────────────────────────
// The quick filters across the top. Non-exclusive views, not folders.

export type Lens = 'all' | 'attention' | 'chasing' | 'review' | 'ready' | 'filed';

export const LENSES: { id: Lens; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'attention', label: 'Needs you' },
  { id: 'chasing', label: 'Chasing' },
  { id: 'review', label: 'In review' },
  { id: 'ready', label: 'Ready' },
  { id: 'filed', label: 'Filed' },
];

export type SortKey = 'urgent' | 'waiting' | 'name' | 'progress' | 'active';

export const SORTS: { id: SortKey; label: string }[] = [
  { id: 'urgent', label: 'Most urgent' },
  { id: 'waiting', label: 'Longest waiting' },
  { id: 'name', label: 'Name (A–Z)' },
  { id: 'progress', label: 'Least complete' },
  { id: 'active', label: 'Recently active' },
];

// ── Derivation ────────────────────────────────────────────────────────────────

export interface DerivedClient {
  client: ClientDoc;
  /** Days since the checklist first went out. 0 before it has. */
  waitingDays: number;
  /** Items the taxpayer still hasn't sent — what a chase is about. */
  stillNeeded: number;
  /** Sent, waiting on a preparer. */
  inReview: number;
  accepted: number;
  total: number;
  overdue: number;
  percent: number;
  band: Band;
  /** Higher sorts nearer the top. */
  urgency: number;
  emailBounced: boolean;
  smsOptOut: boolean;
  /** We can't reliably reach this client on any channel. */
  unreachable: boolean;
  lastActivityAt?: Date;
}

function bandOf(c: ClientDoc, overdue: number): Band {
  if (c.stage === 'blocked' || c.chase?.status === 'escalated' || overdue > 0) return 'attention';
  if (c.stage === 'not_started') return 'to_start';
  if (c.stage === 'awaiting' || c.stage === 'partial') return 'chasing';
  if (c.stage === 'in_review') return 'review';
  if (c.stage === 'ready') return 'ready';
  return 'filed';
}

export function derive(c: ClientDoc): DerivedClient {
  const p = c.progress ?? { total: 0, received: 0, accepted: 0, rejected: 0, overdue: 0, percent: 0 };
  const total = p.total ?? 0;
  const received = p.received ?? 0;
  const accepted = p.accepted ?? 0;
  const overdue = p.overdue ?? 0;
  const stillNeeded = Math.max(0, total - received);
  const inReview = Math.max(0, received - accepted);
  const percent = p.percent ?? (total ? Math.round((accepted / total) * 100) : 0);

  const started = c.progress?.firstRequestedAt ?? c.chase?.startedAt;
  const waitingDays =
    started && c.stage !== 'not_started'
      ? Math.max(0, differenceInCalendarDays(new Date(), toDate(started)))
      : 0;

  const emailBounced = /bounce/i.test(c.chase?.pausedReason ?? '');
  const smsOptOut = Boolean(c.primaryContact?.smsOptOut);
  const noPhone = !c.primaryContact?.phone;
  const unreachable = emailBounced && (smsOptOut || noPhone);

  const band = bandOf(c, overdue);
  const bandRank = BAND_ORDER.length - BAND_ORDER.indexOf(band);
  const urgency =
    bandRank * 1_000_000 + overdue * 20_000 + waitingDays * 200 + (100 - percent) + stillNeeded * 30;

  const activity = c.progress?.lastActivityAt ?? c.chase?.lastSentAt;

  return {
    client: c,
    waitingDays,
    stillNeeded,
    inReview,
    accepted,
    total,
    overdue,
    percent,
    band,
    urgency,
    emailBounced,
    smsOptOut,
    unreachable,
    lastActivityAt: activity ? toDate(activity) : undefined,
  };
}

// ── Filtering, sorting, grouping ──────────────────────────────────────────────

const lensPredicate: Record<Lens, (d: DerivedClient) => boolean> = {
  all: () => true,
  attention: (d) => d.band === 'attention',
  chasing: (d) => d.client.stage === 'awaiting' || d.client.stage === 'partial',
  review: (d) => d.client.stage === 'in_review',
  ready: (d) => d.client.stage === 'ready',
  filed: (d) => d.client.stage === 'filed',
};

export function lensCounts(all: DerivedClient[]): Record<Lens, number> {
  const counts = { all: 0, attention: 0, chasing: 0, review: 0, ready: 0, filed: 0 } as Record<
    Lens,
    number
  >;
  for (const d of all) for (const l of LENSES) if (lensPredicate[l.id](d)) counts[l.id]++;
  return counts;
}

function matchesSearch(d: DerivedClient, q: string): boolean {
  const c = d.client;
  const hay = [
    c.displayName,
    c.sortName,
    c.primaryContact?.email,
    c.primaryContact?.name,
    c.secondaryContact?.email,
    c.secondaryContact?.name,
    ENTITY_TYPE_LABEL[c.entityType],
    c.filingStatus ? FILING_STATUS_LABEL[c.filingStatus] : '',
    CLIENT_STAGE_LABEL[c.stage],
    ...(c.tags ?? []),
  ]
    .join(' ')
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}

const comparators: Record<SortKey, (a: DerivedClient, b: DerivedClient) => number> = {
  urgent: (a, b) => b.urgency - a.urgency,
  waiting: (a, b) => b.waitingDays - a.waitingDays || b.urgency - a.urgency,
  name: (a, b) => a.client.sortName.localeCompare(b.client.sortName),
  progress: (a, b) => a.percent - b.percent || b.urgency - a.urgency,
  active: (a, b) => (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0),
};

export interface RosterFilter {
  search: string;
  lens: Lens;
  sort: SortKey;
  assignee: string | 'all' | 'unassigned';
  tag: string | 'all';
}

export type RosterRow =
  | { type: 'group'; band: Band; count: number; key: string }
  | { type: 'client'; d: DerivedClient; key: string };

export interface RosterResult {
  rows: RosterRow[];
  /** Client ids after filtering — the target set for "select all". */
  visibleIds: string[];
  matched: number;
  grouped: boolean;
}

/** The single pipeline the roster renders: filter → sort → (group) → flat rows. */
export function buildRoster(all: DerivedClient[], f: RosterFilter): RosterResult {
  const q = f.search.trim();
  const filtered = all.filter((d) => {
    if (!lensPredicate[f.lens](d)) return false;
    if (f.assignee === 'unassigned' && d.client.assignedTo) return false;
    if (f.assignee !== 'all' && f.assignee !== 'unassigned' && d.client.assignedTo !== f.assignee)
      return false;
    if (f.tag !== 'all' && !(d.client.tags ?? []).includes(f.tag)) return false;
    if (q && !matchesSearch(d, q)) return false;
    return true;
  });

  const visibleIds = filtered.map((d) => d.client.id);
  // Group only in the unfiltered "All" home view; any narrowing reads as a flat
  // result list, which is what a search or a lens implies.
  const grouped = f.lens === 'all' && !q && f.assignee === 'all' && f.tag === 'all';

  if (!grouped) {
    const sorted = [...filtered].sort(comparators[f.sort]);
    return {
      rows: sorted.map((d) => ({ type: 'client', d, key: d.client.id })),
      visibleIds,
      matched: filtered.length,
      grouped: false,
    };
  }

  const rows: RosterRow[] = [];
  for (const band of BAND_ORDER) {
    const inBand = filtered.filter((d) => d.band === band).sort(comparators[f.sort]);
    if (inBand.length === 0) continue;
    rows.push({ type: 'group', band, count: inBand.length, key: `band-${band}` });
    for (const d of inBand) rows.push({ type: 'client', d, key: d.client.id });
  }
  return { rows, visibleIds, matched: filtered.length, grouped: true };
}

// ── Chase-state summary (roster + detail) ─────────────────────────────────────

export type ChaseHealth = 'idle' | 'working' | 'opened' | 'stalled' | 'escalated' | 'paused' | 'done';

export interface ChaseSummary {
  health: ChaseHealth;
  sentCount: number;
  lastSentAt?: Date;
  lastOpenedAt?: Date;
  nextDueAt?: Date;
  pausedReason?: string;
  /** One plain-English line for the roster's activity column. */
  line: string;
}

export function chaseSummary(d: DerivedClient): ChaseSummary {
  const ch = d.client.chase;
  const lastSentAt = ch?.lastSentAt ? toDate(ch.lastSentAt) : undefined;
  const lastOpenedAt = ch?.lastOpenedAt ? toDate(ch.lastOpenedAt) : undefined;
  const nextDueAt = ch?.nextDueAt ? toDate(ch.nextDueAt) : undefined;
  const sentCount = ch?.sentCount ?? 0;

  let health: ChaseHealth = 'idle';
  let line = 'No checklist sent';
  if (d.client.stage === 'filed') {
    health = 'done';
    line = 'Filed';
  } else if (d.client.stage === 'ready' || d.client.stage === 'in_review') {
    health = 'done';
    line = 'All documents in';
  } else if (ch?.status === 'escalated') {
    health = 'escalated';
    line = 'Escalated — needs a human';
  } else if (ch?.status === 'paused' || d.emailBounced) {
    health = 'paused';
    line = d.emailBounced ? 'Paused — email bounced' : 'Chase paused';
  } else if (ch?.status === 'active') {
    if (lastOpenedAt && lastSentAt && lastOpenedAt >= lastSentAt) {
      health = 'opened';
      line = 'Opened, nothing uploaded';
    } else if (sentCount >= 4) {
      health = 'stalled';
      line = `${sentCount} reminders, no reply`;
    } else {
      health = 'working';
      line = sentCount > 0 ? `Reminder ${sentCount} sent` : 'Checklist sent';
    }
  } else if (d.client.stage === 'not_started') {
    health = 'idle';
    line = 'No checklist sent';
  }

  return { health, sentCount, lastSentAt, lastOpenedAt, nextDueAt, pausedReason: ch?.pausedReason, line };
}

export const CHASE_HEALTH_TONE: Record<ChaseHealth, StatusTone> = {
  idle: 'neutral',
  working: 'info',
  opened: 'warn',
  stalled: 'warn',
  escalated: 'danger',
  paused: 'danger',
  done: 'success',
};

// ── Detail: the "what have we tried" timeline ─────────────────────────────────
// Reconstructed faithfully from chase state + the firm's cadence + the documents
// that came back. This is the product's differentiator, so it is featured, not
// hidden: every send, open, bounce and receipt, in order.

export type TimelineKind =
  | 'generated'
  | 'reminder'
  | 'opened'
  | 'received'
  | 'bounced'
  | 'escalated'
  | 'scheduled';

export interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  at: Date;
  future: boolean;
  title: string;
  detail?: string;
  channels?: ChaseChannel[];
  toneLabel?: string;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

// Natural escalation ladder for the timeline — TONE_LABEL alone would read
// "Reminder reminder" / "Final notice reminder", so name each send directly.
const REMINDER_TITLE: Record<ChaseTone, string> = {
  warm: 'Opening reminder',
  neutral: 'Follow-up reminder',
  firm: 'Firm reminder',
  urgent: 'Urgent reminder',
  final: 'Final notice',
};

export function buildTimeline(
  client: ClientDoc,
  documents: (StoredDocument & { id: string })[],
  profileId: string,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const ch = client.chase;
  const started = client.progress?.firstRequestedAt ?? ch?.startedAt;
  const profile: ChaseProfile =
    CHASE_PROFILES[profileId as keyof typeof CHASE_PROFILES] ?? CHASE_PROFILES.standard;

  if (started) {
    const at = toDate(started);
    entries.push({
      id: 'generated',
      kind: 'generated',
      at,
      future: false,
      title: 'Checklist built from last year’s return',
      detail: `${client.progress?.total ?? 0} items, each tied to a line on the prior return`,
    });

    const sent = Math.min(ch?.sentCount ?? 0, profile.steps.length);
    for (let i = 0; i < sent; i++) {
      const step = profile.steps[i];
      const tone: ChaseTone = step.tone;
      entries.push({
        id: `reminder-${i}`,
        kind: 'reminder',
        at: addDays(at, step.dayOffset),
        future: false,
        title: REMINDER_TITLE[tone],
        channels: step.channels,
        toneLabel: TONE_LABEL[tone],
      });
    }
  }

  for (const doc of documents) {
    if (!doc.uploadedAt) continue;
    const code = docType(doc.classification?.docTypeId ?? '').code;
    entries.push({
      id: `doc-${doc.id}`,
      kind: 'received',
      at: toDate(doc.uploadedAt),
      future: false,
      title: `${code} received`,
      detail: doc.canonicalName ? `Filed as ${doc.canonicalName}` : undefined,
    });
  }

  if (ch?.lastOpenedAt) {
    entries.push({
      id: 'opened',
      kind: 'opened',
      at: toDate(ch.lastOpenedAt),
      future: false,
      title: 'Opened the portal',
      detail: 'Viewed the checklist',
    });
  }

  if (/bounce/i.test(ch?.pausedReason ?? '')) {
    entries.push({
      id: 'bounced',
      kind: 'bounced',
      at: ch?.lastSentAt ? toDate(ch.lastSentAt) : new Date(),
      future: false,
      title: 'Email bounced',
      detail: ch?.pausedReason,
    });
  }

  if (ch?.status === 'escalated') {
    entries.push({
      id: 'escalated',
      kind: 'escalated',
      at: ch?.lastSentAt ? toDate(ch.lastSentAt) : new Date(),
      future: false,
      title: 'Escalated to the assigned preparer',
      detail: 'Automatic chasing stopped — this one needs a person',
    });
  }

  if (ch?.status === 'active' && ch?.nextDueAt) {
    const next = profile.steps[Math.min(ch.sentCount ?? 0, profile.steps.length - 1)];
    entries.push({
      id: 'scheduled',
      kind: 'scheduled',
      at: toDate(ch.nextDueAt),
      future: true,
      title: 'Next reminder scheduled',
      channels: next?.channels,
      toneLabel: next ? TONE_LABEL[next.tone] : undefined,
    });
  }

  return entries.sort((a, b) => {
    if (a.future !== b.future) return a.future ? -1 : 1;
    return a.future ? a.at.getTime() - b.at.getTime() : b.at.getTime() - a.at.getTime();
  });
}
