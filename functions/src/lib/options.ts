/**
 * Deployment options shared by every function. App Check enforcement is a
 * single constant so turning it on for the whole product is a one-line change
 * once the web client ships its reCAPTCHA site key.
 */
import type { CallableOptions } from 'firebase-functions/v2/https';

export const REGION = 'us-central1';

/** Flip to `true` to require a valid App Check token on every callable. */
export const ENFORCE_APP_CHECK = false;

export const callableOptions: CallableOptions = {
  region: REGION,
  enforceAppCheck: ENFORCE_APP_CHECK,
};

export const triggerOptions = { region: REGION } as const;
