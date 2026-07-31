/**
 * Firebase client. The values below are public by design — Firebase web config
 * is an identifier, not a secret. Access control lives in the security rules,
 * which are enforced server-side. App Check is wired up but only activates when
 * a reCAPTCHA site key is built in; see functions/src/lib/options.ts for what
 * it takes to arm it end to end.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  browserLocalPersistence,
  setPersistence,
  type Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

export const useEmulators =
  import.meta.env.VITE_USE_EMULATORS === '1' ||
  (import.meta.env.DEV && location.hostname === 'localhost');

const config = {
  apiKey: 'AIzaSyCkXJkrhq8uNPok0EGWtxer-F7O3D1nev0',
  authDomain: 'taxfax-364f6.firebaseapp.com',
  projectId: 'taxfax-364f6',
  // The Storage emulator only fires onObjectFinalized for the legacy
  // `.appspot.com` default bucket, so an upload to `.firebasestorage.app`
  // lands but never triggers ingest — classification and rename silently
  // never run locally. Production uses the real default bucket.
  storageBucket: useEmulators ? 'taxfax-364f6.appspot.com' : 'taxfax-364f6.firebasestorage.app',
  messagingSenderId: '278732302845',
  appId: '1:278732302845:web:124a744b57f693ae2d9194',
};

export const app: FirebaseApp = initializeApp(config);

/**
 * Offline persistence is not a nice-to-have here: a preparer working a client
 * list on hotel wifi in April must never see a blank screen.
 */
export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
  // Playwright's Linux WebKit build kills the WebChannel streaming GET after a
  // few milliseconds, and the SDK's auto-detect does not recover from it: the
  // client drops to offline mode for the rest of the session, so every realtime
  // surface renders empty forever. Long polling is the documented remedy and
  // costs nothing against a loopback emulator. Production keeps the default
  // auto-detect, so real users still get streaming.
  ...(useEmulators ? { experimentalForceLongPolling: true } : {}),
});

export const auth: Auth = getAuth(app);
export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app, 'us-central1');

void setPersistence(auth, browserLocalPersistence);

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
} else {
  // App Check is only armed when a reCAPTCHA Enterprise site key is built in.
  // Without it this client sends no App Check token, so `ENFORCE_APP_CHECK` in
  // functions/src/lib/options.ts must stay false — turning the backend on first
  // would 401 every call. The warning is here so "App Check is on" is never
  // something you assume from the code being present.
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (siteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } else {
    console.warn('App Check is not active: VITE_RECAPTCHA_SITE_KEY was not set at build time.');
  }
}
