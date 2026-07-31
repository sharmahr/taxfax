import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A local editable copy of a persisted record with an honest dirty flag —
 * because anything that sends messages to clients saves explicitly, never on
 * every keystroke. The draft tracks the live document while it's untouched, so
 * a change made elsewhere still shows up, and stops following it the moment the
 * user has unsaved edits so their work is never clobbered mid-sentence.
 */
export interface Draft<T> {
  value: T;
  set: <K extends keyof T>(key: K, value: T[K]) => void;
  patch: (partial: Partial<T>) => void;
  reset: () => void;
  /** Mark the current value as saved (call after a successful write). */
  commit: () => void;
  dirty: boolean;
}

export function useDraft<T>(source: T): Draft<T> {
  const sig = JSON.stringify(source);
  const [value, setValue] = useState<T>(source);
  const baseline = useRef<{ sig: string; value: T }>({ sig, value: source });

  const dirty = JSON.stringify(value) !== baseline.current.sig;

  useEffect(() => {
    if (baseline.current.sig === sig) return;
    // The stored document changed. Follow it only if the user hasn't started editing.
    if (JSON.stringify(value) === baseline.current.sig) {
      baseline.current = { sig, value: source };
      setValue(source);
    }
    // `value` intentionally excluded — this reacts to the source, not local edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const set = useCallback<Draft<T>['set']>((key, v) => {
    setValue((prev) => ({ ...prev, [key]: v }));
  }, []);

  const patch = useCallback((partial: Partial<T>) => {
    setValue((prev) => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => setValue(baseline.current.value), []);

  const commit = useCallback(() => {
    setValue((v) => {
      baseline.current = { sig: JSON.stringify(v), value: v };
      return v;
    });
  }, []);

  return { value, set, patch, reset, commit, dirty };
}
