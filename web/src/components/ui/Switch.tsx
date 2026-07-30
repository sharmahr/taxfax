import type { ComponentProps } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/cn';

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent',
        'bg-line-strong transition-colors duration-150 ease-out-quint',
        'data-[state=checked]:bg-ink',
        'disabled:cursor-not-allowed disabled:opacity-55',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block size-4 translate-x-0.5 rounded-full bg-surface shadow-sm',
          'transition-transform duration-150 ease-out-quint',
          'data-[state=checked]:translate-x-[18px]',
        )}
      />
    </SwitchPrimitive.Root>
  );
}
