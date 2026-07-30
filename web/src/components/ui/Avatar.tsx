import type { ComponentProps } from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/lib/cn';
import { initials as toInitials } from '@/lib/format';

const SIZES = {
  sm: 'size-6 text-2xs',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
} as const;

interface AvatarProps extends ComponentProps<typeof AvatarPrimitive.Root> {
  name: string;
  src?: string;
  size?: keyof typeof SIZES;
}

/** Initials by default; swaps to the image only once it decodes, so it never flashes. */
export function Avatar({ name, src, size = 'md', className, ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden',
        'rounded-full bg-surface-sunken font-medium text-ink-muted ring-1 ring-inset ring-line/70',
        SIZES[size],
        className,
      )}
      {...props}
    >
      {src ? (
        <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />
      ) : null}
      <AvatarPrimitive.Fallback
        delayMs={src ? 200 : 0}
        className="flex size-full items-center justify-center"
      >
        {toInitials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
