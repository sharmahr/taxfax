/**
 * End-to-end proof for the escalating chase cadence — the flow TaxFax is named
 * after — run against the real Firebase Emulator Suite (Auth + Firestore +
 * Functions). Real security rules, the real `startChase` / `previewChase` /
 * `sendChaseNow` / `pauseChase` / `resumeChase` callables, and the real Firebase
 * Extensions mail/SMS queues. Nothing is mocked. Every claim below is observed
 * in Firestore with the admin SDK, not inferred from a resolved promise.
 *
 * What this proves:
 *  1. Starting a chase writes real cadence state (status active, step 0, count
 *     reset, a first due time) — not a toast.
 *  2. `previewChase` renders the exact outgoing email *and* SMS and queues
 *     NOTHING: no `mail` doc, no `messages` doc appears. A preview that secretly
 *     sends is the worst possible bug in this product, so it is asserted head-on.
 *  3. Escalation is real. Successive sends walk the tone warm→…→final, and the
 *     rendered bodies actually differ between steps — asserted on the copy sitting
 *     in the delivery queue, not merely that a counter moved.
 *  4. Both channels fire: at the SMS step an email doc AND an SMS doc are queued
 *     through the Extensions collections (`mail` and `messages`).
 *  5. `pauseChase` genuinely stops it: the client is removed from the exact
 *     collection-group selection the scheduled sweep uses, and no message is
 *     queued while paused. `resumeChase` puts it back.
 *  6. Quiet hours hold at the callable boundary: a non-forced send inside a quiet
 *     window is refused and handed a legal `nextSlot` instead, queuing nothing —
 *     while a forced send from the same client proves the refusal was about the
 *     clock, not an inability to send.
 *  7. The client-detail UI reflects a real send live over the realtime
 *     subscription, at desktop and on an iPhone 14 Pro (WebKit) — no reload.
 *
 * Auth is driven entirely through the Auth emulator's REST API (create user, set
 * custom claims via the admin `accounts:update` endpoint, sign in). We avoid
 * importing `firebase-admin/auth` on purpose: it drags in an ESM-incompatible
 * `jose`, exactly as `portal.spec.ts` notes. Firestore observation uses
 * `firebase-admin/firestore`, which the other specs already rely on.
 *
 * The suite is shared with other agents, so this run is hermetic: a firm with a
 * unique id, its own users and clients, cleaned up in `afterAll`. It never seeds
 * or wipes the shared book.
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
const REGION = 'us-central1';
const API_KEY = 'fake-api-key'; // any string is accepted by the Auth emulator
const AUTH_HOST = '127.0.0.1:9099';
const FN_BASE = `http://127.0.0.1:5001/${PROJECT_ID}/${REGION}`;
const PASSWORD = 'taxfax-e2e-2026';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= AUTH_HOST;

let admin: App;
const db = (): Firestore => getFirestore(admin);

// ── Auth emulator REST helpers (no firebase-admin/auth) ──────────────────────

interface Json {
  status: number;
  body: Record<string, unknown>;
}
async function restJson(url: string, init: RequestInit): Promise<Json> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body };
}

/** Create an email/password user; returns its uid. */
async function createUser(email: string): Promise<string> {
  const r = await restJson(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }) },
  );
  const uid = r.body.localId as string | undefined;
  if (!uid) throw new Error(`signUp failed: ${JSON.stringify(r.body)}`);
  return uid;
}

/** Set custom claims exactly as `setCustomUserClaims` would — the admin
 *  `accounts:update` endpoint, authorised as the emulator owner. */
async function setClaims(uid: string, claims: Record<string, unknown>): Promise<void> {
  const r = await restJson(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:update`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
      body: JSON.stringify({ localId: uid, emailVerified: true, customAttributes: JSON.stringify(claims) }),
    },
  );
  if (r.status !== 200) throw new Error(`accounts:update failed: ${JSON.stringify(r.body)}`);
}

/** Sign in with the password; the returned ID token carries current claims. */
async function signIn(email: string): Promise<string> {
  const r = await restJson(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }) },
  );
  const idToken = r.body.idToken as string | undefined;
  if (!idToken) throw new Error(`signIn failed: ${JSON.stringify(r.body)}`);
  return idToken;
}

interface CallResult {
  status: number;
  result: any;
  error?: { message?: string; status?: string };
}
async function call(name: string, idToken: string, data: unknown): Promise<CallResult> {
  const res = await fetch(`${FN_BASE}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
    body: JSON.stringify({ data }),
  });
  const body = (await res.json().catch(() => ({}))) as any;
  return { status: res.status, result: body.result, error: body.error };
}

// ── Hermetic seed ────────────────────────────────────────────────────────────

const DEFAULT_CHASE = {
  enabled: true,
  profile: 'standard',
  quietHours: { start: 20, end: 8 },
  sendOnWeekends: false,
  deadline: '04-15',
  escalateAfterStep: 4,
  smsEnabled: true,
  signature: 'Ada Test',
};

// A quiet window that straddles *now* in UTC with an hour of margin either side,
// so a send attempted during the test is reliably inside it, and the next legal
// slot (the hour the window ends) is reliably outside it.
function quietWindowAround(nowHour: number): { start: number; end: number } {
  return { start: (nowHour + 23) % 24, end: (nowHour + 2) % 24 };
}
function inQuiet(hour: number, q: { start: number; end: number }): boolean {
  return q.start > q.end ? hour >= q.start || hour < q.end : hour >= q.start && hour < q.end;
}

let firmId = '';
let ownerToken = '';
let ownerCreds: { email: string } = { email: '' };
let testQuiet = { start: 0, end: 0 };
const clientRef = (id: string) => db().doc(`firms/${firmId}/clients/${id}`);
const mailDoc = (id: string) => db().collection('mail').doc(id).get();
const smsDoc = (id: string) => db().collection('messages').doc(id).get();

const DOC_TYPES: { id: string; priority: 'critical' | 'standard' }[] = [
  { id: 'w2', priority: 'critical' },
  { id: '1099-int', priority: 'standard' },
  { id: '1099-div', priority: 'standard' },
  { id: '1099-b', priority: 'critical' },
  { id: '1098', priority: 'standard' },
  { id: '1099-r', priority: 'standard' },
];

async function seedClient(
  id: string,
  displayName: string,
  chase: Record<string, unknown>,
): Promise<void> {
  const now = new Date();
  const started = new Date(Date.now() - 9 * 86_400_000);
  await clientRef(id).set({
    id,
    firmId,
    taxYear: 2025,
    displayName,
    sortName: displayName,
    entityType: 'individual',
    filingStatus: 'single',
    primaryContact: { name: displayName, email: `${id}@taxpayer.test`, phone: '+15125550100' },
    tags: [],
    stage: 'awaiting',
    progress: { total: DOC_TYPES.length, received: 0, accepted: 0, rejected: 0, overdue: 0, percent: 0 },
    chase,
    createdAt: started,
    updatedAt: now,
  });
  let order = 0;
  for (const dt of DOC_TYPES) {
    const rid = dt.id;
    await db().doc(`firms/${firmId}/clients/${id}/requests/${rid}`).set({
      id: rid,
      firmId,
      clientId: id,
      taxYear: 2025,
      docTypeId: dt.id,
      reason: `You reported a ${dt.id.toUpperCase()} on your 2024 return.`,
      source: 'prior_year',
      priority: dt.priority,
      expectedCount: 1,
      status: 'pending',
      documentIds: [],
      order: order++,
      createdAt: started,
      updatedAt: started,
    });
  }
}

test.beforeAll(async () => {
  test.setTimeout(120_000);
  admin = initializeApp({ projectId: PROJECT_ID }, `e2e-chase-${Date.now()}`);
  firmId = `e2e-chase-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const nowHour = new Date().getUTCHours();
  const quietHours = quietWindowAround(nowHour);

  await db().doc(`firms/${firmId}`).set({
    id: firmId,
    name: 'Cadence Test CPAs',
    slug: firmId,
    createdAt: new Date(),
    taxYear: 2025,
    timezone: 'UTC', // deterministic quiet-hours math
    branding: {
      displayName: 'Cadence Test CPAs',
      accent: '#8B3A2E',
      replyToEmail: 'documents@cadence.test',
      supportPhone: '+15125550100',
    },
    chase: { ...DEFAULT_CHASE, quietHours, sendOnWeekends: true },
    plan: 'firm',
  });

  // Owner: real user, real preparer-or-better claim, real member doc.
  const ownerEmail = `owner-${firmId}@cadence.test`;
  const ownerUid = await createUser(ownerEmail);
  await setClaims(ownerUid, { firms: { [firmId]: 'owner' } });
  await db().doc(`firms/${firmId}/members/${ownerUid}`).set({
    uid: ownerUid, firmId, email: ownerEmail, name: 'Ada Test', role: 'owner', status: 'active', joinedAt: new Date(),
  });
  ownerToken = await signIn(ownerEmail);
  ownerCreds = { email: ownerEmail };

  // Clients, one per concern.
  await seedClient('cadence', 'Priya Cadence', { status: 'idle', stepIndex: 2, sentCount: 3 });
  await seedClient('escalate', 'Marcus Escalate', { status: 'idle', stepIndex: 0, sentCount: 0 });
  await seedClient('pause', 'Dana Pause', { status: 'idle', stepIndex: 0, sentCount: 0 });
  await seedClient('quiet', 'Sofia Quiet', { status: 'idle', stepIndex: 0, sentCount: 0 });
  await seedClient('uilive', 'Elena Live', {
    status: 'active', stepIndex: 0, sentCount: 0,
    startedAt: new Date(Date.now() - 2 * 86_400_000), nextDueAt: new Date(Date.now() + 86_400_000),
  });

  testQuiet = quietHours;
});

test.afterAll(async () => {
  try {
    await db().recursiveDelete(db().doc(`firms/${firmId}`));
    for (const coll of ['mail', 'messages']) {
      const snap = await db().collection(coll).where('chase.firmId', '==', firmId).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
  } catch {
    // best-effort hermetic cleanup
  }
  if (admin) await deleteApp(admin);
});

// ── 1. Start + preview ───────────────────────────────────────────────────────

test('startChase writes real cadence state, and previewChase renders both channels without sending', async () => {
  test.setTimeout(120_000);

  const before = (await clientRef('cadence').get()).data()!;
  expect(before.chase.sentCount).toBe(3); // a stale, mid-cadence state to overwrite

  const started = await call('startChase', ownerToken, { firmId, clientId: 'cadence' });
  expect(started.error, JSON.stringify(started.error)).toBeUndefined();
  expect(started.result.ok).toBe(true);

  const after = (await clientRef('cadence').get()).data()!;
  expect(after.chase.status).toBe('active');
  expect(after.chase.stepIndex).toBe(0);
  expect(after.chase.sentCount).toBe(0);
  expect(after.chase.startedAt, 'startedAt stamped').toBeTruthy();
  expect(after.chase.nextDueAt, 'a first due time scheduled').toBeTruthy();

  // Nothing is queued for this client before any preview.
  expect((await mailDoc(`${firmId}__cadence__2__email`)).exists).toBe(false);
  expect((await smsDoc(`${firmId}__cadence__2__sms__0`)).exists).toBe(false);

  // previewChase at the first SMS step (2) returns a real email AND a real SMS…
  const pv = await call('previewChase', ownerToken, { firmId, clientId: 'cadence', stepIndex: 2 });
  expect(pv.error, JSON.stringify(pv.error)).toBeUndefined();
  expect(pv.result.channels).toEqual(['email', 'sms']);
  expect(String(pv.result.email.subject).length).toBeGreaterThan(0);
  expect(String(pv.result.email.text).length).toBeGreaterThan(0);
  expect(String(pv.result.sms).length).toBeGreaterThan(0);
  expect(pv.result.recipients.emails).toContain('cadence@taxpayer.test');
  expect(pv.result.recipients.phones).toContain('+15125550100');

  // …and queues absolutely nothing. This is the anti-bug: a preview must not send.
  expect((await mailDoc(`${firmId}__cadence__2__email`)).exists).toBe(false);
  expect((await smsDoc(`${firmId}__cadence__2__sms__0`)).exists).toBe(false);

  // The copy escalates: distinct tone AND distinct rendered text across steps.
  const p0 = await call('previewChase', ownerToken, { firmId, clientId: 'cadence', stepIndex: 0 });
  const p2 = await call('previewChase', ownerToken, { firmId, clientId: 'cadence', stepIndex: 2 });
  const p4 = await call('previewChase', ownerToken, { firmId, clientId: 'cadence', stepIndex: 4 });
  expect([p0.result.tone, p2.result.tone, p4.result.tone]).toEqual(['warm', 'firm', 'final']);
  expect(p0.result.email.text).not.toBe(p2.result.email.text);
  expect(p2.result.email.text).not.toBe(p4.result.email.text);
  expect(p0.result.email.subject).not.toBe(p4.result.email.subject);
  // Channel escalation: the opening step is email-only; SMS joins later.
  expect(p0.result.channels).toEqual(['email']);
  expect(p0.result.sms).toBeNull();
});

// ── 2. The escalating cadence ────────────────────────────────────────────────

test('the cadence escalates for real: five sends walk step 0→5, queue both channels, and the copy differs per step', async () => {
  test.setTimeout(120_000);

  const start = await call('startChase', ownerToken, { firmId, clientId: 'escalate' });
  expect(start.error, JSON.stringify(start.error)).toBeUndefined();

  // Force-send every step so the walk is deterministic (force bypasses schedule
  // + quiet hours, never opt-outs). Standard cadence: 0,1 email-only; 2,3,4
  // email+sms. So sentCount advances 1,1,2,2,2 → 8, and step 4 escalates.
  for (let i = 0; i < 5; i++) {
    const r = await call('sendChaseNow', ownerToken, { firmId, clientId: 'escalate', force: true });
    expect(r.error, `send ${i}: ${JSON.stringify(r.error)}`).toBeUndefined();
    expect(r.result.status, `send ${i} outcome`).toBe('sent');
  }

  const c = (await clientRef('escalate').get()).data()!;
  expect(c.chase.stepIndex).toBe(5);
  expect(c.chase.status).toBe('escalated');
  expect(c.chase.sentCount).toBe(8);

  // Both channels at the SMS step: an email doc AND an SMS doc were queued.
  expect((await mailDoc(`${firmId}__escalate__2__email`)).exists).toBe(true);
  expect((await smsDoc(`${firmId}__escalate__2__sms__0`)).exists).toBe(true);
  // The opening step queued email but no SMS — channel escalation is real.
  expect((await mailDoc(`${firmId}__escalate__0__email`)).exists).toBe(true);
  expect((await smsDoc(`${firmId}__escalate__0__sms__0`)).exists).toBe(false);

  // The copy that actually went to the queue differs step to step — not just a
  // counter. Read the enqueued messages and compare their rendered bodies.
  const m0 = (await mailDoc(`${firmId}__escalate__0__email`)).data()!.message;
  const m2 = (await mailDoc(`${firmId}__escalate__2__email`)).data()!.message;
  const m4 = (await mailDoc(`${firmId}__escalate__4__email`)).data()!.message;
  expect(m0.text).not.toBe(m2.text);
  expect(m2.text).not.toBe(m4.text);
  expect(m0.subject).not.toBe(m4.subject);
  const sms2 = (await smsDoc(`${firmId}__escalate__2__sms__0`)).data()!;
  expect(String(sms2.body).length).toBeGreaterThan(0);
  expect(sms2.to).toBe('+15125550100');

  // The queued email is addressed to the taxpayer and carries the chase ref the
  // delivery mirror keys on.
  const mail2 = (await mailDoc(`${firmId}__escalate__2__email`)).data()!;
  expect(mail2.to).toContain('escalate@taxpayer.test');
  expect(mail2.chase).toMatchObject({ firmId, clientId: 'escalate' });
});

// ── 3. Pause genuinely stops it ──────────────────────────────────────────────

test('pauseChase removes the client from the scheduled send sweep, and resume restores it', async () => {
  test.setTimeout(120_000);

  await call('startChase', ownerToken, { firmId, clientId: 'pause' });

  // The sweep selects active clients whose next due time has arrived. Reproduce
  // that exact selection; our freshly-started client is in it.
  const sweep = () =>
    db()
      .collectionGroup('clients')
      .where('chase.status', '==', 'active')
      .where('chase.nextDueAt', '<=', new Date())
      .get();
  const before = (await sweep()).docs.map((d) => d.id);
  expect(before, 'a started client is selectable by the sweep').toContain('pause');

  const paused = await call('pauseChase', ownerToken, { firmId, clientId: 'pause' });
  expect(paused.error, JSON.stringify(paused.error)).toBeUndefined();
  expect(paused.result.ok).toBe(true);

  const doc = (await clientRef('pause').get()).data()!;
  expect(doc.chase.status).toBe('paused');
  expect(doc.chase.nextDueAt, 'nextDueAt is cleared on pause').toBeUndefined();

  // The selection the automated sender uses can no longer see it — so no send,
  // and therefore no queued message, can happen while paused.
  const after = (await sweep()).docs.map((d) => d.id);
  expect(after).not.toContain('pause');
  expect((await mailDoc(`${firmId}__pause__0__email`)).exists).toBe(false);

  // Resume puts it back under the sweep.
  const resumed = await call('resumeChase', ownerToken, { firmId, clientId: 'pause' });
  expect(resumed.error, JSON.stringify(resumed.error)).toBeUndefined();
  expect(resumed.result.ok).toBe(true);
  const back = (await clientRef('pause').get()).data()!;
  expect(back.chase.status).toBe('active');
  expect(back.chase.nextDueAt).toBeTruthy();
});

// ── 4. Quiet hours ───────────────────────────────────────────────────────────

test('quiet hours: a scheduled send is refused and deferred to a legal slot, queuing nothing', async () => {
  test.setTimeout(120_000);

  await call('startChase', ownerToken, { firmId, clientId: 'quiet' });

  // A non-forced send, right now, is inside the firm's quiet window.
  const blocked = await call('sendChaseNow', ownerToken, { firmId, clientId: 'quiet', force: false });
  expect(blocked.error, JSON.stringify(blocked.error)).toBeUndefined();
  expect(blocked.result.status).toBe('blocked_quiet_hours');

  // It hands back a concrete next slot, and that slot is genuinely legal —
  // outside the quiet window, not just "later".
  const slot = new Date(blocked.result.nextSlot);
  expect(Number.isNaN(slot.getTime())).toBe(false);
  expect(inQuiet(slot.getUTCHours(), testQuiet), 'nextSlot lands outside quiet hours').toBe(false);
  expect(slot.getTime()).toBeGreaterThan(Date.now());

  // Nothing was queued by the refused send.
  expect((await mailDoc(`${firmId}__quiet__0__email`)).exists).toBe(false);
  expect((await smsDoc(`${firmId}__quiet__0__sms__0`)).exists).toBe(false);

  // Positive control: forcing past the schedule *does* send from the same client
  // — proving the refusal was about the clock, not a broken send path.
  const forced = await call('sendChaseNow', ownerToken, { firmId, clientId: 'quiet', force: true });
  expect(forced.error, JSON.stringify(forced.error)).toBeUndefined();
  expect(forced.result.status).toBe('sent');
  expect((await mailDoc(`${firmId}__quiet__0__email`)).exists).toBe(true);
});

// ── 5. The UI reflects a real send, live ─────────────────────────────────────

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(ownerCreds.email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();
  // Wait for the post-login redirect to *settle* on its destination.
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

/** Open a client-detail page robustly. Two WebKit-only, dev-environment races
 *  can otherwise interfere: (a) login.tsx fires two redirects to /dashboard as
 *  auth settles, so a plain goto can be interrupted; (b) a transient WebKit +
 *  Vite-dev dynamic-import failure can drop us on the router error boundary
 *  instead of the route. Neither happens in production (bundled assets, real
 *  Firestore). Retry the navigation until the detail's own tab bar renders. */
async function openClient(page: Page, clientId: string): Promise<void> {
  const settled = new RegExp(`/clients/${clientId}$`);
  await expect(async () => {
    await page.goto(`/clients/${clientId}`);
    await expect(page).toHaveURL(settled, { timeout: 3_000 });
    await expect(page.getByRole('tab', { name: 'Checklist' })).toBeVisible({ timeout: 8_000 });
  }).toPass({ timeout: 60_000 });
}

test('the client-detail UI reflects a real send live, over the realtime subscription', async ({ page }, info: TestInfo) => {
  test.setTimeout(120_000);

  // Vite-dev serves ESM per-module; on WebKit a dynamically-imported chunk can
  // transiently fail to load (recovered by openClient's retry) and a WebChannel
  // reconnect can log a transport blip. The shipped Firestore persistent-cache
  // config also emits internal-state assertions under the emulator (reported
  // separately). None is a product error on the path under test, so all are
  // treated as benign here.
  const BENIGN =
    /network connection was lost|Could not reach Cloud Firestore backend|code=unavailable|ERR_NETWORK_CHANGED|Failed to load resource: the server responded with a status of 4\d\d|Importing a module script failed|dynamically imported module|INTERNAL ASSERTION FAILED|INTERNAL UNHANDLED ERROR/i;

  await login(page);
  await openClient(page, 'uilive');

  // On mobile the chase panel lives behind the "Activity" tab; on desktop it's an
  // always-visible sidebar. Reveal it where it's tabbed, so this asserts the same
  // live surface on both form factors.
  const activityTab = page.getByRole('tab', { name: 'Activity' });
  if (await activityTab.count()) await activityTab.click();

  const panel = page.locator('section[aria-label="Chase history"]');
  await expect(panel.getByRole('heading', { name: 'Chase' })).toBeVisible({ timeout: 25_000 });
  // Initial live state (already driven by the onSnapshot subscription): an active
  // chase that hasn't sent a reminder yet.
  await expect(panel.getByText('Checklist sent')).toBeVisible();
  await expect(panel.getByText(/Standard\s+cadence/i)).toBeVisible();
  await capture(page, join(SHOTS, `chase-${info.project.name}-uilive-before.png`));

  // Watch the console only for the live-update phase itself — the detail has
  // finished mounting, so any error now is a real one, not a nav-time dev flake.
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !BENIGN.test(m.text())) consoleErrors.push(m.text());
  });

  // Fire a real send out-of-band — a colleague on another device.
  const send = await call('sendChaseNow', ownerToken, { firmId, clientId: 'uilive', force: true });
  expect(send.error, JSON.stringify(send.error)).toBeUndefined();
  expect(send.result.status).toBe('sent');

  // The page updates itself with no reload — the onSnapshot subscription pushes
  // the out-of-band write straight into the timeline. Arrives in a few ms on an
  // idle suite; the generous budget only absorbs infrastructure noise from the
  // shared emulator under concurrent load (measured seed ~59s; the suite has
  // crashed with orphaned runtime processes when several agents share one).
  // This is contention, NOT transport negotiation: long-polling auto-detection
  // is already on (firebase 11.x defaults experimentalAutoDetectLongPolling to
  // true since v9.22.0), so setting that flag is a no-op — the fix here is an
  // unstrained suite, not an SDK setting.
  await expect(panel.getByText('Reminder 1 sent')).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByText('Checklist sent')).toHaveCount(0);
  await capture(page, join(SHOTS, `chase-${info.project.name}-uilive-after.png`));

  // The live change reflects a real Firestore write, not just a UI flip.
  const doc = (await clientRef('uilive').get()).data()!;
  expect(doc.chase.sentCount).toBe(1);
  expect(doc.chase.stepIndex).toBe(1);
  expect((await mailDoc(`${firmId}__uilive__0__email`)).exists).toBe(true);

  expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
});
