import { useCallback, useEffect, useRef, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { docType } from '@taxfax/shared';
import { useAuth } from '@/lib/auth';
import { useCommand } from '@/lib/command';
import { cn } from '@/lib/cn';
import { usePageTitle } from '@/components/shell';
import { Button, Kbd } from '@/components/ui';
import {
  DecisionPanel,
  DocumentPreview,
  QueueList,
  ReviewEmpty,
  ReviewSkeleton,
  useReviewQueue,
  type ReviewMode,
} from '@/components/review';

export const Route = createFileRoute('/_app/review')({
  component: ReviewScreen,
});

function ReviewScreen() {
  usePageTitle('Review');
  const navigate = useNavigate();
  const { activeFirm } = useAuth();
  const firmId = activeFirm?.firmId ?? null;

  const queue = useReviewQueue(firmId);
  const { selected } = queue;
  const [mode, setMode] = useState<ReviewMode>('idle');
  const [pane, setPane] = useState<'list' | 'detail'>('list');

  useCommand({ id: 'nav-review', group: 'Go to', label: 'Review queue', keywords: ['documents', 'classify'], run: () => navigate({ to: '/review' }) });
  useCommand({ id: 'nav-chase', group: 'Go to', label: 'Chase console', keywords: ['reminders', 'cadence'], run: () => navigate({ to: '/chase' }) });

  // A fresh item is always shown in its resting state, never mid-reject.
  useEffect(() => {
    setMode('idle');
  }, [queue.selectedId]);

  const openItem = useCallback(
    (id: string) => {
      queue.select(id);
      setPane('detail');
    },
    [queue],
  );

  const onAccept = useCallback(() => {
    if (selected) queue.accept(selected);
    setMode('idle');
  }, [queue, selected]);
  const onReject = useCallback(
    (reason: string) => {
      if (selected) queue.reject(selected, reason);
      setMode('idle');
    },
    [queue, selected],
  );
  const onReclassify = useCallback(
    (docTypeId: string, code: string, issuer?: string) => {
      if (selected) queue.reclassify(selected, docTypeId, code, issuer);
      setMode('idle');
    },
    [queue, selected],
  );

  // The global key handler reads the latest state through a ref so we can bind once.
  const live = useRef({ queue, selected, mode, onAccept, onReclassify, setMode });
  live.current = { queue, selected, mode, onAccept, onReclassify, setMode };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const s = live.current;
      if (s.mode !== 'idle') return; // an open reject/reclassify form owns the keys
      const t = e.target as HTMLElement | null;
      if (t && t.closest('input, textarea, select, [contenteditable="true"]')) return;

      switch (e.key) {
        case 'a':
        case 'A':
          e.preventDefault();
          s.onAccept();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          s.setMode('reject');
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          s.setMode('reclassify');
          break;
        case 'j':
        case 'J':
        case 'ArrowDown':
          e.preventDefault();
          s.queue.move(1);
          break;
        case 'k':
        case 'K':
        case 'ArrowUp':
          e.preventDefault();
          s.queue.move(-1);
          break;
        case 'Enter':
          if (t && t.closest('button, a')) return;
          e.preventDefault();
          s.onAccept();
          break;
        default:
          if (/^[1-9]$/.test(e.key)) {
            const alt = s.selected?.classification?.alternates[Number(e.key) - 1];
            if (alt) {
              e.preventDefault();
              const d = docType(alt.docTypeId);
              s.onReclassify(d.id, d.code, s.selected?.classification?.issuer);
            }
          }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!firmId || queue.loading) return <ReviewSkeleton />;
  if (queue.error) return <ReviewError />;
  if (queue.items.length === 0) return <ReviewEmpty hasReviewed={queue.filedCount > 0} />;

  return (
    <div className="flex min-h-0 flex-col lg:h-full">
      <ReviewHeader needsReview={queue.needsReviewCount} spotCheck={queue.spotCheckCount} />

      <span aria-live="polite" className="sr-only">
        {selected ? `Reviewing ${selected.clientName}, ${docType(selected.classification?.docTypeId ?? 'other').code}` : ''}
      </span>

      {/* `minmax(0,1fr)` not `1fr`: a bare `1fr` floors at the preview's
          min-content, which at 1024 pushed the whole grid past the viewport and
          carried the decision column — Accept included — off-screen entirely. */}
      <div className="min-h-0 lg:grid lg:flex-1 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)_minmax(360px,400px)]">
        {/* Queue */}
        <div className={cn('flex min-h-0 flex-col border-line lg:border-r', pane === 'detail' && 'hidden lg:flex')}>
          <div className="min-h-0 flex-1 lg:overflow-y-auto">
            <QueueList items={queue.items} selectedId={queue.selectedId} onSelect={openItem} />
          </div>
        </div>

        {/* Page preview */}
        <div className={cn('flex min-h-0 flex-col bg-surface-sunken/25', pane === 'list' && 'hidden lg:flex')}>
          <button
            type="button"
            onClick={() => setPane('list')}
            className="flex items-center gap-1.5 border-b border-line px-4 py-2.5 text-2xs font-medium text-ink-muted lg:hidden"
          >
            <ArrowLeft className="size-3.5" /> Back to queue
          </button>
          <div className="h-[52vh] p-3 sm:p-4 lg:h-auto lg:min-h-0 lg:flex-1">
            {selected && <DocumentPreview doc={selected} />}
          </div>
        </div>

        {/* Decision */}
        <div className={cn('flex min-h-0 flex-col border-line lg:border-l', pane === 'list' && 'hidden lg:flex')}>
          {selected && (
            <DecisionPanel
              key={selected.id}
              item={selected}
              mode={mode}
              setMode={setMode}
              onAccept={onAccept}
              onReject={onReject}
              onReclassify={onReclassify}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewHeader({ needsReview, spotCheck }: { needsReview: number; spotCheck: number }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-6">
      <div>
        <h1 className="text-sm font-semibold text-ink">Review</h1>
        <p className="text-2xs text-ink-faint">
          <span className={needsReview > 0 ? 'text-status-warn' : undefined}>{needsReview} need a decision</span>
          <span className="mx-1.5 text-ink-faint/50">·</span>
          {spotCheck} to spot-check
        </p>
      </div>
      <dl className="hidden items-center gap-3 text-2xs text-ink-faint md:flex">
        <Legend k="A" label="Accept" />
        <Legend k="R" label="Reject" />
        <Legend k="C" label="Reclassify" />
        <span className="flex items-center gap-1">
          <Kbd>J</Kbd>
          <Kbd>K</Kbd> move
        </span>
      </dl>
    </header>
  );
}

function Legend({ k, label }: { k: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <Kbd>{k}</Kbd> {label}
    </span>
  );
}

function ReviewError() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 py-16">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-3 grid size-11 place-items-center rounded-lg bg-status-danger-wash text-status-danger">
          <AlertTriangle className="size-5" />
        </span>
        <p className="text-sm font-semibold text-ink">The review queue didn't load</p>
        <p className="mt-1 text-sm text-ink-muted">
          This is usually a dropped connection. Reload to try again — nothing was lost.
        </p>
        <Button variant="secondary" className="mt-5" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  );
}
