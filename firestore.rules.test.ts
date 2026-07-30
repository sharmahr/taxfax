/**
 * Security-rule tests. These are the multi-tenant boundary — if one of these
 * regresses, one firm can read another firm's clients.
 *
 *   npm run test:rules      (needs the Firestore emulator on 8080)
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const FIRM_A = 'firmA';
const FIRM_B = 'firmB';
const CLIENT_1 = 'client1';
const CLIENT_2 = 'client2';

let env: RulesTestEnvironment;

const staff = (uid: string, firmId: string, role: string) =>
  env.authenticatedContext(uid, { firms: { [firmId]: role } }).firestore();

const taxpayer = (uid: string, firmId: string, clientId: string) =>
  env.authenticatedContext(uid, { portal: { firmId, clientId } }).firestore();

const clientDoc = (db: ReturnType<typeof staff>, firmId: string, clientId: string) =>
  doc(db, `firms/${firmId}/clients/${clientId}`);

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'taxfax-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

  // Seed both tenants with the admin bypass.
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [firmId, clientIds] of [
      [FIRM_A, [CLIENT_1, CLIENT_2]],
      [FIRM_B, ['other']],
    ] as const) {
      await setDoc(doc(db, `firms/${firmId}`), { id: firmId, name: firmId, seats: 5, plan: 'pro' });
      for (const clientId of clientIds) {
        await setDoc(doc(db, `firms/${firmId}/clients/${clientId}`), {
          id: clientId,
          firmId,
          displayName: clientId,
          stage: 'awaiting',
          progress: { total: 10, received: 3 },
        });
        await setDoc(doc(db, `firms/${firmId}/clients/${clientId}/requests/r1`), {
          id: 'r1',
          firmId,
          clientId,
          docTypeId: 'w2',
          status: 'pending',
          documentIds: [],
        });
        await setDoc(doc(db, `firms/${firmId}/clients/${clientId}/documents/d1`), {
          id: 'd1',
          firmId,
          clientId,
          state: 'ready',
          storagePath: `firms/${firmId}/2025/${clientId}/d1/x.pdf`,
          uploadedBy: 'someone',
          sizeBytes: 100,
        });
        await setDoc(doc(db, `firms/${firmId}/clients/${clientId}/chaseMessages/m1`), { id: 'm1' });
      }
      await setDoc(doc(db, `firms/${firmId}/activity/e1`), { id: 'e1', summary: 'x' });
    }
    await setDoc(doc(db, 'users/staffA'), { uid: 'staffA', firmIds: [FIRM_A], defaultFirmId: FIRM_A });
    await setDoc(doc(db, 'users/staffB'), { uid: 'staffB', firmIds: [FIRM_B] });
    await setDoc(doc(db, 'invites/tok1'), { token: 'tok1', firmId: FIRM_A, role: 'preparer' });
    await setDoc(doc(db, 'portalGrants/tp1'), { uid: 'tp1', firmId: FIRM_A });
    await setDoc(doc(db, 'mail/m1'), { to: 'x@y.z' });
    await setDoc(doc(db, 'messages/s1'), { to: '+15550100' });
  });
});

after(async () => {
  await env?.cleanup();
});

describe('anonymous', () => {
  it('reads nothing', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `firms/${FIRM_A}`)));
    await assertFails(getDoc(clientDoc(db, FIRM_A, CLIENT_1)));
    await assertFails(getDocs(collection(db, `firms/${FIRM_A}/clients`)));
  });

  it('writes nothing', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(setDoc(clientDoc(db, FIRM_A, 'forged'), { firmId: FIRM_A, displayName: 'x' }));
  });
});

describe('tenant isolation', () => {
  it('a member of one firm cannot read another firm', async () => {
    const db = staff('staffB', FIRM_B, 'owner');
    await assertFails(getDoc(clientDoc(db, FIRM_A, CLIENT_1)));
    await assertFails(getDocs(collection(db, `firms/${FIRM_A}/clients`)));
    await assertFails(getDoc(doc(db, `firms/${FIRM_A}/clients/${CLIENT_1}/documents/d1`)));
    await assertFails(getDocs(collection(db, `firms/${FIRM_A}/activity`)));
  });

  it('a member of one firm cannot write into another firm', async () => {
    const db = staff('staffB', FIRM_B, 'owner');
    await assertFails(
      setDoc(clientDoc(db, FIRM_A, 'forged'), { firmId: FIRM_A, displayName: 'Forged' }),
    );
    await assertFails(updateDoc(clientDoc(db, FIRM_A, CLIENT_1), { displayName: 'Hijacked' }));
  });

  it('a forged claim for another firm does not grant access to the real one', async () => {
    // Claims are signed by Functions in production; this proves the rule keys
    // off the firmId in the path, not merely off the presence of any claim.
    const db = env
      .authenticatedContext('attacker', { firms: { [FIRM_B]: 'owner' } })
      .firestore();
    await assertFails(getDoc(clientDoc(db, FIRM_A, CLIENT_1)));
  });
});

describe('roles', () => {
  it('viewer can read but not create clients', async () => {
    const db = staff('v', FIRM_A, 'viewer');
    await assertSucceeds(getDoc(clientDoc(db, FIRM_A, CLIENT_1)));
    await assertFails(
      setDoc(clientDoc(db, FIRM_A, 'new1'), { firmId: FIRM_A, displayName: 'New' }),
    );
  });

  it('preparer can create a client but not delete one', async () => {
    const db = staff('p', FIRM_A, 'preparer');
    await assertSucceeds(
      setDoc(clientDoc(db, FIRM_A, 'new2'), { firmId: FIRM_A, displayName: 'New' }),
    );
    await assertFails(deleteDoc(clientDoc(db, FIRM_A, 'new2')));
  });

  it('admin can delete a client', async () => {
    const db = staff('a', FIRM_A, 'admin');
    await assertSucceeds(deleteDoc(clientDoc(db, FIRM_A, 'new2')));
  });

  it('preparer cannot change billing state on the firm', async () => {
    const admin = staff('a', FIRM_A, 'admin');
    await assertFails(updateDoc(doc(admin, `firms/${FIRM_A}`), { seats: 999 }));
    await assertFails(updateDoc(doc(admin, `firms/${FIRM_A}`), { plan: 'enterprise' }));
    await assertSucceeds(updateDoc(doc(admin, `firms/${FIRM_A}`), { name: 'Renamed' }));
  });

  it('client displayName is validated on create', async () => {
    const db = staff('p', FIRM_A, 'preparer');
    await assertFails(setDoc(clientDoc(db, FIRM_A, 'bad1'), { firmId: FIRM_A, displayName: '' }));
    await assertFails(
      setDoc(clientDoc(db, FIRM_A, 'bad2'), { firmId: FIRM_A, displayName: 'x'.repeat(201) }),
    );
    // firmId in the body must match the path, or a row can be written into the
    // wrong tenant's collection and later read by firmId.
    await assertFails(setDoc(clientDoc(db, FIRM_A, 'bad3'), { firmId: FIRM_B, displayName: 'x' }));
  });
});

describe('derived fields are Functions-only', () => {
  it('staff cannot hand-edit progress, chase or priorYear', async () => {
    const db = staff('p', FIRM_A, 'preparer');
    const ref = clientDoc(db, FIRM_A, CLIENT_1);
    await assertFails(updateDoc(ref, { progress: { total: 0, received: 0 } }));
    await assertFails(updateDoc(ref, { chase: { step: 99 } }));
    await assertFails(updateDoc(ref, { priorYear: { taxYear: 2024 } }));
    await assertFails(updateDoc(ref, { firmId: FIRM_B }));
    await assertSucceeds(updateDoc(ref, { displayName: 'Renamed Client' }));
  });

  it('staff cannot rewrite a document classification or its storage path', async () => {
    const db = staff('p', FIRM_A, 'preparer');
    const ref = doc(db, `firms/${FIRM_A}/clients/${CLIENT_1}/documents/d1`);
    await assertFails(updateDoc(ref, { classification: { docTypeId: 'w2', confidence: 1 } }));
    await assertFails(updateDoc(ref, { storagePath: 'firms/other/x' }));
    await assertFails(updateDoc(ref, { sizeBytes: 1 }));
    await assertSucceeds(updateDoc(ref, { reviewedBy: 'p' }));
  });

  it('members, activity and chase history are read-only to staff', async () => {
    const db = staff('o', FIRM_A, 'owner');
    await assertSucceeds(getDocs(collection(db, `firms/${FIRM_A}/activity`)));
    await assertFails(setDoc(doc(db, `firms/${FIRM_A}/activity/forged`), { summary: 'nope' }));
    await assertFails(setDoc(doc(db, `firms/${FIRM_A}/members/o`), { role: 'owner' }));
    await assertFails(
      setDoc(doc(db, `firms/${FIRM_A}/clients/${CLIENT_1}/chaseMessages/forged`), { id: 'x' }),
    );
  });

  it('a firm cannot be created or deleted from the client', async () => {
    const db = staff('o', FIRM_A, 'owner');
    await assertFails(setDoc(doc(db, 'firms/brandNew'), { id: 'brandNew', name: 'X' }));
    await assertFails(deleteDoc(doc(db, `firms/${FIRM_A}`)));
  });
});

describe('taxpayer portal', () => {
  it('sees its own client and checklist, and the firm for branding', async () => {
    const db = taxpayer('tp1', FIRM_A, CLIENT_1);
    await assertSucceeds(getDoc(clientDoc(db, FIRM_A, CLIENT_1)));
    await assertSucceeds(getDocs(collection(db, `firms/${FIRM_A}/clients/${CLIENT_1}/requests`)));
    await assertSucceeds(getDoc(doc(db, `firms/${FIRM_A}`)));
  });

  it('cannot see a sibling client in the same firm', async () => {
    const db = taxpayer('tp1', FIRM_A, CLIENT_1);
    await assertFails(getDoc(clientDoc(db, FIRM_A, CLIENT_2)));
    await assertFails(getDocs(collection(db, `firms/${FIRM_A}/clients/${CLIENT_2}/requests`)));
    await assertFails(getDocs(collection(db, `firms/${FIRM_A}/clients/${CLIENT_2}/documents`)));
  });

  it('cannot list the client roster or read the activity feed', async () => {
    const db = taxpayer('tp1', FIRM_A, CLIENT_1);
    await assertFails(getDocs(collection(db, `firms/${FIRM_A}/clients`)));
    await assertFails(getDocs(collection(db, `firms/${FIRM_A}/activity`)));
    await assertFails(
      getDocs(collection(db, `firms/${FIRM_A}/clients/${CLIENT_1}/chaseMessages`)),
    );
  });

  it('cannot edit its own stage, progress or checklist status', async () => {
    const db = taxpayer('tp1', FIRM_A, CLIENT_1);
    await assertFails(updateDoc(clientDoc(db, FIRM_A, CLIENT_1), { stage: 'complete' }));
    await assertFails(
      updateDoc(clientDoc(db, FIRM_A, CLIENT_1), { progress: { total: 1, received: 1 } }),
    );
    await assertFails(
      updateDoc(doc(db, `firms/${FIRM_A}/clients/${CLIENT_1}/requests/r1`), { status: 'received' }),
    );
  });

  it('may only leave a note on a checklist item', async () => {
    const db = taxpayer('tp1', FIRM_A, CLIENT_1);
    const ref = doc(db, `firms/${FIRM_A}/clients/${CLIENT_1}/requests/r1`);
    await assertSucceeds(updateDoc(ref, { clientNote: "I didn't have this last year", updatedAt: new Date() }));
    // Sneaking a status change alongside the allowed field must still fail.
    await assertFails(updateDoc(ref, { clientNote: 'x', status: 'received' }));
  });

  it('can open an upload stub but cannot forge its outcome', async () => {
    const db = taxpayer('tp1', FIRM_A, CLIENT_1);
    const ref = doc(db, `firms/${FIRM_A}/clients/${CLIENT_1}/documents/up1`);
    const base = {
      firmId: FIRM_A,
      clientId: CLIENT_1,
      state: 'uploading',
      uploadedBy: 'tp1',
      sizeBytes: 1024,
    };
    await assertSucceeds(setDoc(ref, base));

    // Pre-classifying, skipping the pipeline, impersonating, or oversizing.
    await assertFails(
      setDoc(doc(db, `firms/${FIRM_A}/clients/${CLIENT_1}/documents/up2`), {
        ...base,
        classification: { docTypeId: 'w2', confidence: 1 },
      }),
    );
    await assertFails(
      setDoc(doc(db, `firms/${FIRM_A}/clients/${CLIENT_1}/documents/up3`), {
        ...base,
        state: 'ready',
      }),
    );
    await assertFails(
      setDoc(doc(db, `firms/${FIRM_A}/clients/${CLIENT_1}/documents/up4`), {
        ...base,
        uploadedBy: 'staffA',
      }),
    );
    await assertFails(
      setDoc(doc(db, `firms/${FIRM_A}/clients/${CLIENT_1}/documents/up5`), {
        ...base,
        sizeBytes: 41943041,
      }),
    );
    await assertFails(
      setDoc(doc(db, `firms/${FIRM_A}/clients/${CLIENT_1}/documents/up6`), {
        ...base,
        sizeBytes: 0,
      }),
    );

    // And cannot delete or re-state a document once it exists.
    await assertFails(updateDoc(ref, { state: 'ready' }));
    await assertFails(deleteDoc(ref));
  });

  it('cannot write into another firm even with a valid portal claim', async () => {
    const db = taxpayer('tp1', FIRM_A, CLIENT_1);
    await assertFails(getDoc(clientDoc(db, FIRM_B, 'other')));
    await assertFails(
      setDoc(doc(db, `firms/${FIRM_B}/clients/other/documents/x`), {
        firmId: FIRM_B,
        clientId: 'other',
        state: 'uploading',
        uploadedBy: 'tp1',
        sizeBytes: 10,
      }),
    );
  });
});

describe('user index', () => {
  it('reads only itself, and cannot self-grant a firm', async () => {
    const db = staff('staffA', FIRM_A, 'owner');
    await assertSucceeds(getDoc(doc(db, 'users/staffA')));
    await assertFails(getDoc(doc(db, 'users/staffB')));
    await assertFails(updateDoc(doc(db, 'users/staffA'), { firmIds: [FIRM_A, FIRM_B] }));
    await assertSucceeds(updateDoc(doc(db, 'users/staffA'), { defaultFirmId: FIRM_A }));
  });
});

describe('Functions-only collections', () => {
  it('invites, grants and the extension queues are opaque to every client', async () => {
    const owner = staff('o', FIRM_A, 'owner');
    const tp = taxpayer('tp1', FIRM_A, CLIENT_1);
    for (const db of [owner, tp]) {
      await assertFails(getDoc(doc(db, 'invites/tok1')));
      await assertFails(getDoc(doc(db, 'portalGrants/tp1')));
      await assertFails(getDoc(doc(db, 'mail/m1')));
      await assertFails(getDoc(doc(db, 'messages/s1')));
      // The mail queue is the most dangerous write in the system: anyone who
      // can append to it can send mail as the firm.
      await assertFails(setDoc(doc(db, 'mail/forged'), { to: 'victim@example.com' }));
      await assertFails(setDoc(doc(db, 'messages/forged'), { to: '+15550199' }));
      await assertFails(setDoc(doc(db, 'invites/forged'), { firmId: FIRM_A, role: 'owner' }));
    }
  });

  it('an undeclared collection is denied', async () => {
    const db = staff('o', FIRM_A, 'owner');
    await assertFails(getDoc(doc(db, 'somethingElse/x')));
    await assertFails(setDoc(doc(db, 'somethingElse/x'), { a: 1 }));
  });
});

it('rules cover every collection the app writes', () => {
  // Guards against a new collection being added to the data model without a
  // matching rule block — the default-deny catch-all would silently break it.
  const rules = readFileSync('firestore.rules', 'utf8');
  for (const path of [
    'firms/{firmId}',
    'members/{uid}',
    'clients/{clientId}',
    'requests/{requestId}',
    'documents/{documentId}',
    'chaseMessages/{messageId}',
    'activity/{eventId}',
    'users/{uid}',
    'invites/{token}',
    'portalGrants/{uid}',
    'mail/{id}',
    'messages/{id}',
  ]) {
    assert.ok(rules.includes(`match /${path}`), `firestore.rules is missing: match /${path}`);
  }
});
