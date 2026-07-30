import type { ComponentProps } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

// Header/title/description are plain Dialog parts — same primitive, so they work here.
export {
  DialogHeader as SheetHeader,
  DialogFooter as SheetFooter,
  DialogTitle as SheetTitle,
  DialogDescription as SheetDescription,
} from './Dialog';

const SIDES = {
  right: 'inset-y-0 right-0 max-w-sm border-l ui-sheet-right',
  left: 'inset-y-0 left-0 max-w-sm border-r ui-sheet-left',
} as const;

export function SheetContent({
  side = 'right',
  className,
  children,
  showClose = true,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  side?: keyof typeof SIDES;
  showClose?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="ui-overlay fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex h-full w-full flex-col gap-4 bg-surface-raised p-6 shadow-xl outline-hidden',
          SIDES[side],
          className,
        )}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close
            className="absolute right-4 top-4 inline-flex size-7 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
