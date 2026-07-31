import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import type { ClientDoc } from './logic';

/**
 * A plain two-column list of clients — the shape a section takes when the only
 * thing to say about each one is their name and "open it".
 */
export function ClientList({ clients, limit = 6 }: { clients: ClientDoc[]; limit?: number }) {
  return (
    <ul className="mt-1 grid gap-x-8 sm:grid-cols-2">
      {clients.slice(0, limit).map((c) => (
        <li key={c.id}>
          <Link
            to="/clients/$clientId"
            params={{ clientId: c.id }}
            className="group/client -mx-2.5 flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm text-ink outline-none transition-colors hover:bg-surface-sunken/60 focus-visible:bg-surface-sunken/60"
          >
            <span className="truncate font-medium">{c.displayName}</span>
            <ArrowUpRight className="size-3.5 shrink-0 text-ink-faint transition-colors group-hover/client:text-ink" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
