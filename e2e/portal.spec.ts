/**
 * End-to-end proof for the taxpayer portal, run against the real Firebase
 * Emulator Suite (Auth + Firestore + Storage + Functions) — real security
 * rules, the real Storage trigger, the real callables. Nothing is mocked.
 *
 * What this proves:
 *  1. A taxpayer signs in with a one-tap email link (no password) and lands on
 *     their own list, identified only by the auth claim.
 *  2. DESKTOP: a text-bearing W-2 PDF is uploaded, and the enriched confirmation
 *     ("Got it — W-2 from Copperline Foods.") comes from a *real* extract →
 *     classify round-trip in the emulator, not from seeded data — observed in
 *     Firestore (`state: classified`, `docTypeId: w2`, `issuer: Copperline
 *     Foods`) and echoed in the UI.
 *  3. MOBILE: an iPhone HEIC photo is transcoded to JPEG *in the browser*
 *     (WebKit) before upload — the record lands as `image/jpeg` even though the
 *     phone handed us `image/heic`. HEIC decoding is a platform capability, so
 *     the spec probes for it: where it exists the transcode is asserted down to
 *     the JPEG magic bytes, and where it doesn't (Playwright's Linux WebKit, on
 *     CI) the spec asserts the taxpayer gets a real refusal and runs the rest of
 *     the journey on the same photo as a PNG. The run annotates which path it
 *     took, so a green mobile run never implies more than it proved.
 *     (The Cloud Vision OCR extension isn't run in
 *     the local suite, so a photo can't be *classified* locally; it settles as
 *     an unsorted upload with the baseline confirmation. Enrichment is proven on
 *     desktop, where PDF text is read in-process by `unpdf`.)
 *  4. The bytes land at the exact canonical, tenant-scoped Storage path (the
 *     pipeline renames every settled doc), which means they passed the Storage
 *     security rules on the first try.
 *  5. UNDO: the taxpayer withdraws the file they just sent with one tap. The
 *     document moves to `retracted` and the checklist request it satisfied
 *     reopens to `pending` — observed in Firestore, not just a resolved promise.
 *  6. The done state renders unambiguously and invites them to leave.
 *
 * The `mobile` project is WebKit (iPhone 14 Pro): only WebKit decodes HEIC via
 * `createImageBitmap`, so that is where the HEIC transcode is proven. The
 * `desktop` project (Chromium) uploads the PDF — Chromium cannot decode HEIC,
 * and a desktop user would never hand us one.
 */
import { test, expect, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { capture } from './capture';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SHOTS = join(HERE, 'screenshots');
const FIXTURES = join(HERE, 'fixtures');

const PROJECT_ID = 'taxfax-364f6';
// The app uploads to the `.appspot.com` bucket under the emulator (so the
// Storage extension triggers fire locally); admin reads must match it.
const BUCKET = 'taxfax-364f6.appspot.com';
const API_KEY = 'fake-api-key'; // any string is accepted by the Auth emulator

const FIRM_ID = 'whitfield-rowe';
const CLIENT_ID = 'eleanor-whitfield';
const TAX_YEAR = 2025;
const EMAIL = 'eleanor.whitfield@fastmail.com';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= '127.0.0.1:9199';

let admin: App;
const db = (): Firestore => getFirestore(admin);
const requests = () => db().collection(`firms/${FIRM_ID}/clients/${CLIENT_ID}/requests`);
const documents = () => db().collection(`firms/${FIRM_ID}/clients/${CLIENT_ID}/documents`);
const clientDoc = () => db().doc(`firms/${FIRM_ID}/clients/${CLIENT_ID}`);

test.beforeAll(async () => {
  // The seed is I/O-bound against a busy emulator and can take ~a minute on its
  // own, so this hook needs more than the default per-hook budget.
  test.setTimeout(180_000);
  admin = initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET }, `e2e-${Date.now()}`);
  // A clean, February-shaped book of business, seeded straight into the emulator.
  execSync('node --experimental-strip-types seed/seed.ts', {
    cwd: ROOT,
    stdio: 'pipe',
    env: process.env,
  });
  // The seed clears Firestore but not Storage; wipe this client's objects so the
  // run is hermetic and the "what landed" assertion can't pick a stale file.
  await getStorage(admin)
    .bucket(BUCKET)
    .deleteFiles({ prefix: `firms/${FIRM_ID}/${TAX_YEAR}/${CLIENT_ID}/` });
});

test.afterAll(async () => {
  if (admin) await deleteApp(admin);
});

test.beforeEach(async () => {
  // Language is persisted to the client doc by design — a taxpayer's choice must
  // follow them into the next chase email. So every test has to start from a
  // known baseline (no stored language → resolves to the browser's `en`) instead
  // of inheriting whatever a previous test left behind.
  await clientDoc()
    .update({ language: FieldValue.delete() })
    .catch(() => {});
});

/**
 * Mints a real email-link credential through the Auth emulator's REST API and
 * builds the link our app's /portal/enter expects, exactly as Firebase's own
 * redirect would. This drives the true passwordless entry code path — no test
 * backdoor, no admin SDK auth import (which drags in an ESM-incompatible `jose`).
 */
async function emailLinkFor(email: string): Promise<string> {
  const send = await fetch(
    `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestType: 'EMAIL_SIGNIN',
        email,
        continueUrl: 'http://localhost:5173/portal/enter',
      }),
    },
  );
  if (!send.ok) throw new Error(`sendOobCode failed: ${send.status} ${await send.text()}`);

  const res = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  const body = (await res.json()) as {
    oobCodes: { email: string; requestType: string; oobCode: string }[];
  };
  const oobCode = [...body.oobCodes]
    .reverse()
    .find((c) => c.email === email && c.requestType === 'EMAIL_SIGNIN')?.oobCode;
  if (!oobCode) throw new Error('No EMAIL_SIGNIN oobCode found in the Auth emulator.');

  const target = new URL('http://localhost:5173/portal/enter');
  target.searchParams.set('apiKey', API_KEY);
  target.searchParams.set('mode', 'signIn');
  target.searchParams.set('oobCode', oobCode);
  target.searchParams.set('lang', 'en');
  target.searchParams.set('email', email);
  return target.toString();
}

async function signInAsTaxpayer(page: Page): Promise<void> {
  await page.goto(await emailLinkFor(EMAIL));
  // Sign-in + claim redirects here; the list headline then renders once the
  // Firestore listeners deliver. We wait on the `#portal-heading` id, not its
  // text, because that text is now localized — English on a fresh client, but
  // Spanish/Arabic/etc. once a language is known. Under a freshly-seeded,
  // sibling-loaded emulator that first snapshot can lag, so this wait is
  // deliberately generous.
  await expect(page.locator('#portal-heading')).toBeVisible({ timeout: 60_000 });
  // The passwordless entry is a chain of client navigations (enter → claim →
  // token refresh → /portal). Its trailing redirect can still be settling when
  // the test starts uploading, and a late remount would drop the optimistic
  // upload item. Reload once to land on a stable /portal: beforeLoad now sees the
  // persisted portal claim and renders the list directly, with nothing in flight.
  await page.reload();
  await expect(page.locator('#portal-heading')).toBeVisible({ timeout: 60_000 });
}

/**
 * Whether this browser can decode HEIC at all — a platform capability, not
 * something the app controls. macOS and iOS WebKit decode it through the OS;
 * Playwright's Linux WebKit (what CI runs) ships no decoder. Probed with the
 * real fixture bytes, so the answer is about this exact file rather than a
 * guess about the engine.
 */
async function canDecodeHeic(page: Page): Promise<boolean> {
  const heic = readFileSync(join(FIXTURES, 'w2-photo.heic')).toString('base64');
  return page.evaluate(async (data) => {
    try {
      const bitmap = await createImageBitmap(
        new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type: 'image/heic' }),
      );
      bitmap.close();
      return true;
    } catch {
      return false;
    }
  }, heic);
}

/** Polls the documents collection for the one our upload just produced. */
async function findUploadedDoc(
  match: (data: FirebaseFirestore.DocumentData) => boolean,
  timeout: number,
): Promise<{ id: string; data: FirebaseFirestore.DocumentData }> {
  let found: { id: string; data: FirebaseFirestore.DocumentData } | undefined;
  await expect
    .poll(
      async () => {
        const snap = await documents().get();
        const hit = snap.docs.find((d) => match(d.data()));
        found = hit ? { id: hit.id, data: hit.data() } : undefined;
        return found ? found.id : '';
      },
      { timeout, message: 'the document record our upload produced' },
    )
    .not.toBe('');
  return found!;
}

/**
 * The four locales the design bar is judged at: `en` (baseline), `vi` (longest
 * strings), `zh-Hans` (CJK platform-font fallback) and `ar` (RTL + bidi).
 */
const LOCALE_SHOTS = ['en', 'vi', 'zh-Hans', 'ar'] as const;
/** BCP-47 tag the shell stamps as `lang` for each, so we can wait it out. */
const BCP47: Record<(typeof LOCALE_SHOTS)[number], string> = {
  en: 'en-US',
  vi: 'vi',
  'zh-Hans': 'zh-Hans',
  ar: 'ar',
};

test('portal renders in the taxpayer’s own language', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const tag = testInfo.project.name;

  await signInAsTaxpayer(page);
  await expect(page).toHaveURL(/\/portal\/?$/);

  for (const loc of LOCALE_SHOTS) {
    // We already know the taxpayer's language from last year's return. Simulate
    // that by writing it to the client doc and letting the live Firestore
    // listener apply it — exactly the production path, no switcher, no reload.
    await clientDoc().set({ language: { locale: loc, source: 'taxpayer' } }, { merge: true });
    // The shell stamps `lang`/`dir` from the resolved locale onto its own <div>;
    // waiting for that attribute means we never screenshot the pre-load English
    // flash. (`div[lang=…]` matches the shell, not the switcher's <option>s.)
    await expect(page.locator(`div[lang="${BCP47[loc]}"]`).first()).toBeVisible({ timeout: 30_000 });
    if (loc === 'ar') await expect(page.locator('div[dir="rtl"]').first()).toBeVisible();
    await capture(page, join(SHOTS, `i18n-${loc}-${tag}.png`));
  }
});

test('taxpayer picks a language and it follows them', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const tag = testInfo.project.name;

  await signInAsTaxpayer(page);
  await expect(page).toHaveURL(/\/portal\/?$/);

  // Baseline: no stored language, the emulator browser is `en` → the English ask.
  await expect(page.getByText('Still needed')).toBeVisible();

  // The one control: pick Español from the header switcher (a real <select>).
  await page.locator('header select').selectOption('es');

  // 1) The page switches immediately, to the reviewed Spanish dictionary — proof
  //    the UI is actually driven by `t()`, not by an English literal.
  await expect(page.getByText('Todavía falta')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Still needed')).toHaveCount(0);
  await expect(page.locator('#portal-heading')).toContainText('Sus documentos para');

  // 2) The choice persists to the client doc as a taxpayer-sourced decision.
  //    This is the part that makes the *next* chase email arrive in Spanish too;
  //    a switcher that only repainted this page would be a bug, not a feature.
  await expect
    .poll(async () => (await clientDoc().get()).get('language')?.locale, {
      timeout: 15_000,
      message: 'the switcher persists the language to the client doc',
    })
    .toBe('es');
  expect((await clientDoc().get()).get('language')?.source).toBe('taxpayer');

  // 3) It follows them across a cold load: with the in-session override gone, the
  //    portal reads the persisted `client.language` and still comes up Spanish.
  await page.reload();
  await expect(page.getByText('Todavía falta')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Still needed')).toHaveCount(0);
  await capture(page, join(SHOTS, `i18n-switch-es-${tag}.png`));
});

test('taxpayer: link → send → recognized → undo → done, in one sitting', async ({ page }, testInfo) => {
  // The mobile path deliberately waits out the ~45s image-OCR window before a
  // photo settles; the first Firestore snapshot can also lag under a freshly
  // seeded, sibling-loaded emulator. Give the whole journey generous headroom —
  // it runs in ~55s locally and roughly twice that on a two-core CI runner.
  test.setTimeout(240_000);
  const isMobile = testInfo.project.name === 'mobile';
  const tag = testInfo.project.name;

  // A real taxpayer would never see a raw Firebase error; fail loudly if one
  // leaks. Two classes of noise are excluded because neither is user-facing and
  // neither can exist in a production build:
  //   1. Transient emulator/offline reconnect chatter the SDK recovers from.
  //   2. Vite dev-server HMR churn. This suite shares one dev server with other
  //      agents who edit unrelated routes while it runs; each save hot-reloads a
  //      module, surfacing as a `[vite]` reload/import error and occasionally
  //      remounting the tree (a transient provider-context error React's error
  //      boundary immediately recovers). There is no HMR client once the app is
  //      built, so none of this reaches a real taxpayer.
  const consoleErrors: string[] = [];
  const BENIGN =
    /network connection was lost|Could not reach Cloud Firestore backend|code=unavailable|ERR_NETWORK_CHANGED|Failed to load resource: the server responded with a status of 4\d\d.*emulator|\[vite\]|Importing a module script failed|Failed to fetch dynamically imported module|must be used within <AuthProvider>|recreate this component tree/i;
  page.on('console', (m) => {
    if (m.type() === 'error' && !BENIGN.test(m.text())) consoleErrors.push(m.text());
  });

  // On desktop we upload the taxpayer's W-2 into the W-2 row itself, so it lands
  // in exactly one place and reopens a real request on undo. Eleanor's seeded
  // W-2 is already accepted (so it has no uploader and would shadow ours via the
  // by-type grouping); reopen it and clear its seeded document first.
  if (!isMobile) {
    await requests()
      .doc('w2')
      .update({
        status: 'pending',
        documentIds: [],
        receivedAt: FieldValue.delete(),
        acceptedAt: FieldValue.delete(),
      });
    await documents().doc(`${CLIENT_ID}-w2`).delete();
  }

  // ── 1. One-tap entry, no password ──────────────────────────────────────────
  await signInAsTaxpayer(page);
  await expect(page).toHaveURL(/\/portal\/?$/);
  await expect(page.getByText(/of\s+\d+\s+received/i)).toBeVisible();
  await capture(page, join(SHOTS, `${tag}-01-list.png`));

  // ── 2. Send the document the way this taxpayer actually would ───────────────
  // Desktop: the requested W-2, as a PDF, straight into its checklist row.
  // Mobile: a photographed W-2 through the "Something else?" camera.
  //
  // HEIC is the whole point of the mobile path — it is what an iPhone shoots by
  // default — but decoding it is a platform capability, not something the app
  // can polyfill: WebKit reads it through the OS on macOS and iOS, while
  // Playwright's Linux build (what CI runs) ships no HEIC decoder at all. So
  // probe instead of assuming. Where HEIC decodes we assert the transcode down
  // to the JPEG magic bytes; where it cannot, we assert the taxpayer gets a real
  // refusal rather than a silent failure, and run the rest of the journey on the
  // same photo as a PNG. Skipping outright would leave the phone journey — the
  // reason this project exists on mobile — untested on every CI run.
  const heicDecodes = isMobile && (await canDecodeHeic(page));
  const photo = heicDecodes
    ? { file: 'w2-photo.heic', ext: 'jpg', type: 'image/jpeg', magic: [0xff, 0xd8, 0xff] }
    : { file: 'w2-photo.png', ext: 'png', type: 'image/png', magic: [0x89, 0x50, 0x4e] };
  if (isMobile) {
    testInfo.annotations.push({
      type: 'heic',
      description: heicDecodes
        ? 'browser decodes HEIC — transcode asserted at the byte level'
        : 'browser cannot decode HEIC — asserted the refusal path, journey run as PNG',
    });
  }

  let scope;
  if (isMobile) {
    scope = page.locator('section[aria-labelledby="extra-heading"]');
    const camera = scope.locator('input[type="file"][capture="environment"]').first();

    if (!heicDecodes) {
      // The taxpayer must be told, not left staring at a stalled row. Asserted
      // through the alert role so translated copy can't quietly disable this.
      await camera.setInputFiles(join(FIXTURES, 'w2-photo.heic'));
      await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 20_000 });
    }
    await camera.setInputFiles(join(FIXTURES, photo.file));
  } else {
    scope = page.locator('li').filter({ has: page.getByRole('heading', { name: /W-2/ }) });
    await scope.locator('input[type="file"][multiple]').first().setInputFiles(join(FIXTURES, 'w2-form.pdf'));
  }

  const startedName = isMobile ? /w2-photo/i : /w2-form/i;
  await expect(scope.getByText(new RegExp(`${startedName.source}|Preparing|Got it|%`, 'i')).first()).toBeVisible({
    timeout: 20_000,
  });
  await capture(page, join(SHOTS, `${tag}-02-mid-upload.png`));

  // ── 3. Recognized: the record exists, correctly, from a real round-trip ─────
  // This exact sentence can only come from our upload — no seed uses the
  // "Copperline Foods" issuer, and no seeded document is an unsorted "other".
  const confirmText = isMobile
    ? 'Got it — saved to your file.'
    : 'Got it — W-2 from Copperline Foods.';
  let uploaded: { id: string; data: FirebaseFirestore.DocumentData };
  if (isMobile) {
    // Transcode proof: the phone handed us a HEIC (w2-photo.heic), and the
    // settled record is a JPEG — new content type, new `.jpg` name. Nothing but
    // the in-browser transcode turns a HEIC input into an image/jpeg object.
    // Where the browser cannot decode HEIC this asserts the PNG we fell back to,
    // and `photo` is the single place that difference lives.
    // (Waiting for a settled state also means the storagePath below is final.)
    uploaded = await findUploadedDoc(
      (d) =>
        d.uploadedVia === 'portal' &&
        d.contentType === photo.type &&
        (d.state === 'needs_review' || d.state === 'classified'),
      150_000,
    );
    expect(uploaded.data.originalName).toMatch(new RegExp(`\\.${photo.ext}$`, 'i'));
  } else {
    // Enrichment proof: classified as a W-2 with the issuer we planted, by the
    // emulator's own extract → classify pass — not seeded.
    uploaded = await findUploadedDoc(
      (d) =>
        d.state === 'classified' &&
        d.classification?.docTypeId === 'w2' &&
        d.classification?.issuer === 'Copperline Foods',
      60_000,
    );
  }
  await expect(page.getByText(confirmText).first()).toBeVisible({ timeout: 60_000 });
  await capture(page, join(SHOTS, `${tag}-03-recognized.png`));

  // ── 4. Prove it landed where the rules demand, at the canonical path ────────
  const bucket = getStorage(admin).bucket(BUCKET);
  const wantExt = isMobile ? photo.ext : 'pdf';
  const wantType = isMobile ? photo.type : 'application/pdf';

  // The pipeline renames every settled doc, so the record's own storagePath is
  // the source of truth for where the bytes ended up.
  const storagePath = String(uploaded.data.storagePath);
  expect(storagePath).toMatch(
    new RegExp(`^firms/${FIRM_ID}/${TAX_YEAR}/${CLIENT_ID}/[^/]+/[^/]+\\.${wantExt}$`),
  );
  const [exists] = await bucket.file(storagePath).exists();
  expect(exists, `object present at ${storagePath}`).toBe(true);
  const [meta] = await bucket.file(storagePath).getMetadata();
  expect(meta.contentType).toBe(wantType);

  if (isMobile) {
    // Content-level proof: the stored bytes carry the magic number of the format
    // we expect. On the HEIC path that is the JPEG SOI marker (FF D8 FF), which
    // a HEIC merely renamed to .jpg would not have — so it is proof the
    // on-device canvas transcode really re-encoded the photo.
    const [bytes] = await bucket.file(storagePath).download();
    expect([bytes[0], bytes[1], bytes[2]]).toEqual(photo.magic);
  }

  // ── 5. Undo: withdraw it, and prove the withdrawal in Firestore ─────────────
  const requestId = uploaded.data.requestId as string | undefined;
  await page.getByRole('button', { name: /Undo/i }).first().click();

  await expect
    .poll(async () => (await documents().doc(uploaded.id).get()).get('state'), {
      timeout: 20_000,
      message: 'the document moves to `retracted`',
    })
    .toBe('retracted');
  expect((await documents().doc(uploaded.id).get()).get('retractedAt')).toBeTruthy();

  if (requestId) {
    // The request it satisfied reopens (no other document covers it).
    await expect
      .poll(async () => (await requests().doc(requestId).get()).get('status'), {
        timeout: 20_000,
        message: 'the checklist request reopens to `pending`',
      })
      .toBe('pending');
    const reopened = (await requests().doc(requestId).get()).get('documentIds') as string[] | undefined;
    expect(reopened ?? []).not.toContain(uploaded.id);
  }

  // The confirmation is gone from the UI — the taxpayer sees it was undone.
  await expect(page.getByText(confirmText)).toHaveCount(0, { timeout: 15_000 });
  await capture(page, join(SHOTS, `${tag}-04-undo.png`));

  // ── 6. Done state: finish the list, then confirm the unambiguous exit ───────
  const reqs = await requests().get();
  const batch = db().batch();
  const now = new Date();
  reqs.docs.forEach((d) => {
    // A request is finished only when it holds as many documents as it asked
    // for: `requestSatisfied` (packages/shared) holds both terminal statuses to
    // `expectedCount`, because the server flips a request for two W-2s to
    // `accepted` on the first one. Writing the status alone would manufacture
    // precisely the half-finished state the portal now refuses to call done, so
    // this step would be demanding the product lie in order to go green.
    const want = Math.max(1, (d.get('expectedCount') as number | undefined) ?? 1);
    const documentIds = ((d.get('documentIds') as string[] | undefined) ?? []).slice();
    while (documentIds.length < want) documentIds.push(`e2e-filled-${d.id}-${documentIds.length}`);
    batch.update(d.ref, { status: 'accepted', acceptedAt: now, documentIds });
  });
  await batch.commit();

  // The list is a live Firestore subscription, so completing every request flips
  // the page to the done panel reactively — no reload. A warm listener that is
  // already connected receives the pushed update far more reliably than a cold
  // re-subscription would under a heavily-loaded emulator.
  await expect(page.getByText(/that.s everything/i)).toBeVisible({ timeout: 30_000 });
  // "Nothing more to send" is unique to the done panel — proof the taxpayer is
  // told, unambiguously, that they can leave.
  await expect(page.getByText(/nothing more to send/i)).toBeVisible();
  await capture(page, join(SHOTS, `${tag}-05-done.png`));

  // The vermilion seal is the last thing a taxpayer sees, and the firm's clients
  // use both themes. Toggling the `.dark` class is precisely what the app's own
  // applyTheme() does (web/src/lib/theme.ts), so this is a faithful dark render.
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await expect(page.getByText(/that.s everything/i)).toBeVisible();
  await capture(page, join(SHOTS, `${tag}-05-done-dark.png`));
  await page.evaluate(() => document.documentElement.classList.remove('dark'));

  expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
});
