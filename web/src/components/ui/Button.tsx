import type { ComponentProps } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

const VARIANTS = {
  /** The one loud action on a view. Inverts cleanly in dark mode. */
  primary: 'bg-ink text-paper shadow-sm hover:bg-ink/90',
  secondary: 'border border-line-strong bg-surface text-ink shadow-sm hover:bg-surface-sunken',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  /** Destructive. Solid — `text-paper` clears AA in both themes (5.1 / 6.2). */
  danger: 'bg-status-danger text-paper shadow-sm hover:bg-status-danger/90',
} as const;

const SIZES = {
  sm: 'h-8 gap-1.5 px-3',
  md: 'h-9 gap-2 px-4',
} as const;

const ICON_SIZES = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
} as const;

interface ButtonProps extends ComponentProps<'button'> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Square button for a lone icon (topbar, sidebar collapse, theme toggle). */
  iconOnly?: boolean;
  /** Spinner overlays without changing width, so layout never jumps. */
  loading?: boolean;
  asChild?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  iconOnly = false,
  loading = false,
  asChild = false,
  className,
  type,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(
    'relative inline-flex select-none items-center justify-center whitespace-nowrap',
    'rounded-md text-sm font-medium',
    'transition-[background-color,border-color,color,transform,box-shadow] duration-100 ease-out-quint',
    'active:scale-[0.98]',
    'disabled:pointer-events-none disabled:opacity-55',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
    iconOnly ? ICON_SIZES[size] : SIZES[size],
    VARIANTS[variant],
    className,
  );

  // Slot forwards to a single child (e.g. a router Link); no loading overlay there.
  if (asChild) {
    return (
      <Slot className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      type={type ?? 'button'}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className={classes}
      {...props}
    >
      {loading ? (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner className="size-4" />
        </span>
      ) : null}
      <span className={cn('inline-flex items-center gap-[inherit]', loading && 'invisible')}>
        {children}
      </span>
    </button>
  );
}
