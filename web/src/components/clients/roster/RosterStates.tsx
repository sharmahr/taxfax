import type { ReactNode } from 'react';
import { CheckCheck, SearchX } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CardVignette } from '@/components/brand';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Lens } from '../model';
import { ROSTER_COLS } from './RosterTable';

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 items-center justify-center p-6">{children}</div>;
}

/** New firm, nothing imported yet. The one time the roster is truly empty. */
export function EmptyRoster({ onAddClient }: { onAddClient: () => void }) {
  return (
    <Centered>
      <EmptyState
        vignette={<CardVignette className="text-ink-faint" />}
        title="No clients yet"
        description="Drop in last year’s returns and TaxFax builds each client’s checklist automatically — then starts the chase. Add your first client to begin."
        className="max-w-md"
        action={
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={onAddClient}>
              Add a client
            </Button>
            <Button variant="secondary" onClick={onAddClient}>
              Import last year’s returns
            </Button>
          </div>
        }
      />
    </Centered>
  );
}

/** Active search or filter with nothing behind it. */
export function NoResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <Centered>
      <EmptyState
        icon={SearchX}
        title={query ? `No clients match “${query}”` : 'No clients match these filters'}
        description="Try a different name or email, or clear the filters to see the whole book."
        className="max-w-md"
        action={
          <Button variant="secondary" onClick={onClear}>
            Clear filters
          </Button>
        }
      />
    </Centered>
  );
}

const CAUGHT_UP: Partial<Record<Lens, { title: string; description: string }>> = {
  attention: {
    title: 'Nothing needs you',
    description: 'No blocked, escalated, or overdue clients right now. The chase is handling the rest.',
  },
  chasing: {
    title: 'Nobody left to chase',
    description: 'Every active client has sent everything you asked for. Nice and quiet.',
  },
  review: {
    title: 'Nothing waiting on review',
    description: 'No documents are sitting in your queue. You’re clear.',
  },
};

/** The good empty: a lens with real clients elsewhere, but zero here. */
export function CaughtUp({ lens, onClear }: { lens: Lens; onClear: () => void }) {
  const copy = CAUGHT_UP[lens] ?? {
    title: 'You’re all caught up',
    description: 'Nothing in this view needs attention right now.',
  };
  return (
    <Centered>
      <EmptyState
        icon={CheckCheck}
        title={copy.title}
        description={copy.description}
        className="max-w-md border-status-success/30"
        action={
          <Button variant="ghost" onClick={onClear}>
            View all clients
          </Button>
        }
      />
    </Centered>
  );
}

/** Loading placeholder that matches the real row geometry, never a spinner. */
export function RosterSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-hidden" aria-hidden>
      {/* Desktop: mirror the grid tracks. */}
      <div className="hidden md:block">
        <div
          className="grid h-10 items-center gap-3 border-b border-line px-3"
          style={{ gridTemplateColumns: ROSTER_COLS }}
        >
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-12" />
          <span />
          <span />
        </div>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="grid h-[60px] items-center gap-3 border-b border-line/70 px-3"
            style={{ gridTemplateColumns: ROSTER_COLS }}
          >
            <Skeleton className="size-4 rounded" />
            <div className="space-y-1.5">
              <Skeleton className={cn('h-3.5', i % 3 === 0 ? 'w-52' : 'w-40')} />
              <Skeleton className="h-2.5 w-32" />
            </div>
            <Skeleton className="h-5 w-20 rounded-lg" />
            <Skeleton className="h-1.5 w-16 rounded-full" />
            <Skeleton className="h-3.5 w-10" />
            <Skeleton className="h-5 w-28 rounded-lg" />
            <Skeleton className="mx-auto size-6 rounded-full" />
            <span />
          </div>
        ))}
      </div>
      {/* Mobile: mirror the cards. */}
      <div className="md:hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="space-y-2.5 border-b border-line px-4 py-3.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-20 rounded-lg" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-1.5 w-24 rounded-full" />
              <Skeleton className="h-3.5 w-10" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32 rounded-lg" />
              <Skeleton className="size-6 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
