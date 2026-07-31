import type { ComponentProps } from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/cn';

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/** A thin determinate bar. `value` is 0–100. */
export function Progress({
  value = 0,
  className,
  indicatorClassName,
  ...props
}: ComponentProps<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }) {
  const v = clamp(value ?? 0);
  return (
    <ProgressPrimitive.Root
      value={v}
      className={cn(
        'relative h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken',
        // Which way the bar fills. `width` used to get this free from the inline
        // axis; a transform is physical, so the direction has to be said out loud
        // or the portal fills backwards in Arabic.
        '[--fill-sign:-1] rtl:[--fill-sign:1]',
        className,
      )}
      {...props}
    >
      {/* Full width, slid out of the track by the remainder. A width transition
          would relayout on every progress event from a live upload; a translate
          is composited. The track clips the overhanging cap, so both ends stay
          round. Linear, and short: a taxpayer watching this needs it to read as
          now, not as where the upload was half a second ago. */}
      <ProgressPrimitive.Indicator
        className={cn(
          'h-full w-full rounded-full bg-ink transition-transform duration-200 ease-linear',
          indicatorClassName,
        )}
        style={{ transform: `translateX(calc(var(--fill-sign) * ${100 - v}%))` }}
      />
    </ProgressPrimitive.Root>
  );
}

interface ProgressRingProps {
  /** 0–100. */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/** A compact completion ring for dense roster rows. */
export function ProgressRing({ value, size = 20, strokeWidth = 2.5, className }: ProgressRingProps) {
  const v = clamp(value);
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const center = size / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('shrink-0', className)}
      role="img"
      aria-label={`${Math.round(v)}% collected`}
    >
      <circle cx={center} cy={center} r={r} fill="none" strokeWidth={strokeWidth} className="stroke-line" />
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - v / 100)}
        transform={`rotate(-90 ${center} ${center})`}
        className={cn(
          'transition-[stroke-dashoffset] duration-500 ease-out-quint',
          v >= 100 ? 'stroke-status-success' : 'stroke-ink',
        )}
      />
    </svg>
  );
}
