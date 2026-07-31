/**
 * The checklist writer, from the rule that fired to the sentence a taxpayer
 * reads in their own language.
 *
 * A rule emits a reason *reference* — a key plus the evidence it found — and
 * the portal assembles the sentence from the reader's own dictionary. That only
 * works if the fields survive the write: rule → plan item → `DocRequest`. They
 * are optional on the stored shape, so a writer that drops them compiles
 * happily and the taxpayer silently gets English, which is exactly the language
 * they told the IRS on Schedule LEP they cannot read.
 *
 * `recoverReason` matches a stored English sentence back to its key and still
 * covers everything written before this existed. It is a fallback for legacy
 * data, not the design, so this asserts the key path is what serves a request
 * written today — the reason renders in Arabic even when the stored English is
 * something no template could ever have produced.
 *
 * Needs the Auth, Firestore and Functions emulators. Hermetic run (starts and
 * tears down its own emulators):
 *
 *   firebase emulators:exec --only auth,firestore,functions \
 *     "node --experimental-strip-types --test functions/src/checklist/generate.test.ts"
 *
 * Against already-running emulators on the standard ports:
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *     node --experimental-strip-types --test functions/src/checklist/generate.test.ts
 *
 * It never wipes the emulators — only its own firm — so it is safe to run
 * beside a seeded demo.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import {
  isReasonKey,
  reasonFor,
  reasonText,
  type DocRequest,
} from '../../../packages/shared/src/index.ts';

const PROJECT = process.env.GCLOUD_PROJECT ?? 'taxfax-364f6';
const REGION = 'us-central1';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1:5001';
const FN_BASE = `http://${FN_HOST}/${PROJECT}/${REGION}`;

const FIRM = 'checklist-reason-firm';
const CLIENT = 'checklist-reason-client';

/** Nothing any English template could have produced, so the shim cannot match it. */
const UNRECOVERABLE = 'zzz — typed by a preparer at 1am';

let db: Firestore;
let auth: Auth;
let preparerToken: string;
let requests: DocRequest[];

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
  await auth.createUser({ uid, email: 'lee.preparer@checklist.test', emailVerified: true, displayName: 'Lee Preparer' });
  await auth.setCustomUserClaims(uid, { firms: { [FIRM]: 'preparer' } });
  const customToken = await auth.createCustomToken(uid);
  const signIn = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const body = (await signIn.json()) as { idToken?: string };
  assert.ok(body.idToken, `Auth emulator returned no ID token: ${JSON.stringify(body)}`);
  preparerToken = body.idToken;

  // A client with no prior-year return on file: the starter list, which is what
  // every brand-new client gets on their first day.
  await db.doc(`firms/${FIRM}/clients/${CLIENT}`).set({
    id: CLIENT,
    firmId: FIRM,
    displayName: 'Amal Haddad',
    taxYear: 2025,
    stage: 'not_started',
    language: { locale: 'ar', source: 'detected', lepCode: '001' },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const res = await fetch(`${FN_BASE}/generateChecklist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${preparerToken}` },
    body: JSON.stringify({ data: { firmId: FIRM, clientId: CLIENT } }),
  });
  const generated = (await res.json().catch(() => ({}))) as { result?: { total?: number }; error?: { message?: string } };
  assert.equal(res.status, 200, `generateChecklist failed (${generated.error?.message}).`);

  const snap = await db.collection(`firms/${FIRM}/clients/${CLIENT}/requests`).get();
  requests = snap.docs.map((d) => d.data() as DocRequest);
  assert.ok(requests.length > 0, 'The generator wrote no requests — nothing below would be proving anything.');
});

after(async () => {
  await db.recursiveDelete(db.doc(`firms/${FIRM}`)).catch(() => undefined);
  await auth.deleteUser(`${FIRM}-preparer`).catch(() => undefined);
});

describe('a generated checklist carries the reason as a key, not only as English', () => {
  it('writes a known reason key on every request', () => {
    const keyless = requests.filter((r) => !isReasonKey(r.reasonKey)).map((r) => r.docTypeId);
    assert.deepEqual(
      keyless,
      [],
      `Requests written with no reason key: ${keyless.join(', ')}. The taxpayer's portal has nothing ` +
        'to look up, so the most persuasive sentence the product says reaches them in English.',
    );
  });

  it('still writes the English sentence for the firm’s own console', () => {
    for (const r of requests) {
      assert.equal(
        typeof r.reason === 'string' && r.reason.length > 0,
        true,
        `${r.docTypeId} lost its English reason — the preparer console and the activity log read that field.`,
      );
      assert.equal(
        r.reason,
        reasonText('en', { key: r.reasonKey!, vars: r.reasonVars }),
        `${r.docTypeId}'s stored English drifted from what its key renders — the two would tell different stories.`,
      );
    }
  });

  it('renders in the taxpayer’s language from the key alone, with no help from the shim', () => {
    const request = requests[0]!;

    // Control: strip the key and the same call has only unrecoverable English to
    // work with, so it must hand back that English verbatim. Without this, an
    // assertion that "Arabic came out" could be satisfied by the shim, or by a
    // renderer that translates anything at all.
    const withoutKey = reasonFor('ar', { reason: UNRECOVERABLE });
    assert.equal(
      withoutKey,
      UNRECOVERABLE,
      'A reason with no key and no recoverable template did not render verbatim — the control is broken, ' +
        'so the assertion below proves nothing.',
    );

    const fromKey = reasonFor('ar', { ...request, reason: UNRECOVERABLE });
    assert.notEqual(
      fromKey,
      UNRECOVERABLE,
      `${request.docTypeId} fell through to the stored sentence — the stored key is not being used.`,
    );
    assert.equal(
      fromKey,
      reasonText('ar', { key: request.reasonKey!, vars: request.reasonVars }),
      'The rendered reason is not what the stored key and evidence render — something else produced it.',
    );
    assert.notEqual(
      fromKey,
      request.reason,
      'The Arabic reason is identical to the English one — the taxpayer is reading a language they told the IRS they cannot.',
    );
  });
});
