import { Button } from '@/components/ui/Button';

/**
 * The explicit-save contract. Settings that send messages to clients never
 * autosave; this bar makes the pending change legible and reversible, and only
 * appears once something is actually dirty.
 */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  saveLabel = 'Save changes',
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saveLabel?: string;
}) {
  if (!dirty) return null;
  return (
    <div className="pointer-events-none sticky bottom-0 z-10 flex justify-end pt-6">
      <div className="rise-in pointer-events-auto flex w-full items-center justify-between gap-4 rounded-xl border border-line bg-surface-raised px-4 py-3 shadow-lg">
        <p className="text-2xs text-ink-muted" aria-live="polite">
          You have unsaved changes.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
          <Button variant="primary" size="sm" onClick={onSave} loading={saving}>
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
