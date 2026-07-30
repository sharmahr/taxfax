import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { fieldStyles } from './Input';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(fieldStyles, 'min-h-20 resize-y px-3 py-2 text-sm/relaxed', className)}
      {...props}
    />
  );
}
