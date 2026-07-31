import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, type UploadTask } from 'firebase/storage';
import { paths } from '@taxfax/shared';
import { auth, db, storage } from '@/lib/firebase';
import { prepareUpload, UploadPrepError } from './prepareUpload';
import { usePortalLocale } from './locale';
import { portalErrorMessage, requestUploadSlot } from './portalApi';

/**
 * The upload engine. One job: get a taxpayer's file onto Storage at the exact
 * path the server blessed, with honest progress and a real undo.
 *
 * The moment the object finalizes we write the `uploading` stub the security
 * rules document as the upload handshake. Two reasons it lives here, and only
 * after finalize:
 *   1. The record exists the instant the bytes land, so the taxpayer gets an
 *      immediate confirmation and the firm has something to enrich — even if the
 *      Storage trigger is cold-starting or briefly down. The trigger merges its
 *      classification into this stub when it runs.
 *   2. Nothing is written until the upload is irreversible anyway. Cancelling
 *      while it is still in flight leaves no Firestore ghost behind — the rules
 *      forbid a taxpayer from deleting a document, so a premature stub would
 *      strand an un-removable row. That is what keeps undo real.
 */

export type UploadStatus = 'preparing' | 'uploading' | 'processing' | 'error';

export interface UploadItem {
  id: string;
  /** The checklist row the taxpayer tapped, if any — used to place it in the list. */
  requestId: string | null;
  originalName: string;
  displayName: string;
  contentType: string;
  sizeBytes: number;
  status: UploadStatus;
  /** 0–1, straight from the resumable upload — never a fake animation. */
  progress: number;
  /** Known once the server grants a slot; lets the list match the finalized doc. */
  documentId: string | null;
  error: string | null;
  /** True when we converted a HEIC photo to JPEG before upload. */
  transcoded: boolean;
}

export interface UploadContext {
  firmId: string;
  clientId: string;
  taxYear: number;
}

export interface UseUploads {
  items: UploadItem[];
  start: (files: FileList | File[], requestId?: string | null) => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  dismiss: (id: string) => void;
}

export function useUploads({ firmId, clientId, taxYear }: UploadContext): UseUploads {
  const { t } = usePortalLocale();
  const [items, setItems] = useState<UploadItem[]>([]);

  const itemsRef = useRef<UploadItem[]>([]);
  const filesRef = useRef<Map<string, File>>(new Map());
  const tasksRef = useRef<Map<string, UploadTask>>(new Map());
  const canceledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Abort every in-flight upload if the component unmounts.
  useEffect(() => {
    const tasks = tasksRef.current;
    return () => {
      for (const task of tasks.values()) {
        try {
          task.cancel();
        } catch {
          /* already settled */
        }
      }
    };
  }, []);

  const patch = useCallback((id: string, partial: Partial<UploadItem>) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...partial } : x)));
  }, []);
  const forget = useCallback((id: string) => {
    canceledRef.current.delete(id);
    filesRef.current.delete(id);
    tasksRef.current.delete(id);
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const runUpload = useCallback(
    async (id: string, file: File) => {
      const bail = () => canceledRef.current.has(id);

      patch(id, { status: 'preparing', progress: 0, error: null });

      let prepared;
      try {
        prepared = await prepareUpload(file, t);
      } catch (err) {
        if (bail()) return forget(id);
        patch(id, {
          status: 'error',
          error: err instanceof UploadPrepError ? err.message : portalErrorMessage(err),
        });
        return;
      }
      if (bail()) return forget(id);
      patch(id, {
        displayName: prepared.fileName,
        contentType: prepared.contentType,
        sizeBytes: prepared.sizeBytes,
        transcoded: prepared.transcoded,
      });

      let slot;
      try {
        slot = await requestUploadSlot({
          firmId,
          clientId,
          taxYear,
          fileName: prepared.fileName,
          contentType: prepared.contentType,
          sizeBytes: prepared.sizeBytes,
        });
      } catch (err) {
        if (bail()) return forget(id);
        patch(id, { status: 'error', error: portalErrorMessage(err) });
        return;
      }
      if (bail()) return forget(id);
      patch(id, { documentId: slot.documentId, status: 'uploading', progress: 0 });

      const task = uploadBytesResumable(storageRef(storage, slot.storagePath), prepared.blob, {
        contentType: prepared.contentType,
      });
      tasksRef.current.set(id, task);
      task.on(
        'state_changed',
        (snap) => {
          const p = snap.totalBytes > 0 ? snap.bytesTransferred / snap.totalBytes : 0;
          patch(id, { progress: p });
        },
        (err) => {
          tasksRef.current.delete(id);
          const code = (err as { code?: string }).code;
          if (code === 'storage/canceled' || bail()) return forget(id);
          patch(id, { status: 'error', error: portalErrorMessage(err) });
        },
        () => {
          tasksRef.current.delete(id);
          // Finalized: the bytes are durably on Storage and can't be undone now.
          patch(id, { status: 'processing', progress: 1 });

          // Write the `uploading` stub the rules bless as the handshake, so the
          // document exists immediately. The Storage trigger merges its
          // classification in when it runs; if it raced us and created the
          // record first, our create is denied and the live listener shows its
          // version — either way the taxpayer's file is on record.
          const uid = auth.currentUser?.uid;
          if (uid) {
            void setDoc(doc(db, paths.document(firmId, clientId, slot.documentId)), {
              firmId,
              clientId,
              taxYear,
              storagePath: slot.storagePath,
              originalName: prepared.fileName,
              contentType: prepared.contentType,
              sizeBytes: prepared.sizeBytes,
              state: 'uploading',
              uploadedBy: uid,
              uploadedVia: 'portal',
              uploadedAt: serverTimestamp(),
            }).catch(() => {
              /* trigger won the race, or a transient write error; listener recovers */
            });
          }
        },
      );
    },
    [firmId, clientId, taxYear, patch, forget, t],
  );

  const start = useCallback(
    (files: FileList | File[], requestId: string | null = null) => {
      for (const file of Array.from(files)) {
        const id =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `u_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        filesRef.current.set(id, file);
        setItems((xs) => [
          ...xs,
          {
            id,
            requestId,
            originalName: file.name || 'upload',
            displayName: file.name || 'upload',
            contentType: file.type,
            sizeBytes: file.size,
            status: 'preparing',
            progress: 0,
            documentId: null,
            error: null,
            transcoded: false,
          },
        ]);
        void runUpload(id, file);
      }
    },
    [runUpload],
  );

  const cancel = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((x) => x.id === id);
      // Once finalized we can't undo — that record belongs to the firm now.
      if (item && item.status === 'processing') return;
      canceledRef.current.add(id);
      const task = tasksRef.current.get(id);
      if (task) {
        try {
          task.cancel(); // the error callback runs forget()
        } catch {
          forget(id);
        }
      } else {
        forget(id);
      }
    },
    [forget],
  );

  const retry = useCallback(
    (id: string) => {
      const file = filesRef.current.get(id);
      if (!file) return;
      canceledRef.current.delete(id);
      void runUpload(id, file);
    },
    [runUpload],
  );

  return { items, start, cancel, retry, dismiss: forget };
}
