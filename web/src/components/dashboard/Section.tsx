import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SectionProps {
  title: string;
  count?: number;
  /** A trailing affordance — usually a "view all" link. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A titled block on the dashboard. The count sits with the title so every
 *  number on the screen is attached to a list you can act on. */
export function Section({ title, count, action, children, className }: SectionProps) {
  return (
    <section className={cn('min-w-0', className)}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h2 className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-ink">{title}</span>
          {count != null && count > 0 && (
            <span className="font-mono text-2xs tabular-nums text-ink-faint">{count}</span>
          )}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
