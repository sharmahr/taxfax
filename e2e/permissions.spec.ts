/**
 * End-to-end proof for the multi-tenant boundary, from the browser, run against
 * the real Firebase Emulator Suite (Auth + Firestore + Functions) — the real
 * security rules and the real callables. Nothing is mocked; the admin SDK is
 * used only to *seed* the two tenants, never to make an assertion pass.
 *
 * `firestore.rules.test.ts` and `storage.rules.test.ts` already prove the rules
 * in isolation. What is NOT proven there is that the shipped client honours them.
 * This proves, end to end:
 *  1. A signed-in member of firm A cannot read firm B's client, requests,
 *     documents or activity — and CAN read its own (the positive control that
 *     stops this from being a test that refuses everything). Plus: the shipped
 *     app, navigated to a foreign client URL, resolves the firm from the auth
 *     claim (never the URL) and shows "belongs to a different workspace" instead
 *     of fetching across the tenant line.
 *  2. A portal taxpayer authenticated for client X cannot reach client Y's
 *     documents, nor any firm-side surface (activity), and is refused a firm-side
 *     callable — while their own client's documents read fine.
 *  3. Role restriction holds at the callable, not merely hidden in the UI: a
 *     viewer is refused the preparer-gated chase actions, while an owner is
 *     allowed them.
 *  4. An anonymous visitor hitting an app URL is redirected to /login, and a
 *     data request without a credential is refused.
 *
 * The discipline this file is built on — learned the hard way in this codebase:
 * a security test that only asserts "an error happened" is not a security test.
 * Eight boundary tests once passed against a callable returning INTERNAL on every
 * call. So every refusal here asserts a *genuine authorization* failure
 * (`PERMISSION_DENIED`), never `INTERNAL` or a network error, and every "you
 * can't" is paired with a "but the right principal can", so a blanket failure
 * can't masquerade as a passing boundary. This mirrors `assertRefused()` in
 * `functions/src/firm/portal.test.ts`.
 *
 * Why the cross-tenant reads use the Firestore REST endpoint from inside the
 * page rather than the SDK object: the app doesn't expose its Firestore instance
 * on `window`, and a bare `import('firebase/firestore')` can't be resolved at
 * runtime under Vite. So the reads are issued with `fetch()` *from the app
 * origin* carrying the signed-in user's real ID token. The emulator enforces the
 * identical security rules for a user-token REST read as for the SDK (only the
 * admin credential bypasses them, which we never use for an assertion), and CORS
 * is open to the app origin. It is the same credential, the same rules, the same
 * refusal the SDK would get — issued from the browser, not Node.
 *
 * Auth is driven through the Auth emulator REST API (see chase.spec.ts for why
 * we avoid importing firebase-admin/auth). The suite is shared, so this run is
 * hermetic: two firms with unique ids, cleaned up in afterAll.
 */
import { test, expect, type Page } from '@playwright/test';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'taxfax-364f6';
const REGION = 'us-central1';
const API_KEY = 'fake-api-key';
const AUTH_HOST = '127.0.0.1:9099';
const FS_BASE = `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const FN_BASE = `http://127.0.0.1:5001/${PROJECT_ID}/${REGION}`;
const PASSWORD = 'taxfax-e2e-2026';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= AUTH_HOST;

let admin: App;
const db = (): Firestore => getFirestore(admin);

// ── Auth emulator REST helpers (no firebase-admin/auth) ──────────────────────

async function restJson(url: string, init: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}
const createdUids: string[] = [];

async function createUser(email: string): Promise<string> {
  const r = await restJson(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }) },
  );
  if (!r.body.localId) throw new Error(`signUp failed: ${JSON.stringify(r.body)}`);
  createdUids.push(r.body.localId);
  return r.body.localId as string;
}
async function setClaims(uid: string, claims: Record<string, unknown>): Promise<void> {
  const r = await restJson(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:update`,
    { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer owner' }, body: JSON.stringify({ localId: uid, emailVerified: true, customAttributes: JSON.stringify(claims) }) },
  );
  if (r.status !== 200) throw new Error(`accounts:update failed: ${JSON.stringify(r.body)}`);
}
async function signIn(email: string): Promise<string> {
  const r = await restJson(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }) },
  );
  if (!r.body.idToken) throw new Error(`signIn failed: ${JSON.stringify(r.body)}`);
  return r.body.idToken as string;
}
async function deleteUser(uid: string): Promise<void> {
  await restJson(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:delete`,
    { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer owner' }, body: JSON.stringify({ localId: uid }) },
  ).catch(() => {});
}

interface CallResult {
  status: number;
  result: any;
  error?: { message?: string; status?: string };
}
async function call(name: string, idToken: string | null, data: unknown): Promise<CallResult> {
  const res = await fetch(`${FN_BASE}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: 'Bearer ' + idToken } : {}) },
    body: JSON.stringify({ data }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, result: body.result, error: body.error };
}

// ── The refusal discipline ───────────────────────────────────────────────────

/** A callable refusal that is a genuine authorization denial — not a crash
 *  (INTERNAL), not a missing/other error. Mirrors portal.test.ts assertRefused,
 *  then goes one better and pins the exact code. */
function assertDenied(res: CallResult, why: string): void {
  expect(res.error, `${why}: expected a refusal, got none (${JSON.stringify(res.result)})`).toBeTruthy();
  expect(res.error?.status, `${why}: failed with INTERNAL — the callable crashed rather than refusing`).not.toBe('INTERNAL');
  expect(res.error?.status, `${why}: expected a genuine PERMISSION_DENIED`).toBe('PERMISSION_DENIED');
}

interface RestRead {
  status: number;
  errorStatus: string | null;
  hasData: boolean;
}
/** Issue a Firestore REST read *from the page's origin* with an optional user
 *  token. Returns the HTTP status and the emulator's canonical error status. */
async function pageRead(page: Page, path: string, token: string | null): Promise<RestRead> {
  return page.evaluate(
    async ({ base, path, token }) => {
      const res = await fetch(`${base}/${path}`, token ? { headers: { Authorization: 'Bearer ' + token } } : {});
      let body: any = null;
      try {
        body = await res.json();
      } catch {
        // non-JSON
      }
      const node = Array.isArray(body) ? body[0] : body;
      return {
        status: res.status,
        errorStatus: node && node.error ? node.error.status ?? null : null,
        hasData: !!(node && (node.fields || node.documents)),
      };
    },
    { base: FS_BASE, path, token },
  );
}
/** A REST read that is a genuine authorization denial of existing data. */
function assertRestDenied(r: RestRead, why: string): void {
  expect(r.status, `${why}: expected HTTP 403`).toBe(403);
  expect(r.errorStatus, `${why}: failed with INTERNAL, not a refusal`).not.toBe('INTERNAL');
  expect(r.errorStatus, `${why}: expected genuine PERMISSION_DENIED`).toBe('PERMISSION_DENIED');
}

/** login.tsx fires two client-side redirects to /dashboard as auth settles; on
 *  WebKit the second can interrupt a plain goto that follows. Retry until the
 *  target URL sticks. */
async function gotoAndStick(page: Page, path: string, settled: RegExp): Promise<void> {
  await expect(async () => {
    await page.goto(path);
    await expect(page).toHaveURL(settled, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
}

// ── Hermetic two-tenant seed ─────────────────────────────────────────────────

let firmA = '';
let firmB = '';
const CLIENT_X = 'clientx';
const CLIENT_Y = 'clienty';
const CLIENT_B = 'clientb';

let ownerToken = '';
let viewerToken = '';
let portalToken = '';
let ownerCreds = { email: '' };

async function seedFirm(id: string, name: string): Promise<void> {
  await db().doc(`firms/${id}`).set({
    id, name, slug: id, createdAt: new Date(), taxYear: 2025, timezone: 'UTC',
    branding: { displayName: name, accent: '#8B3A2E', replyToEmail: `docs@${id}.test`, supportPhone: '+15125550100' },
    chase: { enabled: true, profile: 'standard', quietHours: { start: 20, end: 8 }, sendOnWeekends: false, deadline: '04-15', escalateAfterStep: 4, smsEnabled: true, signature: '' },
    plan: 'firm',
  });
  await db().doc(`firms/${id}/activity/seed-event`).set({
    id: 'seed-event', type: 'checklist_sent', summary: 'Seeded activity row.',
    actor: { name: 'Seed', kind: 'staff' }, createdAt: new Date(),
  });
}

async function seedClient(firmId: string, clientId: string, displayName: string): Promise<void> {
  await db().doc(`firms/${firmId}/clients/${clientId}`).set({
    id: clientId, firmId, taxYear: 2025, displayName, sortName: displayName,
    entityType: 'individual', filingStatus: 'single',
    primaryContact: { name: displayName, email: `${clientId}@taxpayer.test`, phone: '+15125550100' },
    tags: [], stage: 'awaiting',
    progress: { total: 1, received: 0, accepted: 0, rejected: 0, overdue: 0, percent: 0 },
    chase: { status: 'active', stepIndex: 0, sentCount: 0, startedAt: new Date(), nextDueAt: new Date() },
    createdAt: new Date(), updatedAt: new Date(),
  });
  await db().doc(`firms/${firmId}/clients/${clientId}/requests/w2`).set({
    id: 'w2', firmId, clientId, taxYear: 2025, docTypeId: 'w2',
    reason: 'You reported a W-2 last year.', source: 'prior_year', priority: 'critical',
    expectedCount: 1, status: 'pending', documentIds: [], order: 0, createdAt: new Date(), updatedAt: new Date(),
  });
  await db().doc(`firms/${firmId}/clients/${clientId}/documents/doc1`).set({
    id: 'doc1', firmId, clientId, taxYear: 2025,
    storagePath: `firms/${firmId}/2025/${clientId}/doc1/w2.pdf`,
    originalName: 'w2.pdf', contentType: 'application/pdf', sizeBytes: 100_000,
    state: 'classified', requestId: 'w2', uploadedBy: 'seed', uploadedVia: 'portal', uploadedAt: new Date(),
  });
}

test.beforeAll(async () => {
  test.setTimeout(120_000);
  admin = initializeApp({ projectId: PROJECT_ID }, `e2e-perm-${Date.now()}`);
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  firmA = `e2e-perm-a-${stamp}`;
  firmB = `e2e-perm-b-${stamp}`;

  await seedFirm(firmA, 'Alderman & Co');
  await seedFirm(firmB, 'Bergen Tax Partners');
  await seedClient(firmA, CLIENT_X, 'Xavier Portal');
  await seedClient(firmA, CLIENT_Y, 'Yolanda Sibling');
  await seedClient(firmB, CLIENT_B, 'Bianca Bergen');

  const ownerEmail = `owner-${firmA}@perm.test`;
  const ownerUid = await createUser(ownerEmail);
  await setClaims(ownerUid, { firms: { [firmA]: 'owner' } });
  await db().doc(`firms/${firmA}/members/${ownerUid}`).set({
    uid: ownerUid, firmId: firmA, email: ownerEmail, name: 'Olivia Owner', role: 'owner', status: 'active', joinedAt: new Date(),
  });
  ownerToken = await signIn(ownerEmail);
  ownerCreds = { email: ownerEmail };

  const viewerEmail = `viewer-${firmA}@perm.test`;
  const viewerUid = await createUser(viewerEmail);
  await setClaims(viewerUid, { firms: { [firmA]: 'viewer' } });
  await db().doc(`firms/${firmA}/members/${viewerUid}`).set({
    uid: viewerUid, firmId: firmA, email: viewerEmail, name: 'Victor Viewer', role: 'viewer', status: 'active', joinedAt: new Date(),
  });
  viewerToken = await signIn(viewerEmail);

  const portalEmail = `portal-${firmA}@perm.test`;
  const portalUid = await createUser(portalEmail);
  await setClaims(portalUid, { portal: { firmId: firmA, clientId: CLIENT_X } });
  portalToken = await signIn(portalEmail);
});

test.afterAll(async () => {
  try {
    await db().recursiveDelete(db().doc(`firms/${firmA}`));
    await db().recursiveDelete(db().doc(`firms/${firmB}`));
    await Promise.all(createdUids.map(deleteUser));
  } catch {
    // best-effort hermetic cleanup
  }
  if (admin) await deleteApp(admin);
});

// ── 1. Cross-tenant: firm A cannot read firm B ───────────────────────────────

test('a firm-A member cannot read firm B, but can read its own — and the app never crosses the tenant line', async ({ page }) => {
  test.setTimeout(120_000);

  const consoleErrors: string[] = [];
  const BENIGN = /network connection was lost|Could not reach Cloud Firestore backend|code=unavailable|ERR_NETWORK_CHANGED|Failed to load resource: the server responded with a status of 4\d\d/i;
  page.on('console', (m) => {
    if (m.type() === 'error' && !BENIGN.test(m.text())) consoleErrors.push(m.text());
  });

  // Sign in as the firm-A owner so the reads below carry a real, shipped session
  // and the page sits on the app origin (for CORS).
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(ownerCreds.email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();
  // Wait for the post-login redirect to settle before issuing in-page reads, so
  // a page.evaluate can't land mid-navigation (execution-context race on WebKit).
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  // Positive control: the very same token reads firm A's own client fine. If
  // this failed, a blanket refusal below would prove nothing.
  const own = await pageRead(page, `firms/${firmA}/clients/${CLIENT_X}`, ownerToken);
  expect(own.status, 'firm-A member reads its own client').toBe(200);
  expect(own.hasData).toBe(true);

  // The tenant line: firm B's client, requests, documents, activity — all refused
  // with a genuine PERMISSION_DENIED, from the browser, with a real credential.
  assertRestDenied(await pageRead(page, `firms/${firmB}/clients/${CLIENT_B}`, ownerToken), "firm-A member reads firm B's client");
  assertRestDenied(await pageRead(page, `firms/${firmB}/clients/${CLIENT_B}/requests`, ownerToken), "firm-A member lists firm B's requests");
  assertRestDenied(await pageRead(page, `firms/${firmB}/clients/${CLIENT_B}/documents`, ownerToken), "firm-A member lists firm B's documents");
  assertRestDenied(await pageRead(page, `firms/${firmB}/activity`, ownerToken), "firm-A member lists firm B's activity");

  // The shipped app resolves the firm from the auth claim, never the URL: pointed
  // at firm B's client id, it looks under firm A (where it doesn't exist) and says
  // so — it does not fetch across the tenant boundary.
  await gotoAndStick(page, `/clients/${CLIENT_B}`, new RegExp(`/clients/${CLIENT_B}$`));
  await expect(page.getByText('Client not found')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/different workspace/i)).toBeVisible();

  // And crucially: the app never *attempted* the cross-tenant read in the first
  // place — a real attempt would surface a `permission-denied` listener error in
  // the console. (The blanket-error channel is too noisy to assert on directly:
  // the shipped Firestore persistent-cache config emits unrelated internal-state
  // assertions under the emulator — see the report — so this narrows to the one
  // symptom a tenant leak would actually produce.)
  const tenantLeaks = consoleErrors.filter((e) => /permission|insufficient/i.test(e));
  expect(tenantLeaks, `permission errors leaked: ${tenantLeaks.join(' | ')}`).toEqual([]);
});

// ── 2. Portal boundary ───────────────────────────────────────────────────────

test('a portal taxpayer for client X cannot reach client Y or any firm-side surface', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/login'); // land on the app origin for the browser reads

  // Positive control: the portal token reads its OWN client's documents fine.
  const own = await pageRead(page, `firms/${firmA}/clients/${CLIENT_X}/documents`, portalToken);
  expect(own.status, "portal reads its own client's documents").toBe(200);

  // A sibling client in the same firm, and the firm-side activity feed, are both
  // refused — a portal credential is scoped to exactly one client.
  assertRestDenied(await pageRead(page, `firms/${firmA}/clients/${CLIENT_Y}`, portalToken), 'portal-for-X reads client Y');
  assertRestDenied(await pageRead(page, `firms/${firmA}/clients/${CLIENT_Y}/documents`, portalToken), "portal-for-X reads client Y's documents");
  assertRestDenied(await pageRead(page, `firms/${firmA}/activity`, portalToken), 'portal-for-X reads firm activity');

  // A firm-side callable is refused for a portal credential — not merely hidden.
  assertDenied(await call('startChase', portalToken, { firmId: firmA, clientId: CLIENT_X }), 'portal calls startChase');
  assertDenied(await call('sendChaseNow', portalToken, { firmId: firmA, clientId: CLIENT_X, force: true }), 'portal calls sendChaseNow');
});

// ── 3. Role restriction at the callable ──────────────────────────────────────

test('a viewer is refused preparer-gated chase actions at the callable, while an owner is allowed', async () => {
  test.setTimeout(120_000);

  // The refusal — and it must be PERMISSION_DENIED, the guard's denial, not a crash.
  assertDenied(await call('startChase', viewerToken, { firmId: firmA, clientId: CLIENT_X }), 'viewer calls startChase');
  assertDenied(await call('sendChaseNow', viewerToken, { firmId: firmA, clientId: CLIENT_X, force: true }), 'viewer calls sendChaseNow');
  assertDenied(await call('pauseChase', viewerToken, { firmId: firmA, clientId: CLIENT_X }), 'viewer calls pauseChase');

  // The paired positive control: an owner IS allowed the same action against the
  // same client. Without this, a callable broken for everyone would look like a
  // passing boundary — the exact trap this codebase learned to distrust.
  const allowed = await call('startChase', ownerToken, { firmId: firmA, clientId: CLIENT_X });
  expect(allowed.error, `owner startChase should succeed: ${JSON.stringify(allowed.error)}`).toBeUndefined();
  expect(allowed.result?.ok).toBe(true);
});

// ── 4. Anonymous ─────────────────────────────────────────────────────────────

test('an anonymous visitor is redirected to /login and no data request succeeds', async ({ page }) => {
  test.setTimeout(120_000);

  // A fresh, unauthenticated context hitting an app URL is bounced to /login.
  await page.goto('/clients');
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });

  // And a credential-less data request is refused — genuinely, not INTERNAL.
  const anon = await pageRead(page, `firms/${firmA}/clients/${CLIENT_X}`, null);
  assertRestDenied(anon, 'anonymous reads a client with no token');
});
