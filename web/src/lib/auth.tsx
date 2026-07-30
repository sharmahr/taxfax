import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  getIdTokenResult,
  onIdTokenChanged,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { paths, type Firm, type FirmRole, type Timestampish, type UserIndex } from '@taxfax/shared';
import { auth, db } from './firebase';
import { toDate } from './format';

/**
 * Custom claims carry tenancy so no read is needed to know what a user may see:
 *   token.firms  = { "<firmId>": "owner|admin|preparer|viewer" }
 *   token.portal = { firmId, clientId }   (taxpayers only)
 */
export interface Claims {
  firms: Record<string, FirmRole>;
  portal?: { firmId: string; clientId: string };
}

export interface Workspace {
  firmId: string;
  role: FirmRole;
  /** Null until the firm document has loaded. */
  firm: Firm | null;
}

interface AuthSnapshot {
  user: User | null;
  claims: Claims | null;
  loading: boolean;
}

const WORKSPACE_KEY = 'taxfax.workspace';

// ── Module-level auth store ──────────────────────────────────────────────────
// Kept outside React so the router's `beforeLoad` guards can await the first
// auth resolution before any component renders.

let snapshot: AuthSnapshot = { user: null, claims: null, loading: true };
const listeners = new Set<() => void>();
let started = false;
let markReady!: () => void;
const readyPromise = new Promise<void>((resolve) => {
  markReady = resolve;
});

function parseClaims(claims: Record<string, unknown>): Claims {
  return {
    firms: (claims.firms as Record<string, FirmRole> | undefined) ?? {},
    portal: claims.portal as Claims['portal'],
  };
}

function emit(next: AuthSnapshot): void {
  snapshot = next;
  for (const l of listeners) l();
}

function start(): void {
  if (started) return;
  started = true;
  onIdTokenChanged(auth, async (user) => {
    if (user) {
      const result = await getIdTokenResult(user);
      emit({ user, claims: parseClaims(result.claims), loading: false });
    } else {
      emit({ user: null, claims: null, loading: false });
    }
    markReady();
  });
}

/** Resolves once the initial auth state is known. Safe to await in `beforeLoad`. */
export function authReady(): Promise<void> {
  start();
  return readyPromise;
}

export function getAuthSnapshot(): AuthSnapshot {
  return snapshot;
}

/** Force a token refresh so freshly-granted claims land without a re-login. */
async function refreshClaims(): Promise<void> {
  if (!auth.currentUser) return;
  const result = await getIdTokenResult(auth.currentUser, true);
  emit({ ...snapshot, claims: parseClaims(result.claims) });
}

// ── React surface ────────────────────────────────────────────────────────────

export interface AuthContextValue {
  user: User | null;
  claims: Claims | null;
  loading: boolean;
  firms: Workspace[];
  activeFirm: Workspace | null;
  setActiveFirm: (firmId: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const snap = useSyncExternalStore(
    (cb) => {
      start();
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getAuthSnapshot,
    getAuthSnapshot,
  );

  const uid = snap.user?.uid ?? null;
  const firmIdsKey = useMemo(
    () => Object.keys(snap.claims?.firms ?? {}).sort().join(','),
    [snap.claims],
  );

  const [firmDocs, setFirmDocs] = useState<Record<string, Firm | null>>({});
  const [defaultFirmId, setDefaultFirmId] = useState<string | undefined>(undefined);
  const [activeFirmId, setActiveFirmId] = useState<string | null>(() =>
    typeof localStorage === 'undefined' ? null : localStorage.getItem(WORKSPACE_KEY),
  );

  // Watch the user index for the default workspace and for claim-staleness
  // pings (functions bump `claimsUpdatedAt`; we refresh the token in response).
  const lastClaimsAt = useRef<number | null>(null);
  useEffect(() => {
    lastClaimsAt.current = null;
    if (!uid) {
      setDefaultFirmId(undefined);
      return;
    }
    return onSnapshot(doc(db, paths.user(uid)), (userSnap) => {
      const data = userSnap.data() as
        | (UserIndex & { claimsUpdatedAt?: Timestampish })
        | undefined;
      if (!data) return;
      setDefaultFirmId(data.defaultFirmId);
      const at = data.claimsUpdatedAt ? toDate(data.claimsUpdatedAt).getTime() : 0;
      if (lastClaimsAt.current === null) {
        lastClaimsAt.current = at;
      } else if (at > lastClaimsAt.current) {
        lastClaimsAt.current = at;
        void refreshClaims();
      }
    });
  }, [uid]);

  // Live firm metadata for every workspace the user belongs to.
  useEffect(() => {
    const firmIds = firmIdsKey ? firmIdsKey.split(',') : [];
    if (firmIds.length === 0) {
      setFirmDocs({});
      return;
    }
    const unsubs = firmIds.map((firmId) =>
      onSnapshot(
        doc(db, paths.firm(firmId)),
        (firmSnap) =>
          setFirmDocs((prev) => ({
            ...prev,
            [firmId]: firmSnap.exists() ? ({ ...(firmSnap.data() as Firm), id: firmSnap.id }) : null,
          })),
        () => setFirmDocs((prev) => ({ ...prev, [firmId]: null })),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [firmIdsKey]);

  const firms = useMemo<Workspace[]>(() => {
    const map = snap.claims?.firms ?? {};
    return Object.keys(map)
      .sort()
      .map((firmId) => ({ firmId, role: map[firmId], firm: firmDocs[firmId] ?? null }));
  }, [snap.claims, firmDocs]);

  const activeFirm = useMemo<Workspace | null>(() => {
    if (firms.length === 0) return null;
    const wanted = activeFirmId ?? defaultFirmId;
    return firms.find((f) => f.firmId === wanted) ?? firms[0];
  }, [firms, activeFirmId, defaultFirmId]);

  const setActiveFirm = useCallback(
    (firmId: string) => {
      setActiveFirmId(firmId);
      localStorage.setItem(WORKSPACE_KEY, firmId);
      if (uid) {
        void setDoc(doc(db, paths.user(uid)), { defaultFirmId: firmId }, { merge: true }).catch(
          () => {},
        );
      }
    },
    [uid],
  );

  const signOut = useCallback(async () => {
    localStorage.removeItem(WORKSPACE_KEY);
    await firebaseSignOut(auth);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: snap.user,
      claims: snap.claims,
      loading: snap.loading,
      firms,
      activeFirm,
      setActiveFirm,
      signOut,
    }),
    [snap.user, snap.claims, snap.loading, firms, activeFirm, setActiveFirm, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>.');
  return ctx;
}
