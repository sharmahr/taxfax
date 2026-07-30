/**
 * Firebase client. The values below are public by design — Firebase web config
 * is an identifier, not a secret. Access control lives in the security rules
 * and App Check, both of which are enforced server-side.
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

const config = {
  apiKey: 'AIzaSyCkXJkrhq8uNPok0EGWtxer-F7O3D1nev0',
  authDomain: 'taxfax-364f6.firebaseapp.com',
  projectId: 'taxfax-364f6',
  storageBucket: 'taxfax-364f6.firebasestorage.app',
  messagingSenderId: '278732302845',
  appId: '1:278732302845:web:124a744b57f693ae2d9194',
};

export const useEmulators =
  import.meta.env.VITE_USE_EMULATORS === '1' ||
  (import.meta.env.DEV && location.hostname === 'localhost');

export const app: FirebaseApp = initializeApp(config);

/**
 * Offline persistence is not a nice-to-have here: a preparer working a client
 * list on hotel wifi in April must never see a blank screen.
 */
export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
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
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (siteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
}
