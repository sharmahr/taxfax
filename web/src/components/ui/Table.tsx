import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/**
 * Semantic table primitives tuned for dense financial data: hairline rules, a
 * quiet hover that shifts the row and reveals its actions, and an optional
 * sticky header. Wrap in your own scrolling/virtualized container — these stay
 * unopinionated about height so a 2,000-row roster can virtualize them.
 *
 * Row actions: put them in a trailing cell styled
 * `opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100`.
 */

export function Table({ className, ...props }: ComponentProps<'table'>) {
  return <table className={cn('w-full border-collapse text-sm', className)} {...props} />;
}

export function TableHeader({
  sticky = false,
  className,
  ...props
}: ComponentProps<'thead'> & { sticky?: boolean }) {
  return (
    <thead
      className={cn(
        '[&_tr]:border-b [&_tr]:border-line',
        sticky && '[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-paper',
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'group/row border-b border-line transition-colors duration-100',
        'hover:bg-surface-sunken/60 data-[state=selected]:bg-surface-sunken',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      className={cn('label-eyebrow h-9 whitespace-nowrap px-3 text-left align-middle', className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('px-3 py-2.5 align-middle', className)} {...props} />;
}
