/**
 * The checklist engine — TaxFax's wedge.
 *
 * A prior-year return is parsed into a `PriorYearReturn` fact set, then every
 * rule below is evaluated against it. Each hit becomes a checklist line with a
 * plain-English reason, so the preparer can see *why* the item is there and the
 * taxpayer understands what's being asked for.
 */

import type { EntityType, FilingStatus, RequestPriority } from './models.ts';

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
  reason: string;
  priority: RequestPriority;
  issuers: string[];
}

export interface ChecklistRule {
  id: string;
  docTypeId: string;
  priority: RequestPriority;
  /**
   * Returns `false` to skip, or `{ quantity, reason }` to emit a checklist line.
   * Reasons must name the evidence — that's what makes the checklist credible.
   */
  evaluate(ctx: RuleContext): { quantity: number; reason: string } | false;
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

const plural = (n: number, one: string, many = one + 's') => (n === 1 ? one : many);

/** "last year" / "in 2024" — used so reasons read naturally. */
const yr = (p: PriorYearReturn) => p.taxYear;

// ── Rules ───────────────────────────────────────────────────────────────────

export const CHECKLIST_RULES: ChecklistRule[] = [
  // Always-on engagement items.
  {
    id: 'engagement-letter',
    docTypeId: 'engagement-letter',
    priority: 'critical',
    evaluate: () => ({ quantity: 1, reason: 'Required before we can start work.' }),
  },
  {
    id: 'photo-id-refresh',
    docTypeId: 'photo-id',
    priority: 'standard',
    evaluate: ({ prior }) =>
      prior.entityType === 'individual'
        ? {
            quantity: prior.filingStatus === 'mfj' ? 2 : 1,
            reason:
              prior.filingStatus === 'mfj'
                ? 'Both spouses need a current photo ID to e-file.'
                : 'Needed to verify your identity when we e-file.',
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
            reason: `You used an IRS Identity Protection PIN on your ${yr(prior)} return. The IRS issues a new one every December.`,
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
          ? `Last year you had ${qty} ${plural(qty, 'W-2')} — from ${listOf(names)}.`
          : `Your ${yr(prior)} return reported ${usd(wages)} of wages.`,
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
          ? `Interest last year from ${listOf(names)}.`
          : `Your ${yr(prior)} return reported ${usd(amt)} of interest income.`,
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
          ? `Dividends last year from ${listOf(names)}.`
          : `Your ${yr(prior)} return reported ${usd(amt)} of dividends.`,
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
          ? `You filed Schedule D last year with activity at ${listOf(names)}. We need the full consolidated statement, including the cost-basis pages.`
          : `You filed Schedule D last year, so we need your broker's consolidated 1099 — including the cost-basis detail.`,
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
        reason: `Your ${yr(prior)} return reported ${usd(amt)} from an IRA, pension, or annuity.`,
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
        reason: `You reported ${usd(amt)} of Social Security benefits last year.`,
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
            reason: 'You had unemployment or a state refund reported last year.',
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
            ? `You filed ${n} Schedule Cs last year — one profit & loss statement per business.`
            : `You filed Schedule C last year${net ? ` with ${usd(net)} of net business income` : ''}. A full-year P&L is the fastest way to get this done.`,
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
          ? `Last year you received 1099-NECs from ${listOf(names)}.`
          : 'You reported self-employment income last year — send any 1099-NECs you receive.',
      };
    },
  },
  {
    id: 'sch-c-1099k',
    docTypeId: '1099-k',
    priority: 'standard',
    evaluate: ({ prior }) =>
      count(prior, '1099-k') > 0
        ? {
            quantity: count(prior, '1099-k'),
            reason: `You received a 1099-K last year${named(prior, '1099-k').length ? ` from ${listOf(named(prior, '1099-k'))}` : ''}. The reporting threshold keeps dropping, so expect one again.`,
          }
        : false,
  },
  {
    id: 'mileage',
    docTypeId: 'mileage-log',
    priority: 'standard',
    evaluate: ({ prior }) =>
      has(prior, 'C') || has(prior, 'E')
        ? {
            quantity: 1,
            reason:
              'You claimed vehicle expenses last year. The IRS requires contemporaneous mileage records, so send your log or app export.',
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
            reason:
              'You claimed a home office last year — we need this year’s square footage plus utilities, rent or mortgage interest, and insurance.',
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
            reason:
              'Send invoices for anything the business bought over $2,500 — equipment, vehicles, or improvements.',
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
            reason: 'Year-end payroll reports (W-3, 940, 941) reconcile wages on the return.',
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
            reason:
              'You had business income last year but no bookkeeping file. Twelve months of statements let us build the P&L for you.',
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
          ? `You hold interests in ${listOf(names)}. Partnership K-1s often arrive late — send each as it comes.`
          : `You received ${n} partnership ${plural(n, 'K-1')} last year.`,
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
          ? `You're a shareholder in ${listOf(names)}.`
          : `You received ${n} S-corporation ${plural(n, 'K-1')} last year.`,
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
            reason: 'You were a beneficiary of a trust or estate last year.',
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
            ? `Schedule E showed ${n} rental properties last year — send income and expenses for each.`
            : 'You filed Schedule E last year. Send full-year rent collected plus expenses for the property.',
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
          ? `Mortgage interest last year from ${listOf(names)}.`
          : 'You deducted mortgage interest last year.',
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
            reason: 'You deducted real estate taxes last year.',
          }
        : false,
  },
  {
    id: 'closing',
    docTypeId: 'closing-statement',
    priority: 'optional',
    evaluate: () => ({
      quantity: 1,
      reason: 'Only if you bought, sold, or refinanced property this year.',
    }),
  },

  // ── Deductions & credits ─────────────────────────────────────────────────
  {
    id: 'charitable',
    docTypeId: 'charitable',
    priority: 'standard',
    evaluate: ({ prior }) =>
      prior.itemized
        ? {
            quantity: 1,
            reason: `You itemised last year${line(prior, 'schA-14') ? ` and gave ${usd(line(prior, 'schA-14'))}` : ''}. Anything over $250 needs a written acknowledgement from the charity.`,
          }
        : false,
  },
  {
    id: 'medical',
    docTypeId: 'medical-expenses',
    priority: 'optional',
    evaluate: ({ prior }) =>
      prior.itemized && line(prior, 'schA-1') > 0
        ? {
            quantity: 1,
            reason: `You claimed ${usd(line(prior, 'schA-1'))} of medical expenses last year.`,
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
            reason: 'You deducted student loan interest last year.',
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
            reason: 'You claimed an education credit last year.',
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
            reason:
              "You claimed the child and dependent care credit last year. We need the provider's name, address, and tax ID — not just the amount.",
          }
        : false,
  },
  {
    id: 'ira',
    docTypeId: '5498',
    priority: 'optional',
    evaluate: ({ prior }) =>
      line(prior, 'sch1-20') > 0
        ? { quantity: 1, reason: 'You deducted an IRA contribution last year.' }
        : false,
  },
  {
    id: 'hsa',
    docTypeId: '5498-sa',
    priority: 'standard',
    evaluate: ({ prior }) =>
      has(prior, '8889')
        ? { quantity: 1, reason: 'You filed Form 8889 for an HSA last year.' }
        : false,
  },
  {
    id: 'hsa-dist',
    docTypeId: '1099-sa',
    priority: 'standard',
    evaluate: ({ prior }) =>
      has(prior, '8889')
        ? { quantity: 1, reason: 'Needed if you spent from your HSA this year.' }
        : false,
  },
  {
    id: 'energy',
    docTypeId: 'energy-credit',
    priority: 'optional',
    evaluate: ({ prior }) =>
      has(prior, '5695')
        ? { quantity: 1, reason: 'You claimed a home energy credit last year.' }
        : false,
  },
  {
    id: 'educator',
    docTypeId: 'k12-educator',
    priority: 'optional',
    evaluate: ({ prior }) =>
      line(prior, 'sch1-11') > 0
        ? { quantity: 1, reason: 'You claimed the educator expense deduction last year.' }
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
            reason:
              'You had Marketplace coverage last year. Without Form 1095-A the IRS rejects the return outright.',
          }
        : false,
  },

  // ── Payments & banking ───────────────────────────────────────────────────
  {
    id: 'estimates',
    docTypeId: 'estimated-payments',
    priority: 'critical',
    evaluate: ({ prior }) =>
      line(prior, '26') > 0 || has(prior, 'SE') || has(prior, 'C')
        ? {
            quantity: 1,
            reason: `You made estimated payments last year${line(prior, '26') ? ` totalling ${usd(line(prior, '26'))}` : ''}. We need the exact date and amount of each one.`,
          }
        : false,
  },
  {
    id: 'bank-info',
    docTypeId: 'voided-check',
    priority: 'standard',
    evaluate: () => ({
      quantity: 1,
      reason: 'So any refund reaches you by direct deposit instead of a paper cheque.',
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
            reason:
              'You answered yes to the digital-asset question last year. Send a full transaction export from every exchange and wallet.',
          }
        : false,
  },
];

function listOf(names: string[]): string {
  const shown = names.slice(0, 3);
  const rest = names.length - shown.length;
  const joined =
    shown.length === 1
      ? shown[0]
      : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
  return rest > 0 ? `${joined} (+${rest} more)` : joined;
}

/**
 * Runs every rule and returns the checklist, ordered by taxonomy category then
 * priority. Deterministic — the same return always yields the same checklist.
 */
export function generateChecklist(ctx: RuleContext): ChecklistHit[] {
  const hits: ChecklistHit[] = [];
  for (const rule of CHECKLIST_RULES) {
    const result = rule.evaluate(ctx);
    if (!result || result.quantity <= 0) continue;
    hits.push({
      docTypeId: rule.docTypeId,
      quantity: result.quantity,
      reason: result.reason,
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
export const STARTER_CHECKLIST: { docTypeId: string; priority: RequestPriority; reason: string }[] =
  [
    {
      docTypeId: 'prior-return',
      priority: 'critical',
      reason:
        "Send last year's complete return and we'll build the rest of this list from it automatically.",
    },
    { docTypeId: 'engagement-letter', priority: 'critical', reason: 'Required before we can start work.' },
    { docTypeId: 'photo-id', priority: 'standard', reason: 'Needed to verify your identity when we e-file.' },
    { docTypeId: 'w2', priority: 'standard', reason: 'One from each employer.' },
    { docTypeId: 'voided-check', priority: 'standard', reason: 'So a refund reaches you by direct deposit.' },
  ];
