/**
 * The shape a locale dictionary must fill.
 *
 * Everything here is *data*. A professional reviewer for a language is handed
 * exactly one file — `dict/<locale>.ts` — with no code in it, flips `review` to
 * `'professional'` and signs it. `check.ts` fails the build if a locale is
 * missing a key, so a half-translated language can never quietly ship.
 */

import type { ChaseTone } from '../models.ts';
import type { PluralForms } from './format.ts';
import type { LocaleId } from './locales.ts';

/**
 * Translation provenance, per locale. Machine-quality strings are not presented
 * as verified — the field exists so the difference is in the data, not in a
 * README nobody reads.
 */
export type ReviewStatus =
  /** The English source. Not a translation. */
  | 'source'
  /** Written by the model that built this module. Good, unverified, not yet fit for a real send. */
  | 'machine'
  /** Read end to end and corrected by a fluent tax professional. */
  | 'professional';

/** Plural word sets referenced from templates as `{count#key}`. */
export type PluralKey = 'item' | 'document' | 'day';

/** Fragments the renderer splices into a body, and the glue around lists. */
export type ChaseStringKey =
  /** Used when we somehow have no item names at all. */
  | 'list.fallback'
  /** Tail on a truncated inline list: ", plus 3 more". */
  | 'list.plus'
  /** Tail on a truncated bullet block: "…and 3 more". */
  | 'bullet.more'
  /** "Reminder" lede when some documents are already in. */
  | 'neutral.ledeSome'
  /** "Reminder" lede when nothing is in yet. */
  | 'neutral.ledeNone'
  /** "Urgent" paragraph when the filing deadline is within 30 days. */
  | 'urgent.deadlineNear'
  /** "Urgent" paragraph when it is not. */
  | 'urgent.deadlineFar'
  /** How a checklist line names its issuers: "W-2 from Acme Corp". */
  | 'item.fromIssuer';

/**
 * The portal's taxpayer-facing skeleton. Deliberately a seed set, not a guess at
 * a UI that five other agents are building right now: these are the strings the
 * domain guarantees a taxpayer reads. The portal team adds keys as it wires up,
 * and the completeness check makes a missing translation a build failure.
 */
export type PortalStringKey =
  | 'portal.title'
  | 'portal.progress'
  | 'portal.needed'
  | 'portal.upload'
  | 'portal.uploadHint'
  | 'portal.allDone'
  | 'portal.whyAsked'
  | 'portal.help'
  | 'portal.language'
  | 'portal.languageHint'
  /** The list failed to load. */
  | 'portal.loadFailed'
  | 'portal.loadFailedHint'
  /** The firm has not asked for anything yet. */
  | 'portal.emptyTitle'
  | 'portal.emptyHint'
  /** Heading over the "send us something we didn't ask for" affordance. */
  | 'portal.somethingElse'
  /**
   * The recognition line: what we say back the moment an upload lands. Three
   * forms because we know three different amounts about the file — the type and
   * who issued it, the type alone, or neither. `{code}` is an IRS identifier and
   * `{issuer}` a company's legal name; both are interpolated, never translated,
   * and `interpolate` bidi-isolates them so they survive inside an RTL sentence.
   */
  | 'upload.gotItIssuer'
  | 'upload.gotItCode'
  | 'upload.gotItSaved'
  | 'upload.preparing'
  | 'upload.failed'
  | 'upload.unreadable'
  | 'upload.undo'
  | 'upload.undoLabel'
  | 'upload.removing'
  | 'upload.removingLabel'
  /**
   * The magic-link handshake. Rendered before we know who the taxpayer is, so
   * the portal picks the locale off `navigator.languages` here rather than off
   * `Client.language` — a Vietnamese speaker who cannot get past the front door
   * never reaches the list we translated for them.
   */
  | 'signin.working'
  | 'signin.confirmTitle'
  | 'signin.confirmBody'
  | 'signin.emailLabel'
  | 'signin.continue'
  | 'signin.expiredTitle'
  | 'signin.expiredBody'
  | 'signin.expiredShort'
  | 'signin.yourEmail'
  | 'signin.sendLink'
  | 'signin.sentTitle'
  | 'signin.sentBody'
  | 'status.pending'
  | 'status.received'
  | 'status.accepted'
  | 'status.rejected'
  | 'status.waived';

export type StringKey = ChaseStringKey | PortalStringKey;

export interface ToneCopy {
  subject: string;
  /** Paragraph templates, joined with a blank line. */
  body: string[];
  sms: string;
}

export interface Dictionary {
  locale: LocaleId;
  review: ReviewStatus;
  /** Who signed it off, once `review` is `'professional'`. */
  reviewedBy?: string;
  plural: Record<PluralKey, PluralForms>;
  chase: Record<ChaseTone, ToneCopy>;
  s: Record<StringKey, string>;
  /**
   * Checklist item names, by doc-type id.
   *
   * IRS form identifiers — W-2, 1099-INT, 1098, K-1, 1095-A — are deliberately
   * absent and never translated. They are printed in Latin on the physical
   * document the taxpayer is hunting for; a Korean speaker looking through a
   * drawer needs to see "1099-DIV", not a Korean paraphrase of it. Only the
   * plain-language descriptors ("Property tax", "Mileage") are translated, and
   * in Arabic the untranslated code is exactly the LTR run that has to be
   * bidi-isolated inside an RTL sentence.
   */
  docCode: Record<DescriptorDocTypeId, string>;
}

/** The doc types whose `code` is a plain-English descriptor rather than an IRS form number. */
export type DescriptorDocTypeId =
  | 'crypto-report'
  | 'profit-loss'
  | 'balance-sheet'
  | 'mileage-log'
  | 'asset-schedule'
  | 'home-office'
  | 'bank-statements'
  | 'payroll-summary'
  | 'property-tax'
  | 'rental-summary'
  | 'closing-statement'
  | 'charitable'
  | 'medical-expenses'
  | 'childcare'
  | 'estimated-payments'
  | 'k12-educator'
  | 'energy-credit'
  | 'photo-id'
  | 'ssn-card'
  | 'voided-check'
  | 'prior-return'
  | 'engagement-letter'
  | 'organizer'
  | 'other';

export const DESCRIPTOR_DOC_TYPE_IDS: DescriptorDocTypeId[] = [
  'crypto-report',
  'profit-loss',
  'balance-sheet',
  'mileage-log',
  'asset-schedule',
  'home-office',
  'bank-statements',
  'payroll-summary',
  'property-tax',
  'rental-summary',
  'closing-statement',
  'charitable',
  'medical-expenses',
  'childcare',
  'estimated-payments',
  'k12-educator',
  'energy-credit',
  'photo-id',
  'ssn-card',
  'voided-check',
  'prior-return',
  'engagement-letter',
  'organizer',
  'other',
];

export const TONES: ChaseTone[] = ['warm', 'neutral', 'firm', 'urgent', 'final'];
