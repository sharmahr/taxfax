import type { ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/cn';

export const TooltipProvider = TooltipPrimitive.Provider;

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipPrimitive.TooltipContentProps['side'];
  align?: TooltipPrimitive.TooltipContentProps['align'];
  /** Override the provider delay for a single tooltip. */
  delayDuration?: number;
}

/** Convenience wrapper: wrap any focusable trigger. Needs a <TooltipProvider> above it. */
export function Tooltip({ content, children, side = 'top', align = 'center', delayDuration }: TooltipProps) {
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            'ui-tooltip z-50 max-w-xs select-none rounded-md bg-ink px-2 py-1',
            'text-2xs font-medium text-paper shadow-md',
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-ink" width={10} height={5} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export { TooltipPrimitive };
