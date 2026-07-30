/**
 * Cloud Storage security-rule tests. This is where the actual tax documents
 * live — a hole here leaks W-2s and SSNs, not just metadata.
 *
 *   npm run test:rules      (needs the Storage emulator on 9199)
 */
import { after, before, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { getBytes, ref, uploadBytes, deleteObject } from 'firebase/storage';

const FIRM_A = 'firmA';
const FIRM_B = 'firmB';
const CLIENT_1 = 'client1';
const CLIENT_2 = 'client2';
const YEAR = 2025;
/** Objects are immutable, so every create-path test needs a fresh key. */
const RUN = Date.now().toString(36);

const PDF = { contentType: 'application/pdf' };
const objPath = (firmId: string, clientId: string, docId: string, name = 'x.pdf') =>
  `firms/${firmId}/${YEAR}/${clientId}/${docId}/${name}`;

let env: RulesTestEnvironment;

const staff = (uid: string, firmId: string, role: string) =>
  env.authenticatedContext(uid, { firms: { [firmId]: role } }).storage();

const taxpayer = (uid: string, firmId: string, clientId: string) =>
  env.authenticatedContext(uid, { portal: { firmId, clientId } }).storage();

const bytes = (n = 64) => new Uint8Array(n);

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'taxfax-storage-test',
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });

  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const s = ctx.storage();
    await uploadBytes(ref(s, objPath(FIRM_A, CLIENT_1, 'd1')), bytes(), PDF);
    await uploadBytes(ref(s, objPath(FIRM_A, CLIENT_2, 'd2')), bytes(), PDF);
    await uploadBytes(ref(s, objPath(FIRM_B, 'other', 'd3')), bytes(), PDF);
    await uploadBytes(ref(s, `firms/${FIRM_A}/assets/logo.png`), bytes(), {
      contentType: 'image/png',
    });
  });
});

after(async () => {
  await env?.cleanup();
});

describe('storage: tenancy', () => {
  it('anonymous reads nothing and writes nothing', async () => {
    const s = env.unauthenticatedContext().storage();
    await assertFails(getBytes(ref(s, objPath(FIRM_A, CLIENT_1, 'd1'))));
    await assertFails(uploadBytes(ref(s, objPath(FIRM_A, CLIENT_1, `new-${RUN}`)), bytes(), PDF));
  });

  it('staff read their own firm only', async () => {
    const a = staff('sa', FIRM_A, 'preparer');
    await assertSucceeds(getBytes(ref(a, objPath(FIRM_A, CLIENT_1, 'd1'))));
    await assertFails(getBytes(ref(a, objPath(FIRM_B, 'other', 'd3'))));
  });

  it('staff cannot write into another firm', async () => {
    const a = staff('sa', FIRM_A, 'preparer');
    await assertFails(uploadBytes(ref(a, objPath(FIRM_B, 'other', `x-${RUN}`)), bytes(), PDF));
  });

  it('viewers cannot upload or delete', async () => {
    const v = staff('v', FIRM_A, 'viewer');
    await assertSucceeds(getBytes(ref(v, objPath(FIRM_A, CLIENT_1, 'd1'))));
    await assertFails(uploadBytes(ref(v, objPath(FIRM_A, CLIENT_1, `vv-${RUN}`)), bytes(), PDF));
    await assertFails(deleteObject(ref(v, objPath(FIRM_A, CLIENT_1, 'd1'))));
  });
});

describe('storage: taxpayer portal', () => {
  it('reads and writes only its own client folder', async () => {
    const tp = taxpayer('tp1', FIRM_A, CLIENT_1);
    await assertSucceeds(getBytes(ref(tp, objPath(FIRM_A, CLIENT_1, 'd1'))));
    await assertSucceeds(uploadBytes(ref(tp, objPath(FIRM_A, CLIENT_1, `mine-${RUN}`)), bytes(), PDF));

    // The neighbour's documents are the whole ballgame.
    await assertFails(getBytes(ref(tp, objPath(FIRM_A, CLIENT_2, 'd2'))));
    await assertFails(uploadBytes(ref(tp, objPath(FIRM_A, CLIENT_2, `evil-${RUN}`)), bytes(), PDF));
    await assertFails(getBytes(ref(tp, objPath(FIRM_B, 'other', 'd3'))));
  });

  it('cannot delete anything, including its own upload', async () => {
    const tp = taxpayer('tp1', FIRM_A, CLIENT_1);
    await assertFails(deleteObject(ref(tp, objPath(FIRM_A, CLIENT_1, 'd1'))));
  });
});

describe('storage: upload constraints', () => {
  it('rejects executable and script-bearing types', async () => {
    const tp = taxpayer('tp1', FIRM_A, CLIENT_1);
    for (const contentType of [
      'image/svg+xml', // scriptable, renders in-browser
      'text/html',
      'application/x-msdownload',
      'application/javascript',
      'application/zip',
    ]) {
      await assertFails(
        uploadBytes(ref(tp, objPath(FIRM_A, CLIENT_1, `bad-${RUN}`)), bytes(), { contentType }),
      );
    }
  });

  it('accepts the real formats a taxpayer actually has', async () => {
    const tp = taxpayer('tp1', FIRM_A, CLIENT_1);
    for (const contentType of ['application/pdf', 'image/jpeg', 'image/heic', 'text/csv']) {
      const docId = `ok-${RUN}-${contentType.replace(/[^a-z0-9]/gi, '-')}`;
      await assertSucceeds(
        uploadBytes(ref(tp, objPath(FIRM_A, CLIENT_1, docId)), bytes(), { contentType }),
      );
    }
  });

  it('rejects empty and oversized files', async () => {
    const tp = taxpayer('tp1', FIRM_A, CLIENT_1);
    await assertFails(
      uploadBytes(ref(tp, objPath(FIRM_A, CLIENT_1, `empty-${RUN}`)), new Uint8Array(0), PDF),
    );
    await assertFails(
      uploadBytes(
        ref(tp, objPath(FIRM_A, CLIENT_1, `huge-${RUN}`)),
        new Uint8Array(40 * 1024 * 1024 + 1),
        PDF,
      ),
    );
  });

  it('objects are immutable — a rename must be copy-then-delete', async () => {
    const p = staff('sa', FIRM_A, 'preparer');
    // An overwrite is evaluated as `create` in Storage rules, so this is the
    // check that actually proves immutability rather than `allow update: if false`.
    await assertFails(uploadBytes(ref(p, objPath(FIRM_A, CLIENT_1, 'd1')), bytes(128), PDF));

    const tp = taxpayer('tp1', FIRM_A, CLIENT_1);
    await assertFails(uploadBytes(ref(tp, objPath(FIRM_A, CLIENT_1, 'd1')), bytes(128), PDF));

    // A first write to a fresh path still works; only replacement is blocked.
    await assertSucceeds(uploadBytes(ref(p, objPath(FIRM_A, CLIENT_1, `fresh-${RUN}`)), bytes(), PDF));
    await assertFails(uploadBytes(ref(p, objPath(FIRM_A, CLIENT_1, `fresh-${RUN}`)), bytes(), PDF));
  });

  it('taxYear must be four digits, so uploads cannot burrow into assets/', async () => {
    const tp = taxpayer('tp1', FIRM_A, CLIENT_1);
    await assertFails(
      uploadBytes(ref(tp, `firms/${FIRM_A}/assets/${CLIENT_1}/d/evil-${RUN}.pdf`), bytes(), PDF),
    );
    await assertFails(
      uploadBytes(ref(tp, `firms/${FIRM_A}/20XX/${CLIENT_1}/d/evil-${RUN}.pdf`), bytes(), PDF),
    );
  });
});

describe('storage: firm branding', () => {
  it('is world-readable so the portal can brand before sign-in', async () => {
    const anon = env.unauthenticatedContext().storage();
    await assertSucceeds(getBytes(ref(anon, `firms/${FIRM_A}/assets/logo.png`)));
  });

  it('is writable only by an admin, and only as a real image', async () => {
    const admin = staff('ad', FIRM_A, 'admin');
    const preparer = staff('pr', FIRM_A, 'preparer');
    const png = { contentType: 'image/png' };

    await assertSucceeds(uploadBytes(ref(admin, `firms/${FIRM_A}/assets/new-${RUN}.png`), bytes(), png));
    await assertFails(uploadBytes(ref(preparer, `firms/${FIRM_A}/assets/nope-${RUN}.png`), bytes(), png));
    await assertFails(
      uploadBytes(ref(admin, `firms/${FIRM_A}/assets/evil-${RUN}.svg`), bytes(), {
        contentType: 'image/svg+xml',
      }),
    );
    await assertFails(
      uploadBytes(ref(admin, `firms/${FIRM_A}/assets/big-${RUN}.png`), new Uint8Array(3 * 1024 * 1024), png),
    );
    // An admin of one firm is not an admin of another's branding.
    await assertFails(uploadBytes(ref(admin, `firms/${FIRM_B}/assets/x-${RUN}.png`), bytes(), png));
  });
});

describe('storage: everything else', () => {
  it('paths outside the declared layout are denied', async () => {
    const owner = staff('o', FIRM_A, 'owner');
    for (const p of ['random/x.pdf', `firms/${FIRM_A}/x.pdf`, 'firms/x.pdf', `firms/${FIRM_A}`]) {
      await assertFails(uploadBytes(ref(owner, p), bytes(), PDF));
    }
  });
});
