import type { ComponentProps } from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'group peer size-4 shrink-0 rounded-sm border border-line-strong bg-surface shadow-xs',
        'transition-[background-color,border-color] duration-100 ease-out-quint',
        'data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[state=checked]:text-paper',
        'data-[state=indeterminate]:border-ink data-[state=indeterminate]:bg-ink data-[state=indeterminate]:text-paper',
        'disabled:cursor-not-allowed disabled:opacity-55',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="size-3 group-data-[state=indeterminate]:hidden" strokeWidth={3} />
        <Minus className="hidden size-3 group-data-[state=indeterminate]:block" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
