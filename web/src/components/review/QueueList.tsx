import { useEffect, type Ref } from 'react';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'motion/react';
import { docType } from '@taxfax/shared';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';
import type { QueueItem } from './useReviewQueue';

/* The one place in this product where a stylesheet cannot do the job.
 *
 * `app.css` owns the motion vocabulary and stays the default everywhere else:
 * two curves, four primitives, and Radix overlays that keep their element
 * mounted through `data-state="closed"` so even dialogs and sheets get real
 * exit animations with no JavaScript. None of that reaches a row that React has
 * already unmounted, and none of it can slide the rows below it up into the
 * space that row left. That is this file, and only this file.
 *
 * The numbers are that same vocabulary restated where an exit can reach it:
 * `--ease-out-quint` for arriving, `--ease-in-out-quart` for leaving, and
 * durations lifted from `swap-in` and the dialog and sheet exits. One system,
 * two implementations — if a value changes here it changes there too. */
const EASE_OUT = [0.16, 1, 0.3, 1] as [number, number, number, number];
const EASE_IN_OUT = [0.76, 0, 0.24, 1] as [number, number, number, number];
const ARRIVE = 0.18;
const LEAVE = 0.16;
const SETTLE = 0.22;

interface QueueListProps {
  items: QueueItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function QueueList({ items, selectedId, onSelect }: QueueListProps) {
  // One effect for the list, not one per row. `aria-activedescendant` already
  // makes the id of the selected row the contract between this component and
  // the accessibility tree; keeping the scroll on the same id keeps the row
  // itself refless, which is what `popLayout` needs to measure it.
  useEffect(() => {
    if (!selectedId) return;
    document.getElementById(`queue-opt-${selectedId}`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  return (
    // The library's own default is `reducedMotion: "never"`. This is the floor
    // under the per-row check below, not a substitute for it.
    <MotionConfig reducedMotion="user">
      {/* `relative`: a row on its way out is lifted out of flow and positioned
          against this box, so the rows below can close the gap while it leaves
          rather than after it. */}
      <ul
        role="listbox"
        aria-label="Documents to review"
        tabIndex={0}
        aria-activedescendant={selectedId ? `queue-opt-${selectedId}` : undefined}
        className="relative divide-y divide-line outline-none focus-visible:ring-[3px] focus-visible:ring-focus/25"
      >
        {/* `initial={false}`: this queue is opened dozens of times a day and
            must never fan itself in. Only rows that arrive while someone is
            watching — a taxpayer uploading mid-session — animate. */}
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((item) => (
            <QueueRow
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={() => onSelect(item.id)}
            />
          ))}
        </AnimatePresence>
      </ul>
    </MotionConfig>
  );
}

/**
 * A decision has to stay legible after it is made. Accepting the top document
 * used to delete it mid-render: the highlight stayed exactly where it was while
 * a different client's name appeared underneath it — and "did I just accept the
 * right thing?" is the one question this product cannot leave open. So the row
 * fades and slides out to the left while the queue closes the gap behind it.
 * The eye follows the row out and lands on the next one.
 *
 * None of it delays the decision. The write is already queued, the selection has
 * already moved, and the toast carrying the five-second undo is already up
 * before the first frame of this renders. `popLayout` lifts the leaving row out
 * of flow so the exit and the reflow run together rather than end to end, which
 * is the difference between 220ms and 380ms on a keypress someone makes three
 * hundred times in a sitting. Only `transform` and `opacity` move; `layout` is
 * a FLIP, so the rows below travel without a reflow.
 *
 * `ref` is a plain prop in React 19, and it has to reach the `li`: `popLayout`
 * measures the leaving row through it, and silently does nothing without it.
 */
function QueueRow({
  item,
  selected,
  onSelect,
  ref,
}: {
  item: QueueItem;
  selected: boolean;
  onSelect: () => void;
  ref?: Ref<HTMLLIElement>;
}) {
  const reduced = useReducedMotion();
  const needsReview = item.state === 'needs_review';
  const def = docType(item.classification?.docTypeId ?? 'other');
  const pct = Math.round((item.classification?.confidence ?? 0) * 100);

  // Not a shorter journey — no journey. Under reduced motion the row goes in one
  // frame, exactly as it did before any of this existed.
  const anim = reduced
    ? { initial: false as const, exit: { opacity: 0, transition: { duration: 0 } } }
    : {
        layout: 'position' as const,
        initial: { opacity: 0, y: -4 },
        animate: { opacity: 1, y: 0, transition: { duration: ARRIVE, ease: EASE_OUT } },
        exit: { opacity: 0, x: -12, transition: { duration: LEAVE, ease: EASE_IN_OUT } },
        transition: { duration: SETTLE, ease: EASE_OUT },
      };

  return (
    <motion.li {...anim} ref={ref} id={`queue-opt-${item.id}`} role="option" aria-selected={selected}>
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
    </motion.li>
  );
}
