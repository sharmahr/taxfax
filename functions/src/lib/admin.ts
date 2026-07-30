/**
 * The single Firebase Admin entry point. Everything server-side imports `db`,
 * `bucket`, `authAdmin` from here so the SDK is initialised exactly once and
 * `ignoreUndefinedProperties` is guaranteed on before the first write.
 */
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';

const app = getApps().length ? getApps()[0]! : initializeApp();

export const db = getFirestore(app);

// Must run before the first read/write; guarded so a hot-reloaded emulator
// instance re-importing the module doesn't crash on the second call.
try {
  db.settings({ ignoreUndefinedProperties: true });
} catch {
  // Settings were already applied on a previous module evaluation.
}

export const bucket = getStorage(app).bucket(
  app.options.storageBucket || 'taxfax-364f6.firebasestorage.app',
);
export const authAdmin = getAuth(app);

export { FieldValue, Timestamp };
