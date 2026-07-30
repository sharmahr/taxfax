/**
 * `retractDocument` — the taxpayer withdrawing a file they sent by mistake.
 *
 * This is a portal-facing callable, which makes it one of the few places an
 * unauthenticated-ish, low-trust actor can mutate firm data. The tests that
 * matter here are the ones that prove it cannot be turned into a lever:
 *   - a portal user can only ever touch their own client's documents
 *   - they cannot retract something the firm added on their behalf
 *   - they cannot retract something a preparer has already accepted
 *   - retraction reopens the checklist request rather than leaving it "received"
 *   - the Storage object is never deleted, so the firm keeps the full record
 *
 * Needs the Auth, Firestore and Functions emulators. Hermetic run:
 *
 *   firebase emulators:exec --only auth,firestore,functions \
 *     "node --experimental-strip-types --test functions/src/firm/portal.test.ts"
 */
import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

const PROJECT = process.env.GCLOUD_PROJECT ?? 'taxfax-364f6';
const REGION = 'us-central1';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1:5001';
const FN_BASE = `http://${FN_HOST}/${PROJECT}/${REGION}`;

const FIRM = 'portal-test-firm';
const CLIENT = 'portal-test-client';
const OTHER_CLIENT = 'portal-test-neighbour';

let db: Firestore;
let auth: Auth;
let token: string;
let neighbourToken: string;

async function call(name: string, idToken: string | null, data: unknown) {
  const res = await fetch(`${FN_BASE}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: "Bearer " + idToken } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const body = (await res.json().catch(() => ({}))) as any;
  return { status: res.status, result: body.result, error: body.error as { message?: string } | undefined };
}

async function portalTokenFor(uid: string, clientId: string): Promise<string> {
  await auth.setCustomUserClaims(uid, { portal: { firmId: FIRM, clientId } });
  const customToken = await auth.createCustomToken(uid);
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const body = (await res.json()) as any;
  if (!body.idToken) throw new Error(`Auth emulator returned no ID token: ${JSON.stringify(body)}`);
  return body.idToken as string;
}

/** A request with one document hanging off it, in whatever state the test needs. */
async function seedDocument(
  id: string,
  overrides: Record<string, unknown> = {},
  clientId = CLIENT,
): Promise<void> {
  const base = `firms/${FIRM}/clients/${clientId}`;
  await db.doc(`${base}/requests/req-${id}`).set({
    id: `req-${id}`,
    firmId: FIRM,
    clientId,
    taxYear: 2025,
    docTypeId: 'w2',
    reason: 'You had a W-2 from Riverbend Health last year.',
    source: 'prior_year',
    priority: 'critical',
    expectedCount: 1,
    status: 'received',
    documentIds: [id],
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.doc(`${base}/documents/${id}`).set({
    id,
    firmId: FIRM,
    clientId,
    taxYear: 2025,
    storagePath: `firms/${FIRM}/2025/${clientId}/${id}/w2.jpg`,
    originalName: 'IMG_4021.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 84_211,
    state: 'classified',
    requestId: `req-${id}`,
    uploadedBy: 'portal-user',
    uploadedVia: 'portal',
    uploadedAt: new Date(),
    ...overrides,
  });
}

/**
 * A refusal, not a crash. Asserting merely that *an* error came back would let
 * these tests keep passing if the callable started throwing INTERNAL on every
 * call — which is exactly how a security test quietly stops testing anything.
 */
function assertRefused(res: { error?: { message?: string; status?: string } }, why: string): void {
  assert.ok(res.error, why);
  assert.notEqual(
    res.error?.status,
    'INTERNAL',
    `${why} — but it failed with INTERNAL, which means the callable crashed rather than refusing`,
  );
}

const read = async (path: string) => (await db.doc(path).get()).data() as any;
const docPath = (id: string, clientId = CLIENT) =>
  `firms/${FIRM}/clients/${clientId}/documents/${id}`;
const reqPath = (id: string, clientId = CLIENT) =>
  `firms/${FIRM}/clients/${clientId}/requests/req-${id}`;

before(async () => {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= AUTH_HOST;
  initializeApp({ projectId: PROJECT });
  db = getFirestore();
  auth = getAuth();

  await db.doc(`firms/${FIRM}`).set({ id: FIRM, name: 'Portal Test LLP' });
  for (const clientId of [CLIENT, OTHER_CLIENT]) {
    await db.doc(`firms/${FIRM}/clients/${clientId}`).set({
      id: clientId,
      firmId: FIRM,
      displayName: clientId,
      taxYear: 2025,
    });
  }

  const uid = (await auth.createUser({ email: `taxpayer-${Date.now()}@portal.test` })).uid;
  token = await portalTokenFor(uid, CLIENT);
  const otherUid = (await auth.createUser({ email: `neighbour-${Date.now()}@portal.test` })).uid;
  neighbourToken = await portalTokenFor(otherUid, OTHER_CLIENT);
});

describe('retractDocument — the happy path', () => {
  it('withdraws the document and reopens the request it was satisfying', async () => {
    await seedDocument('doc-happy');

    const res = await call('retractDocument', token, { documentId: 'doc-happy' });
    assert.equal(res.error, undefined, `retract failed: ${JSON.stringify(res.error)}`);

    const document = await read(docPath('doc-happy'));
    assert.equal(document.state, 'retracted', 'the document must be marked withdrawn');
    assert.ok(document.retractedAt, 'retractedAt must be stamped so the firm can see when');
    assert.equal(
      document.storagePath,
      `firms/${FIRM}/2025/${CLIENT}/doc-happy/w2.jpg`,
      'the Storage object must survive — retraction is not a delete, the firm keeps the record',
    );

    const request = await read(reqPath('doc-happy'));
    assert.equal(
      request.status,
      'pending',
      'the request must reopen, otherwise the client looks done and never gets chased again',
    );
    assert.deepEqual(request.documentIds, [], 'the withdrawn document must be unlinked');
  });

  it('is idempotent — a double tap does not throw or corrupt the request', async () => {
    await seedDocument('doc-twice');
    await call('retractDocument', token, { documentId: 'doc-twice' });
    const second = await call('retractDocument', token, { documentId: 'doc-twice' });
    assert.equal(second.error, undefined, 'retracting twice must be harmless');
    assert.equal((await read(docPath('doc-twice'))).state, 'retracted');
  });

  it('leaves the request satisfied when another document still covers it', async () => {
    await seedDocument('doc-multi');
    await db.doc(reqPath('doc-multi')).update({ documentIds: ['doc-multi', 'doc-sibling'] });

    await call('retractDocument', token, { documentId: 'doc-multi' });

    const request = await read(reqPath('doc-multi'));
    assert.equal(
      request.status,
      'received',
      'a request still holding another document must not reopen',
    );
    assert.deepEqual(request.documentIds, ['doc-sibling']);
  });
});

describe('retractDocument — the boundary', () => {
  it("refuses to touch another client's document", async () => {
    await seedDocument('doc-neighbour', {}, OTHER_CLIENT);

    // The neighbour's document id, presented by our taxpayer's token.
    const res = await call('retractDocument', token, { documentId: 'doc-neighbour' });

    assertRefused(res, 'a portal user must never reach across to another client');
    assert.equal(
      (await read(docPath('doc-neighbour', OTHER_CLIENT))).state,
      'classified',
      "the neighbour's document must be untouched",
    );
  });

  it('refuses an unauthenticated caller', async () => {
    await seedDocument('doc-anon');
    const res = await call('retractDocument', null, { documentId: 'doc-anon' });
    assertRefused(res, 'no token must mean no retraction');
    assert.equal((await read(docPath('doc-anon'))).state, 'classified');
  });

  it('refuses to withdraw a document the firm uploaded on the client behalf', async () => {
    await seedDocument('doc-byfirm', { uploadedVia: 'firm' });
    const res = await call('retractDocument', token, { documentId: 'doc-byfirm' });
    assertRefused(res, 'the taxpayer must not be able to delete the firm\'s own working papers');
    assert.equal((await read(docPath('doc-byfirm'))).state, 'classified');
  });

  it('refuses once a preparer has accepted it', async () => {
    await seedDocument('doc-accepted', { state: 'accepted' });
    const res = await call('retractDocument', token, { documentId: 'doc-accepted' });
    assertRefused(res, 'an accepted document is working papers, not the taxpayer\'s to pull back');
    assert.match(
      res.error?.message ?? '',
      /already reviewed/i,
      'and the refusal must tell them what to do next, not just say no',
    );
    assert.equal((await read(docPath('doc-accepted'))).state, 'accepted');
  });

  it('refuses outside the grace window', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await seedDocument('doc-stale', { uploadedAt: twoDaysAgo });
    const res = await call('retractDocument', token, { documentId: 'doc-stale' });
    assertRefused(res, 'the window must actually close');
    assert.equal((await read(docPath('doc-stale'))).state, 'classified');
  });

  it('rejects a missing document id rather than failing obscurely', async () => {
    const res = await call('retractDocument', token, {});
    assertRefused(res, 'a missing id must be a clean invalid-argument');
  });

  it('reports a document that does not exist', async () => {
    const res = await call('retractDocument', token, { documentId: 'no-such-doc' });
    assertRefused(res, 'a bogus id must not silently succeed');
  });

  it("cannot be used by a neighbour to reopen our client's request", async () => {
    await seedDocument('doc-crosstalk');
    const res = await call('retractDocument', neighbourToken, { documentId: 'doc-crosstalk' });
    assertRefused(res, 'the neighbour token must not reach our client');
    assert.equal((await read(reqPath('doc-crosstalk'))).status, 'received');
  });
});
