/**
 * `acceptDocument` — the moment a preparer signs a document off, and the only
 * moment a checklist line is allowed to go terminal.
 *
 * The whole product promise is "we know what is still missing", so `accepted`
 * on a request is a promise that nothing on that line is outstanding. A client
 * who owes two W-2s must not have the line closed by the first one: the chase
 * stops, the roster reads 100%, and the return gets prepared against income
 * nobody ever sent. That failure is silent and it looks like success, which is
 * what makes it the worst one this product has.
 *
 * The count, not the sign-off, is what answers "is this line done" — the same
 * test `requestSatisfied` applies on the taxpayer's portal, asserted here
 * against the real callable so the server and the portal cannot disagree.
 *
 * Needs the Auth, Firestore and Functions emulators. Hermetic run (starts and
 * tears down its own emulators):
 *
 *   firebase emulators:exec --only auth,firestore,functions \
 *     "node --experimental-strip-types --test functions/src/ingest/pipeline.test.ts"
 *
 * Against already-running emulators on the standard ports:
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *     node --experimental-strip-types --test functions/src/ingest/pipeline.test.ts
 *
 * It never wipes the emulators — only its own firm — so it is safe to run
 * beside a seeded demo.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { requestSatisfied, type DocRequest } from '../../../packages/shared/src/index.ts';

const PROJECT = process.env.GCLOUD_PROJECT ?? 'taxfax-364f6';
const REGION = 'us-central1';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1:5001';
const FN_BASE = `http://${FN_HOST}/${PROJECT}/${REGION}`;

const FIRM = 'ingest-accept-firm';
const CLIENT = 'ingest-accept-client';
const BASE = `firms/${FIRM}/clients/${CLIENT}`;
const REQUEST = 'w2';

let db: Firestore;
let auth: Auth;
let preparerToken: string;

async function call(name: string, token: string, data: unknown) {
  const res = await fetch(`${FN_BASE}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    result?: unknown;
    error?: { message?: string };
  };
  return { status: res.status, result: body.result, error: body.error };
}

/** Two W-2s asked for, `arrived` of them uploaded and awaiting review. */
async function seedTwoW2Request(arrived: string[]): Promise<void> {
  await db.doc(`${BASE}/requests/${REQUEST}`).set({
    id: REQUEST,
    firmId: FIRM,
    clientId: CLIENT,
    taxYear: 2025,
    docTypeId: 'w2',
    reason: 'You had 2 W-2s last year, from Acme Corp and Northwind LLC.',
    source: 'prior_year',
    priority: 'critical',
    expectedCount: 2,
    expectedIssuers: ['Acme Corp', 'Northwind LLC'],
    status: 'received',
    documentIds: arrived,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    receivedAt: new Date(),
  });
  for (const id of arrived) {
    await db.doc(`${BASE}/documents/${id}`).set({
      id,
      firmId: FIRM,
      clientId: CLIENT,
      taxYear: 2025,
      storagePath: `firms/${FIRM}/2025/${CLIENT}/${id}/w2.pdf`,
      originalName: `${id}.pdf`,
      contentType: 'application/pdf',
      sizeBytes: 51_200,
      state: 'classified',
      classification: { docTypeId: 'w2', confidence: 0.96, evidence: [], alternates: [], method: 'text' },
      requestId: REQUEST,
      uploadedBy: 'portal-user',
      uploadedVia: 'portal',
      uploadedAt: new Date(),
    });
  }
}

async function readRequest(): Promise<DocRequest> {
  const snap = await db.doc(`${BASE}/requests/${REQUEST}`).get();
  assert.ok(snap.exists, 'The request vanished — the rest of this test proves nothing.');
  return snap.data() as DocRequest;
}

before(async () => {
  assert.ok(
    process.env.FIRESTORE_EMULATOR_HOST,
    'FIRESTORE_EMULATOR_HOST is unset — refusing to write test checklists into a real Firestore.',
  );
  assert.ok(
    process.env.FIREBASE_AUTH_EMULATOR_HOST,
    'FIREBASE_AUTH_EMULATOR_HOST is unset — refusing to mint users against a real Auth project.',
  );

  const app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  auth = getAuth(app);

  // Only this firm, never the whole emulator: a seeded demo may be live beside us.
  await db.recursiveDelete(db.doc(`firms/${FIRM}`));

  const uid = `${FIRM}-preparer`;
  await auth.deleteUser(uid).catch(() => undefined);
  await auth.createUser({ uid, email: 'sam.preparer@ingest.test', emailVerified: true, displayName: 'Sam Preparer' });
  await auth.setCustomUserClaims(uid, { firms: { [FIRM]: 'preparer' } });
  const customToken = await auth.createCustomToken(uid);
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const body = (await res.json()) as { idToken?: string };
  assert.ok(body.idToken, `Auth emulator returned no ID token: ${JSON.stringify(body)}`);
  preparerToken = body.idToken;
});

after(async () => {
  await db.recursiveDelete(db.doc(`firms/${FIRM}`)).catch(() => undefined);
  await auth.deleteUser(`${FIRM}-preparer`).catch(() => undefined);
});

describe('acceptDocument — a line closes on the count, not on the first signature', () => {
  it('leaves a two-W-2 request open when only the first has been accepted', async () => {
    await seedTwoW2Request(['w2-acme']);

    const accepted = await call('acceptDocument', preparerToken, {
      firmId: FIRM,
      clientId: CLIENT,
      documentId: 'w2-acme',
    });
    assert.equal(accepted.status, 200, `acceptDocument failed (${accepted.error?.message}).`);

    const request = await readRequest();
    assert.notEqual(
      request.status,
      'accepted',
      `Request closed on 1 of ${request.expectedCount} documents (status "${request.status}") — ` +
        'the chase stops, the roster reads done, and the firm files a return missing a W-2.',
    );
    assert.equal(
      request.status,
      'received',
      `Expected the line to stay in review while a W-2 is still outstanding, got "${request.status}".`,
    );
    assert.equal(
      request.acceptedAt,
      undefined,
      'acceptedAt was stamped on a line that is still collecting — every "finished on" report inherits the lie.',
    );
    assert.equal(
      requestSatisfied(request),
      false,
      'The server and the portal disagree: the portal still shows this line as outstanding.',
    );
  });

  it('closes it once the second W-2 is accepted too', async () => {
    // The positive control. Without it, a guard that refused to ever write
    // `accepted` would pass the case above and quietly break every checklist.
    await seedTwoW2Request(['w2-acme', 'w2-northwind']);

    for (const documentId of ['w2-acme', 'w2-northwind']) {
      const res = await call('acceptDocument', preparerToken, { firmId: FIRM, clientId: CLIENT, documentId });
      assert.equal(res.status, 200, `acceptDocument failed for ${documentId} (${res.error?.message}).`);
    }

    const request = await readRequest();
    assert.equal(
      request.status,
      'accepted',
      `Both W-2s are in and signed off, yet the line reads "${request.status}" — ` +
        'a client who has sent everything would be chased forever.',
    );
    assert.ok(request.acceptedAt, 'A closed line carries no acceptedAt — the audit trail loses when it was finished.');
    assert.equal(
      requestSatisfied(request),
      true,
      'The server closed the line but the portal still shows it as outstanding.',
    );
  });

  it('closes a single-document request on its one and only signature', async () => {
    // The other positive control: the common case is one document, one accept,
    // and it must still go terminal immediately.
    await db.doc(`${BASE}/requests/engagement-letter`).set({
      id: 'engagement-letter',
      firmId: FIRM,
      clientId: CLIENT,
      taxYear: 2025,
      docTypeId: 'engagement-letter',
      reason: 'We need this signed before we can start.',
      source: 'prior_year',
      priority: 'critical',
      expectedCount: 1,
      status: 'received',
      documentIds: ['engagement-1'],
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.doc(`${BASE}/documents/engagement-1`).set({
      id: 'engagement-1',
      firmId: FIRM,
      clientId: CLIENT,
      taxYear: 2025,
      storagePath: `firms/${FIRM}/2025/${CLIENT}/engagement-1/letter.pdf`,
      originalName: 'letter.pdf',
      contentType: 'application/pdf',
      sizeBytes: 12_000,
      state: 'classified',
      requestId: 'engagement-letter',
      uploadedBy: 'portal-user',
      uploadedVia: 'portal',
      uploadedAt: new Date(),
    });

    const res = await call('acceptDocument', preparerToken, {
      firmId: FIRM,
      clientId: CLIENT,
      documentId: 'engagement-1',
    });
    assert.equal(res.status, 200, `acceptDocument failed (${res.error?.message}).`);

    const snap = await db.doc(`${BASE}/requests/engagement-letter`).get();
    assert.equal(
      (snap.data() as DocRequest).status,
      'accepted',
      'A one-document line did not close on its only signature — every checklist would stay open forever.',
    );
  });

  it('counts a document the preparer accepts after rejecting it', async () => {
    // `rejectDocument` pulls the id back out of `documentIds`. If accepting it
    // again did not put it back, the line would be short by one for good and
    // the taxpayer would be chased for a document the firm has in hand.
    await seedTwoW2Request(['w2-acme', 'w2-northwind']);
    const rejected = await call('rejectDocument', preparerToken, {
      firmId: FIRM,
      clientId: CLIENT,
      documentId: 'w2-northwind',
      reason: 'Page 2 is cut off.',
    });
    assert.equal(rejected.status, 200, `rejectDocument failed (${rejected.error?.message}).`);
    assert.deepEqual(
      (await readRequest()).documentIds,
      ['w2-acme'],
      'Rejecting did not detach the document — the premise of this test no longer holds.',
    );

    for (const documentId of ['w2-acme', 'w2-northwind']) {
      const res = await call('acceptDocument', preparerToken, { firmId: FIRM, clientId: CLIENT, documentId });
      assert.equal(res.status, 200, `acceptDocument failed for ${documentId} (${res.error?.message}).`);
    }

    const request = await readRequest();
    assert.deepEqual(
      [...request.documentIds].sort(),
      ['w2-acme', 'w2-northwind'],
      'An accepted document is missing from the line it satisfies — the count can never be met again.',
    );
    assert.equal(
      request.status,
      'accepted',
      `A re-accepted W-2 left the line at "${request.status}" — the client is chased for what the firm already has.`,
    );
  });
});
