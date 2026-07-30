/**
 * Tenancy + client-management integration tests — the multi-tenant boundary and
 * the client-lifecycle invariants, exercised end-to-end against the real Cloud
 * Functions running in the emulator.
 *
 * These prove the things that, if they silently regress, either leak one firm's
 * data into another or lock a firm out of its own workspace:
 *   - custom claims are minted from the member docs and never disagree with them
 *   - the last owner can never be demoted or removed
 *   - an invite binds to exactly the firm and the email it was issued for
 *   - importClients dedupes by email and is safe to re-run
 *   - onClientWritten derives state without re-triggering itself
 *   - a portal (taxpayer) claim can never coexist with, or convert into, a firms claim
 *
 * Needs the Auth, Firestore and Functions emulators. Hermetic run (starts and
 * tears down its own emulators):
 *
 *   firebase emulators:exec --only auth,firestore,functions \
 *     "node --experimental-strip-types --test functions/src/firm/tenancy.test.ts"
 *
 * Against already-running emulators on the standard ports:
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *     node --experimental-strip-types --test functions/src/firm/tenancy.test.ts
 *
 * (The Functions emulator is assumed at 127.0.0.1:5001; override with
 * FUNCTIONS_EMULATOR_HOST.)
 */
import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

const PROJECT = process.env.GCLOUD_PROJECT ?? 'taxfax-364f6';
const REGION = 'us-central1';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1:5001';
const FN_BASE = `http://${FN_HOST}/${PROJECT}/${REGION}`;

const OWNER_EMAIL = 'dana.owner@whitfield.test';
const AVA_EMAIL = 'ava.whitfield@client.test';
const INVITEE_EMAIL = 'pat.preparer@whitfield.test';
const OTHER_INVITE_EMAIL = 'sam.viewer@whitfield.test';
const WRONG_EMAIL = 'not.sam@intruder.test';
const UNVERIFIED_EMAIL = 'unverified@client.test';

let db: Firestore;
let auth: Auth;

// Shared narrative state; each describe builds on the firm the previous one made.
const S: Record<string, any> = {};

interface CallResult {
  status: number;
  result: any;
  error: { message?: string; status?: string } | undefined;
}

async function call(name: string, token: string | null, data: unknown): Promise<CallResult> {
  const res = await fetch(`${FN_BASE}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const body = (await res.json().catch(() => ({}))) as any;
  return { status: res.status, result: body.result, error: body.error };
}

async function tokenFor(uid: string): Promise<string> {
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

async function makeUser(email: string, emailVerified: boolean, name?: string): Promise<string> {
  const user = await auth.createUser({ email, emailVerified, displayName: name });
  return user.uid;
}

async function claimsOf(uid: string): Promise<Record<string, any>> {
  const user = await auth.getUser(uid);
  return (user.customClaims ?? {}) as Record<string, any>;
}

async function readDoc(path: string): Promise<any> {
  const snap = await db.doc(path).get();
  return snap.exists ? snap.data() : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor<T>(pred: () => Promise<T | null | undefined>, label: string, ms = 12000): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = await pred();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`Timed out after ${ms}ms waiting for ${label}`);
    await sleep(150);
  }
}

before(async () => {
  assert.ok(
    process.env.FIRESTORE_EMULATOR_HOST,
    'FIRESTORE_EMULATOR_HOST is unset — refusing to run tenancy tests against a real Firestore.',
  );
  assert.ok(
    process.env.FIREBASE_AUTH_EMULATOR_HOST,
    'FIREBASE_AUTH_EMULATOR_HOST is unset — refusing to mint users against a real Auth project.',
  );

  const app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  auth = getAuth(app);

  // Hermetic: wipe both emulators so slugs, seat counts and dedupe are deterministic.
  await fetch(`http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
    method: 'DELETE',
  });
  await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });

  S.ownerUid = await makeUser(OWNER_EMAIL, true, 'Dana Owner');
  S.ownerToken0 = await tokenFor(S.ownerUid);
});

describe('createFirm', () => {
  it('creates the firm and returns its id', async () => {
    S.createRes = await call('createFirm', S.ownerToken0, {
      name: 'Whitfield & Co',
      displayName: 'Whitfield & Co',
      timezone: 'America/Chicago',
    });
    assert.equal(
      S.createRes.status,
      200,
      `createFirm failed (${S.createRes.error?.message}) — a firm can't be founded, so nobody can onboard.`,
    );
    S.firmId = S.createRes.result?.firmId;
    assert.ok(S.firmId, 'createFirm returned no firmId — the client has no workspace to write into.');

    S.firm = await readDoc(`firms/${S.firmId}`);
    S.ownerMember = await readDoc(`firms/${S.firmId}/members/${S.ownerUid}`);
    S.ownerClaims = await claimsOf(S.ownerUid);
    S.ownerToken = await tokenFor(S.ownerUid); // re-mint: now carries the firms claim
  });

  it('generates a URL-safe slug from the firm name', () => {
    assert.equal(
      S.createRes.result.slug,
      'whitfield-and-co',
      'Slug derivation drifted — shareable firm URLs would break or collide across tenants.',
    );
    assert.match(
      S.createRes.result.slug,
      /^[a-z0-9-]+$/,
      'Slug contains unsafe characters — it would break the URL a client visits.',
    );
  });

  it('records the caller as the owner', () => {
    assert.equal(
      S.ownerMember?.role,
      'owner',
      'Founder is not owner — they could not manage their own firm or invite staff.',
    );
  });

  it('seeds chase settings with the firm signature', () => {
    assert.equal(typeof S.firm?.chase?.signature, 'string', 'No chase signature seeded — reminder emails would send unsigned.');
    assert.ok(
      S.firm.chase.signature.includes('at Whitfield & Co'),
      'Chase signature does not name the firm — clients get anonymous, spammy-looking reminders.',
    );
  });

  it('stores the firm timezone', () => {
    assert.equal(
      S.firm?.timezone,
      'America/Chicago',
      'Firm timezone lost — the chase scheduler would send reminders at the wrong hour, incl. overnight.',
    );
  });

  it('starts the firm on a trial with seats', () => {
    assert.equal(S.firm?.plan, 'trial', 'Firm did not start on a trial — billing/seat gating is undefined.');
    assert.ok((S.firm?.seats ?? 0) > 0, 'Firm has zero seats — no one, not even the owner, could be counted as a member.');
  });

  it('writes the owner member document', () => {
    assert.ok(S.ownerMember, 'Owner member doc missing — security rules read membership from here; the owner would be denied.');
    assert.equal(S.ownerMember.uid, S.ownerUid, 'Owner member doc has the wrong uid — claims would be minted for the wrong person.');
  });

  it('mints the firms claim for the owner', () => {
    assert.equal(
      S.ownerClaims?.firms?.[S.firmId],
      'owner',
      'Owner has no firms claim — every firm-scoped request from the founder would be permission-denied.',
    );
  });

  it('rejects a second firm with the same name from the same owner', async () => {
    const dup = await call('createFirm', S.ownerToken, { name: 'Whitfield & Co' });
    assert.notEqual(dup.status, 200, 'Duplicate firm was allowed — one owner accretes shadow workspaces and split data.');
    assert.ok(
      String(dup.error?.message ?? '').toLowerCase().includes('already'),
      'Duplicate-firm error is not human-readable — the founder cannot tell what went wrong.',
    );
  });
});

describe('createClient', () => {
  it('creates a client and returns its id', async () => {
    S.clientRes = await call('createClient', S.ownerToken, {
      firmId: S.firmId,
      displayName: 'Ava Whitfield',
      primaryContact: { email: AVA_EMAIL, phone: '(312) 555-0170' },
      tags: ['vip', 'VIP', '  vip  '],
    });
    assert.equal(S.clientRes.status, 200, `createClient failed (${S.clientRes.error?.message}) — staff cannot add clients.`);
    S.avaClientId = S.clientRes.result?.clientId;
    assert.ok(S.avaClientId, 'createClient returned no clientId — the roster row does not exist.');
    S.ava = await readDoc(`firms/${S.firmId}/clients/${S.avaClientId}`);
  });

  it('derives sortName last-name-first for individuals', () => {
    assert.equal(
      S.ava?.sortName,
      'whitfield ava',
      'sortName derivation broke — the roster would sort by first name, not surname, and become unusable at 500 clients.',
    );
  });

  it('normalises the phone to E.164', () => {
    assert.equal(
      S.ava?.primaryContact?.phone,
      '+13125550170',
      'Phone not normalised — the SMS chase would fail to dial a non-E.164 number.',
    );
  });

  it('de-dupes tags case-insensitively', () => {
    assert.equal(
      S.ava?.tags?.length,
      1,
      'Tags not de-duped — filters and saved views double-count the same tag.',
    );
    assert.equal(String(S.ava.tags[0]).toLowerCase(), 'vip', 'Tag value was mangled during normalisation.');
  });

  it('initialises progress, chase and stage', () => {
    assert.equal(S.ava?.stage, 'not_started', 'Client stage uninitialised — the pipeline board cannot place the client.');
    assert.equal(S.ava?.progress?.percent, 0, 'Progress counters uninitialised — the dashboard shows NaN%.');
    assert.equal(S.ava?.chase?.status, 'idle', 'Chase state uninitialised — the scheduler cannot decide whether to chase.');
  });
});

describe('onClientWritten', () => {
  it('back-fills derived state on a direct (non-callable) write', async () => {
    S.nwId = db.collection(`firms/${S.firmId}/clients`).doc().id;
    await db.doc(`firms/${S.firmId}/clients/${S.nwId}`).set({
      id: S.nwId,
      firmId: S.firmId,
      displayName: 'Northwind Trading LLC',
      entityType: 'llc',
    });
    S.nw = await waitFor(async () => {
      const d = await readDoc(`firms/${S.firmId}/clients/${S.nwId}`);
      return d && d.sortName ? d : null;
    }, 'onClientWritten to back-fill a directly-written client');
    assert.ok(S.nw.progress, 'Trigger did not seed progress on a direct write — the client silently breaks the dashboard.');
    assert.ok(S.nw.chase, 'Trigger did not seed chase on a direct write — that client would never be chased.');
  });

  it('keeps the entity name as the sort key (no last-first flip)', () => {
    assert.equal(
      S.nw?.sortName,
      'northwind trading llc',
      'Entity sortName was flipped like a person — businesses would file under the wrong letter in the roster.',
    );
  });

  it('normalises a messy entityType', () => {
    assert.equal(
      S.nw?.entityType,
      'partnership',
      'entityType left un-normalised — entity-specific checklists and filings would be wrong.',
    );
  });

  it('does not re-trigger itself (updatedAt is stable)', async () => {
    const first = await readDoc(`firms/${S.firmId}/clients/${S.nwId}`);
    const t1 = first.updatedAt?.toMillis?.() ?? 0;
    await sleep(1800);
    const second = await readDoc(`firms/${S.firmId}/clients/${S.nwId}`);
    const t2 = second.updatedAt?.toMillis?.() ?? 0;
    assert.ok(t1 > 0, 'updatedAt was never set — sort-by-recently-updated and staleness checks break.');
    assert.equal(
      t1,
      t2,
      'onClientWritten re-triggered itself — an infinite write loop that burns Firestore quota and runs up unbounded cost.',
    );
  });
});

describe('importClients', () => {
  const rows = [
    { displayName: 'Bob Vance', email: 'BOB@vance.test', phone: '312-555-0101', entityType: '1040' },
    { displayName: 'Bob Vance', email: 'bob@vance.test', entityType: 'individual' }, // same email, different case
    { displayName: '', email: 'noname@x.test' }, // no name → error row
    { displayName: 'Acme S Corp', email: 'ap@acme.test', entityType: '1120-S', filingStatus: 'entity', tags: 'manufacturing; vip' },
    { displayName: 'Dunder Mifflin', email: 'ap@dundermifflin.test', entityType: 'c corp' },
    { displayName: 'No Email Co', entityType: 'partnership' }, // no email → cannot be keyed
  ];

  it('imports a messy CSV without failing the call', async () => {
    S.import1 = await call('importClients', S.ownerToken, { firmId: S.firmId, rows });
    assert.equal(S.import1.status, 200, `importClients failed (${S.import1.error?.message}) — the primary onboarding path is broken.`);
  });

  it('creates each unique client exactly once', () => {
    assert.equal(S.import1.result?.created, 4, 'Wrong created count — a firm would silently lose or duplicate clients on import.');
  });

  it('skips the duplicate email (case-insensitive)', () => {
    assert.equal(S.import1.result?.skipped, 1, 'Duplicate email was not skipped — the same taxpayer appears twice in the roster.');
  });

  it('reports the un-named row as an error at its source index', () => {
    assert.equal(S.import1.result?.errors?.length, 1, 'The un-named row was not reported — the firm cannot tell what failed to import.');
    assert.equal(S.import1.result.errors[0].row, 2, 'Error points at the wrong row — the firm fixes the wrong line of their CSV.');
  });

  it('is idempotent for keyed rows on re-import', async () => {
    const reimport = await call('importClients', S.ownerToken, { firmId: S.firmId, rows });
    assert.equal(
      reimport.result?.created,
      1,
      'Re-import duplicated e-mailed clients — a firm re-running the same file doubles its roster. (Only the one email-less row may re-create.)',
    );
    assert.equal(reimport.result?.skipped, 4, 'Re-import did not skip the four already-present emails — dedupe is not idempotent.');
  });

  it('maps 1120-S to an s-corp entity', async () => {
    const snap = await db
      .collection(`firms/${S.firmId}/clients`)
      .where('primaryContact.email', '==', 'ap@acme.test')
      .limit(1)
      .get();
    assert.equal(
      snap.docs[0]?.data()?.entityType,
      's-corp',
      'Lacerte/Karbon entity codes not recognised — imported businesses get the wrong return type.',
    );
  });
});

describe('inviteMember + acceptInvite', () => {
  it('creates an invite with a token', async () => {
    S.inviteRes = await call('inviteMember', S.ownerToken, { firmId: S.firmId, email: INVITEE_EMAIL, role: 'preparer' });
    assert.equal(S.inviteRes.status, 200, `inviteMember failed (${S.inviteRes.error?.message}) — a firm cannot grow its team.`);
    S.invite1Token = S.inviteRes.result?.token;
    assert.ok(S.invite1Token, 'inviteMember returned no token — there is no link for the invitee to accept.');
    // A second invite that the mismatch test will try to steal.
    const other = await call('inviteMember', S.ownerToken, { firmId: S.firmId, email: OTHER_INVITE_EMAIL, role: 'viewer' });
    S.invite2Token = other.result?.token;
  });

  it('queues the invitation email', async () => {
    const mail = await db.collection('mail').where('to', 'array-contains', INVITEE_EMAIL).limit(1).get();
    assert.ok(
      !mail.empty,
      'No invite email was queued — the invitee never hears about it, so the invite is dead on arrival.',
    );
  });

  it('rejects an invalid role', async () => {
    const bad = await call('inviteMember', S.ownerToken, { firmId: S.firmId, email: 'x@y.test', role: 'superuser' });
    assert.notEqual(bad.status, 200, 'An unknown role was accepted — a typo could mint privileges no rule anticipates.');
    assert.ok(
      String(bad.error?.message ?? '').toLowerCase().includes('role'),
      'Invalid-role error is not human-readable — the admin cannot tell what to fix.',
    );
  });

  it('lets the invited email accept the invite', async () => {
    S.inviteeUid = await makeUser(INVITEE_EMAIL, true, 'Pat Preparer');
    const inviteeToken0 = await tokenFor(S.inviteeUid);
    S.acceptRes = await call('acceptInvite', inviteeToken0, { token: S.invite1Token });
    assert.equal(S.acceptRes.status, 200, `acceptInvite failed (${S.acceptRes.error?.message}) — an invited teammate cannot get in.`);
    S.inviteeClaims = await claimsOf(S.inviteeUid);
    S.inviteePreparerToken = await tokenFor(S.inviteeUid); // carries the preparer claim
  });

  it('mints the firm claim for the accepted member', () => {
    assert.equal(
      S.inviteeClaims?.firms?.[S.firmId],
      'preparer',
      'Accepted member has no firms claim — they joined but every request they make is denied.',
    );
  });

  it('binds the invite to the invited email only', async () => {
    const wrongUid = await makeUser(WRONG_EMAIL, true, 'Not Sam');
    const wrongToken = await tokenFor(wrongUid);
    const stolen = await call('acceptInvite', wrongToken, { token: S.invite2Token });
    assert.notEqual(
      stolen.status,
      200,
      'A different verified email accepted the invite — anyone who guesses a token joins the firm. Cross-tenant breach.',
    );
    assert.ok(
      String(stolen.error?.message ?? '').toLowerCase().includes('different email'),
      'Mismatched-email rejection is not human-readable — the wrong person gets a cryptic error instead of guidance.',
    );
  });
});

describe('owner guards', () => {
  it('refuses to demote the last owner', async () => {
    const res = await call('updateMemberRole', S.ownerToken, { firmId: S.firmId, uid: S.ownerUid, role: 'admin' });
    assert.notEqual(res.status, 200, 'The last owner was demoted — the firm is left with no one who can manage billing or owners. Lockout.');
    assert.ok(
      String(res.error?.message ?? '').toLowerCase().includes('last owner'),
      'Last-owner error is not human-readable — the admin does not learn they must appoint another owner first.',
    );
  });

  it('refuses to remove the last owner', async () => {
    const res = await call('removeMember', S.ownerToken, { firmId: S.firmId, uid: S.ownerUid });
    assert.notEqual(res.status, 200, 'The last owner was removed — the firm is orphaned and no one can administer it. Lockout.');
    assert.ok(
      String(res.error?.message ?? '').toLowerCase().includes('last owner'),
      'Last-owner removal error is not human-readable.',
    );
  });

  it('forbids a preparer from changing roles', async () => {
    const res = await call('updateMemberRole', S.inviteePreparerToken, { firmId: S.firmId, uid: S.ownerUid, role: 'viewer' });
    assert.equal(res.status, 403, 'A preparer changed roles — privilege escalation; a non-admin could seize control of the firm.');
    assert.ok(
      String(res.error?.message ?? '').toLowerCase().includes('admin'),
      'Privilege error is not human-readable — the preparer does not learn they need an admin.',
    );
  });
});

describe('claimPortalAccess (portal isolation)', () => {
  it('sends a portal invite for a client with an email', async () => {
    const res = await call('sendPortalInvite', S.ownerToken, { firmId: S.firmId, clientId: S.avaClientId });
    assert.equal(res.status, 200, `sendPortalInvite failed (${res.error?.message}) — the taxpayer never receives a way in.`);
    assert.equal(res.result?.email, AVA_EMAIL, 'Portal invite went to the wrong address — a client link could land in the wrong inbox.');
  });

  it('resolves a verified taxpayer to their own client', async () => {
    S.taxpayerUid = await makeUser(AVA_EMAIL, true, 'Ava Whitfield');
    const taxpayerToken = await tokenFor(S.taxpayerUid);
    S.claimRes = await call('claimPortalAccess', taxpayerToken, { firmId: S.firmId });
    assert.equal(S.claimRes.status, 200, `claimPortalAccess failed (${S.claimRes.error?.message}) — a real taxpayer cannot reach their portal.`);
    assert.equal(
      S.claimRes.result?.clientId,
      S.avaClientId,
      'Taxpayer resolved to the wrong client — one client could see another client\'s documents.',
    );
    S.taxpayerClaims = await claimsOf(S.taxpayerUid);
    S.grant = await readDoc(`portalGrants/${S.taxpayerUid}`);
  });

  it('sets the portal claim to the matched firm and client', () => {
    assert.deepEqual(
      S.taxpayerClaims?.portal,
      { firmId: S.firmId, clientId: S.avaClientId },
      'Portal claim is wrong or missing — the taxpayer is either locked out or scoped to the wrong file.',
    );
  });

  it('never grants a taxpayer a firms claim', () => {
    assert.equal(
      S.taxpayerClaims?.firms,
      undefined,
      'A taxpayer received a firms claim — a client could read the entire firm\'s roster and every other client. Critical breach.',
    );
  });

  it('records the portal grant', () => {
    assert.equal(
      S.grant?.clientId,
      S.avaClientId,
      'No portalGrant written — the firm has no server-side record of who activated a portal, and rules that read it fail.',
    );
  });

  it('refuses a taxpayer whose email is not verified', async () => {
    const unverifiedUid = await makeUser(UNVERIFIED_EMAIL, false, 'Unverified');
    const unverifiedToken = await tokenFor(unverifiedUid);
    const res = await call('claimPortalAccess', unverifiedToken, { firmId: S.firmId });
    assert.notEqual(res.status, 200, 'An unverified email claimed a portal — anyone could assert any address and hijack a client file.');
    assert.ok(
      String(res.error?.message ?? '').toLowerCase().includes('secure link'),
      'Verification rejection is not human-readable — the taxpayer does not learn to use the emailed link.',
    );
  });
});
