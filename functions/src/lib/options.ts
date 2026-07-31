/**
 * Deployment options shared by every function.
 *
 * App Check enforcement is real, and off by default, because it can only be
 * switched on in an order: the web client has to be sending tokens *before* the
 * backend starts demanding them, or every callable answers 401 to a firm in the
 * middle of a return. So it is read from the environment at deploy time rather
 * than hard-coded, and arming it is a config change plus a redeploy.
 *
 * To turn it on, in this order:
 *  1. Register a reCAPTCHA Enterprise key for the web app (Firebase console →
 *     App Check) and build `web` with `VITE_RECAPTCHA_SITE_KEY` set to it.
 *     `web/src/lib/firebase.ts` only calls `initializeAppCheck` when that var
 *     is present, so without it the client sends no token at all.
 *  2. Wait for App Check's "unverified requests" metric to fall to ~0. Whatever
 *     is left is a real client you are about to lock out.
 *  3. Set `ENFORCE_APP_CHECK=true` in `functions/.env` (or in the deploy
 *     environment) and `firebase deploy --only functions`.
 *
 * Until step 3 this is `false`, and that is the honest state: the controls
 * actually carrying weight today are the Firestore rules and the auth checks in
 * `lib/guards.ts`. App Check adds attestation that a call came from our app; it
 * has never been what authorizes anything.
 *
 * Emulators and tests do not set the variable, so local runs stay unenforced
 * and need no debug token.
 */
import type { CallableOptions } from 'firebase-functions/v2/https';

export const REGION = 'us-central1';

/** Read at deploy time — the value is baked into the deployed function. */
export const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === 'true';

export const callableOptions: CallableOptions = {
  region: REGION,
  enforceAppCheck: ENFORCE_APP_CHECK,
};

export const triggerOptions = { region: REGION } as const;
