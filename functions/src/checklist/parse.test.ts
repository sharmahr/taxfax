/**
 * Prior-year parser regression suite — the product's wedge, pinned.
 *
 *   node --experimental-strip-types --test functions/src/checklist/parse.test.ts
 *
 * `parseReturnText` reads semi-structured text out of an arbitrary tax-return
 * PDF, so it regresses silently the first time someone tightens a regex — and
 * the failure mode isn't a crash, it's a client asked for the wrong documents,
 * or not asked for a K-1 they actually have. These fixtures lock the behaviour
 * reported when the parser shipped: a full, correct parse of a realistic 1040
 * package, twenty checklist reasons that quote the taxpayer's own employers and
 * amounts, graceful degradation to confidence 0 on unreadable input, and a
 * trust boundary below which we fall back to the starter list rather than ask
 * for documents we only think exist. Pure unit test, Node stdlib runner, no
 * emulator — it belongs in the fast CI tier alongside packages/shared/src/check.ts.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseReturnText } from './parsePriorYearReturn.ts';
import { planChecklist, MIN_CONFIDENCE } from './plan.ts';
import {
  emptyPriorYear,
  generateChecklist,
  isReasonKey,
  reasonFor,
  STARTER_CHECKLIST,
  type ChecklistHit,
} from '../../../packages/shared/src/index.ts';

// ── A realistic nine-page 1040 filing package ────────────────────────────────
// Married filing jointly, two dependents, a Schedule C business, a Schedule E
// with two rentals, itemized deductions, estimated payments, a "yes" to the
// digital-asset question, and — attached to the same package — two W-2s, a
// 1099-INT and a partnership K-1, each from a named issuer. Newlines are kept
// because the issuer extractor reads raw page lines.

const P_1040 = `Form 1040 U.S. Individual Income Tax Return 2023
Department of the Treasury—Internal Revenue Service
For the year Jan. 1–Dec. 31, 2023
Your first name Robert   Last name Taxpayer
Your social security number 123-45-6789
Spouse's first name Susan   Spouse's last name Taxpayer
Spouse's social security number 987-65-4321
Filing Status: X Married filing jointly
Digital assets: At any time during 2023, did you receive any digital assets? Yes X No
Dependents (see instructions):
Emma Taxpayer 111-22-3333 Daughter
Liam Taxpayer 444-55-6666 Son
Income
1z Total wages from all Forms W-2 120,000
2a Tax-exempt interest 0   2b Taxable interest 1,250
3a Qualified dividends 900   3b Ordinary dividends 1,100
7 Capital gain or (loss) 0
26 Estimated tax payments and amount applied from 2022 return 12,000
Standard Deduction for Married filing jointly 27,700`;

const P_SCH1 = `SCHEDULE 1 (Form 1040) Additional Income and Adjustments to Income 2023
Part I Additional Income
3 Business income or (loss). Attach Schedule C 45,000
5 Rental real estate, royalties, partnerships, S corporations, trusts, etc. Attach Schedule E 63,000
7 Unemployment compensation 0
10 Additional income. Add lines 1 through 9 108,000`;

const P_SCHC = `SCHEDULE C (Form 1040) Profit or Loss From Business (Sole Proprietorship) 2023
Name of proprietor Robert Taxpayer
A Principal business Consulting
Part I Income
1 Gross receipts or sales 92,000
31 Net profit or (loss) 45,000`;

const P_SCHE = `SCHEDULE E (Form 1040) Supplemental Income and Loss 2023
Part I Income or Loss From Rental Real Estate and Royalties
Physical address of each property:
A 123 Main St, Austin, TX 78701
B 456 Oak Ave, Denver, CO 80202
26 Total rental real estate and royalty income or (loss) 63,000`;

const P_SCHA = `SCHEDULE A (Form 1040) Itemized Deductions 2023
Medical and Dental Expenses
1 Medical and dental expenses (see instructions) 9,500
Gifts to Charity
14 Add lines 11 through 13 8,700
17 Total itemized deductions 18,200`;

const P_W2_A = `Form W-2 Wage and Tax Statement 2023
a Employee's social security number 123-45-6789
b Employer identification number (EIN) 12-3456789
c Employer's name, address, and ZIP code
Acme Corporation
500 Industrial Blvd
Springfield, IL 62704
1 Wages, tips, other compensation 72,000
2 Federal income tax withheld 11,400`;

const P_W2_B = `Form W-2 Wage and Tax Statement 2023
a Employee's social security number 987-65-4321
b Employer identification number (EIN) 98-7654321
c Employer's name, address, and ZIP code
Northwind Logistics LLC
88 Cargo Way
Memphis, TN 38118
1 Wages, tips, other compensation 48,000
2 Federal income tax withheld 6,900`;

const P_1099INT = `Form 1099-INT Interest Income 2023
PAYER'S name, street address, city, state, ZIP code
First National Bank
1200 Commerce Street
Dallas, TX 75201
RECIPIENT'S name Robert Taxpayer
1 Interest income 1,250`;

const P_K1 = `Schedule K-1 (Form 1065) 2023 Partner's Share of Income, Deductions, Credits
Part I Information About the Partnership
Partnership's name, address, city, state, and ZIP code
Blue Harbor Partners LP
77 Marina Blvd
Seattle, WA 98101
Part III Partner's Share of Current Year Income
1 Ordinary business income (loss) 18,400`;

const PACKAGE_1040 = [P_1040, P_SCH1, P_SCHC, P_SCHE, P_SCHA, P_W2_A, P_W2_B, P_1099INT, P_K1];

const prior = parseReturnText(PACKAGE_1040);
const hits = generateChecklist({ prior, taxYear: prior.taxYear + 1 });

function hitFor(docTypeId: string): ChecklistHit {
  const h = hits.find((x) => x.docTypeId === docTypeId);
  assert.ok(h, `checklist is missing a ${docTypeId} request`);
  return h;
}

// ── The parse ────────────────────────────────────────────────────────────────

describe('parseReturnText — realistic 1040 package', () => {
  it('identifies the form, year, filing status, dependents and confidence', () => {
    assert.equal(prior.formType, '1040');
    assert.equal(prior.entityType, 'individual');
    assert.equal(prior.taxYear, 2023);
    assert.equal(prior.filingStatus, 'mfj');
    assert.equal(prior.dependents, 2);
    assert.equal(prior.itemized, true);
    assert.equal(prior.confidence, 1);
  });

  it('detects every attached schedule', () => {
    assert.deepEqual([...prior.schedules].sort(), ['1', 'A', 'C', 'E']);
  });

  it('reads every 1040, Schedule 1 and Schedule A line value', () => {
    assert.deepEqual(prior.lines, {
      '1z': 120000,
      '2a': 0,
      '2b': 1250,
      '3a': 900,
      '3b': 1100,
      '7': 0,
      '26': 12000,
      'sch1-3': 45000,
      'sch1-5': 63000,
      'sch1-7': 0,
      'schA-1': 9500,
      'schA-14': 8700,
      'digital-assets': 1,
    });
  });

  it('counts the source documents bundled in the package', () => {
    assert.deepEqual(prior.documentCounts, {
      w2: 2,
      '1099-int': 1,
      'k1-1065': 1,
      'rental-summary': 2,
    });
  });

  it('extracts and cleans every issuer name', () => {
    assert.deepEqual(prior.issuers, [
      { docTypeId: 'w2', name: 'Acme Corporation' },
      { docTypeId: 'w2', name: 'Northwind Logistics LLC' },
      { docTypeId: '1099-int', name: 'First National Bank' },
      { docTypeId: 'k1-1065', name: 'Blue Harbor Partners LP' },
    ]);
  });

  it('strips addresses and EINs so issuer names read cleanly in a chase message', () => {
    // "Acme Corporation", never "Employer's name, address, and ZIP code" or a
    // street line with a ZIP — the clean name is what makes the reason readable.
    for (const { name } of prior.issuers) {
      assert.doesNotMatch(name, /\d/, `issuer "${name}" still carries a digit (EIN, ZIP or street number)`);
      assert.doesNotMatch(name, /address|street|\bzip\b|employer|payer|partnership/i, `issuer "${name}" still carries label boilerplate`);
    }
  });
});

// ── The reasons — the sentences that sell the product ────────────────────────

describe('generateChecklist — reasons quote the taxpayer’s own facts', () => {
  it('produces the full twenty-item personalised checklist', () => {
    assert.equal(hits.length, 20);
  });

  it('the W-2 request names both employers', () => {
    const reason = hitFor('w2').reason;
    assert.match(reason, /2 W-2s/);
    assert.match(reason, /Acme Corporation/);
    assert.match(reason, /Northwind Logistics LLC/);
    assert.equal(hitFor('w2').quantity, 2);
  });

  it('the K-1 request names the partnership', () => {
    assert.match(hitFor('k1-1065').reason, /Blue Harbor Partners LP/);
  });

  it('the 1099-INT request names the bank', () => {
    assert.match(hitFor('1099-int').reason, /First National Bank/);
  });

  it('the Schedule C request quotes the business income', () => {
    assert.match(hitFor('profit-loss').reason, /\$45k/);
  });

  it('the rental request quotes the property count', () => {
    assert.equal(hitFor('rental-summary').quantity, 2);
    assert.match(hitFor('rental-summary').reason, /2 rental/);
  });

  it('the itemized-deduction requests quote the amounts', () => {
    assert.match(hitFor('charitable').reason, /\$9k/);
    assert.match(hitFor('estimated-payments').reason, /\$12k/);
    assert.ok(hitFor('medical-expenses'));
  });

  it('a crypto report is requested off the digital-asset answer', () => {
    assert.ok(hitFor('crypto-report'));
  });
});

// ── Entity returns ───────────────────────────────────────────────────────────

describe('parseReturnText — entity returns', () => {
  it('recognises a 1065 partnership return by its title', () => {
    const p = parseReturnText([
      `Form 1065 U.S. Return of Partnership Income 2023
Department of the Treasury Internal Revenue Service
For calendar year 2023, or tax year beginning
Name of partnership Blue Harbor Partners LP
A Principal business activity Real estate
Number of Schedules K-1. Attach one for each person who was a partner 3
Schedule K Partners' Distributive Share Items`,
    ]);
    assert.equal(p.formType, '1065');
    assert.equal(p.entityType, 'partnership');
    assert.equal(p.filingStatus, 'entity');
    assert.equal(p.taxYear, 2023);
  });
});

// ── Degradation — a parser that throws takes down the upload trigger ──────────

describe('parseReturnText — degrades to confidence 0 without throwing', () => {
  const cases: { label: string; input: string[] }[] = [
    { label: 'empty page array', input: [] },
    { label: 'scanned image with no text layer', input: [''] },
    { label: 'whitespace-only extraction', input: ['   \n\n\t  '] },
    { label: 'garbage bytes', input: ['zx9 qk!! 39d ~~~ \f \f ??? ¿?? \u0000 lorem 000'] },
    { label: 'a foreign-language return', input: ['Déclaration des revenus. Impôt sur le revenu des personnes physiques. Formulaire officiel à conserver.'] },
    { label: 'null (defensive)', input: null as unknown as string[] },
  ];

  for (const { label, input } of cases) {
    it(`${label} → confidence 0, no throw`, () => {
      // A throw escapes and fails the test with a real stack — better diagnostics
      // than doesNotThrow. Either way it would crash onDocumentUpdated into retries.
      const result = parseReturnText(input);
      assert.equal(result.confidence, 0, `${label} must not be trusted`);
    });
  }
});

// ── The trust boundary ───────────────────────────────────────────────────────

describe('planChecklist — never ask for documents we only think exist', () => {
  it('a confident parse personalises the checklist', () => {
    const plan = planChecklist(prior);
    assert.equal(plan.source, 'prior_year');
    assert.equal(plan.items.length, 20);
  });

  it('a weak parse falls back to the starter list, not a confidently wrong 20-item one', () => {
    const scanned = parseReturnText([
      `Scanned copy of last year's return. The fax came through faint and the
optical text layer is mostly gone; only a handful of words survived and
none of the totals or form headings are legible on this page.`,
    ]);
    assert.ok(scanned.confidence < MIN_CONFIDENCE, 'this fixture is meant to be untrustworthy');

    const plan = planChecklist(scanned);
    assert.equal(plan.source, 'starter');
    assert.notEqual(plan.items.length, 20);
    assert.equal(plan.items.length, STARTER_CHECKLIST.length);
    assert.deepEqual(
      plan.items.map((i) => i.docTypeId),
      STARTER_CHECKLIST.map((s) => s.docTypeId),
    );
  });

  it('pins the confidence threshold exactly', () => {
    const below = { ...emptyPriorYear(2023), confidence: MIN_CONFIDENCE - 0.001 };
    const at = { ...emptyPriorYear(2023), confidence: MIN_CONFIDENCE };
    assert.equal(planChecklist(below).source, 'starter');
    assert.equal(planChecklist(at).source, 'prior_year');
  });

  // The sentences asserted above are the English ones, which is what the firm's
  // console reads. The taxpayer reads the same reason assembled from their own
  // dictionary, and that needs the key and the evidence as data — both optional
  // on the stored request, so a planner that drops them compiles happily and
  // the taxpayer silently gets a language they told the IRS they can't read.

  it('plans every reason as a key, on the personalised list and the starter one', () => {
    for (const plan of [planChecklist(prior), planChecklist(emptyPriorYear(2023))]) {
      const keyless = plan.items.filter((i) => !isReasonKey(i.reasonKey)).map((i) => i.docTypeId);
      assert.deepEqual(
        keyless,
        [],
        `${plan.source}: ${keyless.join(', ')} planned with no reason key — those lines reach the taxpayer in English.`,
      );
    }
  });

  it('keeps the evidence a rule found as data, not dissolved into the sentence', () => {
    const w2 = planChecklist(prior).items.find((i) => i.docTypeId === 'w2');
    assert.ok(w2, 'no W-2 line planned — the fixture no longer proves anything');
    assert.equal(w2.reasonKey, 'reason.w2IssuersMany');
    assert.deepEqual(
      w2.reasonVars,
      { count: 2, issuers: ['Acme Corporation', 'Northwind Logistics LLC'] },
      'The two employers survived into English but not into the evidence — a translated reason would name nobody.',
    );

    const arabic = reasonFor('ar', w2);
    assert.notEqual(arabic, w2.reason, 'The Arabic reason came back in English.');
    for (const employer of ['Acme Corporation', 'Northwind Logistics LLC']) {
      assert.ok(
        arabic.includes(employer),
        `The Arabic reason does not name ${employer} — the sentence that makes a taxpayer go and find the paper.`,
      );
    }
  });
});
