/**
 * Synthetic tax documents for the demo — real bytes, honestly classified.
 *
 * Two problems this solves at once.
 *
 * The preview pane. Every seeded document used to carry a `storagePath` with
 * nothing behind it, so the review queue — the screen the whole product is sold
 * on — read "Preview not available" 174 times. Now each row has a real PDF.
 *
 * The confidence score. Every seeded document used to claim `0.94`, which is
 * worse than useless on a screen headed "WHY THE CLASSIFIER SAID P&L": a number
 * that never moves is a number nobody believes. So nothing here sets a
 * confidence. We generate a page, extract its text the way the ingest pipeline
 * would, hand it to the *real* classifier, and store whatever comes back. The
 * spread in the demo is therefore the classifier's actual behaviour, and the
 * evidence bullets are the phrases it actually matched.
 *
 * Everything is invented. The names are made up, the EINs are in the IRS's
 * reserved 00-0000000 shape, the account numbers are masked, and no PDF here
 * came from a real return. A demo that showed a real taxpayer's W-2 would be a
 * far worse bug than an empty preview.
 */

import { classifyText, extractIssuer } from '../functions/src/ingest/classify.ts';
import {
  CLASSIFY_ACCEPT_THRESHOLD,
  CLASSIFY_REVIEW_THRESHOLD,
  docType,
  type Classification,
  type DocumentState,
} from '../packages/shared/src/index.ts';
import { buildPdf, type Line } from './pdf.ts';

/**
 * How the document reached us. This is the only knob: quality of capture drives
 * how much of the form survives into the extracted text, which drives the score.
 * Nothing here names a target confidence.
 */
export type Capture =
  /** Straight from the payroll provider or broker. Perfect text, honest filename. */
  | 'efile'
  /** Clean, but the taxpayer downloaded it and the browser named it. */
  | 'portal'
  /** Flatbed scan behind the firm's cover sheet, so the form starts on page 2. */
  | 'scan'
  /** Faxed. Legible, but half the box labels didn't survive the transit. */
  | 'fax'
  /** Phone photo, OCR'd. The title garbled, so there is no form-title match. */
  | 'photo'
  /** Phone photo in bad light. Almost nothing survived. */
  | 'photo-dark'
  /** A consolidated brokerage package that is genuinely three forms at once. */
  | 'consolidated';

export interface DocumentContext {
  docTypeId: string;
  capture: Capture;
  /** Taxpayer name as it prints on the form. */
  clientName: string;
  /** Employer / payer / lender, when the checklist expects one. */
  issuer?: string;
  taxYear: number;
  /** Makes amounts and account numbers stable across re-seeds. */
  seed: string;
}

export interface BuiltDocument {
  pdf: Buffer;
  /** Page-delimited text, exactly what the extractor hands the classifier. */
  text: string;
  /** The taxpayer's own filename, before the canonical rename. */
  originalName: string;
  contentType: 'application/pdf';
  pageCount: number;
  /** Straight from `classifyText` — never hand-written. */
  classification: Classification;
  /** What `decide()` in the ingest pipeline would do with that classification. */
  state: Extract<DocumentState, 'classified' | 'needs_review'>;
}

// ── Deterministic filler ────────────────────────────────────────────────────
// A seed that produces different amounts on every run makes screenshots churn
// and makes "did my change do that?" unanswerable.

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A stable pseudo-random integer in [min, max] for this document + field. */
function pick(ctx: DocumentContext, field: string, min: number, max: number): number {
  return min + (hash(`${ctx.seed}:${field}`) % (max - min + 1));
}

/** A dollar amount, formatted the way a form prints it. */
function money(ctx: DocumentContext, field: string, min: number, max: number): string {
  const cents = pick(ctx, field, min * 100, max * 100);
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** An EIN in the 00-xxxxxxx block the IRS does not issue. */
function ein(ctx: DocumentContext, field = 'ein'): string {
  return `00-${String(pick(ctx, field, 0, 9_999_999)).padStart(7, '0')}`;
}

/** Masked, the way every real statement prints it. */
function masked(ctx: DocumentContext, field = 'acct'): string {
  return `XXXX-XXXX-${String(pick(ctx, field, 0, 9999)).padStart(4, '0')}`;
}

const ADDRESS = (ctx: DocumentContext) =>
  `${pick(ctx, 'street', 100, 9899)} ${['Ridgemont', 'Barton Springs', 'Shoal Creek', 'Guadalupe', 'Cypress'][pick(ctx, 'st', 0, 4)]} ${['Dr', 'Rd', 'Ln', 'Blvd'][pick(ctx, 'sfx', 0, 3)]}, Austin, TX 787${String(pick(ctx, 'zip', 0, 99)).padStart(2, '0')}`;

// ── OCR damage ──────────────────────────────────────────────────────────────

/**
 * The substitutions a real OCR engine makes on a hand-held photo: `rn` for `m`,
 * `cl` for `d`, `l` for `i`. Applied only to headline text, because that is what
 * actually happens — a title set in large type across a curved, shadowed page is
 * the first thing to go, while the small printed box labels below it come
 * through fine. That asymmetry is the entire reason a photo scores lower: the
 * classifier is left with supporting detail and no form title, and its ceiling
 * for that is deliberately below auto-accept.
 */
function ocrGarble(s: string): string {
  return s
    .replace(/m/g, 'rn')
    .replace(/d/g, 'cl')
    .replace(/g/g, 'q')
    .replace(/i/g, 'l')
    .replace(/B/g, '8')
    .replace(/D/g, 'O')
    // The form number sits in the same washed-out headline band as the title,
    // and digits are where OCR is least reliable of all.
    .replace(/0/g, 'O')
    .replace(/1/g, 'l')
    .replace(/9/g, 'g');
}

// ── Form bodies ─────────────────────────────────────────────────────────────

interface FormSpec {
  /** The literal IRS (or bookkeeping) title. This is the classifier's strong hit. */
  title: string;
  /** The line under it: form number, OMB, period. */
  sub?: (ctx: DocumentContext) => string;
  /** The label a real form prints above the issuer's name. */
  issuerLabel?: string;
  /** Numbered boxes, most identifying first — a degraded capture keeps only the head. */
  boxes: (ctx: DocumentContext) => [string, string][];
  /** Extra pages after the form face, e.g. a broker's transaction list. */
  extra?: (ctx: DocumentContext) => Line[][];
  /** Printed instead of the taxpayer block when the document is not a payee form. */
  recipientLabel?: string;
}

const FORMS: Record<string, FormSpec> = {
  w2: {
    title: 'Wage and Tax Statement',
    sub: (c) => `Form W-2   ${c.taxYear}   OMB No. 1545-0008   Copy B — To Be Filed With Employee's FEDERAL Tax Return`,
    issuerLabel: "c Employer's name, address, and ZIP code",
    boxes: (c) => [
      ['1 Wages, tips, other compensation', money(c, 'w1', 42_000, 210_000)],
      ['2 Federal income tax withheld', money(c, 'w2', 4_000, 44_000)],
      ['3 Social security wages', money(c, 'w3', 42_000, 168_600)],
      ['5 Medicare wages and tips', money(c, 'w5', 42_000, 210_000)],
      ['12a Code D — elective deferrals to a 401(k)', money(c, 'w12', 0, 23_000)],
      ['16 State wages, tips, etc.  TX', money(c, 'w16', 42_000, 210_000)],
    ],
  },
  '1099-int': {
    title: 'Interest Income',
    sub: (c) => `Form 1099-INT   ${c.taxYear}   OMB No. 1545-0112   Copy B for Recipient`,
    issuerLabel: "PAYER'S name, street address, city, state, ZIP code, telephone no.",
    boxes: (c) => [
      ['1 Interest income', money(c, 'i1', 40, 9_400)],
      ['2 Early withdrawal penalty', money(c, 'i2', 0, 220)],
      ['3 Interest on U.S. Savings Bonds and Treas. obligations', money(c, 'i3', 0, 1_800)],
      ['4 Federal income tax withheld', '0.00'],
      ['8 Tax-exempt interest', money(c, 'i8', 0, 900)],
    ],
  },
  '1099-div': {
    title: 'Dividends and Distributions',
    sub: (c) => `Form 1099-DIV   ${c.taxYear}   OMB No. 1545-0110   Copy B for Recipient`,
    issuerLabel: "PAYER'S name, street address, city, state, ZIP code, telephone no.",
    boxes: (c) => [
      ['1a Total ordinary dividends', money(c, 'd1a', 100, 18_000)],
      ['1b Qualified dividends', money(c, 'd1b', 80, 14_000)],
      ['2a Total capital gain distributions', money(c, 'd2a', 0, 6_400)],
      ['5 Section 199A dividends', money(c, 'd5', 0, 900)],
      ['7 Foreign tax paid', money(c, 'd7', 0, 240)],
    ],
  },
  '1099-b': {
    title: 'Proceeds From Broker and Barter Exchange Transactions',
    sub: (c) => `Form 1099-B   ${c.taxYear}   OMB No. 1545-0715   Copy B for Recipient`,
    issuerLabel: "PAYER'S name, street address, city, state, ZIP code, telephone no.",
    boxes: (c) => [
      ['Short-term transactions for which basis is reported to the IRS', ''],
      ['1d Proceeds', money(c, 'b1d', 4_000, 320_000)],
      ['1e Cost or other basis', money(c, 'b1e', 3_000, 300_000)],
      ['1g Wash sale loss disallowed', money(c, 'b1g', 0, 2_400)],
      ['4 Federal income tax withheld', '0.00'],
    ],
    extra: (c) => {
      // A real consolidated 1099-B is mostly transaction detail. Two extra pages
      // is enough for the preview's page count to read true without bloating the
      // repo — this is a demo file, not an archive.
      const pages: Line[][] = [];
      for (let p = 0; p < 2; p++) {
        const rows: Line[] = [
          { text: `${c.issuer ?? 'Broker'} — ${c.taxYear} Realized Gain / Loss Detail`, size: 11, bold: true },
          { text: `Account ${masked(c)}    Page ${p + 2}`, size: 8, gap: 2 },
          { text: 'Description            Acquired    Sold        Proceeds     Cost basis   Gain/(loss)', size: 8, mono: true, gap: 10 },
        ];
        for (let i = 0; i < 24; i++) {
          const proceeds = pick(c, `tx${p}${i}p`, 40_000, 1_800_000) / 100;
          const basis = pick(c, `tx${p}${i}b`, 30_000, 1_900_000) / 100;
          const sym = ['VTI', 'SCHD', 'AAPL', 'MSFT', 'BND', 'VXUS', 'JNJ', 'KO'][pick(c, `tx${p}${i}s`, 0, 7)];
          rows.push({
            text:
              `${sym.padEnd(22)} 0${pick(c, `tx${p}${i}m`, 1, 9)}/${String(pick(c, `tx${p}${i}d`, 10, 28))}/${c.taxYear - 1}  ` +
              `${String(pick(c, `tx${p}${i}n`, 1, 9))}/${String(pick(c, `tx${p}${i}e`, 10, 28))}/${c.taxYear}  ` +
              `${proceeds.toFixed(2).padStart(11)}  ${basis.toFixed(2).padStart(11)}  ${(proceeds - basis).toFixed(2).padStart(11)}`,
            size: 7.5,
            mono: true,
            gap: 0,
          });
        }
        pages.push(rows);
      }
      return pages;
    },
  },
  '1099-nec': {
    title: 'Nonemployee Compensation',
    sub: (c) => `Form 1099-NEC   ${c.taxYear}   OMB No. 1545-0116   Copy B for Recipient`,
    issuerLabel: "PAYER'S name, street address, city, state, ZIP code, telephone no.",
    boxes: (c) => [
      ['1 Nonemployee compensation', money(c, 'n1', 1_200, 88_000)],
      ['4 Federal income tax withheld', '0.00'],
      ["PAYER'S TIN", ein(c)],
      ["RECIPIENT'S TIN", 'XXX-XX-' + String(pick(c, 'ssn', 0, 9999)).padStart(4, '0')],
    ],
  },
  '1099-k': {
    title: 'Payment Card and Third Party Network Transactions',
    sub: (c) => `Form 1099-K   ${c.taxYear}   OMB No. 1545-2205   Copy B for Payee`,
    issuerLabel: "FILER'S name, street address, city, state, ZIP code, telephone no.",
    boxes: (c) => [
      ['1a Gross amount of payment card/third party network transactions', money(c, 'k1', 3_000, 140_000)],
      ['2 Merchant category code (MCC)', String(pick(c, 'mcc', 5000, 8999))],
      ['3 Number of payment transactions', String(pick(c, 'kcount', 40, 1_900))],
      ['4 Federal income tax withheld', '0.00'],
    ],
  },
  '1099-r': {
    title: 'Distributions From Pensions, Annuities, Retirement or Profit-Sharing Plans, IRAs, Insurance Contracts, etc.',
    sub: (c) => `Form 1099-R   ${c.taxYear}   OMB No. 1545-0119   Copy B — Report this income on your federal tax return.`,
    issuerLabel: "PAYER'S name, street address, city, state, ZIP code, telephone no.",
    boxes: (c) => [
      ['1 Gross distribution', money(c, 'r1', 6_000, 92_000)],
      ['2a Taxable amount', money(c, 'r2', 6_000, 92_000)],
      ['2b Taxable amount not determined', 'X'],
      ['7 Distribution code(s)', ['7', '1', '4', 'G'][pick(c, 'rcode', 0, 3)]],
      ['Total distribution', ''],
    ],
  },
  'ssa-1099': {
    title: 'Social Security Benefit Statement',
    sub: (c) => `Form SSA-1099   ${c.taxYear}   Social Security Administration   DO NOT RETURN THIS FORM TO SSA OR IRS`,
    recipientLabel: 'Name shown on this statement',
    boxes: (c) => [
      ['Box 3. Benefits paid in ' + c.taxYear, money(c, 's3', 12_000, 48_000)],
      ['Box 4. Benefits repaid to SSA in ' + c.taxYear, '0.00'],
      ['Box 5. Net benefits for ' + c.taxYear, money(c, 's5', 12_000, 48_000)],
      ['Box 6. Voluntary federal income tax withheld', money(c, 's6', 0, 7_200)],
    ],
  },
  '1098': {
    title: 'Mortgage Interest Statement',
    sub: (c) => `Form 1098   ${c.taxYear}   OMB No. 1545-1380   Copy B for Payer/Borrower`,
    issuerLabel: "RECIPIENT'S/LENDER'S name, street address, city, state, ZIP code",
    boxes: (c) => [
      ['1 Mortgage interest received from payer(s)/borrower(s)', money(c, 'm1', 2_400, 34_000)],
      ['2 Outstanding mortgage principal', money(c, 'm2', 90_000, 890_000)],
      ['3 Mortgage origination date', `0${pick(c, 'm3', 1, 9)}/${pick(c, 'm3d', 10, 28)}/${c.taxYear - pick(c, 'm3y', 1, 14)}`],
      ['5 Mortgage insurance premiums', money(c, 'm5', 0, 2_100)],
      ['6 Points paid on purchase of principal residence', money(c, 'm6', 0, 4_400)],
    ],
  },
  'k1-1065': {
    title: "Partner's Share of Income, Deductions, Credits, etc.",
    sub: (c) => `Schedule K-1 (Form 1065)   ${c.taxYear}   OMB No. 1545-0123   Final K-1  [ ]   Amended K-1  [ ]`,
    issuerLabel: "Part I  Information About the Partnership — Partnership's name, address, city, state, ZIP code",
    boxes: (c) => [
      ["Partnership's employer identification number", ein(c)],
      ['1 Ordinary business income (loss)', money(c, 'p1', -18_000, 190_000)],
      ['2 Net rental real estate income (loss)', money(c, 'p2', -9_000, 62_000)],
      ['4 Guaranteed payments for services', money(c, 'p4', 0, 120_000)],
      ['19 Distributions', money(c, 'p19', 0, 140_000)],
    ],
  },
  'k1-1120s': {
    title: "Shareholder's Share of Income, Deductions, Credits, etc.",
    sub: (c) => `Schedule K-1 (Form 1120-S)   ${c.taxYear}   OMB No. 1545-0123`,
    issuerLabel: "Part I  Information About the Corporation — Corporation's name, address, city, state, ZIP code",
    boxes: (c) => [
      ["Corporation's employer identification number", ein(c)],
      ['1 Ordinary business income (loss)', money(c, 'sc1', -12_000, 240_000)],
      ['16 Items affecting shareholder basis — Code D, Distributions', money(c, 'sc16', 0, 180_000)],
    ],
  },
  'profit-loss': {
    title: 'Profit and Loss',
    sub: (c) => `${c.issuer ?? c.clientName}   For the year January 1 – December 31, ${c.taxYear}   Accrual basis`,
    boxes: (c) => [
      ['Total revenue', money(c, 'pl1', 180_000, 4_200_000)],
      ['Cost of goods sold', money(c, 'pl2', 60_000, 2_100_000)],
      ['Gross profit', money(c, 'pl3', 90_000, 2_100_000)],
      ['Payroll and related', money(c, 'pl4', 40_000, 900_000)],
      ['Rent and occupancy', money(c, 'pl5', 12_000, 220_000)],
      ['Net operating income', money(c, 'pl6', -40_000, 700_000)],
    ],
  },
  'balance-sheet': {
    title: 'Balance Sheet',
    sub: (c) => `${c.issuer ?? c.clientName}   As of December 31, ${c.taxYear}`,
    boxes: (c) => [
      ['Cash and cash equivalents', money(c, 'bs1', 8_000, 900_000)],
      ['Accounts receivable', money(c, 'bs2', 0, 640_000)],
      ['Fixed assets, net of depreciation', money(c, 'bs3', 0, 1_800_000)],
      ['Accounts payable', money(c, 'bs4', 0, 420_000)],
      ["Total liabilities and equity", money(c, 'bs5', 20_000, 3_100_000)],
      ["Owner's equity", money(c, 'bs6', 0, 2_200_000)],
    ],
  },
  'payroll-summary': {
    title: 'Payroll Summary',
    sub: (c) => `${c.issuer ?? c.clientName}   ${c.taxYear} annual totals   Prepared from Form 941 filings`,
    boxes: (c) => [
      ['Total payroll', money(c, 'ps1', 60_000, 1_400_000)],
      ['Employer taxes', money(c, 'ps2', 5_000, 130_000)],
      ['Employees paid during the year', String(pick(c, 'ps3', 2, 74))],
      ['Form 941 quarters filed', '4 of 4'],
    ],
  },
  'rental-summary': {
    title: 'Rental Income and Expense Summary',
    sub: (c) => `Owner statement — ${c.taxYear}   Prepared by ${c.issuer ?? 'Barton Ridge Property Management'}`,
    boxes: (c) => [
      ['Gross rent collected', money(c, 'rs1', 12_000, 96_000)],
      ['Management fee', money(c, 'rs2', 900, 9_600)],
      ['Repairs and maintenance', money(c, 'rs3', 0, 18_000)],
      ['Tenant turnover and lease-up costs', money(c, 'rs4', 0, 4_800)],
      ['Net distributed to owner', money(c, 'rs5', 4_000, 84_000)],
    ],
  },
  'property-tax': {
    title: 'Property Tax Statement',
    sub: (c) => `Travis County Tax Office   ${c.taxYear} tax year installment   Statement date December 1, ${c.taxYear}`,
    boxes: (c) => [
      ['Parcel number', `0${pick(c, 'pt0', 100000, 999999)}-000${pick(c, 'pt1', 0, 9)}`],
      ['Assessed value', money(c, 'pt2', 180_000, 1_400_000)],
      ['Total tax due', money(c, 'pt3', 3_400, 26_000)],
      ['Amount paid', money(c, 'pt4', 3_400, 26_000)],
    ],
  },
  'estimated-payments': {
    title: 'Estimated Tax Payments',
    sub: (c) => `Form 1040-ES   ${c.taxYear} federal estimated tax — payment confirmations`,
    boxes: (c) => [
      ['Q1 — EFTPS confirmation ' + pick(c, 'e1', 100000, 999999), money(c, 'ev1', 500, 24_000)],
      ['Q2 — EFTPS confirmation ' + pick(c, 'e2', 100000, 999999), money(c, 'ev2', 500, 24_000)],
      ['Q3 — IRS Direct Pay confirmation ' + pick(c, 'e3', 100000, 999999), money(c, 'ev3', 500, 24_000)],
      ['Q4 — IRS Direct Pay confirmation ' + pick(c, 'e4', 100000, 999999), money(c, 'ev4', 500, 24_000)],
    ],
  },
  'bank-statements': {
    title: 'Account Statement',
    sub: (c) => `${c.issuer ?? 'Frost Bank'}   Business checking ${masked(c)}   Statement period December 1 – 31, ${c.taxYear}`,
    boxes: (c) => [
      ['Beginning balance', money(c, 'bk1', 1_000, 240_000)],
      ['Deposits and credits', money(c, 'bk2', 4_000, 480_000)],
      ['Withdrawals and debits', money(c, 'bk3', 4_000, 470_000)],
      ['Ending balance', money(c, 'bk4', 1_000, 260_000)],
    ],
  },
  'engagement-letter': {
    title: 'Engagement Letter',
    sub: (c) => `Whitfield & Rowe CPAs   ${c.taxYear} individual income tax preparation`,
    boxes: (c) => [
      ['Scope of services', `We will prepare your ${c.taxYear} federal income tax return`],
      ['Fee arrangement', `$${money(c, 'el', 450, 4_800)} due on delivery`],
      ['Signed by', c.clientName],
      ['Date signed', `0${pick(c, 'eld', 1, 3)}/${pick(c, 'eldd', 10, 28)}/${c.taxYear + 1}`],
    ],
  },
  'closing-statement': {
    title: 'Closing Disclosure',
    sub: (c) => `Settlement statement   Closing date ${pick(c, 'cd', 1, 12)}/${pick(c, 'cdd', 10, 28)}/${c.taxYear}   Issued by Lone Star Title Co.`,
    boxes: (c) => [
      ['Sale price of property', money(c, 'cs1', 220_000, 1_450_000)],
      ['Loan amount', money(c, 'cs2', 0, 1_100_000)],
      ['Cash to close', money(c, 'cs3', 4_000, 320_000)],
      ["Seller's transaction — total due to seller", money(c, 'cs4', 0, 1_400_000)],
    ],
  },
  'voided-check': {
    title: 'Direct Deposit Authorization',
    sub: () => 'Voided check attached for refund direct deposit',
    boxes: (c) => [
      ['Pay to the order of', 'VOID'],
      ['Routing number', `1140${String(pick(c, 'rt', 10000, 99999))}`],
      ['Account number', masked(c, 'chk')],
      ['Account holder', c.clientName],
    ],
  },
  'photo-id': {
    title: "Driver's License",
    sub: () => 'Texas Department of Public Safety — Identification Card',
    boxes: (c) => [
      ['DLN', String(pick(c, 'dln', 10_000_000, 99_999_999))],
      ['Class C', 'Non-commercial'],
      ['Restrictions', 'NONE'],
      ['Endorsements', 'NONE'],
      ['Name', c.clientName],
    ],
  },
  'asset-schedule': {
    title: 'Depreciation Schedule',
    sub: (c) => `${c.issuer ?? c.clientName}   ${c.taxYear} fixed asset schedule`,
    boxes: (c) => [
      ['Placed in service during the year', String(pick(c, 'as1', 1, 9)) + ' assets'],
      ['Section 179 expense elected', money(c, 'as2', 0, 62_000)],
      ['Current year depreciation', money(c, 'as3', 900, 88_000)],
      ['Accumulated depreciation', money(c, 'as4', 2_000, 340_000)],
    ],
  },
  'mileage-log': {
    title: 'Business Mileage Log',
    sub: (c) => `${c.clientName}   ${c.taxYear}   Contemporaneous log exported from MileIQ`,
    boxes: (c) => [
      ['Total miles driven', String(pick(c, 'ml1', 8_000, 34_000))],
      ['Business miles', String(pick(c, 'ml2', 2_000, 26_000))],
      ['Odometer January 1', String(pick(c, 'ml3', 10_000, 140_000))],
      ['Odometer December 31', String(pick(c, 'ml4', 20_000, 180_000))],
    ],
  },
  charitable: {
    title: 'Charitable Contribution Receipt',
    sub: (c) => `${c.issuer ?? 'Central Texas Food Bank'}   Acknowledgement of your gift   ${c.taxYear}`,
    boxes: (c) => [
      ['Amount received', money(c, 'ch1', 50, 24_000)],
      ['Tax-deductible', 'Yes — we are a 501(c)(3) organization'],
      ['Goods or services', 'No goods or services were provided in exchange for this gift'],
      ['Donor', c.clientName],
    ],
  },
  'home-office': {
    title: 'Home Office Worksheet',
    sub: (c) => `Business use of your home   ${c.taxYear}   Supports Form 8829`,
    boxes: (c) => [
      ['Square footage of home', String(pick(c, 'ho1', 900, 4_200))],
      ['Square footage used regularly and exclusively for business', String(pick(c, 'ho2', 80, 480))],
      ['Total utilities for the year', money(c, 'ho3', 1_200, 7_400)],
      ['Rent or mortgage interest for the year', money(c, 'ho4', 6_000, 42_000)],
    ],
  },
  'medical-expenses': {
    title: 'Year-End Claims Summary',
    sub: (c) => `${c.issuer ?? 'Blue Cross Blue Shield of Texas'}   Explanation of benefits   ${c.taxYear}`,
    boxes: (c) => [
      ['Total billed', money(c, 'me1', 400, 84_000)],
      ['Deductible applied', money(c, 'me2', 0, 8_000)],
      ['Patient responsibility', money(c, 'me3', 0, 21_000)],
      ['Amount you owe', money(c, 'me4', 0, 21_000)],
    ],
  },
  '1099-misc': {
    title: 'Miscellaneous Information',
    sub: (c) => `Form 1099-MISC   ${c.taxYear}   OMB No. 1545-0115   Copy B for Recipient`,
    issuerLabel: "PAYER'S name, street address, city, state, ZIP code, telephone no.",
    boxes: (c) => [
      ['1 Rents', money(c, 'mi1', 0, 48_000)],
      ['3 Other income', money(c, 'mi3', 0, 22_000)],
      ['6 Medical and health care payments', money(c, 'mi6', 0, 9_000)],
    ],
  },
};

// ── Layout ──────────────────────────────────────────────────────────────────

const COVER: Line[] = [
  { text: 'WHITFIELD & ROWE CPAs', size: 13, bold: true },
  { text: 'Front desk document intake', size: 9, gap: 2 },
  { text: 'Received and scanned. Original returned to the client.', size: 9, gap: 18 },
  { text: 'Scanned on a Fujitsu ScanSnap iX1600 at 300dpi, duplex.', size: 8, grey: 0.35, gap: 30 },
];

function formPages(ctx: DocumentContext, spec: FormSpec, opts: { boxes: number; garble: boolean; faint: boolean }): Line[][] {
  const grey = opts.faint ? 0.42 : 0;
  const title = opts.garble ? ocrGarble(spec.title) : spec.title;
  const sub = spec.sub?.(ctx);

  const page: Line[] = [
    { text: title, size: 15, bold: true, grey },
    ...(sub ? [{ text: opts.garble ? ocrGarble(sub) : sub, size: 8.5, grey: Math.max(grey, 0.25), gap: 3 }] : []),
  ];

  if (spec.issuerLabel) {
    page.push(
      { text: spec.issuerLabel, size: 7.5, grey: 0.4, gap: 16 },
      { text: ctx.issuer ?? 'Payer name withheld', size: 11, bold: true, gap: 1, grey },
      { text: ADDRESS(ctx), size: 8.5, grey: 0.3, gap: 1 },
      { text: `TIN ${ein(ctx)}`, size: 8.5, grey: 0.3, gap: 1 },
    );
  } else if (spec.recipientLabel) {
    page.push({ text: spec.recipientLabel, size: 7.5, grey: 0.4, gap: 16 });
  }

  page.push(
    { text: "RECIPIENT'S name and address", size: 7.5, grey: 0.4, gap: 14 },
    { text: ctx.clientName, size: 11, bold: true, gap: 1, grey },
    { text: ADDRESS(ctx), size: 8.5, grey: 0.3, gap: 1 },
  );

  const boxes = spec.boxes(ctx).slice(0, Math.max(1, opts.boxes));
  let first = true;
  for (const [label, value] of boxes) {
    page.push({ text: label, size: 8, grey: Math.max(grey, 0.35), gap: first ? 20 : 8 });
    if (value) page.push({ text: value, size: 11, mono: true, gap: 1, grey });
    first = false;
  }

  return [page, ...(spec.extra?.(ctx) ?? [])];
}

/** How the extractor would read the PDF back: one string per page, form-feed joined. */
function extractedText(pages: Line[][]): string {
  return pages.map((lines) => lines.map((l) => l.text).join('\n')).join('\f');
}

const SLUG = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 28);

function originalNameFor(ctx: DocumentContext): string {
  const def = docType(ctx.docTypeId);
  switch (ctx.capture) {
    case 'efile':
      return `${SLUG(def.slug)}_${SLUG(ctx.issuer ?? ctx.clientName)}_${ctx.taxYear}.pdf`;
    case 'consolidated':
      return `${SLUG(ctx.issuer ?? 'Broker')}_Consolidated_1099_${ctx.taxYear}.pdf`;
    case 'portal':
      return `document (${pick(ctx, 'dl', 1, 9)}).pdf`;
    case 'scan':
      return `scan_${String(pick(ctx, 'sc', 1, 9999)).padStart(4, '0')}.pdf`;
    case 'fax':
      return `FAX_${String(pick(ctx, 'fx', 1, 999)).padStart(4, '0')}.pdf`;
    default:
      return `IMG_${pick(ctx, 'img', 1000, 9999)}.pdf`;
  }
}

/**
 * A consolidated brokerage package: one cover, then 1099-DIV, 1099-INT and
 * 1099-B sections in the same file. This is not a contrived edge case — it is
 * what Schwab and Fidelity actually send, and it is the honest reason a
 * confidence lands mid-band with real alternates rather than at the top: three
 * form titles are genuinely present and only one can win.
 */
function consolidatedPages(ctx: DocumentContext): Line[][] {
  const broker = ctx.issuer ?? 'Charles Schwab';
  const cover: Line[] = [
    { text: `${broker}`, size: 14, bold: true },
    { text: `${ctx.taxYear} Tax Reporting Statement`, size: 11, gap: 4 },
    { text: `Prepared for ${ctx.clientName}    Account ${masked(ctx)}`, size: 9, gap: 10 },
    { text: 'This statement contains the forms listed below. File each with your return.', size: 8.5, grey: 0.3, gap: 14 },
    { text: 'Summary of reportable income', size: 9, bold: true, gap: 16 },
    { text: `Ordinary dividends                      ${money(ctx, 'cd1', 100, 22_000)}`, size: 9, mono: true, gap: 6 },
    { text: `Interest income                         ${money(ctx, 'cd2', 40, 8_000)}`, size: 9, mono: true, gap: 1 },
    { text: `Gross proceeds from sales               ${money(ctx, 'cd3', 4_000, 460_000)}`, size: 9, mono: true, gap: 1 },
  ];
  const section = (id: string) =>
    formPages({ ...ctx, docTypeId: id }, FORMS[id], { boxes: 4, garble: false, faint: false })[0];
  return [cover, section('1099-div'), section('1099-int'), section('1099-b')];
}

const CAPTURE_LAYOUT: Record<Capture, { cover: boolean; boxes: number; garble: boolean; faint: boolean }> = {
  efile: { cover: false, boxes: 6, garble: false, faint: false },
  portal: { cover: false, boxes: 3, garble: false, faint: false },
  scan: { cover: true, boxes: 6, garble: false, faint: false },
  fax: { cover: true, boxes: 2, garble: false, faint: true },
  photo: { cover: false, boxes: 4, garble: true, faint: false },
  'photo-dark': { cover: false, boxes: 1, garble: true, faint: true },
  consolidated: { cover: true, boxes: 4, garble: false, faint: false },
};

/** The pipeline's own `decide()` rule, so seeded state matches ingested state. */
function stateFor(cls: Classification): BuiltDocument['state'] {
  if (cls.docTypeId !== 'other' && cls.confidence >= CLASSIFY_ACCEPT_THRESHOLD) return 'classified';
  return 'needs_review';
}

/**
 * Applies the same demotion `decide()` does: below the review threshold we are
 * too unsure to name the document, so it is filed as "Other" with the best guess
 * kept visible as an alternate. Seeding the pre-demotion classification would
 * show the preparer a confident label the product would never have given them.
 */
function demote(cls: Classification): Classification {
  if (cls.docTypeId === 'other' || cls.confidence >= CLASSIFY_REVIEW_THRESHOLD) return cls;
  return {
    ...cls,
    docTypeId: 'other',
    issuer: undefined,
    alternates: [{ docTypeId: cls.docTypeId, confidence: cls.confidence }, ...cls.alternates].slice(0, 3),
  };
}

/**
 * Builds one document: real PDF bytes, and the classification the real
 * classifier gives those bytes.
 *
 * Throws when a capture that is supposed to read cleanly does not classify as
 * the type it depicts. That check is the whole reason this is trustworthy: if a
 * template ever drifts away from the taxonomy the seed fails loudly instead of
 * quietly filling the demo with mislabelled documents.
 */
export function buildDocument(ctx: DocumentContext): BuiltDocument {
  const spec = FORMS[ctx.docTypeId];
  if (!spec) throw new Error(`seed/documents.ts has no template for “${ctx.docTypeId}”`);

  const layout = CAPTURE_LAYOUT[ctx.capture];
  // No two extractions of the same form yield the same text. A line lost at the
  // fold, a box the scanner clipped: real documents arrive with a little less
  // than the template, and how much less is a genuine reason two W-2s score
  // differently.
  const boxes = layout.boxes - pick(ctx, 'lost-lines', 0, 2);
  const body =
    ctx.capture === 'consolidated' ? consolidatedPages(ctx) : formPages(ctx, spec, { ...layout, boxes });
  const pages = layout.cover && ctx.capture !== 'consolidated' ? [COVER, ...body] : body;

  const text = extractedText(pages);
  const originalName = originalNameFor(ctx);
  const raw = classifyText(text, originalName);
  const issuer = raw.docTypeId === 'other' ? undefined : extractIssuer(text, raw.docTypeId);
  const classification = demote({ ...raw, ...(issuer ? { issuer } : {}) });

  const cleanCapture =
    ctx.capture === 'efile' || ctx.capture === 'portal' || ctx.capture === 'scan' || ctx.capture === 'fax';
  if (ctx.capture === 'consolidated') {
    // The package genuinely contains three form titles; which one wins is the
    // classifier's call, not ours. It must at least stay inside the family.
    if (!['1099-div', '1099-int', '1099-b'].includes(classification.docTypeId)) {
      throw new Error(
        `A consolidated 1099 package classified as “${classification.docTypeId}” — the template drifted.`,
      );
    }
  } else if (cleanCapture && classification.docTypeId !== ctx.docTypeId) {
    throw new Error(
      `${ctx.docTypeId} rendered as a ${ctx.capture} classified as “${classification.docTypeId}” ` +
        `(${classification.confidence}). The template and the taxonomy disagree.`,
    );
  } else if (!cleanCapture && classification.docTypeId !== ctx.docTypeId && classification.docTypeId !== 'other') {
    // A damaged capture may score anywhere — some forms repeat their own title in
    // box 1, so losing the headline does not always lose the match. What it must
    // never do is come back confidently *wrong*: a mislabelled document filed at
    // 0.9 is the one failure mode this classifier is calibrated against.
    throw new Error(
      `${ctx.docTypeId} as a ${ctx.capture} came back as “${classification.docTypeId}” ` +
        `at ${classification.confidence}. That is a confident misfile, not a degraded read.`,
    );
  }

  return {
    pdf: buildPdf(pages),
    text,
    originalName,
    contentType: 'application/pdf',
    pageCount: pages.length,
    classification,
    state: stateFor(classification),
  };
}

export const DOCUMENT_TEMPLATE_IDS = Object.keys(FORMS);

// ── Last year's return ──────────────────────────────────────────────────────

export interface PriorReturnContext {
  clientName: string;
  /** The year the return is *for*, i.e. one behind the season being demoed. */
  taxYear: number;
  formType: '1040' | '1065' | '1120S';
  filingStatus?: string;
  /** A Schedule LEP page is attached when the taxpayer elected a language. */
  lepCode?: string;
  lepLanguage?: string;
  seed: string;
}

const FILING_STATUS_LABEL: Record<string, string> = {
  single: 'Single',
  mfj: 'Married filing jointly',
  mfs: 'Married filing separately',
  hoh: 'Head of household',
  qw: 'Qualifying surviving spouse',
};

const RETURN_TITLE: Record<PriorReturnContext['formType'], string> = {
  '1040': 'U.S. Individual Income Tax Return',
  '1065': 'U.S. Return of Partnership Income',
  '1120S': 'U.S. Income Tax Return for an S Corporation',
};

/**
 * The prior-year return every client record already pointed at and none of them
 * had. `client.priorYear.sourceDocumentId` named a document that was never
 * seeded, so the one piece of evidence behind the checklist — "we built this
 * from your last return" — had nothing to open.
 *
 * For the clients who elected a language with the IRS, the package carries the
 * Schedule LEP page that election was made on. The seeder does not copy a
 * language into Firestore: it prints the code here and lets the real
 * `parseReturnText` find it again, so the demo's detection claim is an actual
 * detection.
 */
export function buildPriorReturn(ctx: PriorReturnContext): Omit<BuiltDocument, 'state'> {
  const c: DocumentContext = {
    docTypeId: 'prior-return',
    capture: 'efile',
    clientName: ctx.clientName,
    taxYear: ctx.taxYear,
    seed: ctx.seed,
  };

  const page1: Line[] = [
    { text: `Form 1040${ctx.formType === '1040' ? '' : ` / ${ctx.formType}`}`, size: 10, bold: true },
    { text: RETURN_TITLE[ctx.formType], size: 15, bold: true, gap: 2 },
    { text: `Department of the Treasury — Internal Revenue Service    ${ctx.taxYear}    OMB No. 1545-0074`, size: 8, grey: 0.35, gap: 3 },
    { text: 'Filing Status', size: 8.5, bold: true, gap: 18 },
    { text: FILING_STATUS_LABEL[ctx.filingStatus ?? 'single'] ?? 'Single', size: 10, gap: 2 },
    { text: 'Your first name and middle initial / Last name', size: 7.5, grey: 0.4, gap: 14 },
    { text: ctx.clientName, size: 11, bold: true, gap: 2 },
    { text: ADDRESS(c), size: 8.5, grey: 0.3, gap: 1 },
    { text: 'Income', size: 8.5, bold: true, gap: 20 },
    { text: `1z  Wages, salaries, tips              ${money(c, 'l1z', 0, 240_000)}`, size: 9, mono: true, gap: 8 },
    { text: `2b  Taxable interest                   ${money(c, 'l2b', 0, 9_000)}`, size: 9, mono: true, gap: 1 },
    { text: `3b  Ordinary dividends                 ${money(c, 'l3b', 0, 18_000)}`, size: 9, mono: true, gap: 1 },
    { text: `11  Adjusted gross income              ${money(c, 'l11', 20_000, 380_000)}`, size: 9, mono: true, gap: 1 },
    { text: `12  Standard deduction                 ${money(c, 'l12', 14_600, 29_200)}`, size: 9, mono: true, gap: 1 },
    { text: `15  Taxable income                     ${money(c, 'l15', 0, 350_000)}`, size: 9, mono: true, gap: 1 },
  ];

  const page2: Line[] = [
    { text: `Schedule 1 (Form 1040) ${ctx.taxYear}`, size: 12, bold: true },
    { text: 'Additional Income and Adjustments to Income', size: 10, gap: 2 },
    { text: `3   Business income (loss) — Schedule C     ${money(c, 's1-3', 0, 140_000)}`, size: 9, mono: true, gap: 16 },
    { text: `5   Rental real estate, royalties, partnerships, S corporations, trusts — Schedule E`, size: 9, mono: true, gap: 4 },
    { text: `                                            ${money(c, 's1-5', 0, 120_000)}`, size: 9, mono: true, gap: 1 },
    { text: `10  Total additional income                 ${money(c, 's1-10', 0, 220_000)}`, size: 9, mono: true, gap: 4 },
  ];

  const pages: Line[][] = [page1, page2];

  if (ctx.lepCode && ctx.lepLanguage) {
    pages.push([
      { text: 'Schedule LEP (Form 1040)', size: 12, bold: true },
      { text: 'Request for Change in Language Preference', size: 14, bold: true, gap: 2 },
      { text: `Department of the Treasury — Internal Revenue Service    ${ctx.taxYear}    OMB No. 1545-0074`, size: 8, grey: 0.35, gap: 3 },
      { text: 'Name shown on return', size: 7.5, grey: 0.4, gap: 20 },
      { text: ctx.clientName, size: 11, bold: true, gap: 2 },
      {
        text: 'Check the box next to the language you would prefer to receive written communications in.',
        size: 8.5,
        grey: 0.3,
        gap: 20,
      },
      // Tax software prints only the elected row. Both the ticked box and the
      // lone code on the page are enough for the parser on their own, so a
      // reader that loses the tick still reads the election correctly.
      { text: `X ${ctx.lepCode} ${ctx.lepLanguage}`, size: 11, mono: true, gap: 16 },
      {
        text: 'Attach to Form 1040, 1040-SR, 1040-NR, or 1040-X.',
        size: 8,
        grey: 0.4,
        gap: 24,
      },
    ]);
  }

  const text = extractedText(pages);
  const originalName = `${ctx.taxYear}_Form_1040_${SLUG(ctx.clientName)}.pdf`;
  const raw = classifyText(text, originalName);
  if (raw.docTypeId !== 'prior-return') {
    throw new Error(`The seeded ${ctx.taxYear} return classified as “${raw.docTypeId}”, not prior-return.`);
  }

  return {
    pdf: buildPdf(pages),
    text,
    originalName,
    contentType: 'application/pdf',
    pageCount: pages.length,
    classification: raw,
  };
}
