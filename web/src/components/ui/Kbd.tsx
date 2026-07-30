import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** A keycap. Pass a single key or a combo like `⌘ K` as children. */
export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 select-none items-center justify-center gap-0.5',
        'rounded-sm border border-line bg-surface-sunken px-1',
        'font-mono text-2xs text-ink-muted',
        className,
      )}
      {...props}
    />
  );
}
