/**
 * Seeds a realistic firm into the emulator (or, with --live, the real project).
 *
 * The data is deliberately not tidy: some clients are finished, some have never
 * opened the portal, one has a bounced email and one has opted out of SMS.
 * Screenshots and E2E runs are only worth anything against a book of business
 * that looks like February.
 */
import { initializeApp, cert, type AppOptions } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { readFileSync } from 'node:fs';
import {
  paths,
  DEFAULT_CHASE_SETTINGS,
  generateChecklist,
  emptyPriorYear,
  docType,
  canonicalName,
  documentPath,
  type Client,
  type ClientStage,
  type DocRequest,
  type EntityType,
  type FilingStatus,
  type FirmRole,
  type PriorYearReturn,
  type RequestStatus,
} from '../packages/shared/src/index.ts';

const LIVE = process.argv.includes('--live');
const TAX_YEAR = 2025;
const FIRM_ID = 'whitfield-rowe';

if (!LIVE) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= '127.0.0.1:9199';
}

const options: AppOptions = { projectId: 'taxfax-364f6' };
if (LIVE) {
  const keyPath = new URL(
    '../.env/taxfax-364f6-firebase-adminsdk-fbsvc-17ef6ed1ff.json',
    import.meta.url,
  );
  options.credential = cert(JSON.parse(readFileSync(keyPath, 'utf8')));
}

initializeApp(options);
const db: Firestore = getFirestore();
const auth: Auth = getAuth();
db.settings({ ignoreUndefinedProperties: true });

// ── Staff ───────────────────────────────────────────────────────────────────

const STAFF: { uid: string; name: string; email: string; role: FirmRole; color: string }[] = [
  { uid: 'staff-ava', name: 'Ava Rowe', email: 'ava@whitfieldrowe.com', role: 'owner', color: '#8B3A2E' },
  { uid: 'staff-marcus', name: 'Marcus Whitfield', email: 'marcus@whitfieldrowe.com', role: 'admin', color: '#2E5B8B' },
  { uid: 'staff-priya', name: 'Priya Raghunathan', email: 'priya@whitfieldrowe.com', role: 'preparer', color: '#3D6B4A' },
  { uid: 'staff-dan', name: 'Dan Okafor', email: 'dan@whitfieldrowe.com', role: 'preparer', color: '#6B4A7A' },
  { uid: 'staff-chen', name: 'Chen Wei', email: 'chen@whitfieldrowe.com', role: 'viewer', color: '#7A5A2E' },
];

const PASSWORD = 'taxfax-demo-2026';

// ── Clients ─────────────────────────────────────────────────────────────────

interface Seed {
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
}

const CLIENTS: Seed[] = [
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
  { name: 'Rafael Montoya', email: 'rafa@montoyabuilds.com', phone: '+15125550148', entity: 'individual', filing: 'mfj', stage: 'partial', assigned: 'staff-dan', tags: [], profile: 'schedule-c', done: 0.35, daysWaiting: 17 },
  { name: 'Ingrid Halvorsen', email: 'ingrid.h@icloud.com', phone: '+15125550171', entity: 'individual', filing: 'single', stage: 'not_started', assigned: 'staff-priya', tags: ['new'], profile: 'w2-simple', done: 0 },
  { name: 'Solomon Adeyemi', email: 's.adeyemi@gmail.com', phone: '+15125550183', entity: 'individual', filing: 'mfj', stage: 'ready', assigned: 'staff-dan', tags: [], profile: 'rental', done: 1 },
  { name: 'Beatrice Kowalczyk', email: 'bea.kowalczyk@outlook.com', phone: '+15125550115', entity: 'individual', filing: 'mfj', stage: 'partial', assigned: 'staff-priya', tags: ['high-value'], profile: 'partner', done: 0.45, daysWaiting: 21 },
  { name: 'Harrow Creek Trust', email: 'trustee@harrowcreek.org', entity: 'trust', stage: 'awaiting', assigned: 'staff-dan', tags: ['entity'], profile: 'entity', done: 0, daysWaiting: 11 },
  { name: 'Nadia Boulanger', email: 'nadia.b@proton.me', phone: '+15125550139', entity: 'individual', filing: 'single', stage: 'in_review', assigned: 'staff-priya', tags: [], profile: 'w2-investments', done: 1 },
  { name: 'Emmanuel Kwakye', email: 'e.kwakye@gmail.com', phone: '+15125550167', entity: 'individual', filing: 'hoh', stage: 'awaiting', assigned: 'staff-dan', tags: [], profile: 'w2-simple', done: 0, daysWaiting: 27 },
  { name: 'Saoirse Ó Braonáin', email: 'saoirse.ob@fastmail.com', phone: '+15125550152', entity: 'individual', filing: 'mfj', stage: 'partial', assigned: 'staff-priya', tags: [], profile: 'rental', done: 0.5, daysWaiting: 14 },
  { name: 'Vikram Chandrasekhar', email: 'vikram.c@outlook.com', phone: '+15125550129', entity: 'individual', filing: 'mfj', stage: 'filed', assigned: 'staff-dan', tags: [], profile: 'partner', done: 1 },
  { name: 'Odalys Restrepo', email: 'odalys.r@yahoo.com', phone: '+15125550144', entity: 'individual', filing: 'single', stage: 'partial', assigned: 'staff-priya', tags: [], profile: 'schedule-c', done: 0.25, daysWaiting: 22 },
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
];

// ── Prior-year profiles ─────────────────────────────────────────────────────

function priorFor(seed: Seed): PriorYearReturn {
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

const slugId = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);
const sortNameOf = (s: Seed) => {
  if (s.entity !== 'individual') return s.name;
  const parts = s.name.split(/\s+/);
  return `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`;
};

async function wipe() {
  const firm = db.doc(paths.firm(FIRM_ID));
  await db.recursiveDelete(firm).catch(() => {});
  for (const s of STAFF) await db.doc(paths.user(s.uid)).delete().catch(() => {});
}

async function seedAuth() {
  for (const s of STAFF) {
    await auth.deleteUser(s.uid).catch(() => {});
    await auth.createUser({
      uid: s.uid,
      email: s.email,
      emailVerified: true,
      password: PASSWORD,
      displayName: s.name,
    });
    await auth.setCustomUserClaims(s.uid, { firms: { [FIRM_ID]: s.role } });
  }

  // One taxpayer, so the portal can be driven end to end.
  const portalUid = 'portal-eleanor';
  await auth.deleteUser(portalUid).catch(() => {});
  await auth.createUser({
    uid: portalUid,
    email: CLIENTS[0].email,
    emailVerified: true,
    password: PASSWORD,
    displayName: CLIENTS[0].name,
  });
  await auth.setCustomUserClaims(portalUid, {
    portal: { firmId: FIRM_ID, clientId: slugId(CLIENTS[0].name) },
  });
  return portalUid;
}

async function seedFirm(portalUid: string) {
  const now = new Date();

  await db.doc(paths.firm(FIRM_ID)).set({
    id: FIRM_ID,
    name: 'Whitfield & Rowe',
    slug: 'whitfield-rowe',
    createdAt: daysAgo(430),
    createdBy: 'staff-ava',
    taxYear: TAX_YEAR,
    timezone: 'America/Chicago',
    branding: {
      displayName: 'Whitfield & Rowe CPAs',
      accent: '#8B3A2E',
      replyToEmail: 'documents@whitfieldrowe.com',
      supportPhone: '+15125550100',
    },
    chase: { ...DEFAULT_CHASE_SETTINGS, signature: 'Ava Rowe\nWhitfield & Rowe CPAs' },
    seats: 12,
    plan: 'firm',
    onboarding: { completedSteps: ['firm', 'import', 'sending', 'staff'], dismissed: true },
  });

  for (const s of STAFF) {
    await db.doc(paths.member(FIRM_ID, s.uid)).set({
      uid: s.uid,
      firmId: FIRM_ID,
      email: s.email,
      name: s.name,
      role: s.role,
      avatarColor: s.color,
      joinedAt: daysAgo(400),
      lastSeenAt: now,
      status: 'active',
    });
    await db.doc(paths.user(s.uid)).set({
      uid: s.uid,
      email: s.email,
      name: s.name,
      firmIds: [FIRM_ID],
      defaultFirmId: FIRM_ID,
    });
  }

  await db.doc(paths.user(portalUid)).set({
    uid: portalUid,
    email: CLIENTS[0].email,
    name: CLIENTS[0].name,
    firmIds: [],
    portalAccess: [{ firmId: FIRM_ID, clientId: slugId(CLIENTS[0].name) }],
  });
}

async function seedClients() {
  const activity: { type: string; summary: string; clientId?: string; at: Date; actor: object }[] = [];
  let totalRequests = 0;
  let totalDocs = 0;

  for (const seed of CLIENTS) {
    const clientId = slugId(seed.name);
    const prior = priorFor(seed);
    const hits = generateChecklist({ prior, taxYear: TAX_YEAR });

    const started = daysAgo(seed.daysWaiting ?? 40);
    const staffName = STAFF.find((s) => s.uid === seed.assigned)!.name.split(' ')[0];

    // Requests
    const requests: DocRequest[] = [];
    let order = 0;
    const targetAccepted = Math.round(hits.length * seed.done);

    for (const hit of hits) {
      const idx = order++;
      let status: RequestStatus = 'pending';
      if (idx < targetAccepted) status = 'accepted';
      else if (idx === targetAccepted && seed.done > 0 && seed.done < 1) status = 'received';

      requests.push({
        id: hit.docTypeId,
        firmId: FIRM_ID,
        clientId,
        taxYear: TAX_YEAR,
        docTypeId: hit.docTypeId,
        reason: hit.reason,
        source: 'prior_year',
        priority: hit.priority,
        expectedCount: hit.quantity,
        expectedIssuers: hit.issuers.length ? hit.issuers : undefined,
        status,
        documentIds: [],
        dueDate: daysAhead(hit.priority === 'critical' ? 24 : 38),
        order: idx,
        createdAt: started,
        updatedAt: status === 'pending' ? started : daysAgo(Math.max(1, (seed.daysWaiting ?? 20) - idx)),
        receivedAt: status !== 'pending' ? daysAgo(Math.max(1, (seed.daysWaiting ?? 20) - idx)) : undefined,
        acceptedAt: status === 'accepted' ? daysAgo(Math.max(1, (seed.daysWaiting ?? 20) - idx)) : undefined,
      } as DocRequest);
    }

    // Documents for everything received or accepted
    const docs: Record<string, unknown>[] = [];
    for (const r of requests) {
      if (r.status === 'pending' || r.status === 'waived') continue;
      const issuer = r.expectedIssuers?.[0];
      const documentId = `${clientId}-${r.docTypeId}`;
      const name = canonicalName({
        clientDisplayName: seed.name,
        taxYear: TAX_YEAR,
        docTypeId: r.docTypeId,
        issuer,
        originalName: 'IMG_4821.HEIC',
        contentType: 'application/pdf',
      });
      r.documentIds = [documentId];
      docs.push({
        id: documentId,
        firmId: FIRM_ID,
        clientId,
        taxYear: TAX_YEAR,
        storagePath: documentPath(FIRM_ID, TAX_YEAR, clientId, documentId, name),
        originalName: `IMG_${4000 + docs.length}.HEIC`,
        canonicalName: name,
        contentType: 'application/pdf',
        sizeBytes: 240_000 + docs.length * 11_000,
        pageCount: r.docTypeId === '1099-b' ? 34 : 1,
        state: r.status === 'accepted' ? 'accepted' : 'classified',
        classification: {
          docTypeId: r.docTypeId,
          confidence: 0.94,
          issuer,
          taxYear: TAX_YEAR,
          evidence: [`Matched form title “${docType(r.docTypeId).label}” on page 1`],
          alternates: [],
          method: 'text',
        },
        requestId: r.id,
        uploadedBy: 'portal-user',
        uploadedVia: 'portal',
        uploadedAt: r.receivedAt,
        processedAt: r.receivedAt,
        reviewedBy: r.status === 'accepted' ? seed.assigned : undefined,
        reviewedAt: r.acceptedAt,
      });
    }

    const accepted = requests.filter((r) => r.status === 'accepted').length;
    const received = requests.filter((r) => r.status === 'received' || r.status === 'accepted').length;
    const overdue =
      seed.stage === 'blocked' || (seed.daysWaiting ?? 0) > 25
        ? requests.filter((r) => r.status === 'pending' && r.priority === 'critical').length
        : 0;

    const chaseStep = Math.min(4, Math.floor((seed.daysWaiting ?? 0) / 6));

    const client: Client = {
      id: clientId,
      firmId: FIRM_ID,
      taxYear: TAX_YEAR,
      displayName: seed.name,
      sortName: sortNameOf(seed),
      entityType: seed.entity,
      filingStatus: seed.filing,
      primaryContact: {
        name: seed.name,
        email: seed.email,
        phone: seed.phone,
        smsOptOut: seed.smsOptOut,
      },
      assignedTo: seed.assigned,
      tags: seed.tags,
      stage: seed.stage,
      progress: {
        total: requests.length,
        received,
        accepted,
        rejected: 0,
        overdue,
        percent: requests.length ? Math.round((accepted / requests.length) * 100) : 0,
        lastActivityAt: received ? daysAgo(Math.max(1, (seed.daysWaiting ?? 20) - 2)) : undefined,
        firstRequestedAt: seed.stage === 'not_started' ? undefined : started,
        completedAt: seed.done === 1 ? daysAgo(2) : undefined,
      },
      priorYear: {
        sourceDocumentId: `${clientId}-prior-return`,
        taxYear: TAX_YEAR - 1,
        parsedAt: started,
        confidence: prior.confidence,
      },
      chase: {
        status:
          seed.stage === 'not_started'
            ? 'idle'
            : seed.done === 1 || seed.stage === 'filed' || seed.stage === 'in_review'
              ? 'complete'
              : seed.stage === 'blocked'
                ? 'escalated'
                : 'active',
        stepIndex: chaseStep,
        startedAt: seed.stage === 'not_started' ? undefined : started,
        lastSentAt: seed.stage === 'not_started' ? undefined : daysAgo(Math.max(1, (seed.daysWaiting ?? 10) % 6)),
        nextDueAt: new Date(Date.now() + 86_400_000 * (1 + (chaseStep % 4))),
        sentCount: chaseStep + 1,
        lastOpenedAt: seed.done > 0 ? daysAgo(3) : undefined,
        pausedReason: seed.emailBounced ? 'Email bounced — address needs updating' : undefined,
      },
      createdAt: daysAgo(420),
      updatedAt: new Date(),
    };

    const clientRef = db.doc(paths.client(FIRM_ID, clientId));
    await clientRef.set(client);

    let batch = db.batch();
    let n = 0;
    for (const r of requests) {
      batch.set(db.doc(paths.request(FIRM_ID, clientId, r.id)), r);
      if (++n % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    for (const d of docs) {
      batch.set(db.doc(paths.document(FIRM_ID, clientId, d.id as string)), d);
      if (++n % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    await batch.commit();

    totalRequests += requests.length;
    totalDocs += docs.length;

    if (seed.stage !== 'not_started') {
      activity.push({
        type: 'checklist_generated',
        clientId,
        summary: `${staffName} generated a ${requests.length}-item checklist for ${seed.name} from their ${TAX_YEAR - 1} return`,
        at: started,
        actor: { uid: seed.assigned, name: staffName, kind: 'staff' },
      });
    }
    if (docs.length) {
      const last = docs[docs.length - 1];
      activity.push({
        type: 'document_classified',
        clientId,
        summary: `${seed.name} uploaded ${docType((last.classification as { docTypeId: string }).docTypeId).code} — filed as ${last.canonicalName}`,
        at: daysAgo(Math.max(1, (seed.daysWaiting ?? 20) - 2)),
        actor: { name: seed.name, kind: 'client' },
      });
    }
    if (client.chase.status === 'active') {
      activity.push({
        type: 'chase_sent',
        clientId,
        summary: `Reminder ${chaseStep + 1} sent to ${seed.name} — ${requests.length - received} documents outstanding`,
        at: client.chase.lastSentAt as Date,
        actor: { name: 'TaxFax', kind: 'system' },
      });
    }
  }

  activity.sort((a, b) => b.at.getTime() - a.at.getTime());
  let batch = db.batch();
  let n = 0;
  for (const a of activity.slice(0, 200)) {
    const ref = db.collection(paths.activity(FIRM_ID)).doc();
    batch.set(ref, { id: ref.id, firmId: FIRM_ID, ...a });
    if (++n % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  await batch.commit();

  return { totalRequests, totalDocs, activity: Math.min(activity.length, 200) };
}

// ── Run ─────────────────────────────────────────────────────────────────────

console.log(`Seeding ${LIVE ? 'LIVE project' : 'emulator'} · taxfax-364f6`);
await wipe();
const portalUid = await seedAuth();
await seedFirm(portalUid);
const stats = await seedClients();

console.log(`
  Firm       Whitfield & Rowe (${FIRM_ID})
  Staff      ${STAFF.length}
  Clients    ${CLIENTS.length}
  Requests   ${stats.totalRequests}
  Documents  ${stats.totalDocs}
  Activity   ${stats.activity}

  Sign in    ava@whitfieldrowe.com / ${PASSWORD}
  Portal     ${CLIENTS[0].email} / ${PASSWORD}
`);
process.exit(0);
