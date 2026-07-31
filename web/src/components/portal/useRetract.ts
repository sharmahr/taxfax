import { useCallback, useState } from 'react';
import { portalErrorMessage, retractDocument } from './portalApi';

/**
 * Undo for a just-uploaded document. Thin state around the `retractDocument`
 * callable: which documents have a retraction in flight (so the button can show
 * "Removing…" and never fire twice), and the taxpayer-facing sentence to show
 * if the server refuses (the window closed, a preparer already accepted it).
 *
 * The document itself disappears from the list the moment the server marks it
 * `retracted` — the live Firestore listener drives that — so there is nothing
 * to optimistically remove here. `onSuccess` lets the caller clear the matching
 * in-flight upload row, which the listener doesn't own.
 */
export interface UseRetract {
  /** Document ids with a retraction in flight. */
  pending: ReadonlySet<string>;
  /** Per-document refusal sentence from the last failed attempt. */
  errors: ReadonlyMap<string, string>;
  retract: (documentId: string, onSuccess?: () => void) => void;
}

export function useRetract(): UseRetract {
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [errors, setErrors] = useState<Map<string, string>>(() => new Map());

  const retract = useCallback((documentId: string, onSuccess?: () => void) => {
    let alreadyPending = false;
    setPending((prev) => {
      if (prev.has(documentId)) {
        alreadyPending = true;
        return prev;
      }
      return new Set(prev).add(documentId);
    });
    if (alreadyPending) return; // guard the double-tap

    setErrors((prev) => {
      if (!prev.has(documentId)) return prev;
      const next = new Map(prev);
      next.delete(documentId);
      return next;
    });

    void retractDocument(documentId)
      .then(() => onSuccess?.())
      .catch((err) => {
        setErrors((prev) => new Map(prev).set(documentId, portalErrorMessage(err)));
      })
      .finally(() => {
        setPending((prev) => {
          if (!prev.has(documentId)) return prev;
          const next = new Set(prev);
          next.delete(documentId);
          return next;
        });
      });
  }, []);

  return { pending, errors, retract };
}
