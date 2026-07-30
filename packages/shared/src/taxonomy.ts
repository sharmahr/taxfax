/**
 * Canonical tax-document taxonomy.
 *
 * Every uploaded file is classified into exactly one `DocTypeId`. The taxonomy
 * drives three things at once: checklist generation, upload classification, and
 * the canonical filename written back to Cloud Storage.
 */

export type DocCategory =
  | 'income'
  | 'investment'
  | 'business'
  | 'property'
  | 'deduction'
  | 'health'
  | 'identity'
  | 'admin';

export const DOC_CATEGORY_LABEL: Record<DocCategory, string> = {
  income: 'Income',
  investment: 'Investments',
  business: 'Business & self-employment',
  property: 'Property & rentals',
  deduction: 'Deductions & credits',
  health: 'Health coverage',
  identity: 'Identity & banking',
  admin: 'Engagement',
};

/** Order categories appear in, everywhere in the product. */
export const DOC_CATEGORY_ORDER: DocCategory[] = [
  'income',
  'investment',
  'business',
  'property',
  'deduction',
  'health',
  'identity',
  'admin',
];

export interface DocTypeDef {
  id: string;
  /** Short label used in checklists and chips: "W-2". */
  code: string;
  /** Human label: "Wage and Tax Statement". */
  label: string;
  category: DocCategory;
  /** One-line plain-English explanation shown to the taxpayer. */
  hint: string;
  /** Who normally issues it — used in the "where do I get this?" helper. */
  issuedBy: string;
  /** True when a taxpayer commonly has several of these (multiple employers, brokers…). */
  multiple: boolean;
  /**
   * Regex fragments matched against extracted document text, in priority order.
   * Written to be specific: the literal IRS form title beats a stray mention.
   */
  match: {
    /** Near-certain identifiers (official form titles / OMB numbers). */
    strong: string[];
    /** Supporting signals; several weak hits can confirm a strong hit. */
    weak?: string[];
    /** Presence of any of these vetoes the match (avoids instruction pages). */
    veto?: string[];
  };
  /** Filename token used in the canonical rename, e.g. `W2`. */
  slug: string;
}

/**
 * The taxonomy. `match` patterns are case-insensitive and run against text that
 * has been whitespace-normalised, so patterns may assume single spaces.
 */
export const DOC_TYPES: DocTypeDef[] = [
  // ── Income ────────────────────────────────────────────────────────────────
  {
    id: 'w2',
    code: 'W-2',
    label: 'Wage and Tax Statement',
    category: 'income',
    hint: 'Your salary or wages from an employer.',
    issuedBy: 'Each employer you worked for',
    multiple: true,
    slug: 'W2',
    match: {
      strong: [
        'wage and tax statement',
        '\\bform w-?2\\b',
        'copy b.{0,40}to be filed with employee',
      ],
      weak: ['social security wages', 'medicare wages and tips', "employer's name, address"],
      veto: ['w-2 instructions for employers', 'form w-2c'],
    },
  },
  {
    id: 'w2g',
    code: 'W-2G',
    label: 'Certain Gambling Winnings',
    category: 'income',
    hint: 'Winnings from a casino, lottery, or sportsbook.',
    issuedBy: 'The casino, track, or lottery',
    multiple: true,
    slug: 'W2G',
    match: {
      strong: ['certain gambling winnings', '\\bform w-?2g\\b'],
      weak: ['type of wager', 'winnings from identical wagers'],
    },
  },
  {
    id: '1099-nec',
    code: '1099-NEC',
    label: 'Nonemployee Compensation',
    category: 'income',
    hint: 'Payment for contract or freelance work.',
    issuedBy: 'Each company that paid you as a contractor',
    multiple: true,
    slug: '1099NEC',
    match: {
      strong: ['nonemployee compensation', '1099-?nec'],
      weak: ['payer.s tin', 'recipient.s tin'],
    },
  },
  {
    id: '1099-misc',
    code: '1099-MISC',
    label: 'Miscellaneous Information',
    category: 'income',
    hint: 'Rents, royalties, prizes, or other miscellaneous payments.',
    issuedBy: 'Whoever made the payment',
    multiple: true,
    slug: '1099MISC',
    match: {
      strong: ['miscellaneous information', 'miscellaneous income', '1099-?misc'],
      weak: ['crop insurance proceeds', 'medical and health care payments'],
    },
  },
  {
    id: '1099-g',
    code: '1099-G',
    label: 'Certain Government Payments',
    category: 'income',
    hint: 'Unemployment benefits or a state tax refund.',
    issuedBy: 'Your state agency',
    multiple: true,
    slug: '1099G',
    match: {
      strong: ['certain government payments', '1099-?g\\b'],
      weak: ['unemployment compensation', 'state or local income tax refunds'],
    },
  },
  {
    id: '1099-k',
    code: '1099-K',
    label: 'Payment Card and Third Party Network Transactions',
    category: 'income',
    hint: 'Money collected through Stripe, PayPal, Venmo, Etsy, or similar.',
    issuedBy: 'The payment platform',
    multiple: true,
    slug: '1099K',
    match: {
      strong: ['payment card and third party network transactions', '1099-?k\\b'],
      weak: ['gross amount of payment card', 'merchant category code'],
    },
  },
  {
    id: 'ssa-1099',
    code: 'SSA-1099',
    label: 'Social Security Benefit Statement',
    category: 'income',
    hint: 'Social Security benefits you received.',
    issuedBy: 'Social Security Administration',
    multiple: false,
    slug: 'SSA1099',
    match: {
      strong: ['social security benefit statement', 'ssa-?1099', 'form ssa-1099'],
      weak: ['benefits paid in', 'box 5. net benefits'],
    },
  },
  {
    id: 'rrb-1099',
    code: 'RRB-1099',
    label: 'Railroad Retirement Benefits',
    category: 'income',
    hint: 'Railroad retirement benefits.',
    issuedBy: 'Railroad Retirement Board',
    multiple: false,
    slug: 'RRB1099',
    match: {
      strong: ['payments by the railroad retirement board', 'rrb-?1099'],
    },
  },

  // ── Investments ───────────────────────────────────────────────────────────
  {
    id: '1099-int',
    code: '1099-INT',
    label: 'Interest Income',
    category: 'investment',
    hint: 'Interest paid by a bank or credit union.',
    issuedBy: 'Each bank that paid you interest',
    multiple: true,
    slug: '1099INT',
    match: {
      strong: ['interest income', '1099-?int'],
      weak: ['early withdrawal penalty', 'interest on u.s. savings bonds'],
      veto: ['1099-oid'],
    },
  },
  {
    id: '1099-div',
    code: '1099-DIV',
    label: 'Dividends and Distributions',
    category: 'investment',
    hint: 'Dividends from stocks or mutual funds.',
    issuedBy: 'Your brokerage or fund company',
    multiple: true,
    slug: '1099DIV',
    match: {
      strong: ['dividends and distributions', '1099-?div'],
      weak: ['total ordinary dividends', 'qualified dividends', 'section 199a dividends'],
    },
  },
  {
    id: '1099-b',
    code: '1099-B',
    label: 'Proceeds From Broker Transactions',
    category: 'investment',
    hint: 'Stocks, bonds, or funds you sold during the year.',
    issuedBy: 'Your brokerage',
    multiple: true,
    slug: '1099B',
    match: {
      strong: [
        'proceeds from broker and barter exchange transactions',
        '1099-?b\\b',
        'consolidated 1099',
      ],
      weak: ['short-term transactions for which basis', 'wash sale loss disallowed', 'cost or other basis'],
    },
  },
  {
    id: '1099-r',
    code: '1099-R',
    label: 'Retirement Distributions',
    category: 'investment',
    hint: 'Money taken out of an IRA, 401(k), or pension.',
    issuedBy: 'Your plan administrator',
    multiple: true,
    slug: '1099R',
    match: {
      strong: [
        'distributions from pensions, annuities, retirement',
        '1099-?r\\b',
      ],
      weak: ['distribution code', 'taxable amount not determined', 'total distribution'],
    },
  },
  {
    id: '1099-s',
    code: '1099-S',
    label: 'Proceeds From Real Estate Transactions',
    category: 'investment',
    hint: 'Sale of a home or other real estate.',
    issuedBy: 'The title or closing agent',
    multiple: true,
    slug: '1099S',
    match: {
      strong: ['proceeds from real estate transactions', '1099-?s\\b'],
      weak: ['address or legal description', 'gross proceeds'],
    },
  },
  {
    id: '1099-q',
    code: '1099-Q',
    label: '529 / Coverdell Distributions',
    category: 'investment',
    hint: 'Money withdrawn from a 529 college savings plan.',
    issuedBy: 'Your 529 plan administrator',
    multiple: true,
    slug: '1099Q',
    match: {
      strong: ['payments from qualified education programs', '1099-?q\\b'],
    },
  },
  {
    id: 'k1-1065',
    code: 'K-1 (1065)',
    label: 'Partnership Schedule K-1',
    category: 'investment',
    hint: 'Your share of income from a partnership or LLC.',
    issuedBy: 'The partnership',
    multiple: true,
    slug: 'K1-1065',
    match: {
      strong: [
        "partner's share of income, deductions, credits",
        'schedule k-?1 \\(form 1065\\)',
      ],
      weak: ['partnership.s employer identification number', 'guaranteed payments'],
    },
  },
  {
    id: 'k1-1120s',
    code: 'K-1 (1120-S)',
    label: 'S Corporation Schedule K-1',
    category: 'investment',
    hint: 'Your share of income from an S corporation.',
    issuedBy: 'The S corporation',
    multiple: true,
    slug: 'K1-1120S',
    match: {
      strong: [
        "shareholder's share of income, deductions, credits",
        'schedule k-?1 \\(form 1120-?s\\)',
      ],
      weak: ['corporation.s employer identification number'],
    },
  },
  {
    id: 'k1-1041',
    code: 'K-1 (1041)',
    label: 'Trust or Estate Schedule K-1',
    category: 'investment',
    hint: 'Your share of income from a trust or estate.',
    issuedBy: 'The trustee or executor',
    multiple: true,
    slug: 'K1-1041',
    match: {
      strong: [
        "beneficiary's share of income, deductions, credits",
        'schedule k-?1 \\(form 1041\\)',
      ],
    },
  },
  {
    id: 'crypto-report',
    code: 'Crypto',
    label: 'Digital Asset Transaction Report',
    category: 'investment',
    hint: 'Your full-year transaction export from every crypto exchange or wallet.',
    issuedBy: 'Coinbase, Kraken, or your tracking tool',
    multiple: true,
    slug: 'Crypto',
    match: {
      strong: ['1099-?da\\b', 'digital asset proceeds from broker'],
      weak: ['coinbase', 'kraken', 'gemini trust', 'transaction history export'],
    },
  },

  // ── Business & self-employment ────────────────────────────────────────────
  {
    id: 'profit-loss',
    code: 'P&L',
    label: 'Profit and Loss Statement',
    category: 'business',
    hint: 'Full-year income and expenses for your business.',
    issuedBy: 'QuickBooks, Xero, or your bookkeeper',
    multiple: true,
    slug: 'ProfitLoss',
    match: {
      strong: ['profit and loss', 'profit & loss', 'income statement'],
      weak: ['total revenue', 'gross profit', 'net operating income', 'cost of goods sold'],
    },
  },
  {
    id: 'balance-sheet',
    code: 'Balance sheet',
    label: 'Balance Sheet',
    category: 'business',
    hint: 'Year-end assets, liabilities, and equity.',
    issuedBy: 'QuickBooks, Xero, or your bookkeeper',
    multiple: true,
    slug: 'BalanceSheet',
    match: {
      strong: ['balance sheet', 'statement of financial position'],
      weak: ['total liabilities and equity', 'accounts receivable', "owner's equity"],
    },
  },
  {
    id: 'mileage-log',
    code: 'Mileage',
    label: 'Vehicle Mileage Log',
    category: 'business',
    hint: 'Business miles driven, plus total miles for the year.',
    issuedBy: 'You — MileIQ, a spreadsheet, or your odometer',
    multiple: false,
    slug: 'MileageLog',
    match: {
      strong: ['mileage log', 'business mileage'],
      weak: ['odometer', 'total miles driven', 'business miles'],
    },
  },
  {
    id: 'asset-schedule',
    code: 'Assets',
    label: 'Asset Purchases & Depreciation',
    category: 'business',
    hint: 'Equipment, vehicles, or property the business bought this year.',
    issuedBy: 'You — receipts or invoices',
    multiple: true,
    slug: 'AssetSchedule',
    match: {
      strong: ['depreciation schedule', 'fixed asset schedule'],
      weak: ['accumulated depreciation', 'placed in service', 'section 179'],
    },
  },
  {
    id: 'home-office',
    code: 'Home office',
    label: 'Home Office Worksheet',
    category: 'business',
    hint: 'Square footage of your office plus full-year utilities, rent, and insurance.',
    issuedBy: 'You',
    multiple: false,
    slug: 'HomeOffice',
    match: {
      strong: ['home office', 'business use of your home'],
      weak: ['square footage', 'form 8829'],
    },
  },
  {
    id: 'bank-statements',
    code: 'Statements',
    label: 'Business Bank & Card Statements',
    category: 'business',
    hint: 'All twelve months for every business account.',
    issuedBy: 'Your bank',
    multiple: true,
    slug: 'BankStatements',
    match: {
      strong: ['account statement', 'statement of account', 'monthly statement'],
      weak: ['beginning balance', 'ending balance', 'deposits and credits'],
    },
  },
  {
    id: 'payroll-summary',
    code: 'Payroll',
    label: 'Annual Payroll Summary',
    category: 'business',
    hint: 'Year-end payroll reports (W-3, 940, 941) if you have employees.',
    issuedBy: 'Gusto, ADP, or your payroll provider',
    multiple: true,
    slug: 'PayrollSummary',
    match: {
      strong: ['payroll summary', '\\bform 940\\b', '\\bform 941\\b', 'transmittal of wage and tax statements'],
      weak: ['total payroll', 'employer taxes'],
    },
  },

  // ── Property & rentals ────────────────────────────────────────────────────
  {
    id: '1098',
    code: '1098',
    label: 'Mortgage Interest Statement',
    category: 'property',
    hint: 'Interest you paid on a home loan.',
    issuedBy: 'Your mortgage servicer',
    multiple: true,
    slug: '1098',
    match: {
      strong: ['mortgage interest statement', '\\bform 1098\\b'],
      weak: ['mortgage insurance premiums', 'outstanding mortgage principal', 'points paid on purchase'],
      veto: ['1098-t', '1098-e', '1098-c'],
    },
  },
  {
    id: 'property-tax',
    code: 'Property tax',
    label: 'Property Tax Statement',
    category: 'property',
    hint: 'Real estate tax you paid to your county or town.',
    issuedBy: 'Your county assessor or treasurer',
    multiple: true,
    slug: 'PropertyTax',
    match: {
      strong: ['property tax statement', 'real estate tax bill', 'secured property tax'],
      weak: ['assessed value', 'parcel number', 'tax year installment'],
    },
  },
  {
    id: 'rental-summary',
    code: 'Rental',
    label: 'Rental Income & Expense Summary',
    category: 'property',
    hint: 'Rent collected and expenses paid, per property.',
    issuedBy: 'You or your property manager',
    multiple: true,
    slug: 'RentalSummary',
    match: {
      strong: ['rental income', 'owner statement', 'property management statement'],
      weak: ['tenant', 'lease', 'management fee', 'repairs and maintenance'],
    },
  },
  {
    id: 'closing-statement',
    code: 'Closing',
    label: 'Closing Disclosure / Settlement Statement',
    category: 'property',
    hint: 'Paperwork from buying, selling, or refinancing property.',
    issuedBy: 'Your title or escrow company',
    multiple: true,
    slug: 'ClosingDisclosure',
    match: {
      strong: ['closing disclosure', 'settlement statement', 'alta settlement'],
      weak: ['loan estimate', 'cash to close', 'seller.s transaction'],
    },
  },

  // ── Deductions & credits ──────────────────────────────────────────────────
  {
    id: '1098-e',
    code: '1098-E',
    label: 'Student Loan Interest',
    category: 'deduction',
    hint: 'Interest paid on student loans.',
    issuedBy: 'Your loan servicer',
    multiple: true,
    slug: '1098E',
    match: {
      strong: ['student loan interest statement', '1098-?e\\b'],
    },
  },
  {
    id: '1098-t',
    code: '1098-T',
    label: 'Tuition Statement',
    category: 'deduction',
    hint: 'Tuition paid to a college or university.',
    issuedBy: 'The school',
    multiple: true,
    slug: '1098T',
    match: {
      strong: ['tuition statement', '1098-?t\\b'],
      weak: ['payments received for qualified tuition', 'scholarships or grants'],
    },
  },
  {
    id: '5498',
    code: '5498',
    label: 'IRA Contribution Information',
    category: 'deduction',
    hint: 'Money you put into an IRA.',
    issuedBy: 'Your IRA custodian',
    multiple: true,
    slug: '5498',
    match: {
      strong: ['ira contribution information', '\\bform 5498\\b'],
      veto: ['5498-sa', '5498-esa'],
    },
  },
  {
    id: '5498-sa',
    code: '5498-SA',
    label: 'HSA Contribution Information',
    category: 'deduction',
    hint: 'Money you put into a health savings account.',
    issuedBy: 'Your HSA custodian',
    multiple: true,
    slug: '5498SA',
    match: { strong: ['hsa, archer msa, or medicare advantage msa information', '5498-?sa'] },
  },
  {
    id: '1099-sa',
    code: '1099-SA',
    label: 'HSA Distributions',
    category: 'deduction',
    hint: 'Money you took out of a health savings account.',
    issuedBy: 'Your HSA custodian',
    multiple: true,
    slug: '1099SA',
    match: { strong: ['distributions from an hsa, archer msa', '1099-?sa'] },
  },
  {
    id: 'charitable',
    code: 'Charity',
    label: 'Charitable Contribution Receipts',
    category: 'deduction',
    hint: 'Donation receipts — anything over $250 needs a written acknowledgement.',
    issuedBy: 'Each charity you gave to',
    multiple: true,
    slug: 'Charitable',
    match: {
      strong: ['charitable contribution', 'donation receipt', 'acknowledgement of your gift'],
      weak: ['tax-deductible', '501\\(c\\)\\(3\\)', 'no goods or services were provided'],
    },
  },
  {
    id: 'medical-expenses',
    code: 'Medical',
    label: 'Medical Expense Summary',
    category: 'deduction',
    hint: 'Out-of-pocket medical, dental, and prescription costs.',
    issuedBy: 'You — your insurer often provides a year-end summary',
    multiple: true,
    slug: 'MedicalExpenses',
    match: {
      strong: ['explanation of benefits', 'medical expense summary', 'year-end claims summary'],
      weak: ['patient responsibility', 'amount you owe', 'deductible applied'],
    },
  },
  {
    id: 'childcare',
    code: 'Childcare',
    label: 'Child & Dependent Care Statement',
    category: 'deduction',
    hint: "Daycare costs plus the provider's name, address, and tax ID.",
    issuedBy: 'Your care provider',
    multiple: true,
    slug: 'ChildcareStatement',
    match: {
      strong: ['dependent care', 'child care statement', 'year-end statement.{0,30}child'],
      weak: ['provider tax id', 'form 2441'],
    },
  },
  {
    id: 'estimated-payments',
    code: 'Estimates',
    label: 'Estimated Tax Payments',
    category: 'deduction',
    hint: 'Dates and amounts of every quarterly payment you made.',
    issuedBy: 'You — IRS Direct Pay confirmations or cancelled checks',
    multiple: false,
    slug: 'EstimatedPayments',
    match: {
      strong: ['estimated tax', '\\b1040-?es\\b'],
      weak: ['payment confirmation', 'eftps', 'direct pay'],
    },
  },
  {
    id: 'k12-educator',
    code: 'Educator',
    label: 'Educator Expense Receipts',
    category: 'deduction',
    hint: 'Classroom supplies you paid for yourself.',
    issuedBy: 'You',
    multiple: true,
    slug: 'EducatorExpenses',
    match: { strong: ['educator expense'], weak: ['classroom supplies'] },
  },
  {
    id: 'energy-credit',
    code: 'Energy',
    label: 'Home Energy Improvement Receipts',
    category: 'deduction',
    hint: 'Solar, heat pump, windows, or insulation installed this year.',
    issuedBy: 'Your installer',
    multiple: true,
    slug: 'EnergyCredit',
    match: {
      strong: ['residential clean energy', 'energy efficient home improvement', 'form 5695'],
      weak: ['solar', 'heat pump', 'manufacturer certification'],
    },
  },

  // ── Health coverage ───────────────────────────────────────────────────────
  {
    id: '1095-a',
    code: '1095-A',
    label: 'Marketplace Health Insurance',
    category: 'health',
    hint: 'Health coverage bought through Healthcare.gov or a state exchange.',
    issuedBy: 'Your health insurance marketplace',
    multiple: false,
    slug: '1095A',
    match: {
      strong: ['health insurance marketplace statement', '1095-?a\\b'],
      weak: ['second lowest cost silver plan', 'advance payment of premium tax credit'],
    },
  },
  {
    id: '1095-bc',
    code: '1095-B/C',
    label: 'Employer or Insurer Health Coverage',
    category: 'health',
    hint: 'Proof of health coverage from an employer or insurer.',
    issuedBy: 'Your employer or insurer',
    multiple: true,
    slug: '1095BC',
    match: {
      strong: [
        'health coverage',
        'employer-provided health insurance offer and coverage',
        '1095-?[bc]\\b',
      ],
    },
  },

  // ── Identity & banking ────────────────────────────────────────────────────
  {
    id: 'photo-id',
    code: 'ID',
    label: "Driver's Licence or State ID",
    category: 'identity',
    hint: "A photo of the front of your licence — several states require it to e-file.",
    issuedBy: 'Your state DMV',
    multiple: true,
    slug: 'PhotoID',
    match: {
      strong: ["driver'?s licen[sc]e", 'identification card', 'department of motor vehicles'],
      weak: ['\\bdln\\b', 'class c', 'endorsements', 'restrictions'],
    },
  },
  {
    id: 'ssn-card',
    code: 'SSN',
    label: 'Social Security Card',
    category: 'identity',
    hint: 'Needed for anyone new on the return — a new spouse or child.',
    issuedBy: 'Social Security Administration',
    multiple: true,
    slug: 'SSNCard',
    match: { strong: ['social security\\s+\\n?card', 'this number has been established for'] },
  },
  {
    id: 'voided-check',
    code: 'Bank',
    label: 'Voided Check or Bank Details',
    category: 'identity',
    hint: 'Routing and account number so your refund arrives by direct deposit.',
    issuedBy: 'Your bank',
    multiple: false,
    slug: 'BankInfo',
    match: {
      strong: ['\\bvoid(ed)?\\b.{0,20}check', 'direct deposit authorization'],
      weak: ['routing number', 'account number', 'pay to the order of'],
    },
  },
  {
    id: 'ip-pin',
    code: 'IP PIN',
    label: 'IRS Identity Protection PIN',
    category: 'identity',
    hint: 'The six-digit PIN the IRS mails you each December (CP01A notice).',
    issuedBy: 'The IRS',
    multiple: true,
    slug: 'IPPIN',
    match: {
      strong: ['identity protection personal identification number', 'ip pin', 'notice cp01a'],
    },
  },

  // ── Engagement ────────────────────────────────────────────────────────────
  {
    id: 'prior-return',
    code: 'Prior return',
    label: "Last Year's Tax Return",
    category: 'admin',
    hint: 'The complete return, including all schedules — this is what builds your checklist.',
    issuedBy: 'Your previous preparer',
    multiple: false,
    slug: 'PriorYearReturn',
    match: {
      strong: [
        'u\\.s\\. individual income tax return',
        '\\bform 1040\\b',
        'u\\.s\\. return of partnership income',
        'u\\.s\\. income tax return for an s corporation',
      ],
      weak: ['filing status', 'adjusted gross income', 'standard deduction', 'schedule 1'],
    },
  },
  {
    id: 'engagement-letter',
    code: 'Engagement',
    label: 'Signed Engagement Letter',
    category: 'admin',
    hint: 'Our terms of service for this year, signed.',
    issuedBy: 'Your accountant',
    multiple: false,
    slug: 'EngagementLetter',
    match: {
      strong: ['engagement letter', 'terms of engagement'],
      weak: ['scope of services', 'we will prepare your'],
    },
  },
  {
    id: 'organizer',
    code: 'Organizer',
    label: 'Completed Tax Organizer',
    category: 'admin',
    hint: 'The questionnaire covering life changes we need to know about.',
    issuedBy: 'Your accountant',
    multiple: false,
    slug: 'Organizer',
    match: { strong: ['tax organizer', 'client organizer'] },
  },
  {
    id: 'other',
    code: 'Other',
    label: 'Other Document',
    category: 'admin',
    hint: "Anything you think we might need that isn't on the list.",
    issuedBy: '—',
    multiple: true,
    slug: 'Other',
    match: { strong: [] },
  },
];

export const DOC_TYPE_BY_ID: Record<string, DocTypeDef> = Object.fromEntries(
  DOC_TYPES.map((d) => [d.id, d]),
);

export function docType(id: string): DocTypeDef {
  return DOC_TYPE_BY_ID[id] ?? DOC_TYPE_BY_ID.other;
}
