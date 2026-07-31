/**
 * The book of business the demo is built from.
 *
 * Split out of `seed.ts` so the document generator can read the same client
 * list the seeder writes: the synthetic PDFs have to name the same employers and
 * banks the prior-year return names, or the demo contradicts itself on screen.
 *
 * The data is deliberately not tidy: some clients are finished, some have never
 * opened the portal, one has a bounced email, one has opted out of SMS, and a
 * realistic minority filed a Schedule LEP asking the IRS to write to them in a
 * language other than English.
 */
import {
  emptyPriorYear,
  type ClientStage,
  type EntityType,
  type FilingStatus,
  type PriorYearReturn,
} from '../packages/shared/src/index.ts';

export const TAX_YEAR = 2025;
export const FIRM_ID = 'whitfield-rowe';


export interface Seed {
  name: string;
  email: string;
  phone?: string;
  entity: EntityType;
  filing?: FilingStatus;
  stage: ClientStage;
  assigned: string;
  tags: string[];
  /** Shapes the generated checklist. */
  profile: 'w2-simple' | 'w2-investments' | 'schedule-c' | 'rental' | 'partner' | 'retired' | 'entity';
  /** 0–1 of checklist items already accepted. */
  done: number;
  smsOptOut?: boolean;
  emailBounced?: boolean;
  daysWaiting?: number;
  /**
   * Schedule LEP code printed on last year's return. The seeder does not trust
   * this field directly: it prints the code onto the synthetic Schedule LEP page
   * and lets the real parser find it again, so the demo's "detected from their
   * return" claim is backed by an actual parse rather than a hand-set value.
   */
  lepCode?: string;
  /**
   * A human overrode (or pre-empted) the detection. `taxpayer` is someone who
   * picked their own language on the portal; `preparer` is the firm setting it
   * because they know the client. Both outrank a parse.
   */
  languageBy?: { source: 'taxpayer' | 'preparer'; locale: string };
}

export const CLIENTS: Seed[] = [
  { name: 'Eleanor Whitfield', email: 'eleanor.whitfield@fastmail.com', phone: '+15125550142', entity: 'individual', filing: 'mfj', stage: 'partial', assigned: 'staff-priya', tags: ['high-value'], profile: 'w2-investments', done: 0.55, daysWaiting: 12 },
  { name: 'Marcus Delacroix', email: 'm.delacroix@gmail.com', phone: '+15125550188', entity: 'individual', filing: 'single', stage: 'awaiting', assigned: 'staff-priya', tags: [], profile: 'schedule-c', done: 0, daysWaiting: 19 },
  { name: 'Priyanka Venkataraman', email: 'pv@venkatconsulting.com', phone: '+15125550119', entity: 'individual', filing: 'mfj', stage: 'ready', assigned: 'staff-dan', tags: ['high-value'], profile: 'partner', done: 1 },
  { name: 'Northwind Logistics LLC', email: 'accounting@northwindlog.com', phone: '+15125550176', entity: 'partnership', stage: 'partial', assigned: 'staff-dan', tags: ['entity', 'high-value'], profile: 'entity', done: 0.4, daysWaiting: 8 },
  { name: 'Rosalind Achebe', email: 'r.achebe@outlook.com', phone: '+15125550163', entity: 'individual', filing: 'hoh', stage: 'in_review', assigned: 'staff-priya', tags: [], profile: 'w2-simple', done: 1 },
  { name: 'Thomas Bergström', email: 'tbergstrom@icloud.com', entity: 'individual', filing: 'mfj', stage: 'blocked', assigned: 'staff-dan', tags: ['needs-attention'], profile: 'rental', done: 0.2, emailBounced: true, daysWaiting: 31 },
  { name: 'Yuki Tanaka', email: 'yuki.tanaka@proton.me', phone: '+15125550154', entity: 'individual', filing: 'single', stage: 'partial', assigned: 'staff-priya', tags: [], profile: 'w2-investments', done: 0.7, daysWaiting: 6 },
  { name: 'Cedar & Vine Hospitality', email: 'finance@cedarvine.co', phone: '+15125550131', entity: 's-corp', stage: 'awaiting', assigned: 'staff-dan', tags: ['entity'], profile: 'entity', done: 0, daysWaiting: 24 },
  { name: 'Abigail Ferreira', email: 'abby.ferreira@gmail.com', phone: '+15125550107', entity: 'individual', filing: 'mfj', stage: 'filed', assigned: 'staff-priya', tags: [], profile: 'w2-simple', done: 1 },
  { name: 'Desmond Oyelaran', email: 'd.oyelaran@yahoo.com', phone: '+15125550195', entity: 'individual', filing: 'single', stage: 'awaiting', assigned: 'staff-dan', tags: [], profile: 'schedule-c', done: 0, smsOptOut: true, daysWaiting: 15 },
  { name: 'Margaret Lindqvist', email: 'meg.lindqvist@fastmail.com', phone: '+15125550122', entity: 'individual', filing: 'qw', stage: 'partial', assigned: 'staff-priya', tags: [], profile: 'retired', done: 0.6, daysWaiting: 9 },
  { name: 'Rafael Montoya', email: 'rafa@montoyabuilds.com', phone: '+15125550148', entity: 'individual', filing: 'mfj', stage: 'partial', assigned: 'staff-dan', tags: [], profile: 'schedule-c', done: 0.35, daysWaiting: 17, lepCode: '001' },
  { name: 'Ingrid Halvorsen', email: 'ingrid.h@icloud.com', phone: '+15125550171', entity: 'individual', filing: 'single', stage: 'not_started', assigned: 'staff-priya', tags: ['new'], profile: 'w2-simple', done: 0 },
  { name: 'Solomon Adeyemi', email: 's.adeyemi@gmail.com', phone: '+15125550183', entity: 'individual', filing: 'mfj', stage: 'ready', assigned: 'staff-dan', tags: [], profile: 'rental', done: 1 },
  { name: 'Beatrice Kowalczyk', email: 'bea.kowalczyk@outlook.com', phone: '+15125550115', entity: 'individual', filing: 'mfj', stage: 'partial', assigned: 'staff-priya', tags: ['high-value'], profile: 'partner', done: 0.45, daysWaiting: 21, lepCode: '009' },
  { name: 'Harrow Creek Trust', email: 'trustee@harrowcreek.org', entity: 'trust', stage: 'awaiting', assigned: 'staff-dan', tags: ['entity'], profile: 'entity', done: 0, daysWaiting: 11 },
  { name: 'Nadia Boulanger', email: 'nadia.b@proton.me', phone: '+15125550139', entity: 'individual', filing: 'single', stage: 'in_review', assigned: 'staff-priya', tags: [], profile: 'w2-investments', done: 1 },
  { name: 'Emmanuel Kwakye', email: 'e.kwakye@gmail.com', phone: '+15125550167', entity: 'individual', filing: 'hoh', stage: 'awaiting', assigned: 'staff-dan', tags: [], profile: 'w2-simple', done: 0, daysWaiting: 27, languageBy: { source: 'preparer', locale: 'ht' } },
  { name: 'Saoirse Ó Braonáin', email: 'saoirse.ob@fastmail.com', phone: '+15125550152', entity: 'individual', filing: 'mfj', stage: 'partial', assigned: 'staff-priya', tags: [], profile: 'rental', done: 0.5, daysWaiting: 14 },
  { name: 'Vikram Chandrasekhar', email: 'vikram.c@outlook.com', phone: '+15125550129', entity: 'individual', filing: 'mfj', stage: 'filed', assigned: 'staff-dan', tags: [], profile: 'partner', done: 1 },
  { name: 'Odalys Restrepo', email: 'odalys.r@yahoo.com', phone: '+15125550144', entity: 'individual', filing: 'single', stage: 'partial', assigned: 'staff-priya', tags: [], profile: 'schedule-c', done: 0.25, daysWaiting: 22, lepCode: '001', languageBy: { source: 'taxpayer', locale: 'es' } },
  { name: 'Bramble Lane Dental PC', email: 'office@bramblelanedental.com', phone: '+15125550158', entity: 's-corp', stage: 'partial', assigned: 'staff-dan', tags: ['entity', 'high-value'], profile: 'entity', done: 0.65, daysWaiting: 5 },
  { name: 'Anneliese Vogt', email: 'a.vogt@icloud.com', phone: '+15125550136', entity: 'individual', filing: 'mfj', stage: 'awaiting', assigned: 'staff-priya', tags: [], profile: 'retired', done: 0, daysWaiting: 33 },
  { name: 'Kofi Mensah', email: 'kofi.mensah@gmail.com', phone: '+15125550191', entity: 'individual', filing: 'single', stage: 'not_started', assigned: 'staff-dan', tags: ['new'], profile: 'w2-simple', done: 0 },
  { name: 'Lucienne Brassard', email: 'l.brassard@proton.me', phone: '+15125550111', entity: 'individual', filing: 'mfj', stage: 'ready', assigned: 'staff-priya', tags: [], profile: 'w2-investments', done: 1 },
  { name: 'Tobias Ferncliffe', email: 'tobias@ferncliffedesign.com', phone: '+15125550174', entity: 'individual', filing: 'single', stage: 'partial', assigned: 'staff-dan', tags: [], profile: 'schedule-c', done: 0.8, daysWaiting: 4 },
  { name: 'Amara Nwachukwu', email: 'amara.n@outlook.com', phone: '+15125550127', entity: 'individual', filing: 'hoh', stage: 'awaiting', assigned: 'staff-priya', tags: [], profile: 'w2-simple', done: 0, daysWaiting: 18 },
  { name: 'Gustav Lindenberg', email: 'g.lindenberg@fastmail.com', phone: '+15125550185', entity: 'individual', filing: 'mfj', stage: 'partial', assigned: 'staff-dan', tags: ['high-value'], profile: 'partner', done: 0.3, daysWaiting: 26 },
  { name: 'Delphine Aubert', email: 'delphine.a@icloud.com', phone: '+15125550162', entity: 'individual', filing: 'single', stage: 'in_review', assigned: 'staff-priya', tags: [], profile: 'rental', done: 1 },
  { name: 'Isaiah Bergen', email: 'isaiah.bergen@gmail.com', phone: '+15125550118', entity: 'individual', filing: 'mfj', stage: 'blocked', assigned: 'staff-dan', tags: ['needs-attention'], profile: 'schedule-c', done: 0.15, daysWaiting: 38 },
  { name: 'Wren & Willow Studio LLC', email: 'hello@wrenwillow.studio', phone: '+15125550146', entity: 'partnership', stage: 'awaiting', assigned: 'staff-priya', tags: ['entity'], profile: 'entity', done: 0, daysWaiting: 13 },
  { name: 'Charlotte Ravensworth', email: 'c.ravensworth@yahoo.com', phone: '+15125550178', entity: 'individual', filing: 'qw', stage: 'partial', assigned: 'staff-dan', tags: [], profile: 'retired', done: 0.55, daysWaiting: 10 },

  // A Texas firm's book is not monolingual. These eight elected a language with
  // the IRS on Schedule LEP (or had one set by the firm), which is the whole
  // point of the feature: nobody had to be asked. Between them they cover every
  // locale TaxFax can write, so the portal and the chase templates are demoed
  // against real data rather than a single token Spanish client.
  { name: 'Nguyễn Thị Hạnh', email: 'hanh.nguyen@fastmail.com', phone: '+15125550203', entity: 'individual', filing: 'mfj', stage: 'partial', assigned: 'staff-priya', tags: [], profile: 'schedule-c', done: 0.4, daysWaiting: 16, lepCode: '003' },
  { name: 'Mei-Ling Hsu', email: 'meiling.hsu@gmail.com', phone: '+15125550217', entity: 'individual', filing: 'single', stage: 'awaiting', assigned: 'staff-dan', tags: [], profile: 'w2-investments', done: 0, daysWaiting: 23, lepCode: '019' },
  { name: 'Liang Xiaoyu', email: 'x.liang@outlook.com', phone: '+15125550224', entity: 'individual', filing: 'mfj', stage: 'partial', assigned: 'staff-dan', tags: ['high-value'], profile: 'partner', done: 0.5, daysWaiting: 7, lepCode: '020' },
  { name: 'Ji-woo Park', email: 'jiwoo.park@proton.me', phone: '+15125550231', entity: 'individual', filing: 'hoh', stage: 'partial', assigned: 'staff-priya', tags: [], profile: 'w2-simple', done: 0.5, daysWaiting: 11, lepCode: '002' },
  { name: 'Fatima Al-Rashid', email: 'f.alrashid@icloud.com', phone: '+15125550248', entity: 'individual', filing: 'mfj', stage: 'awaiting', assigned: 'staff-dan', tags: ['needs-attention'], profile: 'rental', done: 0, daysWaiting: 29, lepCode: '005' },
  { name: 'Joana Ribeiro', email: 'joana.ribeiro@gmail.com', phone: '+15125550255', entity: 'individual', filing: 'single', stage: 'ready', assigned: 'staff-priya', tags: [], profile: 'w2-simple', done: 1, lepCode: '008' },
  { name: 'Dmitri Volkov', email: 'd.volkov@yahoo.com', phone: '+15125550262', entity: 'individual', filing: 'mfj', stage: 'partial', assigned: 'staff-dan', tags: [], profile: 'retired', done: 0.3, daysWaiting: 20, lepCode: '004' },
  { name: 'Maricel Bautista', email: 'maricel.b@fastmail.com', phone: '+15125550279', entity: 'individual', filing: 'hoh', stage: 'in_review', assigned: 'staff-priya', tags: [], profile: 'w2-simple', done: 1, lepCode: '007' },
];

// ── Prior-year profiles ─────────────────────────────────────────────────────

export function priorFor(seed: Seed): PriorYearReturn {
  const p = emptyPriorYear(TAX_YEAR - 1);
  p.confidence = 0.93;
  p.filingStatus = seed.filing;
  p.entityType = seed.entity;
  p.formType = seed.entity === 'individual' ? '1040' : seed.entity === 'partnership' ? '1065' : '1120S';
  p.taxpayerName = seed.name;
  p.dependents = seed.filing === 'hoh' ? 2 : seed.filing === 'mfj' ? 1 : 0;
  p.state = 'TX';

  const employers = ['Acme Robotics', 'Northwind Health', 'Bluebonnet Systems', 'Cardinal Media'];
  const banks = ['Frost Bank', 'Charles Schwab', 'Ally Bank'];

  switch (seed.profile) {
    case 'w2-simple':
      p.lines['1z'] = 78_400;
      p.documentCounts.w2 = 1;
      p.issuers.push({ docTypeId: 'w2', name: employers[0] });
      break;
    case 'w2-investments':
      p.lines['1z'] = 164_200;
      p.lines['2b'] = 2_140;
      p.lines['3b'] = 6_880;
      p.lines['7'] = 18_400;
      p.schedules.push('B', 'D', 'A');
      p.itemized = true;
      p.lines['schA-1'] = 4_200;
      p.lines['schA-14'] = 9_500;
      p.documentCounts.w2 = 2;
      p.documentCounts['1099-int'] = 1;
      p.documentCounts['1099-div'] = 1;
      p.documentCounts['1099-b'] = 1;
      p.documentCounts['1098'] = 1;
      p.issuers.push(
        { docTypeId: 'w2', name: employers[0] },
        { docTypeId: 'w2', name: employers[1] },
        { docTypeId: '1099-int', name: banks[0] },
        { docTypeId: '1099-div', name: banks[1] },
        { docTypeId: '1099-b', name: banks[1] },
        { docTypeId: '1098', name: 'Rocket Mortgage' },
      );
      break;
    case 'schedule-c':
      p.lines['sch1-3'] = 92_600;
      p.lines['26'] = 14_000;
      p.schedules.push('1', 'C', 'SE', '8829', '4562');
      p.documentCounts['1099-nec'] = 3;
      p.documentCounts['1099-k'] = 1;
      p.issuers.push(
        { docTypeId: '1099-nec', name: 'Cardinal Media' },
        { docTypeId: '1099-nec', name: 'Lantern Studios' },
        { docTypeId: '1099-nec', name: 'Harbor Creative' },
        { docTypeId: '1099-k', name: 'Stripe' },
      );
      break;
    case 'rental':
      p.lines['1z'] = 96_000;
      p.lines['sch1-5'] = 31_200;
      p.schedules.push('1', 'E', 'A', '4562');
      p.itemized = true;
      p.lines['schA-14'] = 6_400;
      p.documentCounts.w2 = 1;
      p.documentCounts['rental-summary'] = 2;
      p.documentCounts['1098'] = 2;
      p.documentCounts['property-tax'] = 2;
      p.issuers.push(
        { docTypeId: 'w2', name: employers[2] },
        { docTypeId: '1098', name: 'Frost Bank' },
      );
      break;
    case 'partner':
      p.lines['1z'] = 210_000;
      p.lines['2b'] = 5_600;
      p.lines['3b'] = 12_400;
      p.lines['sch1-5'] = 88_000;
      p.schedules.push('1', 'B', 'D', 'E', 'A');
      p.itemized = true;
      p.lines['schA-14'] = 22_000;
      p.documentCounts.w2 = 1;
      p.documentCounts['k1-1065'] = 2;
      p.documentCounts['k1-1120s'] = 1;
      p.documentCounts['1099-div'] = 1;
      p.documentCounts['1099-b'] = 1;
      p.documentCounts['1098'] = 1;
      p.issuers.push(
        { docTypeId: 'w2', name: employers[3] },
        { docTypeId: 'k1-1065', name: 'Lonestar Ventures LP' },
        { docTypeId: 'k1-1065', name: 'Brazos Real Estate Partners' },
        { docTypeId: 'k1-1120s', name: 'Meridian Advisory Group' },
        { docTypeId: '1099-b', name: 'Fidelity' },
      );
      break;
    case 'retired':
      p.lines['4b'] = 42_000;
      p.lines['6a'] = 38_400;
      p.lines['2b'] = 3_100;
      p.lines['3b'] = 8_900;
      p.schedules.push('B', 'D');
      p.documentCounts['1099-r'] = 2;
      p.documentCounts['ssa-1099'] = 1;
      p.documentCounts['1099-int'] = 2;
      p.documentCounts['1099-div'] = 1;
      p.issuers.push(
        { docTypeId: '1099-int', name: banks[0] },
        { docTypeId: '1099-div', name: banks[2] },
      );
      break;
    case 'entity':
      p.schedules.push('4562');
      p.documentCounts['profit-loss'] = 1;
      p.documentCounts['balance-sheet'] = 1;
      p.documentCounts['payroll-summary'] = 1;
      break;
  }
  return p;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export const slugId = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

export const sortNameOf = (s: Seed) => {
  if (s.entity !== 'individual') return s.name;
  const parts = s.name.split(/\s+/);
  return `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`;
};