/**
 * Reads the taxpayer portal in four languages and writes down what it actually
 * says.
 *
 * This is a *reader*, not a fixture builder. It does not seed, it does not
 * upload, it does not touch Storage — the emulator is shared with other work in
 * progress and wiping it would take that work with it. It signs in as a
 * taxpayer, sets the language the way production does (a value on the client
 * doc, applied by the live Firestore listener), and captures both viewports.
 *
 * Two viewports per locale, driven explicitly rather than by Playwright
 * projects, so one run produces the whole set:
 *   • 1440×900 — desktop
 *   •  390×844 — a phone, which is where a taxpayer photographs a W-2
 *
 * Alongside each Arabic shot it dumps the rendered text with the bidi controls
 * made visible, because "does this read correctly aloud" is a question about
 * character order that a PNG cannot answer on its own.
 *
 *   npx playwright test e2e/fix-portal.spec.ts --project=desktop
 */
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, 'screenshots', 'fix-portal');

const PROJECT_ID = 'taxfax-364f6';
const API_KEY = 'fake-api-key';
const FIRM_ID = 'whitfield-rowe';
const CLIENT_ID = 'eleanor-whitfield';
const EMAIL = 'eleanor.whitfield@fastmail.com';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';

let admin: App;
const db = (): Firestore => getFirestore(admin);
const clientDoc = () => db().doc(`firms/${FIRM_ID}/clients/${CLIENT_ID}`);

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
  admin = initializeApp({ projectId: PROJECT_ID }, `shots-${Date.now()}`);
});

test.afterAll(async () => {
  // Leave the client exactly as we found it. Language is persisted by design, so
  // a leftover value would silently change what the next spec — or the next
  // person — sees.
  await clientDoc()
    .update({ language: FieldValue.delete() })
    .catch(() => {});
  if (admin) await deleteApp(admin);
});

/** Real passwordless entry through the Auth emulator — no test backdoor. */
async function signIn(page: Page): Promise<void> {
  const send = await fetch(
    `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestType: 'EMAIL_SIGNIN',
        email: EMAIL,
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
    .find((c) => c.email === EMAIL && c.requestType === 'EMAIL_SIGNIN')?.oobCode;
  if (!oobCode) throw new Error('No EMAIL_SIGNIN oobCode in the Auth emulator.');

  const target = new URL('http://localhost:5173/portal/enter');
  target.searchParams.set('apiKey', API_KEY);
  target.searchParams.set('mode', 'signIn');
  target.searchParams.set('oobCode', oobCode);
  target.searchParams.set('lang', 'en');
  target.searchParams.set('email', EMAIL);

  await page.goto(target.toString());
  await expect(page.locator('#portal-heading')).toBeVisible({ timeout: 60_000 });
  await page.reload();
  await expect(page.locator('#portal-heading')).toBeVisible({ timeout: 60_000 });
}

/** `en` baseline, `vi` longest strings, `zh-Hans` platform CJK, `ar` RTL. */
const LOCALES = ['en', 'vi', 'zh-Hans', 'ar'] as const;
const BCP47: Record<(typeof LOCALES)[number], string> = {
  en: 'en-US',
  vi: 'vi',
  'zh-Hans': 'zh-Hans',
  ar: 'ar',
};
const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'mobile-390x844', width: 390, height: 844 },
];

test('portal, four languages, two viewports', async ({ page }) => {
  test.setTimeout(240_000);

  // A read that the security rules refuse looks exactly like a list that is
  // simply empty, so surface it rather than screenshotting a lie.
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`  [browser] ${m.text()}`);
  });

  await signIn(page);
  await expect(page).toHaveURL(/\/portal\/?$/);
  // Nothing below is worth capturing if the checklist never arrived.
  await expect(page.getByRole('region', { name: /still needed/i })).toBeVisible({
    timeout: 30_000,
  });

  for (const loc of LOCALES) {
    // Production path: the language we lifted off last year's return lives on
    // the client doc, and the live listener applies it. No switcher, no reload.
    await clientDoc().set({ language: { locale: loc, source: 'taxpayer' } }, { merge: true });
    await expect(page.locator(`div[lang="${BCP47[loc]}"]`).first()).toBeVisible({
      timeout: 30_000,
    });
    if (loc === 'ar') await expect(page.locator('div[dir="rtl"]').first()).toBeVisible();

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      // Reflow after a viewport change is not instantaneous and the heading is
      // the last thing to settle.
      await expect(page.locator('#portal-heading')).toBeVisible();
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(SHOTS, `${loc}-${vp.name}.png`), fullPage: true });
    }

    // The text, not the picture. Bidi controls are invisible in a PNG, so the
    // only way to check the character order is to read the string with them
    // spelled out.
    const text = (await page.locator('main').first().innerText())
      .replace(/\u2066/g, '<FSI>')
      .replace(/\u2067/g, '<RLI>')
      .replace(/\u2068/g, '⟦')
      .replace(/\u2069/g, '⟧')
      .replace(/\u200f/g, '<RLM>');
    writeFileSync(join(SHOTS, `${loc}.txt`), text, 'utf8');
  }
});
