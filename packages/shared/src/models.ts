/**
 * Firestore data model. Every collection is rooted under `firms/{firmId}` so a
 * single security-rule predicate — "is the caller a member of this firm?" —
 * isolates tenants without any server-side filtering.
 */

export type Timestampish = { seconds: number; nanoseconds: number } | Date | number;

import type { ClientLanguage } from './i18n/language.ts';
import type { LocaleId } from './i18n/locales.ts';

// ── Tenancy ─────────────────────────────────────────────────────────────────

export type FirmRole = 'owner' | 'admin' | 'preparer' | 'viewer';

/** Ranked so `ROLE_RANK[a] >= ROLE_RANK[b]` answers "does a outrank b?". */
export const ROLE_RANK: Record<FirmRole, number> = {
  owner: 40,
  admin: 30,
  preparer: 20,
  viewer: 10,
};

export const ROLE_LABEL: Record<FirmRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  preparer: 'Preparer',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTION: Record<FirmRole, string> = {
  owner: 'Full control, including billing and deleting the workspace.',
  admin: 'Manage clients, staff, templates, and chase settings.',
  preparer: 'Work assigned clients — request, review, and approve documents.',
  viewer: 'Read-only across the firm. Cannot send chases or change data.',
};

export interface Firm {
  id: string;
  name: string;
  /** URL-safe handle used on the client portal: taxfax.xyz/p/{slug}. */
  slug: string;
  createdAt: Timestampish;
  createdBy: string;
  /** Current filing season, e.g. 2025 means "the 2025 return, filed in 2026". */
  taxYear: number;
  timezone: string;
  /** Shown to taxpayers on the portal and in every chase message. */
  branding: {
    displayName: string;
    /** Storage path, not a URL — resolved client-side. */
    logoPath?: string;
    accent: string;
    replyToEmail: string;
    supportPhone?: string;
  };
  chase: ChaseSettings;
  /**
   * Taxpayer-facing messages follow the client's language. Absent means on: a
   * single-language firm never has to think about it, because a client with no
   * Schedule LEP election and no override stays on English either way. A firm
   * whose staff can't read a reply in Vietnamese can switch it off.
   */
  multilingual?: { enabled: boolean };
  seats: number;
  plan: 'trial' | 'solo' | 'firm' | 'multi';
  trialEndsAt?: Timestampish;
  onboarding: {
    completedSteps: string[];
    dismissed: boolean;
  };
}

export interface FirmMember {
  uid: string;
  firmId: string;
  email: string;
  name: string;
  role: FirmRole;
  avatarColor: string;
  invitedBy?: string;
  joinedAt: Timestampish;
  lastSeenAt?: Timestampish;
  status: 'active' | 'invited' | 'disabled';
}

export interface Invite {
  token: string;
  firmId: string;
  firmName: string;
  email: string;
  role: FirmRole;
  invitedBy: string;
  invitedByName: string;
  createdAt: Timestampish;
  expiresAt: Timestampish;
  acceptedAt?: Timestampish;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
}

/** Membership index at `users/{uid}` so login can resolve workspaces in one read. */
export interface UserIndex {
  uid: string;
  email: string;
  name: string;
  firmIds: string[];
  defaultFirmId?: string;
  /** Set when the user is a taxpayer rather than firm staff. */
  portalAccess?: { firmId: string; clientId: string }[];
}

// ── Clients ─────────────────────────────────────────────────────────────────

export type FilingStatus =
  | 'single'
  | 'mfj'
  | 'mfs'
  | 'hoh'
  | 'qw'
  | 'entity';

export const FILING_STATUS_LABEL: Record<FilingStatus, string> = {
  single: 'Single',
  mfj: 'Married filing jointly',
  mfs: 'Married filing separately',
  hoh: 'Head of household',
  qw: 'Qualifying widow(er)',
  entity: 'Business entity',
};

export type EntityType = 'individual' | 'partnership' | 's-corp' | 'c-corp' | 'trust' | 'nonprofit';

export const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  individual: 'Individual (1040)',
  partnership: 'Partnership (1065)',
  's-corp': 'S corporation (1120-S)',
  'c-corp': 'C corporation (1120)',
  trust: 'Trust or estate (1041)',
  nonprofit: 'Nonprofit (990)',
};

/**
 * Where a client sits in the collection funnel. This is the single most-read
 * field in the product — it drives the roster, the dashboard, and whether the
 * chase engine is allowed to send anything.
 */
export type ClientStage =
  | 'not_started'   // no checklist yet
  | 'awaiting'      // checklist sent, nothing back
  | 'partial'       // some documents in
  | 'in_review'     // everything in, preparer checking
  | 'blocked'       // needs a human — bad contact info, client dispute
  | 'ready'         // complete and accepted
  | 'filed';        // return filed, archived for the season

export const CLIENT_STAGE_LABEL: Record<ClientStage, string> = {
  not_started: 'Not started',
  awaiting: 'Awaiting documents',
  partial: 'Partially received',
  in_review: 'In review',
  blocked: 'Blocked',
  ready: 'Ready to prepare',
  filed: 'Filed',
};

/** Stages the chase engine is permitted to act on. */
export const CHASEABLE_STAGES: ClientStage[] = ['awaiting', 'partial'];

export interface Client {
  id: string;
  firmId: string;
  taxYear: number;

  displayName: string;
  /** Sort key: last name for individuals, entity name otherwise. */
  sortName: string;
  entityType: EntityType;
  filingStatus?: FilingStatus;

  primaryContact: Contact;
  /** Spouse or a second signer who should also receive chases. */
  secondaryContact?: Contact;

  assignedTo?: string;
  tags: string[];
  stage: ClientStage;

  /** Denormalized counters kept current by Cloud Functions so the roster is one read per client. */
  progress: ClientProgress;

  /** Set once a prior-year return has been parsed. */
  priorYear?: {
    sourceDocumentId: string;
    taxYear: number;
    parsedAt: Timestampish;
    confidence: number;
  };

  chase: ClientChaseState;

  /**
   * The language we write to this taxpayer in. Usually detected from the
   * Schedule LEP election on last year's return; a preparer or the taxpayer can
   * override it. See `preferLanguage` for who wins.
   */
  language?: ClientLanguage;

  notes?: string;
  createdAt: Timestampish;
  updatedAt: Timestampish;
  archivedAt?: Timestampish;
}

export interface Contact {
  name: string;
  email: string;
  /** E.164. Absent means SMS steps are skipped for this client. */
  phone?: string;
  /** Taxpayer opted out of SMS — respected forever, per TCPA. */
  smsOptOut?: boolean;
  emailOptOut?: boolean;
}

export interface ClientProgress {
  total: number;
  received: number;
  accepted: number;
  rejected: number;
  overdue: number;
  /** 0–100, accepted / total. The number shown on the roster. */
  percent: number;
  lastActivityAt?: Timestampish;
  firstRequestedAt?: Timestampish;
  completedAt?: Timestampish;
}

// ── Checklist ───────────────────────────────────────────────────────────────

export type RequestStatus =
  | 'pending'      // asked for, nothing uploaded
  | 'received'     // file(s) uploaded, awaiting preparer review
  | 'accepted'     // preparer signed off
  | 'rejected'     // wrong or illegible, client must re-upload
  | 'waived';      // preparer decided it isn't needed this year

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'Needed',
  received: 'Received',
  accepted: 'Accepted',
  rejected: 'Needs redo',
  waived: 'Not needed',
};

export type RequestPriority = 'critical' | 'standard' | 'optional';

export type RequestSource = 'prior_year' | 'template' | 'manual' | 'inferred';

export const REQUEST_SOURCE_LABEL: Record<RequestSource, string> = {
  prior_year: 'From last year’s return',
  template: 'Firm template',
  manual: 'Added by preparer',
  inferred: 'Detected from an upload',
};

/** One line on a client's document checklist. */
export interface DocRequest {
  id: string;
  firmId: string;
  clientId: string;
  taxYear: number;

  docTypeId: string;
  /** Overrides the taxonomy label when the preparer renames it. */
  label?: string;
  /** "Because Schedule E showed two rental properties last year." */
  reason: string;
  source: RequestSource;
  priority: RequestPriority;

  /** How many the taxpayer is expected to send (3 W-2s last year → 3). */
  expectedCount: number;
  /** Carried forward from the prior return: ["Acme Corp", "Northwind LLC"]. */
  expectedIssuers?: string[];

  status: RequestStatus;
  documentIds: string[];
  dueDate?: Timestampish;

  /** Free-text ask from the preparer, shown verbatim on the portal. */
  instructions?: string;
  /** Why it was rejected — shown to the taxpayer. */
  rejectionReason?: string;

  order: number;
  createdAt: Timestampish;
  updatedAt: Timestampish;
  receivedAt?: Timestampish;
  acceptedAt?: Timestampish;
}

// ── Documents ───────────────────────────────────────────────────────────────

export type DocumentState =
  | 'uploading'
  | 'scanning'      // classification pipeline running
  | 'classified'
  | 'needs_review'  // classifier unsure, a human must confirm
  | 'accepted'
  | 'rejected'
  | 'retracted'     // taxpayer withdrew it — wrong file, sent by mistake
  | 'failed';

export interface StoredDocument {
  id: string;
  firmId: string;
  clientId: string;
  taxYear: number;

  /** Cloud Storage object path. Never exposed raw — always via a signed read. */
  storagePath: string;
  /** What the taxpayer's phone called it: "IMG_4821.HEIC". */
  originalName: string;
  /** What we renamed it to: "Whitfield_2025_W2_AcmeCorp.pdf". */
  canonicalName?: string;
  contentType: string;
  sizeBytes: number;
  pageCount?: number;

  state: DocumentState;
  classification?: Classification;
  requestId?: string;

  uploadedBy: string;
  uploadedVia: 'portal' | 'firm' | 'email';
  uploadedAt: Timestampish;
  processedAt?: Timestampish;

  /** Populated only on `failed`, and always human-readable. */
  error?: string;

  reviewedBy?: string;
  reviewedAt?: Timestampish;
  rejectionReason?: string;
  /** Set when the taxpayer withdrew it themselves. */
  retractedAt?: Timestampish;
}

export interface Classification {
  docTypeId: string;
  /** 0–1. Below `CLASSIFY_REVIEW_THRESHOLD` we route to human review. */
  confidence: number;
  /** Issuer name lifted from the document: "Acme Corp". */
  issuer?: string;
  taxYear?: number;
  /** Which patterns fired — shown in the UI so preparers can trust it. */
  evidence: string[];
  /** Runner-up guesses, for the one-click correction menu. */
  alternates: { docTypeId: string; confidence: number }[];
  method: 'text' | 'ocr' | 'filename' | 'manual';
}

/** Below this we ask a human. Tuned so false-accepts are near zero. */
export const CLASSIFY_ACCEPT_THRESHOLD = 0.82;
export const CLASSIFY_REVIEW_THRESHOLD = 0.45;

// ── Activity ────────────────────────────────────────────────────────────────

export type ActivityType =
  | 'client_created'
  | 'client_imported'
  | 'checklist_generated'
  | 'checklist_sent'
  | 'request_added'
  | 'request_waived'
  | 'document_uploaded'
  | 'document_classified'
  | 'document_accepted'
  | 'document_rejected'
  | 'document_retracted'
  | 'chase_sent'
  | 'chase_paused'
  | 'chase_resumed'
  | 'client_viewed_portal'
  | 'stage_changed'
  | 'language_detected'
  | 'member_invited'
  | 'member_joined';

export interface Activity {
  id: string;
  firmId: string;
  clientId?: string;
  type: ActivityType;
  /** Pre-rendered so the feed needs no joins: "Ava accepted Whitfield's W-2". */
  summary: string;
  actor: { uid?: string; name: string; kind: 'staff' | 'client' | 'system' };
  meta?: Record<string, unknown>;
  at: Timestampish;
}

// ── Chase ───────────────────────────────────────────────────────────────────

export type ChaseChannel = 'email' | 'sms';
export type ChaseTone = 'warm' | 'neutral' | 'firm' | 'urgent' | 'final';

export interface ChaseSettings {
  enabled: boolean;
  profile: ChaseProfileId;
  /** Local hours during which a message may be delivered. */
  quietHours: { start: number; end: number };
  sendOnWeekends: boolean;
  /** Hard deadline that compresses the cadence as it approaches. */
  deadline: string;
  /** Stop chasing and notify the preparer after this many steps. */
  escalateAfterStep: number;
  smsEnabled: boolean;
  /** Appended to every message: "— Ava at Whitfield & Co." */
  signature: string;
}

export type ChaseProfileId = 'gentle' | 'standard' | 'relentless';

export interface ChaseStep {
  index: number;
  /** Days after the checklist was first sent. */
  dayOffset: number;
  channels: ChaseChannel[];
  tone: ChaseTone;
  /** Also ping the assigned preparer. */
  notifyStaff?: boolean;
}

export interface ChaseProfile {
  id: ChaseProfileId;
  label: string;
  description: string;
  steps: ChaseStep[];
}

export interface ClientChaseState {
  status: 'idle' | 'active' | 'paused' | 'escalated' | 'complete';
  stepIndex: number;
  startedAt?: Timestampish;
  lastSentAt?: Timestampish;
  nextDueAt?: Timestampish;
  sentCount: number;
  /** Bumped by the portal so the UI can show "opened, still hasn't uploaded". */
  lastOpenedAt?: Timestampish;
  pausedReason?: string;
}

/** One delivered (or failed) chase message. */
export interface ChaseMessage {
  id: string;
  firmId: string;
  clientId: string;
  stepIndex: number;
  channel: ChaseChannel;
  tone: ChaseTone;
  to: string;
  subject?: string;
  body: string;
  /** Language it was written in. Absent on messages sent before this existed. */
  locale?: LocaleId;
  /** Doc-type codes outstanding at send time, for the activity feed. */
  outstanding: string[];
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'skipped';
  skipReason?: string;
  error?: string;
  /** Id of the row in the extension's `mail`/`messages` collection. */
  deliveryRef?: string;
  createdAt: Timestampish;
}

// ── Portal ──────────────────────────────────────────────────────────────────

/** Grants a taxpayer's Auth uid access to exactly one client record. */
export interface PortalGrant {
  uid: string;
  firmId: string;
  clientId: string;
  email: string;
  createdAt: Timestampish;
  lastSeenAt?: Timestampish;
}
