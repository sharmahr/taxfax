import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** A quiet indeterminate spinner. Inherits `currentColor`, so it sits inside buttons. */
export function Spinner({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      role="status"
      aria-label="Loading"
      className={cn('size-4 animate-spin', className)}
      {...props}
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
      <path
        d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
