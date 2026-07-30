import { useEffect, useRef } from 'react';
import { docType } from '@taxfax/shared';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';
import type { QueueItem } from './useReviewQueue';

interface QueueListProps {
  items: QueueItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function QueueList({ items, selectedId, onSelect }: QueueListProps) {
  return (
    <ul
      role="listbox"
      aria-label="Documents to review"
      tabIndex={0}
      aria-activedescendant={selectedId ? `queue-opt-${selectedId}` : undefined}
      className="divide-y divide-line outline-none focus-visible:ring-[3px] focus-visible:ring-focus/25"
    >
      {items.map((item) => (
        <QueueRow
          key={item.id}
          item={item}
          selected={item.id === selectedId}
          onSelect={() => onSelect(item.id)}
        />
      ))}
    </ul>
  );
}

function QueueRow({ item, selected, onSelect }: { item: QueueItem; selected: boolean; onSelect: () => void }) {
  const ref = useRef<HTMLLIElement>(null);
  const needsReview = item.state === 'needs_review';
  const def = docType(item.classification?.docTypeId ?? 'other');
  const pct = Math.round((item.classification?.confidence ?? 0) * 100);

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  return (
    <li ref={ref} id={`queue-opt-${item.id}`} role="option" aria-selected={selected}>
      <button
        type="button"
        onClick={onSelect}
        tabIndex={-1}
        className={cn(
          'flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left transition-colors',
          selected ? 'border-ink bg-surface-sunken' : 'border-transparent hover:bg-surface-sunken/50',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'mt-0.5 size-2 shrink-0 rounded-full',
            needsReview ? 'bg-status-warn' : 'bg-status-info/60',
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[13px] font-medium text-ink">{item.clientName}</span>
            <span className="shrink-0 font-mono text-2xs tabular-nums text-ink-faint">{timeAgo(item.uploadedAt)}</span>
          </span>
          <span className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="ticket truncate text-ink-muted">
              {def.code}
              {item.classification?.issuer ? ` · ${item.classification.issuer}` : ''}
            </span>
            <span
              className={cn(
                'shrink-0 font-mono text-2xs tabular-nums',
                needsReview ? 'text-status-warn' : 'text-ink-faint',
              )}
            >
              {pct}%
            </span>
          </span>
        </span>
      </button>
    </li>
  );
}
