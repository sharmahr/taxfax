/**
 * Seeds a realistic firm into the emulator (or, with --live, the real project).
 *
 * The data is deliberately not tidy: some clients are finished, some have never
 * opened the portal, one has a bounced email and one has opted out of SMS.
 * Screenshots and E2E runs are only worth anything against a book of business
 * that looks like February.
 *
 * Two things this deliberately refuses to fake.
 *
 * Documents have bytes. Every `storagePath` used to point at nothing, so the
 * review queue's preview pane — the screen the product is sold on — showed
 * "Preview not available" for the entire demo. Each document is now a real
 * synthetic PDF uploaded to Storage.
 *
 * Confidence is measured, not written. No line here sets a classifier
 * confidence. The generated PDF's text goes through the *real* classifier and
 * whatever it returns is what gets stored, including the state the pipeline's
 * own thresholds would have chosen. Likewise a client's language is not
 * assigned: the Schedule LEP page is printed onto last year's return and the
 * real prior-year parser reads it back off.
 */
import { initializeApp, cert, type AppOptions } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync } from 'node:fs';
import { parseReturnText } from '../functions/src/checklist/parsePriorYearReturn.ts';
import {
  paths,
  DEFAULT_CHASE_SETTINGS,
  canonicalName,
  generateChecklist,
  docType,
  documentPath,
  isLocaleId,
  localeRecord,
  resolveLepCode,
  LEP_LANGUAGES,
  type Classification,
  type Client,
  type ClientLanguage,
  type DocRequest,
  type FirmRole,
  type RequestStatus,
} from '../packages/shared/src/index.ts';
import { CLIENTS, FIRM_ID, TAX_YEAR, priorFor, slugId, sortNameOf, type Seed } from './clients.ts';
import { buildDocument, buildPriorReturn, type Capture } from './documents.ts';

const LIVE = process.argv.includes('--live');

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

/**
 * The legacy `.appspot.com` name, deliberately. It is what the web app resolves
 * to against the emulator, and the Storage emulator only fires the ingest
 * trigger for that bucket — seeding into `.firebasestorage.app` would put the
 * bytes somewhere the preview pane cannot read them.
 */
const BUCKET = 'taxfax-364f6.appspot.com';
const bucket = getStorage().bucket(BUCKET);

// ── Staff ───────────────────────────────────────────────────────────────────

const STAFF: { uid: string; name: string; email: string; role: FirmRole; color: string }[] = [
  { uid: 'staff-ava', name: 'Ava Rowe', email: 'ava@whitfieldrowe.com', role: 'owner', color: '#8B3A2E' },
  { uid: 'staff-marcus', name: 'Marcus Whitfield', email: 'marcus@whitfieldrowe.com', role: 'admin', color: '#2E5B8B' },
  { uid: 'staff-priya', name: 'Priya Raghunathan', email: 'priya@whitfieldrowe.com', role: 'preparer', color: '#3D6B4A' },
  { uid: 'staff-dan', name: 'Dan Okafor', email: 'dan@whitfieldrowe.com', role: 'preparer', color: '#6B4A7A' },
  { uid: 'staff-chen', name: 'Chen Wei', email: 'chen@whitfieldrowe.com', role: 'viewer', color: '#7A5A2E' },
];

const PASSWORD = 'taxfax-demo-2026';

// ── Helpers ─────────────────────────────────────────────────────────────────

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * How each document arrived, drawn from a fixed distribution so the demo is the
 * same on every machine.
 *
 * This is the only thing the seed chooses. It does not choose a confidence: the
 * classifier reads whatever text the chosen capture leaves behind, and the score
 * follows. The weights are what a firm's February actually looks like — most
 * documents arrive clean from a payroll provider or a broker, a steady minority
 * are scans, and a stubborn tail are photographs taken on a phone at the kitchen
 * table, which is exactly the tail the review queue exists for.
 */
const CAPTURE_MIX: Capture[] = [
  ...Array<Capture>(9).fill('efile'),
  ...Array<Capture>(7).fill('portal'),
  ...Array<Capture>(6).fill('scan'),
  ...Array<Capture>(3).fill('fax'),
  ...Array<Capture>(4).fill('photo'),
  ...Array<Capture>(1).fill('photo-dark'),
];

function captureFor(documentId: string, docTypeId: string): Capture {
  // Nobody e-files a driver's licence or a voided cheque; they photograph one
  // and scan the other. Forcing the realistic channel matters more than the mix.
  if (docTypeId === 'photo-id') return hash(documentId) % 3 === 0 ? 'photo-dark' : 'photo';
  if (docTypeId === 'voided-check') return hash(documentId) % 2 === 0 ? 'photo' : 'scan';
  if (docTypeId === 'charitable' || docTypeId === 'mileage-log' || docTypeId === 'closing-statement') {
    const drawn = CAPTURE_MIX[hash(documentId) % CAPTURE_MIX.length];
    return drawn === 'efile' ? 'scan' : drawn;
  }
  // A consolidated brokerage package is how dividends actually arrive.
  if (docTypeId === '1099-div' && hash(documentId) % 3 === 0) return 'consolidated';
  return CAPTURE_MIX[hash(documentId) % CAPTURE_MIX.length];
}

/** The clean end of the mix, for documents that have already cleared review. */
const CLEAN_MIX: Capture[] = ['efile', 'efile', 'efile', 'portal', 'portal', 'scan', 'scan', 'fax'];

/**
 * A document that a preparer already accepted read cleanly — that is *why* it is
 * out of the queue. The awkward captures are the ones still sitting in review,
 * which is the honest reason the queue skews toward low confidence while the
 * book as a whole does not.
 */
function acceptedCapture(documentId: string, docTypeId: string): Capture {
  if (docTypeId === 'photo-id' || docTypeId === 'voided-check') return 'scan';
  if (docTypeId === '1099-div' && hash(documentId) % 3 === 0) return 'consolidated';
  return CLEAN_MIX[hash(documentId) % CLEAN_MIX.length];
}

/**
 * Things taxpayers send that nobody asked for.
 *
 * Every real firm's review queue is half this: a photograph of a licence, a
 * bank statement "in case you need it", a brochure from an insurer. They carry
 * no request, they are why the queue needs a human, and without them the demo's
 * flagship screen has a dozen rows and no argument.
 */
const UNSOLICITED: { docTypeId: string; capture: Capture }[] = [
  { docTypeId: 'photo-id', capture: 'photo' },
  { docTypeId: 'bank-statements', capture: 'photo' },
  { docTypeId: 'medical-expenses', capture: 'fax' },
  { docTypeId: 'charitable', capture: 'photo-dark' },
  { docTypeId: '1099-misc', capture: 'photo' },
  { docTypeId: 'property-tax', capture: 'scan' },
  { docTypeId: 'closing-statement', capture: 'photo' },
  { docTypeId: '1098', capture: 'photo' },
  { docTypeId: 'bank-statements', capture: 'scan' },
  { docTypeId: 'mileage-log', capture: 'photo' },
];

/**
 * Writes the bytes behind a `storagePath`.
 *
 * The `taxfaxProcessed` marker is the same one the rename step sets, and the
 * ingest trigger returns early when it sees it. Without it, uploading 200 seeded
 * PDFs would kick off 200 real classification runs against records that are
 * already final — the seed would be racing the pipeline for its own data.
 *
 * `contentDisposition: inline` is load-bearing, not tidiness. Storage defaults
 * an object with no disposition to `attachment`, and a browser answers that by
 * downloading the file instead of drawing it — so the review queue's `<iframe>`
 * paints a blank white rectangle even though the bytes arrive with a 200 and a
 * `%PDF-` header. The preview pane is the demo; it has to render.
 */
async function upload(path: string, body: Buffer, contentType: string): Promise<void> {
  await bucket.file(path).save(body, {
    resumable: false,
    contentType,
    metadata: {
      contentType,
      contentDisposition: `inline; filename="${path.split('/').pop()}"`,
      metadata: { taxfaxProcessed: '1' },
    },
  });
}

/** Uploads in small waves — 300 sequential round-trips makes a re-seed a coffee break. */
async function uploadAll(files: { path: string; body: Buffer; contentType: string }[]): Promise<void> {
  const WAVE = 8;
  for (let i = 0; i < files.length; i += WAVE) {
    await Promise.all(files.slice(i, i + WAVE).map((f) => upload(f.path, f.body, f.contentType)));
  }
}


async function wipe() {
  const firm = db.doc(paths.firm(FIRM_ID));
  await db.recursiveDelete(firm).catch(() => {});
  for (const s of STAFF) await db.doc(paths.user(s.uid)).delete().catch(() => {});
  // Documents are bytes now, so a re-seed has to clear the bucket too or the
  // previous run's files linger under paths no Firestore record points at.
  await bucket.deleteFiles({ prefix: `firms/${FIRM_ID}/` }).catch(() => {});
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
    // On, explicitly. It defaults to on when absent, but a demo firm that never
    // states it leaves the buyer unable to tell the feature exists at all.
    multilingual: { enabled: true },
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

/**
 * Resolves a client's language the way `generateChecklist` does in production:
 * a Schedule LEP election found on last year's return is evidence, and a human
 * always outranks it.
 *
 * `detectedCode` is what the real parser pulled off the generated PDF, not what
 * the seed list says. An election we recognise but cannot write (Polish, say)
 * still resolves to English — with the election recorded, so the firm is told
 * rather than quietly served English.
 */
function languageFor(seed: Seed, detectedCode: string | undefined): ClientLanguage | undefined {
  const elected = detectedCode ? resolveLepCode(detectedCode) : null;
  const detected: ClientLanguage | undefined =
    elected && elected.kind !== 'unknown'
      ? {
          locale: elected.locale,
          source: 'detected',
          lepCode: elected.code,
          ...(elected.kind === 'unsupported'
            ? { unsupported: { code: elected.code, language: elected.language } }
            : {}),
          updatedAt: daysAgo(60),
        }
      : undefined;

  if (!seed.languageBy) return detected;
  if (!isLocaleId(seed.languageBy.locale)) {
    throw new Error(`${seed.name} is set to “${seed.languageBy.locale}”, which is not a locale we can write.`);
  }
  return {
    locale: seed.languageBy.locale,
    source: seed.languageBy.source,
    ...(detected?.lepCode ? { lepCode: detected.lepCode } : {}),
    ...(detected?.unsupported ? { unsupported: detected.unsupported } : {}),
    updatedAt: daysAgo(21),
  };
}

async function seedClients() {
  const activity: { type: string; summary: string; clientId?: string; at: Date; actor: object }[] = [];
  let totalRequests = 0;
  let totalDocs = 0;
  let totalBytes = 0;
  const confidences: number[] = [];
  const languages: string[] = [];

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
        // The English sentence is for the preparer's console; the key and the
        // evidence behind it are what let the portal say the same thing in the
        // taxpayer's language. Both travel, or the demo's Arabic client reads
        // their checklist in English.
        reasonKey: hit.reasonKey,
        reasonVars: hit.reasonVars,
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

    // Documents for everything received or accepted. Bytes and classification
    // both come from the generator, so what the preview pane shows and what the
    // evidence panel claims are the same document.
    const docs: Record<string, unknown>[] = [];
    const uploads: { path: string; body: Buffer; contentType: string }[] = [];

    for (const r of requests) {
      if (r.status === 'pending' || r.status === 'waived') continue;
      const issuer = r.expectedIssuers?.[0];
      const documentId = `${clientId}-${r.docTypeId}`;
      const built = buildDocument({
        docTypeId: r.docTypeId,
        capture:
          r.status === 'accepted'
            ? acceptedCapture(documentId, r.docTypeId)
            : captureFor(documentId, r.docTypeId),
        clientName: seed.name,
        issuer,
        taxYear: TAX_YEAR,
        seed: documentId,
      });

      // The pipeline names the file after what it decided, not after what was
      // asked for — a document it could not place lands as "Other", and the
      // demo should show that rather than a tidy name nobody would have got.
      const filedAs = built.classification.docTypeId;
      const name = canonicalName({
        clientDisplayName: seed.name,
        taxYear: TAX_YEAR,
        docTypeId: filedAs,
        issuer: built.classification.issuer ?? issuer,
        originalName: built.originalName,
        contentType: built.contentType,
      });
      const storagePath = documentPath(FIRM_ID, TAX_YEAR, clientId, documentId, name);
      uploads.push({ path: storagePath, body: built.pdf, contentType: built.contentType });

      r.documentIds = [documentId];
      docs.push({
        id: documentId,
        firmId: FIRM_ID,
        clientId,
        taxYear: TAX_YEAR,
        storagePath,
        originalName: built.originalName,
        canonicalName: name,
        contentType: built.contentType,
        sizeBytes: built.pdf.length,
        pageCount: built.pageCount,
        // A preparer who accepted the document outranks the classifier; anything
        // still in the queue keeps the state the pipeline's thresholds gave it.
        state: r.status === 'accepted' ? 'accepted' : built.state,
        classification: { ...built.classification, taxYear: TAX_YEAR } satisfies Classification,
        requestId: r.id,
        uploadedBy: 'portal-user',
        uploadedVia: 'portal',
        uploadedAt: r.receivedAt,
        processedAt: r.receivedAt,
        reviewedBy: r.status === 'accepted' ? seed.assigned : undefined,
        reviewedAt: r.acceptedAt,
      });
    }

    // Uploads nobody asked for. These are what actually fills a February review
    // queue, and they are the only documents here with no request behind them.
    if (seed.stage !== 'not_started' && seed.stage !== 'filed') {
      const count = hash(clientId) % 3;
      for (let i = 0; i < count; i++) {
        const pickIdx = (hash(`${clientId}-extra-${i}`) >>> 0) % UNSOLICITED.length;
        const extra = UNSOLICITED[pickIdx];
        const documentId = `${clientId}-unsolicited-${i}`;
        const built = buildDocument({
          docTypeId: extra.docTypeId,
          capture: extra.capture,
          clientName: seed.name,
          taxYear: TAX_YEAR,
          seed: documentId,
        });
        const name = canonicalName({
          clientDisplayName: seed.name,
          taxYear: TAX_YEAR,
          docTypeId: built.classification.docTypeId,
          issuer: built.classification.issuer,
          originalName: built.originalName,
          contentType: built.contentType,
        });
        const storagePath = documentPath(FIRM_ID, TAX_YEAR, clientId, documentId, name);
        uploads.push({ path: storagePath, body: built.pdf, contentType: built.contentType });
        docs.push({
          id: documentId,
          firmId: FIRM_ID,
          clientId,
          taxYear: TAX_YEAR,
          storagePath,
          originalName: built.originalName,
          canonicalName: name,
          contentType: built.contentType,
          sizeBytes: built.pdf.length,
          pageCount: built.pageCount,
          state: built.state,
          classification: { ...built.classification, taxYear: TAX_YEAR } satisfies Classification,
          uploadedBy: 'portal-user',
          uploadedVia: 'portal',
          uploadedAt: daysAgo(Math.max(1, (seed.daysWaiting ?? 12) - i - 1)),
          processedAt: daysAgo(Math.max(1, (seed.daysWaiting ?? 12) - i - 1)),
        });
      }
    }

    // Last year's return: the evidence behind every checklist on the account,
    // and — for the clients who elected one — where their language comes from.
    const elected = seed.lepCode
      ? LEP_LANGUAGES.find((l) => l.code === seed.lepCode)
      : undefined;
    const priorDocId = `${clientId}-prior-return`;
    const priorReturn = buildPriorReturn({
      clientName: seed.name,
      taxYear: TAX_YEAR - 1,
      formType: prior.formType as '1040' | '1065' | '1120S',
      filingStatus: seed.filing,
      lepCode: elected?.code,
      lepLanguage: elected?.language,
      seed: priorDocId,
    });
    const priorName = canonicalName({
      clientDisplayName: seed.name,
      taxYear: TAX_YEAR - 1,
      docTypeId: 'prior-return',
      originalName: priorReturn.originalName,
      contentType: priorReturn.contentType,
    });
    const priorPath = documentPath(FIRM_ID, TAX_YEAR, clientId, priorDocId, priorName);
    uploads.push({ path: priorPath, body: priorReturn.pdf, contentType: priorReturn.contentType });
    docs.push({
      id: priorDocId,
      firmId: FIRM_ID,
      clientId,
      taxYear: TAX_YEAR,
      storagePath: priorPath,
      originalName: priorReturn.originalName,
      canonicalName: priorName,
      contentType: priorReturn.contentType,
      sizeBytes: priorReturn.pdf.length,
      pageCount: priorReturn.pageCount,
      state: 'accepted',
      classification: { ...priorReturn.classification, taxYear: TAX_YEAR - 1 } satisfies Classification,
      uploadedBy: seed.assigned,
      uploadedVia: 'staff',
      uploadedAt: started,
      processedAt: started,
      reviewedBy: seed.assigned,
      reviewedAt: started,
    });

    // Read the election back off the generated PDF rather than trusting the seed
    // list. If the parser ever stops finding a code the demo goes English, which
    // is the truthful outcome — not a language nothing on file supports.
    const language = languageFor(seed, parseReturnText(priorReturn.text.split('\f')).lepCode);

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
      language,
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

    // Firestore first, bytes second. `onDocumentUploaded` skips an object whose
    // record is already final, so writing the record ahead of the upload is a
    // second belt alongside the `taxfaxProcessed` marker.
    await uploadAll(uploads);
    totalRequests += requests.length;
    totalDocs += docs.length;
    totalBytes += uploads.reduce((n, u) => n + u.body.length, 0);
    for (const d of docs) confidences.push((d.classification as Classification).confidence);
    if (language) languages.push(`${language.locale} (${language.source})`);

    if (seed.stage !== 'not_started') {
      activity.push({
        type: 'checklist_generated',
        clientId,
        summary: `${staffName} generated a ${requests.length}-item checklist for ${seed.name} from their ${TAX_YEAR - 1} return`,
        at: started,
        actor: { uid: seed.assigned, name: staffName, kind: 'staff' },
      });
    }
    if (language?.lepCode) {
      const outcome = resolveLepCode(language.lepCode);
      const inUse = localeRecord(language.locale).englishName;
      activity.push({
        type: 'language_detected',
        clientId,
        summary:
          outcome.kind === 'unsupported'
            ? `${seed.name} elected ${outcome.language} on their ${TAX_YEAR - 1} Schedule LEP. TaxFax can't write ${outcome.language} yet, so their messages stay in English.`
            : outcome.kind === 'supported' && language.locale === outcome.locale
              ? `${seed.name} elected ${outcome.language} on their ${TAX_YEAR - 1} Schedule LEP — their messages will go out in ${outcome.language}.`
              : `${seed.name} elected ${outcome.language} on their ${TAX_YEAR - 1} Schedule LEP, but you have them set to ${inUse}. Your setting stands.`,
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

  return {
    totalRequests,
    totalDocs,
    totalBytes,
    activity: Math.min(activity.length, 200),
    confidences,
    languages,
  };
}

/** A one-line histogram, so a re-seed says out loud what it just claimed. */
function histogram(values: number[]): string {
  const bands: [string, (v: number) => boolean][] = [
    ['0.95–1.00  near-certain', (v) => v >= 0.95],
    ['0.82–0.95  auto-filed  ', (v) => v >= 0.82 && v < 0.95],
    ['0.45–0.82  needs review', (v) => v >= 0.45 && v < 0.82],
    ['0.00–0.45  filed as Other', (v) => v < 0.45],
  ];
  const width = 34;
  return bands
    .map(([label, test]) => {
      const n = values.filter(test).length;
      const bar = '█'.repeat(Math.round((n / Math.max(1, values.length)) * width));
      return `    ${label}  ${String(n).padStart(3)}  ${bar}`;
    })
    .join('\n');
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
  Documents  ${stats.totalDocs}  (${(stats.totalBytes / 1e6).toFixed(1)} MB of PDFs in Storage)
  Activity   ${stats.activity}

  Classifier confidence, as measured on the seeded bytes — nothing here is set
  by hand; ${new Set(stats.confidences).size} distinct values across ${stats.confidences.length} documents:
${histogram(stats.confidences)}

  Languages  ${stats.languages.length} of ${CLIENTS.length} clients — ${[...new Set(stats.languages)].sort().join(', ')}

  Sign in    ava@whitfieldrowe.com / ${PASSWORD}
  Portal     ${CLIENTS[0].email} / ${PASSWORD}
`);
process.exit(0);
