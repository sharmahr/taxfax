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
import type { User } from 'firebase/auth';
import type { Firm, FirmRole, Timestampish, UserIndex } from '@taxfax/shared';

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

// ── Deferred runtime ─────────────────────────────────────────────────────────
// The Firebase SDK is ~750 kB and a signed-out visitor reading the marketing
// page needs none of it, so nothing above is imported statically — including
// `@taxfax/shared` and `./format`, whose barrels drag the document taxonomy and
// date-fns along with them. Every call site goes through `loadDeps()`, which
// resolves to the same modules after the first await; once auth has resolved
// the promise is already settled, so later callers pay a microtask and no more.

interface Deps {
  auth: import('firebase/auth').Auth;
  db: import('firebase/firestore').Firestore;
  fbAuth: typeof import('firebase/auth');
  fbStore: typeof import('firebase/firestore');
  paths: typeof import('@taxfax/shared').paths;
  toDate: typeof import('./format').toDate;
}

let deps: Promise<Deps> | null = null;

function loadDeps(): Promise<Deps> {
  deps ??= Promise.all([
    import('./firebase'),
    import('firebase/auth'),
    import('firebase/firestore'),
    import('@taxfax/shared'),
    import('./format'),
  ]).then(([firebase, fbAuth, fbStore, shared, format]) => ({
    auth: firebase.auth,
    db: firebase.db,
    fbAuth,
    fbStore,
    paths: shared.paths,
    toDate: format.toDate,
  }));
  return deps;
}

// ── Module-level auth store ──────────────────────────────────────────────────
// Kept outside React so the router's `beforeLoad` guards can await the first
// auth resolution before any component renders.

let snapshot: AuthSnapshot = { user: null, claims: null, loading: true };
const listeners = new Set<() => void>();
let started = false;
let settledWithoutSdk = false;
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
  void loadDeps().then(
    ({ auth, fbAuth }) => {
      fbAuth.onIdTokenChanged(auth, async (user) => {
        if (user) {
          const result = await fbAuth.getIdTokenResult(user);
          emit({ user, claims: parseClaims(result.claims), loading: false });
        } else {
          emit({ user: null, claims: null, loading: false });
        }
        markReady();
      });
    },
    () => {
      // A chunk that will not download must not leave `beforeLoad` hanging on a
      // promise that can never settle. Resolve as signed out so the guards
      // redirect to /login, and allow a later navigation to retry the load.
      deps = null;
      started = false;
      emit({ user: null, claims: null, loading: false });
      markReady();
    },
  );
}

/** Resolves once the initial auth state is known. Safe to await in `beforeLoad`. */
export function authReady(): Promise<void> {
  start();
  return readyPromise;
}

/**
 * `browserLocalPersistence` (see `./firebase`) parks the signed-in user under a
 * `firebase:authUser:*` key, so the absence of one is a reliable synchronous
 * "nobody has ever signed in on this device".
 */
function hasPersistedSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      if (localStorage.key(i)?.startsWith('firebase:authUser:')) return true;
    }
    return false;
  } catch {
    // Storage blocked (private browsing). Assume a session and let auth decide.
    return true;
  }
}

/**
 * Mounting the provider must not drag the SDK onto a page that only shows
 * marketing copy. With no persisted session there is nothing for auth to
 * resolve, so settle as signed out and download nothing; `authReady()` from a
 * route guard still starts the real listener when a protected route is
 * entered, which is what makes signing in from a cold page work.
 */
function startIfSession(): void {
  if (started || settledWithoutSdk) return;
  if (hasPersistedSession()) {
    start();
    return;
  }
  settledWithoutSdk = true;
  emit({ user: null, claims: null, loading: false });
  markReady();
}

export function getAuthSnapshot(): AuthSnapshot {
  return snapshot;
}

/** Force a token refresh so freshly-granted claims land without a re-login. */
async function refreshClaims(): Promise<void> {
  const { auth, fbAuth } = await loadDeps();
  if (!auth.currentUser) return;
  const result = await fbAuth.getIdTokenResult(auth.currentUser, true);
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
      startIfSession();
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
    let unsub: (() => void) | null = null;
    let cancelled = false;
    void loadDeps().then(({ db, fbStore, paths, toDate }) => {
      if (cancelled) return;
      unsub = fbStore.onSnapshot(fbStore.doc(db, paths.user(uid)), (userSnap) => {
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
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [uid]);

  // Live firm metadata for every workspace the user belongs to.
  useEffect(() => {
    const firmIds = firmIdsKey ? firmIdsKey.split(',') : [];
    if (firmIds.length === 0) {
      setFirmDocs({});
      return;
    }
    let unsubs: Array<() => void> = [];
    let cancelled = false;
    void loadDeps().then(({ db, fbStore, paths }) => {
      if (cancelled) return;
      unsubs = firmIds.map((firmId) =>
        fbStore.onSnapshot(
          fbStore.doc(db, paths.firm(firmId)),
          (firmSnap) =>
            setFirmDocs((prev) => ({
              ...prev,
              [firmId]: firmSnap.exists()
                ? { ...(firmSnap.data() as Firm), id: firmSnap.id }
                : null,
            })),
          () => setFirmDocs((prev) => ({ ...prev, [firmId]: null })),
        ),
      );
    });
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
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
        void loadDeps()
          .then(({ db, fbStore, paths }) =>
            fbStore.setDoc(
              fbStore.doc(db, paths.user(uid)),
              { defaultFirmId: firmId },
              { merge: true },
            ),
          )
          .catch(() => {});
      }
    },
    [uid],
  );

  const signOut = useCallback(async () => {
    localStorage.removeItem(WORKSPACE_KEY);
    const { auth, fbAuth } = await loadDeps();
    await fbAuth.signOut(auth);
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
