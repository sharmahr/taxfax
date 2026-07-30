import { useEffect, useMemo, useRef, useState } from 'react';
import { DOC_CATEGORY_LABEL, DOC_CATEGORY_ORDER, DOC_TYPES, type DocTypeDef } from '@taxfax/shared';
import { Input, Kbd } from '@/components/ui';

interface ReclassifyPickerProps {
  currentDocTypeId?: string;
  onPick: (docTypeId: string, code: string) => void;
  onCancel: () => void;
}

const ORDER = new Map(DOC_CATEGORY_ORDER.map((c, i) => [c, i] as const));

/** A keyboard-first document-type picker: type to filter, arrows to move, ↵ to file. */
export function ReclassifyPicker({ currentDocTypeId, onPick, onCancel }: ReclassifyPickerProps) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (t: DocTypeDef) =>
      !needle || t.code.toLowerCase().includes(needle) || t.label.toLowerCase().includes(needle) || t.category.includes(needle);
    return DOC_TYPES.filter(match).sort(
      (a, b) => (ORDER.get(a.category) ?? 0) - (ORDER.get(b.category) ?? 0) || a.code.localeCompare(b.code),
    );
  }, [q]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = filtered[active];
      if (pick) onPick(pick.id, pick.code);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  let lastCategory = '';
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line p-3">
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search document types…"
          aria-label="Search document types"
        />
      </div>
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-[13px] text-ink-faint">No document type matches “{q}”.</p>
        ) : (
          filtered.map((t, i) => {
            const header = t.category !== lastCategory ? DOC_CATEGORY_LABEL[t.category] : null;
            lastCategory = t.category;
            const isCurrent = t.id === currentDocTypeId;
            return (
              <div key={t.id}>
                {header && <p className="label-eyebrow px-2 pb-1 pt-2 text-ink-faint">{header}</p>}
                <button
                  type="button"
                  data-idx={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => onPick(t.id, t.code)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                    i === active ? 'bg-surface-sunken' : 'hover:bg-surface-sunken/60'
                  }`}
                >
                  <span className="ticket shrink-0 text-ink">{t.code}</span>
                  <span className="truncate text-[13px] text-ink-muted">{t.label}</span>
                  {isCurrent && <span className="ml-auto shrink-0 text-2xs text-ink-faint">current</span>}
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="flex items-center gap-3 border-t border-line px-3 py-2 text-2xs text-ink-faint">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> move
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> file
        </span>
        <span className="flex items-center gap-1">
          <Kbd>esc</Kbd> cancel
        </span>
      </div>
    </div>
  );
}
