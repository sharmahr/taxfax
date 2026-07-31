/**
 * End-to-end proof for firm onboarding + the client-import crux, run against the
 * real Firebase Emulator Suite (Auth + Firestore + Functions) — real security
 * rules, the real `importClients` callable. Nothing is mocked.
 *
 * What this proves, in one sitting, exactly as a January firm would live it:
 *  1. A firm signs up and lands in the guided first-run flow.
 *  2. A genuinely messy CSV — a quoted comma inside a name, a malformed phone,
 *     an in-file duplicate email, CRLF line endings — is parsed *in the browser*
 *     and previewed truthfully, with each problem flagged before anything writes.
 *  3. Committing lands exactly the right clients in Firestore: the comma-name is
 *     intact, the unusable phone is dropped (not the client), the duplicate is
 *     collapsed to one.
 *  4. Re-running the identical import is a no-op — created: 0, no duplicates —
 *     because the server dedupes on email. Re-running an import is terrifying
 *     otherwise, so we prove it is safe.
 *  5. The rest of the surfaces render: the prior-year checklist payoff, the team
 *     step, and the cadence message preview; plus Settings → Members and
 *     Settings → Cadence.
 *
 * Both Playwright projects run this: `desktop` at 1440×900, `mobile` on an
 * iPhone 14 Pro (WebKit). The app auto-targets the emulators on `localhost` in
 * dev, so no test backdoor is needed — this is the real signup code path.
 */
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { capture } from './capture';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, 'screenshots');
const PROJECT_ID = 'taxfax-364f6';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';

let admin: App;
const db = (): Firestore => getFirestore(admin);

test.beforeAll(() => {
  admin = initializeApp({ projectId: PROJECT_ID }, `e2e-onboarding-${Date.now()}`);
});

test.afterAll(async () => {
  if (admin) await deleteApp(admin);
});

/**
 * A deliberately messy roster — the shape of a real Lacerte/Drake export a
 * partner would paste in without cleaning first. Every case the brief calls out
 * is present, and every row carries an email so the re-run is a true no-op.
 *
 *  - Header names are idiosyncratic ("E-mail Address", "Phone #") to exercise
 *    column inference.
 *  - "Whitfield, Eleanor" is quoted so its comma is part of the name, not a
 *    column break.
 *  - "not-a-phone" is unusable — the client should import without a phone.
 *  - dana.okafor@example.com appears twice — the second is an in-file duplicate.
 *  - Line endings are CRLF, as Windows tax software emits.
 */
const CSV_ROWS = [
  'Client Name,E-mail Address,Phone #,Entity,Filing Status',
  '"Whitfield, Eleanor",eleanor.w@example.com,(415) 555-0100,1040,MFJ',
  'Marcus Chen,marcus.chen@example.com,not-a-phone,1040,Single',
  'Priya Raman,priya.raman@example.com,415.555.0111,1065,',
  'Dana Okafor,dana.okafor@example.com,+1 415 555 0144,1120S,MFS',
  'Dana Okafor (dupe),dana.okafor@example.com,415-555-0155,1040,Single',
  'Sofia Nguyen,sofia.nguyen@example.com,4155550166,1040,HOH',
];
const CSV = CSV_ROWS.join('\r\n') + '\r\n';

const EXPECTED_NAMES = [
  'Whitfield, Eleanor',
  'Marcus Chen',
  'Priya Raman',
  'Dana Okafor',
  'Sofia Nguyen',
];

function csvFile() {
  return { name: 'clients-messy.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf-8') };
}

function shot(page: Page, info: TestInfo, name: string) {
  return capture(page, join(SHOTS, `onb-${info.project.name}-${name}.png`));
}

// Sonner pauses its auto-dismiss timer while the headless page is unfocused, so
// success toasts otherwise linger over the surface underneath (notably the
// import summary's stat ribbon on mobile). We can't remove Sonner's nodes — that
// corrupts React's reconciliation — so we hide the toaster region visually. This
// is registered as an init script so it survives full-page navigations too. It's
// screenshot hygiene: the surfaces underneath are real, the transient toast just
// isn't in frame.
function hideToasts(page: Page) {
  return page.addInitScript(() => {
    const inject = () => {
      if (document.getElementById('e2e-hide-toasts')) return;
      const style = document.createElement('style');
      style.id = 'e2e-hide-toasts';
      style.textContent = '[data-sonner-toaster]{display:none!important}';
      document.head?.appendChild(style);
    };
    if (document.head) inject();
    else document.addEventListener('DOMContentLoaded', inject);
  });
}

interface ClientDoc {
  displayName: string;
  entityType: string;
  filingStatus?: string;
  primaryContact?: { name?: string; email?: string; phone?: string };
}

async function clientsFor(firmId: string): Promise<ClientDoc[]> {
  const snap = await db().collection(`firms/${firmId}/clients`).get();
  return snap.docs.map((d) => d.data() as ClientDoc);
}

async function signUp(page: Page, ownerName: string, firmName: string, email: string) {
  await page.goto('/signup');
  await page.getByRole('heading', { name: /create your workspace/i }).waitFor();
  await page.locator('input[name="name"]').fill(ownerName);
  await page.locator('input[name="organization"]').fill(firmName);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill('taxfax-e2e-2026');
  await page.getByRole('button', { name: /create workspace/i }).click();
  // createFirm provisions server-side, then the app routes a brand-new firm
  // straight into the guided flow, because a firm with no clients has nothing
  // to read on a dashboard. Waiting for the app's own navigation rather than
  // issuing our own `goto('/onboarding')` is both the fix for a real race — our
  // goto could be interrupted mid-flight by the app's, which is what CI saw —
  // and the only coverage this destination has anywhere.
  await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
}

/** The firm this run just provisioned — the newest with our clean name. */
async function newestFirmId(firmName: string): Promise<string> {
  const q = await db().collection('firms').where('name', '==', firmName).get();
  if (q.empty) return '';
  const newest = [...q.docs].sort(
    (a, b) => (b.get('createdAt')?.toMillis?.() ?? 0) - (a.get('createdAt')?.toMillis?.() ?? 0),
  )[0];
  return newest.id;
}

test('firm signs up, imports a messy CSV, and a re-run is a no-op', async ({ page }, info) => {
  test.setTimeout(120_000);
  const tag = info.project.name;
  // Clean, professional identities so the live email preview reads like a real
  // firm; only the email carries a unique token (it shows small, in the nav).
  const firmName = tag === 'mobile' ? 'Brightwater Tax Group' : 'Rivera & Lowe CPAs';
  const ownerName = tag === 'mobile' ? 'Sam Brightwater' : 'Dana Rivera';
  const email = `partner.${Date.now().toString(36)}@${tag}.taxfax.test`;

  // Surface any raw Firebase error that leaks to the console — a firm must never
  // see one, and neither should our logs.
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  // Keep transient success toasts out of the screenshots (see hideToasts).
  await hideToasts(page);

  // ── 1. Sign up ─────────────────────────────────────────────────────────────
  await signUp(page, ownerName, firmName, email);

  // Resolve the firm the signup just provisioned.
  let firmId = '';
  await expect
    .poll(async () => (firmId = await newestFirmId(firmName)), {
      timeout: 20_000,
      message: 'the firm document created at signup',
    })
    .not.toBe('');

  // ── 2. Into the guided flow, step 1: firm profile ──────────────────────────
  await expect(page.getByRole('heading', { name: 'Set up your firm' })).toBeVisible({ timeout: 25_000 });
  await shot(page, info, '01-profile');

  await page.getByRole('button', { name: /save & continue/i }).click();

  // ── 3. Step 2: the import — drop the messy CSV ─────────────────────────────
  await expect(page.getByRole('heading', { name: 'Import your clients' })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(csvFile());

  // Preview renders from an in-browser parse — no upload yet.
  await expect(page.getByRole('heading', { name: 'Match your columns' })).toBeVisible({ timeout: 15_000 });

  // The messy cases are legible in the preview *before* committing. Name and
  // status render in both the mobile card list and the sm+ table (one is hidden
  // per viewport), so we match only the visible instance.
  await expect(page.getByText('Whitfield, Eleanor').filter({ visible: true })).toBeVisible(); // quoted comma survived
  await expect(page.getByText(/5\s+new/i)).toBeVisible();

  // Expand the "needs a look" ledger and assert both flagged cases there. The
  // ledger is a single, viewport-independent summary, so it proves the malformed
  // phone and the in-file duplicate were caught without depending on the table
  // (whose columns collapse on mobile).
  const flagged = page.locator('summary', { hasText: /need(s)? a look/i });
  await expect(flagged).toBeVisible();
  await flagged.click();
  await expect(page.getByText(/isn.t dialable/i)).toBeVisible();            // unusable phone flagged
  await expect(page.getByText(/Duplicate of an earlier row/i)).toBeVisible(); // in-file duplicate caught
  await shot(page, info, '02-import-preview');

  // ── 4. Commit, and prove exactly the right rows landed ─────────────────────
  await page.getByRole('button', { name: /^Import 5 clients$/ }).click();
  await expect(page.getByRole('heading', { name: /imported 5 clients/i })).toBeVisible({ timeout: 20_000 });
  await shot(page, info, '03-import-summary');

  const after = await clientsFor(firmId);
  expect(after).toHaveLength(5);

  const names = after.map((c) => c.displayName).sort();
  expect(names).toEqual([...EXPECTED_NAMES].sort());
  expect(names).not.toContain('Dana Okafor (dupe)'); // the duplicate collapsed to the first

  const marcus = after.find((c) => c.displayName === 'Marcus Chen');
  expect(marcus?.primaryContact?.email).toBe('marcus.chen@example.com');
  expect(marcus?.primaryContact?.phone).toBeUndefined(); // unusable phone dropped, client kept

  const eleanor = after.find((c) => c.displayName === 'Whitfield, Eleanor');
  expect(eleanor?.filingStatus).toBe('mfj');

  const priya = after.find((c) => c.displayName === 'Priya Raman');
  expect(priya?.entityType).toBe('partnership'); // 1065 → partnership, inferred

  // ── 5. Re-run the identical import — the preview must refuse it ────────────
  // Re-uploading the file you just imported is the second thing every firm does.
  // The server has always deduped by email — that is proven against the real
  // callable in functions/src/firm/tenancy.test.ts:350 — but the preview used to
  // offer "Import 5 clients" and then create nothing. It now reads the roster
  // first, so the refusal is what needs proving here, and duplicating the
  // server-side guarantee at this layer would only make it slower to run.
  await page.getByRole('button', { name: /import another file/i }).click();
  await expect(page.getByText(/drop a csv here/i)).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(csvFile());
  await expect(page.getByRole('heading', { name: 'Match your columns' })).toBeVisible();

  await expect(page.getByText(/your roster is up to date/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: /^Nothing to import$/ })).toBeDisabled();
  await shot(page, info, '03b-import-refused');

  const afterRerun = await clientsFor(firmId);
  expect(afterRerun, 'a re-run must not duplicate anyone').toHaveLength(5);

  // ── 6. The rest of the first-run surfaces render ───────────────────────────
  await page.getByRole('button', { name: 'See a checklist build itself' }).click();
  await expect(page.getByRole('heading', { name: 'See a checklist build itself' })).toBeVisible();
  await shot(page, info, '04-prior-year');

  await page.getByRole('button', { name: 'Invite your team' }).click();
  await expect(page.getByRole('heading', { name: 'Invite your team' })).toBeVisible();
  await shot(page, info, '05-team');

  await page.getByRole('button', { name: 'Tune the chase' }).click();
  await expect(page.getByRole('heading', { name: 'Tune the chase' })).toBeVisible();
  await expect(page.getByText('The schedule', { exact: true })).toBeVisible();
  await shot(page, info, '06-cadence');

  // ── 7. Settings: members & roles ───────────────────────────────────────────
  // First, the honest just-signed-up state: one owner, nobody else yet. The
  // empty state is a first-class screen, not a blank table.
  await page.goto('/settings/members');
  await expect(page.getByRole('heading', { name: 'Members & roles' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/just you so far/i)).toBeVisible({ timeout: 15_000 });
  await shot(page, info, '07-settings-members-empty');

  // Now seed two colleagues straight into Firestore (admin SDK, bypasses rules,
  // touches only this test firm) so the populated roster renders the way a
  // staffed firm sees it — and the last-owner lock on the sole owner is legible.
  await db().doc(`firms/${firmId}/members/e2e-admin`).set({
    uid: 'e2e-admin', firmId, email: 'marcus@example.com', name: 'Marcus Whitfield',
    role: 'admin', avatarColor: '#2E5B8B', status: 'active', joinedAt: new Date(),
  });
  await db().doc(`firms/${firmId}/members/e2e-prep`).set({
    uid: 'e2e-prep', firmId, email: 'priya@example.com', name: 'Priya Raghunathan',
    role: 'preparer', avatarColor: '#3D6B4A', status: 'active', joinedAt: new Date(),
  });
  // The signup→createFirm path stamps the owner's member name from the email
  // local-part (the ID token has no `name` claim yet — see the report), so the
  // owner would show as "partner.ms7ywcct". Correct it to the real name for a
  // truthful screenshot; the underlying bug is reported separately.
  const owners = await db().collection(`firms/${firmId}/members`).where('role', '==', 'owner').get();
  await owners.docs[0]!.ref.update({ name: ownerName });
  await page.reload();
  await expect(page.getByText('Priya Raghunathan')).toBeVisible({ timeout: 15_000 });
  // The sole owner can't be removed (it's you, and you're the last owner); a
  // colleague can. The constraint shows as a disabled control, never a server
  // error after the fact.
  await expect(page.getByRole('button', { name: `Remove ${ownerName}` })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Remove Priya Raghunathan' })).toBeEnabled();
  // On the phone the roster sits below the role legend; scroll it into frame so
  // the shot shows the locked sole-owner next to editable colleagues — the whole
  // point being that the constraint reads as a disabled control, up front.
  if (info.project.name === 'mobile') {
    await page.getByText('Priya Raghunathan').scrollIntoViewIfNeeded();
  }
  await shot(page, info, '07-settings-members-staffed');

  await page.goto('/settings/cadence');
  await expect(page.getByRole('heading', { name: 'Chase cadence' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('The schedule', { exact: true })).toBeVisible();
  // On desktop the live preview sits in the right rail, already in frame. On the
  // phone it stacks below the controls, so pull the actual message text into
  // view — the whole point of this screen is that a partner sees what clients
  // receive before turning the chase on.
  if (info.project.name === 'mobile') {
    await page.getByText('What they receive', { exact: true }).scrollIntoViewIfNeeded();
  }
  await shot(page, info, '08-settings-cadence');

  // Catch a genuine rule/callable rejection surfacing to the client — the real
  // multi-tenant-safety signal. Transient emulator reconnect noise
  // (`code=unavailable`, "offline mode"), which WebKit logs and then recovers
  // from, is not a leak.
  const leaked = consoleErrors.filter((e) =>
    /permission-denied|unauthenticated|invalid-argument|failed-precondition/i.test(e),
  );
  expect(leaked, `a Firebase rule/callable error leaked: ${leaked.join(' | ')}`).toEqual([]);
});
