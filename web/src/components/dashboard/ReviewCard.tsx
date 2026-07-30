import { Link } from '@tanstack/react-router';
import { ArrowRight, Inbox } from 'lucide-react';

interface ReviewCardProps {
  count: number;
  clients: number;
  topClients: string[];
}

/** One-click bridge into the review queue, with just enough specifics to be worth the click. */
export function ReviewCard({ count, clients, topClients }: ReviewCardProps) {
  const names = topClients.join(', ');
  const rest = clients - topClients.length;

  return (
    <Link
      to="/review"
      className="group flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 outline-none transition-colors hover:border-line-strong focus-visible:border-ink"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Inbox className="size-4 shrink-0 text-status-info" />
          <span className="text-sm font-semibold text-ink">
            {count} {count === 1 ? 'document' : 'documents'} waiting on a decision
          </span>
        </div>
        <p className="mt-1 truncate text-[13px] text-ink-muted">
          {clients === 0
            ? 'Spot-check the classifier and clear the queue.'
            : `Across ${clients} ${clients === 1 ? 'client' : 'clients'}${names ? ` — ${names}` : ''}${rest > 0 ? ` +${rest}` : ''}`}
        </p>
      </div>
      <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-ink px-4 text-sm font-medium text-paper shadow-sm transition-transform group-active:scale-[0.98]">
        Review
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
