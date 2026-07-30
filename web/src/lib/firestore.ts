import { useEffect, useRef, useState } from 'react';
import {
  doc,
  getDocs,
  onSnapshot,
  queryEqual,
  type DocumentData,
  type FirestoreError,
  type Query,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Thin typed listeners over the Web SDK. These are plumbing, not a framework:
 * a live document, a live collection, and a one-shot read, each returning the
 * same `{ data, loading, error }` shape with correct listener cleanup.
 */

export interface DocState<T> {
  data: (T & { id: string }) | null;
  loading: boolean;
  error: FirestoreError | null;
}

export interface ListState<T> {
  data: (T & { id: string })[];
  loading: boolean;
  error: FirestoreError | null;
}

/** Live single document. Pass `null` to stay idle (e.g. before a firm resolves). */
export function useDoc<T = DocumentData>(path: string | null): DocState<T> {
  const [state, setState] = useState<DocState<T>>({
    data: null,
    loading: path != null,
    error: null,
  });

  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    return onSnapshot(
      doc(db, path),
      (snap) =>
        setState({
          data: snap.exists() ? ({ ...(snap.data() as T), id: snap.id }) : null,
          loading: false,
          error: null,
        }),
      (error) => setState({ data: null, loading: false, error }),
    );
  }, [path]);

  return state;
}

/**
 * Hold a query stable across renders so an equal-but-new query object doesn't
 * tear down and rebuild the listener on every parent render.
 */
function useStableQuery(query: Query<DocumentData> | null): Query<DocumentData> | null {
  const ref = useRef<Query<DocumentData> | null>(null);
  if (query) {
    if (!ref.current || !queryEqual(ref.current, query)) ref.current = query;
  } else {
    ref.current = null;
  }
  return ref.current;
}

/** Live collection or query. Pass `null` to stay idle. */
export function useCollection<T = DocumentData>(query: Query<DocumentData> | null): ListState<T> {
  const stable = useStableQuery(query);
  const [state, setState] = useState<ListState<T>>({
    data: [],
    loading: query != null,
    error: null,
  });

  useEffect(() => {
    if (!stable) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    return onSnapshot(
      stable,
      (snap) =>
        setState({
          data: snap.docs.map((d) => ({ ...(d.data() as T), id: d.id })),
          loading: false,
          error: null,
        }),
      (error) => setState({ data: [], loading: false, error }),
    );
  }, [stable]);

  return state;
}

/** One-shot read for lists that don't need to stay live (imports, pickers). */
export function useCollectionOnce<T = DocumentData>(
  query: Query<DocumentData> | null,
): ListState<T> {
  const stable = useStableQuery(query);
  const [state, setState] = useState<ListState<T>>({
    data: [],
    loading: query != null,
    error: null,
  });

  useEffect(() => {
    if (!stable) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    getDocs(stable)
      .then((snap) => {
        if (cancelled) return;
        setState({
          data: snap.docs.map((d) => ({ ...(d.data() as T), id: d.id })),
          loading: false,
          error: null,
        });
      })
      .catch((error: FirestoreError) => {
        if (!cancelled) setState({ data: [], loading: false, error });
      });
    return () => {
      cancelled = true;
    };
  }, [stable]);

  return state;
}
