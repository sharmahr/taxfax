import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** A calm opacity pulse — never a shimmer sweep. Match the shape it stands in for. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('pulse-calm rounded-md bg-surface-sunken', className)}
      {...props}
    />
  );
}
