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
  /** Heading over the lines the taxpayer has already satisfied: "Done · 8". */
  | 'portal.done'
  | 'portal.upload'
  | 'portal.uploadHint'
  /** "1 of 2 uploaded" — the count under a line that expects more than one. */
  | 'portal.uploadedCount'
  | 'portal.allDone'
  | 'portal.whyAsked'
  | 'portal.help'
  | 'portal.language'
  | 'portal.languageHint'
  /** The header badge that says nobody else can see this list. */
  | 'portal.private'
  /** The firm's own words back to the taxpayer when a document was refused. */
  | 'portal.needsAnotherTry'
  /** Stands in for the firm's name before the firm doc has loaded. */
  | 'portal.yourAccountant'
  /** The list failed to load. */
  | 'portal.loadFailed'
  | 'portal.loadFailedHint'
  /** The firm has not asked for anything yet. */
  | 'portal.emptyTitle'
  | 'portal.emptyHint'
  /** Heading over the "send us something we didn't ask for" affordance. */
  | 'portal.somethingElse'
  | 'portal.somethingElseHint'
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
  | 'upload.percent'
  | 'upload.failed'
  | 'upload.unreadable'
  | 'upload.undo'
  | 'upload.undoLabel'
  | 'upload.removing'
  | 'upload.removingLabel'
  | 'upload.tryAgain'
  | 'upload.remove'
  | 'upload.cancel'
  /**
   * The uploader itself — the one control the entire product hinges on. On a
   * phone the camera button is `portal.upload` and `upload.chooseFiles` is the
   * quieter path to the photo library; on a desktop the drop target reads
   * `upload.dropPrompt` followed inline by the `upload.chooseFile` action, so a
   * language that words the invitation differently still gets its own order
   * inside each half.
   */
  | 'upload.chooseFiles'
  | 'upload.dropPrompt'
  | 'upload.chooseFile'
  /** Everything we can actually read, phrased as what to send. */
  | 'upload.unsupported'
  | 'upload.empty'
  | 'upload.tooLarge'
  | 'upload.photoTooLarge'
  | 'upload.heicUnreadable'
  | 'upload.heicFailed'
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

/**
 * The "why we need this" sentence on a checklist line — a key, not a sentence.
 *
 * This is the most persuasive copy in the product: it is the reason a taxpayer
 * goes and finds the document instead of ignoring the email. It used to be an
 * English string literal frozen into the rule that generated it, which made it
 * the one surface no amount of translating could reach. Naming each sentence
 * lets the reader's own language be chosen at *display* time, from the same
 * evidence the rule found.
 *
 * Two conventions hold here:
 *
 *   • **IRS identifiers are not slots a translator fills.** They belong to the
 *     key (see `REASON_CODES`), are spliced in by the renderer, and are bidi
 *     isolated on the way — "1099-DIV" is what is printed on the paper in the
 *     drawer, in every language.
 *   • **A count that changes the sentence gets its own key** (`…Many`). The
 *     noun being counted is usually an IRS form code, and English marks its
 *     plural on the code itself ("2 W-2s"). That is an English orthographic
 *     fact, not a shared noun, so it cannot live in `plural` — every other
 *     language phrases the count its own way in its own template.
 */
export type ReasonKey =
  // Engagement — asked of everyone, every year.
  | 'reason.engagement'
  | 'reason.photoId'
  | 'reason.photoIdBoth'
  | 'reason.ipPin'
  | 'reason.priorReturn'
  // Wages
  | 'reason.w2Issuers'
  | 'reason.w2IssuersMany'
  | 'reason.w2Wages'
  | 'reason.w2Each'
  // Interest, dividends, brokerage
  | 'reason.interestIssuers'
  | 'reason.interestAmount'
  | 'reason.dividendsIssuers'
  | 'reason.dividendsAmount'
  | 'reason.brokerIssuers'
  | 'reason.brokerSchedule'
  // Retirement and benefits
  | 'reason.retirement'
  | 'reason.socialSecurity'
  | 'reason.unemployment'
  // Self-employment
  | 'reason.scheduleCMany'
  | 'reason.scheduleCIncome'
  | 'reason.scheduleC'
  | 'reason.necIssuers'
  | 'reason.necSelfEmployed'
  | 'reason.paymentAppIssuers'
  | 'reason.paymentApp'
  | 'reason.mileage'
  | 'reason.homeOffice'
  | 'reason.assets'
  | 'reason.payroll'
  | 'reason.bankStatements'
  // Pass-through
  | 'reason.k1PartnershipIssuers'
  | 'reason.k1Partnership'
  | 'reason.k1PartnershipMany'
  | 'reason.k1SCorpIssuers'
  | 'reason.k1SCorp'
  | 'reason.k1SCorpMany'
  | 'reason.k1Trust'
  // Property
  | 'reason.rentalMany'
  | 'reason.rentalOne'
  | 'reason.mortgageIssuers'
  | 'reason.mortgage'
  | 'reason.propertyTax'
  | 'reason.closing'
  // Deductions and credits
  | 'reason.charitableGave'
  | 'reason.charitable'
  | 'reason.medical'
  | 'reason.studentLoan'
  | 'reason.education'
  | 'reason.childcare'
  | 'reason.ira'
  | 'reason.hsa'
  | 'reason.hsaSpend'
  | 'reason.energy'
  | 'reason.educator'
  | 'reason.marketplace'
  // Payments and banking
  | 'reason.estimatesTotal'
  | 'reason.estimates'
  | 'reason.bankInfo'
  | 'reason.refundDeposit'
  // Crypto
  | 'reason.crypto';

/**
 * Every reason key, in one array so the completeness check can walk them
 * without reaching into a dictionary that might itself be the thing missing one.
 */export const REASON_KEYS: ReasonKey[] = [
  'reason.engagement',
  'reason.photoId',
  'reason.photoIdBoth',
  'reason.ipPin',
  'reason.priorReturn',
  'reason.w2Issuers',
  'reason.w2IssuersMany',
  'reason.w2Wages',
  'reason.w2Each',
  'reason.interestIssuers',
  'reason.interestAmount',
  'reason.dividendsIssuers',
  'reason.dividendsAmount',
  'reason.brokerIssuers',
  'reason.brokerSchedule',
  'reason.retirement',
  'reason.socialSecurity',
  'reason.unemployment',
  'reason.scheduleCMany',
  'reason.scheduleCIncome',
  'reason.scheduleC',
  'reason.necIssuers',
  'reason.necSelfEmployed',
  'reason.paymentAppIssuers',
  'reason.paymentApp',
  'reason.mileage',
  'reason.homeOffice',
  'reason.assets',
  'reason.payroll',
  'reason.bankStatements',
  'reason.k1PartnershipIssuers',
  'reason.k1Partnership',
  'reason.k1PartnershipMany',
  'reason.k1SCorpIssuers',
  'reason.k1SCorp',
  'reason.k1SCorpMany',
  'reason.k1Trust',
  'reason.rentalMany',
  'reason.rentalOne',
  'reason.mortgageIssuers',
  'reason.mortgage',
  'reason.propertyTax',
  'reason.closing',
  'reason.charitableGave',
  'reason.charitable',
  'reason.medical',
  'reason.studentLoan',
  'reason.education',
  'reason.childcare',
  'reason.ira',
  'reason.hsa',
  'reason.hsaSpend',
  'reason.energy',
  'reason.educator',
  'reason.marketplace',
  'reason.estimatesTotal',
  'reason.estimates',
  'reason.bankInfo',
  'reason.refundDeposit',
  'reason.crypto',
];

/**
 * The evidence a rule found, kept as data so the sentence can be rebuilt in any
 * language. Firestore-shaped on purpose: strings, numbers and string arrays
 * only, no nested objects, so it round-trips through a document untouched.
 */
export interface ReasonVars {
  /** How many the prior-year return evidenced. */
  count?: number;
  /** A tax year, as digits. A string, not a number: `Intl` would group it "2,024". */
  year?: string;
  /** A US dollar figure already shortened for display, e.g. "$45k". */
  amount?: string;
  /** Payer legal names, joined with the reader's own list format at render time. */
  issuers?: string[];
}

/** A reason, stored and rendered: which sentence, and what it says. */
export interface ReasonRef {
  key: ReasonKey;
  vars?: ReasonVars;
}

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
   * The "why we need this" sentence for every checklist rule, keyed rather than
   * generated. `{code}`-shaped slots are IRS identifiers supplied by the
   * renderer, never by the translator; `{issuers}` is a list of company legal
   * names; `{amount}` is a US dollar figure. All three are interpolated so they
   * are bidi-isolated inside an RTL sentence.
   */
  reason: Record<ReasonKey, string>;
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
