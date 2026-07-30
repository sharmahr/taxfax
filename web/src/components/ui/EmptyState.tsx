import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Reads like a status report, never a joke. The caller supplies the plain-spoken copy. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-14 text-center',
        className,
      )}
    >
      {Icon ? (
        <div className="mb-4 inline-flex size-11 items-center justify-center rounded-lg bg-surface-sunken text-ink-faint">
          <Icon className="size-5" />
        </div>
      ) : null}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-pretty text-sm text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
