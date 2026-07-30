import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/**
 * The shared field shell — one source of truth for how an input surface looks
 * and focuses, reused by Textarea and the Select trigger so they stay identical.
 */
export const fieldStyles = cn(
  'w-full rounded-md border border-line-strong bg-surface text-ink',
  'placeholder:text-ink-faint',
  'transition-[color,box-shadow,border-color] duration-100 ease-out-quint',
  'focus-visible:outline-hidden focus-visible:border-focus focus-visible:ring-[3px] focus-visible:ring-focus/25',
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60',
  'aria-[invalid=true]:border-status-danger aria-[invalid=true]:ring-status-danger/25',
);

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input type={type} className={cn(fieldStyles, 'h-9 px-3 text-sm', className)} {...props} />
  );
}
