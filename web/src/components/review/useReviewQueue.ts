import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, collectionGroup, orderBy, query, where } from 'firebase/firestore';
import { paths, type Client, type StoredDocument } from '@taxfax/shared';
import { db } from '@/lib/firebase';
import { useCollection } from '@/lib/firestore';
import { toast } from '@/components/ui';
import { firstName } from '@/lib/format';
import { acceptDocument, reclassifyAndAccept, rejectDocument, reviewErrorMessage } from './actions';

export type ReviewDoc = StoredDocument & { id: string };
export type ClientDoc = Client & { id: string };
export interface QueueItem extends ReviewDoc {
  clientName: string;
}

type PendingAction =
  | { kind: 'accept'; item: QueueItem }
  | { kind: 'reject'; item: QueueItem; reason: string }
  | { kind: 'reclassify'; item: QueueItem; docTypeId: string; issuer?: string; code: string };

/** How long an action can be taken back before it actually hits the backend. */
const UNDO_MS = 5000;

const STATE_RANK: Record<string, number> = { needs_review: 0, classified: 1, failed: 2 };

function sortQueue(a: QueueItem, b: QueueItem): number {
  const sr = (STATE_RANK[a.state] ?? 9) - (STATE_RANK[b.state] ?? 9);
  if (sr !== 0) return sr;
  const ca = a.classification?.confidence ?? 0;
  const cb = b.classification?.confidence ?? 0;
  if (ca !== cb) return ca - cb;
  return toMillis(a.uploadedAt) - toMillis(b.uploadedAt);
}

function toMillis(ts: StoredDocument['uploadedAt'] | undefined): number {
  if (!ts) return 0;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return ts.seconds * 1000;
}

export interface ReviewQueue {
  loading: boolean;
  error: boolean;
  items: QueueItem[];
  needsReviewCount: number;
  spotCheckCount: number;
  /** Documents this firm has ever accepted. Zero means a brand-new firm, which
   *  is a different empty queue from one that has been worked down to zero. */
  filedCount: number;
  selected: QueueItem | null;
  selectedId: string | null;
  select: (id: string) => void;
  move: (delta: number) => void;
  accept: (item: QueueItem) => void;
  reject: (item: QueueItem, reason: string) => void;
  reclassify: (item: QueueItem, docTypeId: string, code: string, issuer?: string) => void;
  hasPending: boolean;
}

export function useReviewQueue(firmId: string | null): ReviewQueue {
  const docs = useCollection<ReviewDoc>(
    firmId
      ? query(
          collectionGroup(db, 'documents'),
          where('firmId', '==', firmId),
          where('state', 'in', ['needs_review', 'classified']),
        )
      : null,
  );
  const clients = useCollection<ClientDoc>(
    firmId ? query(collection(db, paths.clients(firmId)), orderBy('sortName')) : null,
  );

  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pendingRef = useRef<Map<string, { action: PendingAction; timeout: ReturnType<typeof setTimeout> }>>(new Map());

  const nameById = useMemo(() => new Map(clients.data.map((c) => [c.id, c.displayName] as const)), [clients.data]);

  const items = useMemo(() => {
    return docs.data
      .filter((d) => !hidden.has(d.id))
      .map<QueueItem>((d) => ({ ...d, clientName: nameById.get(d.clientId) ?? 'Unknown client' }))
      .sort(sortQueue);
  }, [docs.data, hidden, nameById]);

  // Keep a valid selection as the queue shifts under us.
  useEffect(() => {
    if (items.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !items.some((i) => i.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const run = useCallback(async (action: PendingAction) => {
    const { firmId: f, clientId, id } = action.item;
    const target = { firmId: f, clientId, documentId: id };
    if (action.kind === 'accept') await acceptDocument(target);
    else if (action.kind === 'reject') await rejectDocument({ ...target, reason: action.reason });
    else await reclassifyAndAccept({ ...target, docTypeId: action.docTypeId, issuer: action.issuer });
  }, []);

  const commit = useCallback(
    (id: string) => {
      const entry = pendingRef.current.get(id);
      if (!entry) return;
      pendingRef.current.delete(id);
      run(entry.action).catch((err) => {
        setHidden((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.error(reviewErrorMessage(err));
      });
    },
    [run],
  );

  const undo = useCallback((id: string) => {
    const entry = pendingRef.current.get(id);
    if (!entry) return;
    clearTimeout(entry.timeout);
    pendingRef.current.delete(id);
    setHidden((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSelectedId(id);
  }, []);

  const enqueue = useCallback(
    (action: PendingAction, toastLine: string, description?: string) => {
      const id = action.item.id;
      if (pendingRef.current.has(id)) return;

      // Advance the selection before the item disappears from the list.
      const idx = items.findIndex((i) => i.id === id);
      const next = items[idx + 1] ?? items[idx - 1] ?? null;
      setSelectedId(next ? next.id : null);

      setHidden((prev) => new Set(prev).add(id));
      const timeout = setTimeout(() => commit(id), UNDO_MS);
      pendingRef.current.set(id, { action, timeout });

      toast(toastLine, {
        description,
        duration: UNDO_MS,
        action: { label: 'Undo', onClick: () => undo(id) },
      });
    },
    [items, commit, undo],
  );

  const accept = useCallback(
    (item: QueueItem) => {
      const code = item.classification?.docTypeId ?? 'document';
      enqueue({ kind: 'accept', item }, `Accepted ${firstName(item.clientName)}'s document.`, item.canonicalName ?? code);
    },
    [enqueue],
  );

  const reject = useCallback(
    (item: QueueItem, reason: string) => {
      enqueue({ kind: 'reject', item, reason }, `Sent back to ${firstName(item.clientName)}.`, reason);
    },
    [enqueue],
  );

  const reclassify = useCallback(
    (item: QueueItem, docTypeId: string, code: string, issuer?: string) => {
      enqueue({ kind: 'reclassify', item, docTypeId, issuer, code }, `Filed as ${code}.`, `${firstName(item.clientName)} · corrected and accepted`);
    },
    [enqueue],
  );

  const move = useCallback(
    (delta: number) => {
      setSelectedId((current) => {
        if (items.length === 0) return null;
        const idx = current ? items.findIndex((i) => i.id === current) : -1;
        const nextIdx = Math.min(items.length - 1, Math.max(0, (idx < 0 ? 0 : idx) + delta));
        return items[nextIdx].id;
      });
    },
    [items],
  );

  // On unmount, commit anything still in the undo window so no decision is lost.
  useEffect(() => {
    const pending = pendingRef.current;
    return () => {
      for (const [, entry] of pending) {
        clearTimeout(entry.timeout);
        run(entry.action).catch(() => undefined);
      }
      pending.clear();
    };
  }, [run]);

  const selected = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);
  const needsReviewCount = items.filter((i) => i.state === 'needs_review').length;

  // The queue query only returns undecided documents, so an empty queue cannot
  // say whether a decision was ever made. The roster can, and it is already
  // subscribed above — the same move `/chase` makes to tell a finished cadence
  // from one that never started. Only acceptances count: a rejection puts the
  // request back to `pending`, which is not work finished.
  const filedCount = useMemo(
    () => clients.data.reduce((n, c) => n + (c.progress?.accepted ?? 0), 0),
    [clients.data],
  );

  return {
    loading: (docs.loading || clients.loading) && docs.data.length === 0,
    error: Boolean(docs.error),
    items,
    needsReviewCount,
    spotCheckCount: items.length - needsReviewCount,
    filedCount,
    selected,
    selectedId,
    select: setSelectedId,
    move,
    accept,
    reject,
    reclassify,
    hasPending: pendingRef.current.size > 0,
  };
}
