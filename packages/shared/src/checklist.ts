/**
 * The checklist engine — TaxFax's wedge.
 *
 * A prior-year return is parsed into a `PriorYearReturn` fact set, then every
 * rule below is evaluated against it. Each hit becomes a checklist line with the
 * reason it was asked for, so the preparer can see *why* the item is there and
 * the taxpayer understands what's being asked for.
 *
 * A rule emits a **reason reference** — a key plus the evidence it found — not a
 * sentence. The sentence is assembled from the reader's own dictionary at
 * display time (see `i18n/reasons.ts`). A rule that wrote English prose froze
 * the taxpayer's most persuasive copy into a language they may not read, and
 * dissolved the evidence it had found on the way. `hit.reason` is still the
 * English rendering, so everything that only ever wanted a sentence — the
 * preparer's console, an activity log, a chase preview — is unchanged.
 */

import type { EntityType, FilingStatus, RequestPriority } from './models.ts';
import { renderReason } from './i18n/reasons.ts';
import type { ReasonKey, ReasonRef, ReasonVars } from './i18n/types.ts';
import { en } from './i18n/dict/en.ts';

/** Facts extracted from a prior-year return. Everything is optional-tolerant. */
export interface PriorYearReturn {
  taxYear: number;
  formType: '1040' | '1065' | '1120S' | '1120' | '1041' | 'unknown';
  entityType: EntityType;
  filingStatus?: FilingStatus;
  taxpayerName?: string;
  spouseName?: string;
  /** Number of dependents claimed. */
  dependents: number;
  /** Two-letter state of residence, when a state return was attached. */
  state?: string;
  /** Schedules and forms detected: '1', 'A', 'B', 'C', 'D', 'E', 'SE', '8829'… */
  schedules: string[];
  /** Form-line values keyed by IRS line label: `{ '1z': 84000, '2b': 312 }`. */
  lines: Record<string, number>;
  /** Payers named on the return's attachments, grouped by document type. */
  issuers: { docTypeId: string; name: string }[];
  /**
   * Schedule LEP code, when the taxpayer attached one: a formal election of the
   * language the IRS should write to them in. Three digits as printed on the
   * form, e.g. `'003'`. This is the whole reason TaxFax can chase in the right
   * language without the firm lifting a finger.
   */
  lepCode?: string;
  /** The IRS's English name for that language, e.g. `'Vietnamese'`. */
  lepLanguage?: string;
  itemized: boolean;
  /** Count of each source document type found in last year's package. */
  documentCounts: Record<string, number>;
  /** 0–1 confidence in the parse as a whole. */
  confidence: number;
}

export function emptyPriorYear(taxYear: number): PriorYearReturn {
  return {
    taxYear,
    formType: 'unknown',
    entityType: 'individual',
    dependents: 0,
    schedules: [],
    lines: {},
    issuers: [],
    itemized: false,
    documentCounts: {},
    confidence: 0,
  };
}

export interface RuleContext {
  prior: PriorYearReturn;
  /** Season being collected for, i.e. `prior.taxYear + 1` in the normal case. */
  taxYear: number;
}

export interface ChecklistHit {
  docTypeId: string;
  quantity: number;
  /**
   * The reason rendered in English. Kept so every existing consumer — the
   * preparer's console, the activity log, the persisted `DocRequest.reason` —
   * reads exactly as it did before.
   */
  reason: string;
  /** The same reason as a key, so a taxpayer can read it in their own language. */
  reasonKey: ReasonKey;
  /** The evidence the rule found, for the renderer to splice in. */
  reasonVars?: ReasonVars;
  priority: RequestPriority;
  issuers: string[];
}

export interface ChecklistRule {
  id: string;
  docTypeId: string;
  priority: RequestPriority;
  /**
   * Returns `false` to skip, or `{ quantity, reason }` to emit a checklist line.
   * Reasons must name the evidence — that's what makes the checklist credible —
   * which is why the evidence travels as data rather than as a formatted
   * sentence.
   */
  evaluate(ctx: RuleContext): { quantity: number; reason: ReasonRef } | false;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const has = (p: PriorYearReturn, sched: string) => p.schedules.includes(sched);
const line = (p: PriorYearReturn, l: string) => p.lines[l] ?? 0;
const count = (p: PriorYearReturn, docTypeId: string) => p.documentCounts[docTypeId] ?? 0;
const named = (p: PriorYearReturn, docTypeId: string) =>
  p.issuers.filter((i) => i.docTypeId === docTypeId).map((i) => i.name);

const usd = (n: number) =>
  n >= 1000
    ? `$${Math.round(n / 1000).toLocaleString('en-US')}k`
    : `$${Math.round(n).toLocaleString('en-US')}`;

/** The prior tax year as digits — a string, so `Intl` never groups it "2,024". */
const yr = (p: PriorYearReturn) => String(p.taxYear);

/** A reason with no evidence to splice in. */
const say = (key: ReasonKey): ReasonRef => ({ key });
/** A reason and the evidence that earned it. */
const because = (key: ReasonKey, vars: ReasonVars): ReasonRef => ({ key, vars });

// ── Rules ───────────────────────────────────────────────────────────────────

export const CHECKLIST_RULES: ChecklistRule[] = [
  // Always-on engagement items.
  {
    id: 'engagement-letter',
    docTypeId: 'engagement-letter',
    priority: 'critical',
    evaluate: () => ({ quantity: 1, reason: say('reason.engagement') }),
  },
  {
    id: 'photo-id-refresh',
    docTypeId: 'photo-id',
    priority: 'standard',
    evaluate: ({ prior }) =>
      prior.entityType === 'individual'
        ? {
            quantity: prior.filingStatus === 'mfj' ? 2 : 1,
            reason: say(
              prior.filingStatus === 'mfj' ? 'reason.photoIdBoth' : 'reason.photoId',
            ),
          }
        : false,
  },
  {
    id: 'ip-pin',
    docTypeId: 'ip-pin',
    priority: 'critical',
    evaluate: ({ prior }) =>
      count(prior, 'ip-pin') > 0
        ? {
            quantity: count(prior, 'ip-pin'),
            reason: because('reason.ipPin', { year: yr(prior) }),
          }
        : false,
  },

  // ── Wages ────────────────────────────────────────────────────────────────
  {
    id: 'w2',
    docTypeId: 'w2',
    priority: 'critical',
    evaluate: ({ prior }) => {
      const n = count(prior, 'w2');
      const wages = line(prior, '1z') || line(prior, '1a');
      if (n === 0 && wages === 0) return false;
      const qty = Math.max(n, 1);
      const names = named(prior, 'w2');
      return {
        quantity: qty,
        reason: names.length
          ? because(qty === 1 ? 'reason.w2Issuers' : 'reason.w2IssuersMany', {
              count: qty,
              issuers: names,
            })
          : because('reason.w2Wages', { year: yr(prior), amount: usd(wages) }),
      };
    },
  },

  // ── Interest / dividends ─────────────────────────────────────────────────
  {
    id: '1099-int',
    docTypeId: '1099-int',
    priority: 'standard',
    evaluate: ({ prior }) => {
      const amt = line(prior, '2b') + line(prior, '2a');
      const n = count(prior, '1099-int');
      if (amt === 0 && n === 0) return false;
      const qty = Math.max(n, 1);
      const names = named(prior, '1099-int');
      return {
        quantity: qty,
        reason: names.length
          ? because('reason.interestIssuers', { issuers: names })
          : because('reason.interestAmount', { year: yr(prior), amount: usd(amt) }),
      };
    },
  },
  {
    id: '1099-div',
    docTypeId: '1099-div',
    priority: 'standard',
    evaluate: ({ prior }) => {
      const amt = line(prior, '3b') + line(prior, '3a');
      const n = count(prior, '1099-div');
      if (amt === 0 && n === 0) return false;
      const qty = Math.max(n, 1);
      const names = named(prior, '1099-div');
      return {
        quantity: qty,
        reason: names.length
          ? because('reason.dividendsIssuers', { issuers: names })
          : because('reason.dividendsAmount', { year: yr(prior), amount: usd(amt) }),
      };
    },
  },
  {
    id: '1099-b',
    docTypeId: '1099-b',
    priority: 'critical',
    evaluate: ({ prior }) => {
      if (!has(prior, 'D') && line(prior, '7') === 0 && count(prior, '1099-b') === 0) return false;
      const qty = Math.max(count(prior, '1099-b'), 1);
      const names = named(prior, '1099-b');
      return {
        quantity: qty,
        reason: names.length
          ? because('reason.brokerIssuers', { issuers: names })
          : say('reason.brokerSchedule'),
      };
    },
  },

  // ── Retirement / benefits ────────────────────────────────────────────────
  {
    id: '1099-r',
    docTypeId: '1099-r',
    priority: 'critical',
    evaluate: ({ prior }) => {
      const amt = line(prior, '4a') + line(prior, '4b') + line(prior, '5a') + line(prior, '5b');
      const n = count(prior, '1099-r');
      if (amt === 0 && n === 0) return false;
      return {
        quantity: Math.max(n, 1),
        reason: because('reason.retirement', { year: yr(prior), amount: usd(amt) }),
      };
    },
  },
  {
    id: 'ssa-1099',
    docTypeId: 'ssa-1099',
    priority: 'critical',
    evaluate: ({ prior }) => {
      const amt = line(prior, '6a');
      if (amt === 0 && count(prior, 'ssa-1099') === 0) return false;
      return {
        quantity: prior.filingStatus === 'mfj' && count(prior, 'ssa-1099') > 1 ? 2 : 1,
        reason: because('reason.socialSecurity', { amount: usd(amt) }),
      };
    },
  },
  {
    id: '1099-g',
    docTypeId: '1099-g',
    priority: 'standard',
    evaluate: ({ prior }) =>
      count(prior, '1099-g') > 0 || line(prior, 'sch1-7') > 0
        ? {
            quantity: Math.max(count(prior, '1099-g'), 1),
            reason: say('reason.unemployment'),
          }
        : false,
  },

  // ── Self-employment ──────────────────────────────────────────────────────
  {
    id: 'sch-c-pl',
    docTypeId: 'profit-loss',
    priority: 'critical',
    evaluate: ({ prior }) => {
      if (!has(prior, 'C')) return false;
      const n = prior.schedules.filter((s) => s === 'C').length || 1;
      const net = line(prior, 'sch1-3');
      return {
        quantity: n,
        reason:
          n > 1
            ? because('reason.scheduleCMany', { count: n })
            : net
              ? because('reason.scheduleCIncome', { amount: usd(net) })
              : say('reason.scheduleC'),
      };
    },
  },
  {
    id: 'sch-c-1099nec',
    docTypeId: '1099-nec',
    priority: 'standard',
    evaluate: ({ prior }) => {
      const n = count(prior, '1099-nec');
      if (!has(prior, 'C') && n === 0) return false;
      const names = named(prior, '1099-nec');
      return {
        quantity: Math.max(n, 1),
        reason: names.length
          ? because('reason.necIssuers', { issuers: names })
          : say('reason.necSelfEmployed'),
      };
    },
  },
  {
    id: 'sch-c-1099k',
    docTypeId: '1099-k',
    priority: 'standard',
    evaluate: ({ prior }) => {
      if (count(prior, '1099-k') === 0) return false;
      const names = named(prior, '1099-k');
      return {
        quantity: count(prior, '1099-k'),
        reason: names.length
          ? because('reason.paymentAppIssuers', { issuers: names })
          : say('reason.paymentApp'),
      };
    },
  },
  {
    id: 'mileage',
    docTypeId: 'mileage-log',
    priority: 'standard',
    evaluate: ({ prior }) =>
      has(prior, 'C') || has(prior, 'E')
        ? {
            quantity: 1,
            reason: say('reason.mileage'),
          }
        : false,
  },
  {
    id: 'home-office',
    docTypeId: 'home-office',
    priority: 'optional',
    evaluate: ({ prior }) =>
      has(prior, '8829')
        ? {
            quantity: 1,
            reason: say('reason.homeOffice'),
          }
        : false,
  },
  {
    id: 'assets',
    docTypeId: 'asset-schedule',
    priority: 'standard',
    evaluate: ({ prior }) =>
      has(prior, '4562') || has(prior, 'C') || has(prior, 'E')
        ? {
            quantity: 1,
            reason: say('reason.assets'),
          }
        : false,
  },
  {
    id: 'payroll',
    docTypeId: 'payroll-summary',
    priority: 'standard',
    evaluate: ({ prior }) =>
      prior.entityType !== 'individual' || count(prior, 'payroll-summary') > 0
        ? {
            quantity: 1,
            reason: say('reason.payroll'),
          }
        : false,
  },
  {
    id: 'bank-statements',
    docTypeId: 'bank-statements',
    priority: 'optional',
    evaluate: ({ prior }) =>
      has(prior, 'C') && !count(prior, 'profit-loss')
        ? {
            quantity: 12,
            reason: say('reason.bankStatements'),
          }
        : false,
  },

  // ── Pass-through ─────────────────────────────────────────────────────────
  {
    id: 'k1-1065',
    docTypeId: 'k1-1065',
    priority: 'critical',
    evaluate: ({ prior }) => {
      const n = count(prior, 'k1-1065');
      if (n === 0) return false;
      const names = named(prior, 'k1-1065');
      return {
        quantity: n,
        reason: names.length
          ? because('reason.k1PartnershipIssuers', { issuers: names })
          : because(n === 1 ? 'reason.k1Partnership' : 'reason.k1PartnershipMany', { count: n }),
      };
    },
  },
  {
    id: 'k1-1120s',
    docTypeId: 'k1-1120s',
    priority: 'critical',
    evaluate: ({ prior }) => {
      const n = count(prior, 'k1-1120s');
      if (n === 0) return false;
      const names = named(prior, 'k1-1120s');
      return {
        quantity: n,
        reason: names.length
          ? because('reason.k1SCorpIssuers', { issuers: names })
          : because(n === 1 ? 'reason.k1SCorp' : 'reason.k1SCorpMany', { count: n }),
      };
    },
  },
  {
    id: 'k1-1041',
    docTypeId: 'k1-1041',
    priority: 'standard',
    evaluate: ({ prior }) =>
      count(prior, 'k1-1041') > 0
        ? {
            quantity: count(prior, 'k1-1041'),
            reason: say('reason.k1Trust'),
          }
        : false,
  },

  // ── Property ─────────────────────────────────────────────────────────────
  {
    id: 'rental',
    docTypeId: 'rental-summary',
    priority: 'critical',
    evaluate: ({ prior }) => {
      if (!has(prior, 'E')) return false;
      const n = Math.max(count(prior, 'rental-summary'), 1);
      return {
        quantity: n,
        reason:
          n > 1
            ? because('reason.rentalMany', { count: n })
            : say('reason.rentalOne'),
      };
    },
  },
  {
    id: '1098',
    docTypeId: '1098',
    priority: 'critical',
    evaluate: ({ prior }) => {
      const n = count(prior, '1098');
      if (n === 0 && !prior.itemized && !has(prior, 'E')) return false;
      const names = named(prior, '1098');
      return {
        quantity: Math.max(n, 1),
        reason: names.length
          ? because('reason.mortgageIssuers', { issuers: names })
          : say('reason.mortgage'),
      };
    },
  },
  {
    id: 'property-tax',
    docTypeId: 'property-tax',
    priority: 'standard',
    evaluate: ({ prior }) =>
      prior.itemized || has(prior, 'E')
        ? {
            quantity: Math.max(count(prior, 'property-tax'), 1),
            reason: say('reason.propertyTax'),
          }
        : false,
  },
  {
    id: 'closing',
    docTypeId: 'closing-statement',
    priority: 'optional',
    evaluate: () => ({
      quantity: 1,
      reason: say('reason.closing'),
    }),
  },

  // ── Deductions & credits ─────────────────────────────────────────────────
  {
    id: 'charitable',
    docTypeId: 'charitable',
    priority: 'standard',
    evaluate: ({ prior }) => {
      if (!prior.itemized) return false;
      const gave = line(prior, 'schA-14');
      return {
        quantity: 1,
        reason: gave
          ? because('reason.charitableGave', { amount: usd(gave) })
          : say('reason.charitable'),
      };
    },
  },
  {
    id: 'medical',
    docTypeId: 'medical-expenses',
    priority: 'optional',
    evaluate: ({ prior }) =>
      prior.itemized && line(prior, 'schA-1') > 0
        ? {
            quantity: 1,
            reason: because('reason.medical', { amount: usd(line(prior, 'schA-1')) }),
          }
        : false,
  },
  {
    id: '1098-e',
    docTypeId: '1098-e',
    priority: 'standard',
    evaluate: ({ prior }) =>
      count(prior, '1098-e') > 0 || line(prior, 'sch1-21') > 0
        ? {
            quantity: Math.max(count(prior, '1098-e'), 1),
            reason: say('reason.studentLoan'),
          }
        : false,
  },
  {
    id: '1098-t',
    docTypeId: '1098-t',
    priority: 'standard',
    evaluate: ({ prior }) =>
      count(prior, '1098-t') > 0 || has(prior, '8863')
        ? {
            quantity: Math.max(count(prior, '1098-t'), 1),
            reason: say('reason.education'),
          }
        : false,
  },
  {
    id: 'childcare',
    docTypeId: 'childcare',
    priority: 'standard',
    evaluate: ({ prior }) =>
      has(prior, '2441')
        ? {
            quantity: 1,
            reason: say('reason.childcare'),
          }
        : false,
  },
  {
    id: 'ira',
    docTypeId: '5498',
    priority: 'optional',
    evaluate: ({ prior }) =>
      line(prior, 'sch1-20') > 0
        ? { quantity: 1, reason: say('reason.ira') }
        : false,
  },
  {
    id: 'hsa',
    docTypeId: '5498-sa',
    priority: 'standard',
    evaluate: ({ prior }) =>
      has(prior, '8889')
        ? { quantity: 1, reason: say('reason.hsa') }
        : false,
  },
  {
    id: 'hsa-dist',
    docTypeId: '1099-sa',
    priority: 'standard',
    evaluate: ({ prior }) =>
      has(prior, '8889')
        ? { quantity: 1, reason: say('reason.hsaSpend') }
        : false,
  },
  {
    id: 'energy',
    docTypeId: 'energy-credit',
    priority: 'optional',
    evaluate: ({ prior }) =>
      has(prior, '5695')
        ? { quantity: 1, reason: say('reason.energy') }
        : false,
  },
  {
    id: 'educator',
    docTypeId: 'k12-educator',
    priority: 'optional',
    evaluate: ({ prior }) =>
      line(prior, 'sch1-11') > 0
        ? { quantity: 1, reason: say('reason.educator') }
        : false,
  },

  // ── Health ───────────────────────────────────────────────────────────────
  {
    id: '1095-a',
    docTypeId: '1095-a',
    priority: 'critical',
    evaluate: ({ prior }) =>
      has(prior, '8962') || count(prior, '1095-a') > 0
        ? {
            quantity: 1,
            reason: say('reason.marketplace'),
          }
        : false,
  },

  // ── Payments & banking ───────────────────────────────────────────────────
  {
    id: 'estimates',
    docTypeId: 'estimated-payments',
    priority: 'critical',
    evaluate: ({ prior }) => {
      if (line(prior, '26') <= 0 && !has(prior, 'SE') && !has(prior, 'C')) return false;
      const paid = line(prior, '26');
      return {
        quantity: 1,
        reason: paid
          ? because('reason.estimatesTotal', { amount: usd(paid) })
          : say('reason.estimates'),
      };
    },
  },
  {
    id: 'bank-info',
    docTypeId: 'voided-check',
    priority: 'standard',
    evaluate: () => ({
      quantity: 1,
      reason: say('reason.bankInfo'),
    }),
  },

  // ── Crypto ───────────────────────────────────────────────────────────────
  {
    id: 'crypto',
    docTypeId: 'crypto-report',
    priority: 'standard',
    evaluate: ({ prior }) =>
      count(prior, 'crypto-report') > 0 || prior.lines['digital-assets'] === 1
        ? {
            quantity: 1,
            reason: say('reason.crypto'),
          }
        : false,
  },
];

/**
 * Runs every rule and returns the checklist, ordered by taxonomy category then
 * priority. Deterministic — the same return always yields the same checklist.
 *
 * Each hit carries the reason twice: as a key plus its evidence, which is what
 * a taxpayer reads in their own language, and as the English sentence, which is
 * what the firm's own console and every existing consumer reads.
 */
export function generateChecklist(ctx: RuleContext): ChecklistHit[] {
  const hits: ChecklistHit[] = [];
  for (const rule of CHECKLIST_RULES) {
    const result = rule.evaluate(ctx);
    if (!result || result.quantity <= 0) continue;
    const { key, vars } = result.reason;
    hits.push({
      docTypeId: rule.docTypeId,
      quantity: result.quantity,
      reason: renderReason('en', result.reason, en),
      reasonKey: key,
      ...(vars ? { reasonVars: vars } : {}),
      priority: rule.priority,
      issuers: named(ctx.prior, rule.docTypeId),
    });
  }
  return hits;
}

/**
 * Fallback checklist for a brand-new client with no prior-year return. Kept
 * deliberately short — a wall of 30 optional items is what competitors do, and
 * it is why taxpayers ignore them.
 */
export const STARTER_CHECKLIST: {
  docTypeId: string;
  priority: RequestPriority;
  reason: string;
  reasonKey: ReasonKey;
}[] = (
  [
    { docTypeId: 'prior-return', priority: 'critical', reasonKey: 'reason.priorReturn' },
    { docTypeId: 'engagement-letter', priority: 'critical', reasonKey: 'reason.engagement' },
    { docTypeId: 'photo-id', priority: 'standard', reasonKey: 'reason.photoId' },
    { docTypeId: 'w2', priority: 'standard', reasonKey: 'reason.w2Each' },
    { docTypeId: 'voided-check', priority: 'standard', reasonKey: 'reason.refundDeposit' },
  ] satisfies { docTypeId: string; priority: RequestPriority; reasonKey: ReasonKey }[]
).map((s) => ({ ...s, reason: renderReason('en', { key: s.reasonKey }, en) }));
