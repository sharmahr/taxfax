import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

const VARIANTS = {
  neutral: 'border-transparent bg-surface-sunken text-ink-muted',
  outline: 'border-line text-ink-muted',
  /** Identity, not status — the vermilion used like a stamp. Uses stamp-ink for AA. */
  stamp: 'border-stamp/20 bg-stamp-wash text-stamp-ink',
} as const;

interface BadgeProps extends ComponentProps<'span'> {
  variant?: keyof typeof VARIANTS;
}

/** A small count or tag. For document/workflow status use `StatusPill`. */
export function Badge({ variant = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 py-0.5',
        'text-2xs font-medium',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
