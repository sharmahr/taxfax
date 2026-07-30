/**
 * Classifier regression suite.
 *
 *   node --experimental-strip-types --test functions/src/ingest/classify.test.ts
 *
 * The classifier renames and files real people's tax documents, so a silent
 * accuracy drift is the scariest bug in the product — invisible until a preparer
 * finds a 1099-B filed as a 1099-DIV. These fixtures lock in calibration: every
 * clear form must auto-accept with the right type, issuer and year, and every
 * ambiguous or adversarial document must stay below the accept bar. Framework
 * is the Node stdlib runner, matching packages/shared/src/check.ts.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyText, extractIssuer, extractTaxYear } from './classify.ts';
import {
  CLASSIFY_ACCEPT_THRESHOLD,
  CLASSIFY_REVIEW_THRESHOLD,
} from '../../../packages/shared/src/index.ts';

type Route = 'accept' | 'review' | 'below';

/** The same routing the pipeline applies to a confidence score. */
function route(confidence: number): Route {
  if (confidence >= CLASSIFY_ACCEPT_THRESHOLD) return 'accept';
  if (confidence >= CLASSIFY_REVIEW_THRESHOLD) return 'review';
  return 'below';
}

// ── The thirteen golden fixtures ─────────────────────────────────────────────

const W2 = `2024 Form W-2 Wage and Tax Statement
Copy B—To Be Filed With Employee's FEDERAL Tax Return
OMB No. 1545-0008
Employer's name, address, and ZIP code
ACME CORP
500 Industrial Way, Springfield, IL 62704
Social security wages 84,000.00
Medicare wages and tips 84,000.00
Employee's social security number`;

const INT_1099 = `2024 Form 1099-INT
Interest Income
OMB No. 1545-0112
PAYER'S name, street address, city or town, state or province, country, ZIP or foreign postal code
FIRST NATIONAL BANK
1 Banking Plaza, Columbus, OH 43004
Payer's TIN 12-3456789
Recipient's TIN
Box 1 Interest income 1,240.55
Box 2 Early withdrawal penalty`;

const NEC_1099 = `2024 Form 1099-NEC
Nonemployee Compensation
OMB No. 1545-0116
PAYER'S name, street address, city or town, state or province, country, ZIP or foreign postal code
NORTHWIND CONSULTING LLC
88 Market St, Seattle, WA 98101
Payer's TIN
Recipient's TIN
Box 1 Nonemployee compensation 42,000.00`;

const BROKERAGE_1099 = `Fidelity Investments
2024 Consolidated Form 1099
Form 1099-B Proceeds From Broker and Barter Exchange Transactions
Short-term transactions for which basis was reported to the IRS
Wash sale loss disallowed
Cost or other basis
Also included in this statement:
Form 1099-DIV Dividends and Distributions
Form 1099-INT Interest Income\fForm 1099-B detail
Proceeds 55,000.00 Cost or other basis 50,000.00`;

const K1_1065 = `2024 Schedule K-1 (Form 1065)
Partner's Share of Income, Deductions, Credits, etc.
Part I Information About the Partnership
B Partnership's name, address, city, state, and ZIP code
NORTHWIND PARTNERS LP
2 Commerce Sq, Austin, TX 78701
Part III Partner's Share of Current Year Income
Guaranteed payments 15,000.00`;

const MORTGAGE_1098 = `2024 Form 1098
Mortgage Interest Statement
OMB No. 1545-1380
RECIPIENT'S/LENDER'S name, street address, city or town, state or province, country, ZIP
WELLS FARGO HOME MORTGAGE
1 Home Campus, Des Moines, IA 50328
Box 1 Mortgage interest received from payer 12,450.00
Box 2 Outstanding mortgage principal
Points paid on purchase of principal residence
Mortgage insurance premiums`;

const MARKETPLACE_1095A = `2024 Form 1095-A
Health Insurance Marketplace Statement
OMB No. 1545-2232
Part III Coverage Information
Monthly premium amount
Second lowest cost silver plan (SLCSP) premium
Monthly advance payment of premium tax credit`;

const PRIOR_1040 = `2023 Form 1040
U.S. Individual Income Tax Return
Department of the Treasury—Internal Revenue Service
Filing Status: Married filing jointly
Standard deduction
Adjusted gross income
Schedule 1 Additional Income and Adjustments`;

const PROFIT_LOSS = `Acme Widgets LLC
Profit and Loss
January - December 2024
Total Revenue 1,250,000.00
Cost of Goods Sold 480,000.00
Gross Profit 770,000.00
Operating Expenses
Net Operating Income 210,000.00`;

const R_1099 = `2024 Form 1099-R
Distributions From Pensions, Annuities, Retirement or Profit-Sharing Plans, IRAs, Insurance Contracts, etc.
OMB No. 1545-0119
PAYER'S name, street address, city or town, state or province, country, ZIP
VANGUARD FIDUCIARY TRUST
Box 1 Gross distribution 22,000.00
Box 7 Distribution code
Total distribution`;

const SSA_1099 = `2024 SSA-1099 Social Security Benefit Statement
Form SSA-1099
Box 3 Benefits Paid in 2024
Box 5. Net Benefits for 2024
Social Security Administration`;

// Ambiguous #1: a payroll stub carries W-2-ish box labels but no form title.
const PAY_STUB = `Earnings Statement
Pay period: 12/01/2024 - 12/15/2024
Employee: Jordan Whitfield
Gross Pay 3,500.00
Federal Withholding 420.00
Social security wages 3,500.00
Medicare wages and tips 3,500.00
Net Pay 2,610.00
Year-to-date gross 84,000.00`;

// Ambiguous #2: a plain cover note with no tax content at all.
const GENERIC_NOTE = `To whom it may concern,
Please find attached the documents you requested for the upcoming meeting.
Let me know if you need anything else.
Best regards,
Jordan`;

interface Golden {
  name: string;
  filename: string;
  text: string;
  docTypeId: string;
  routing: Route;
  issuer: string | undefined;
  year: number | undefined;
}

const GOLDEN: Golden[] = [
  { name: 'W-2', filename: 'IMG_4821.HEIC', text: W2, docTypeId: 'w2', routing: 'accept', issuer: 'Acme Corp', year: 2024 },
  { name: '1099-INT', filename: '1099-int.pdf', text: INT_1099, docTypeId: '1099-int', routing: 'accept', issuer: 'First National Bank', year: 2024 },
  { name: '1099-NEC', filename: 'nec.pdf', text: NEC_1099, docTypeId: '1099-nec', routing: 'accept', issuer: 'Northwind Consulting LLC', year: 2024 },
  { name: 'Consolidated brokerage 1099-B', filename: 'Consolidated1099.pdf', text: BROKERAGE_1099, docTypeId: '1099-b', routing: 'accept', issuer: 'Fidelity Investments', year: 2024 },
  { name: 'K-1 (1065)', filename: 'k1.pdf', text: K1_1065, docTypeId: 'k1-1065', routing: 'accept', issuer: 'Northwind Partners LP', year: 2024 },
  { name: '1098 mortgage', filename: '1098.pdf', text: MORTGAGE_1098, docTypeId: '1098', routing: 'accept', issuer: 'Wells Fargo Home Mortgage', year: 2024 },
  { name: '1095-A', filename: 'scan.pdf', text: MARKETPLACE_1095A, docTypeId: '1095-a', routing: 'accept', issuer: undefined, year: 2024 },
  { name: 'Prior-year 1040', filename: 'last_year_return.pdf', text: PRIOR_1040, docTypeId: 'prior-return', routing: 'accept', issuer: undefined, year: 2023 },
  { name: 'QuickBooks P&L', filename: 'Profit_and_Loss_2024.pdf', text: PROFIT_LOSS, docTypeId: 'profit-loss', routing: 'accept', issuer: 'Acme Widgets LLC', year: 2024 },
  { name: '1099-R', filename: 'retirement.pdf', text: R_1099, docTypeId: '1099-r', routing: 'accept', issuer: 'Vanguard Fiduciary Trust', year: 2024 },
  { name: 'SSA-1099', filename: 'ssa.pdf', text: SSA_1099, docTypeId: 'ssa-1099', routing: 'accept', issuer: undefined, year: 2024 },
  { name: 'AMBIGUOUS pay stub', filename: 'paystub.pdf', text: PAY_STUB, docTypeId: 'w2', routing: 'review', issuer: undefined, year: 2024 },
  { name: 'AMBIGUOUS cover note', filename: 'note.pdf', text: GENERIC_NOTE, docTypeId: 'other', routing: 'below', issuer: undefined, year: undefined },
];

describe('classifier — golden fixtures', () => {
  for (const g of GOLDEN) {
    it(`${g.name} → ${g.docTypeId} (${g.routing})`, () => {
      const c = classifyText(g.text, g.filename);
      assert.equal(c.docTypeId, g.docTypeId, `predicted type for "${g.name}"`);
      assert.equal(
        route(c.confidence),
        g.routing,
        `"${g.name}" routed ${route(c.confidence)} at confidence ${c.confidence.toFixed(2)}, expected ${g.routing}`,
      );
      assert.equal(extractIssuer(g.text, c.docTypeId), g.issuer, `issuer for "${g.name}"`);
      assert.equal(extractTaxYear(g.text), g.year, `tax year for "${g.name}"`);
    });
  }
});

// ── The assertion that actually protects users ───────────────────────────────

describe('calibration guardrail — never auto-file an ambiguous document', () => {
  for (const g of GOLDEN.filter((f) => f.name.startsWith('AMBIGUOUS'))) {
    it(`${g.name} stays below the accept threshold`, () => {
      const c = classifyText(g.text, g.filename);
      assert.ok(
        c.confidence < CLASSIFY_ACCEPT_THRESHOLD,
        `"${g.name}" reached ${c.confidence.toFixed(2)} ≥ accept ${CLASSIFY_ACCEPT_THRESHOLD}. ` +
          `A false-accept here silently misfiles a document during tax season — the exact ` +
          `failure this classifier exists to prevent. Ambiguous input MUST route to human review.`,
      );
    });
  }
});

// ── Adversarial fixtures ─────────────────────────────────────────────────────

// (a) An instructions booklet repeats the form title but must be vetoed, never
//     filed as the form itself.
const W2_INSTRUCTIONS = `2024 General Instructions for Forms W-2 and W-3
W-2 Instructions for Employers
Wage and Tax Statement
Department of the Treasury Internal Revenue Service
Box 1. Report wages, tips, and other compensation.
Box 2. Federal income tax withheld.
When to file. Where to file. How to complete and file Form W-2.`;

// (b) A 1099-INT whose subject is clear, with only an incidental mention of the
//     Form 1040 it gets reported on. Position weighting must keep INT the winner.
const INT_WITH_1040_MENTION = `2024 Form 1099-INT
Interest Income
PAYER'S name, street address, city or town, state or province, country, ZIP
HARBOR CREDIT UNION
Box 1 Interest income 845.00
Report this amount on your Form 1040, U.S. Individual Income Tax Return, Schedule B.
See the Instructions for Form 1040 for details.`;

describe('classifier — adversarial', () => {
  it('an IRS instructions page is vetoed, not classified as the form', () => {
    const c = classifyText(W2_INSTRUCTIONS, 'w2_instructions.pdf');
    assert.notEqual(c.docTypeId, 'w2', 'instructions for Form W-2 must NOT be filed as a W-2');
    assert.ok(
      route(c.confidence) !== 'accept',
      `instructions page auto-accepted at ${c.confidence.toFixed(2)} as ${c.docTypeId}`,
    );
  });

  it('the subject form wins over an incidental form mention', () => {
    const c = classifyText(INT_WITH_1040_MENTION, 'interest.pdf');
    assert.equal(c.docTypeId, '1099-int', 'the document is a 1099-INT that merely references Form 1040');
    assert.notEqual(c.docTypeId, 'prior-return', 'an incidental "Form 1040" mention must not win');
  });

  it('empty and garbage extractions land in "other" without throwing', () => {
    for (const text of ['', '   \n\n  ', 'zx9 qk!! 39d ~~~ lorem ipsum 000 \f \f ????']) {
      const c = classifyText(text, 'unknown.bin');
      assert.equal(c.docTypeId, 'other', `garbage text should be "other", got ${c.docTypeId}`);
      assert.ok(c.confidence < CLASSIFY_REVIEW_THRESHOLD, 'garbage must not clear even the review bar');
    }
  });
});
