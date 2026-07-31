import { useId } from 'react';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════════════════
   House illustration — engraved, not drawn.

   These are not a mascot. There is no character, no face, no hands: the
   vocabulary is stationery and instruments, rendered the way a share
   certificate or a passport page renders them — orthographic line-work, tone
   built from ruled hatching, one ink. That is the part of the banknote idiom
   that still reads as "secure document"; the allegorical figures are the part
   every issuing authority dropped, and so did we.

   Everything is `currentColor`, so a vignette takes ink from its container and
   inverts for free on dark. Vermilion appears only where the product has
   actually done something — a printed rule, a stamp, a seal — never as
   decoration.

   Three drawings cover every slot in the product: nothing on file yet, the
   work is closed out, the taxpayer is finished. A fourth would be a fourth
   thing to keep consistent for no new meaning.
   ═══════════════════════════════════════════════════════════════════════════ */

interface VignetteProps {
  className?: string;
}

/** Ruled hatching. One tile, rotated — the whole tone system in sixty bytes. */
function Hatch({
  id,
  gap,
  weight,
  angle,
}: {
  id: string;
  gap: number;
  weight: number;
  angle: number;
}) {
  return (
    <pattern
      id={id}
      width={gap}
      height={gap}
      patternUnits="userSpaceOnUse"
      patternTransform={`rotate(${angle})`}
    >
      <line x1="0" y1="0" x2="0" y2={gap} stroke="currentColor" strokeWidth={weight} />
    </pattern>
  );
}

const engraved = {
  fill: 'none' as const,
  stroke: 'currentColor',
  'aria-hidden': true,
  focusable: 'false' as const,
};

/**
 * A blank index card, and the empty ones waiting behind it.
 *
 * Rounded corners, a printed head rule, a margin rule and the rod punch at the
 * foot: four details that make this a card and not a page. The rules are
 * there and nothing is written on them, which is the entire statement — the
 * file exists, it is simply empty.
 *
 * Use for: "No clients yet" (roster), "Nothing to chase — yet", first-run
 * dashboards, and the 404, where "Not on file." is the same picture.
 */
export function CardVignette({ className }: VignetteProps) {
  const uid = useId();
  const shade = `${uid}-s`;

  return (
    <svg viewBox="0 0 176 120" className={cn('w-44', className)} {...engraved}>
      <defs>
        <Hatch id={shade} gap={2.8} weight={0.5} angle={-45} />
      </defs>

      <g strokeWidth="0.9" fill="var(--color-surface)">
        <rect x="36" y="30" width="110" height="62" rx="2" opacity="0.38" />
        <rect x="32" y="34" width="110" height="62" rx="2" opacity="0.62" />
      </g>

      <rect x="30" y="99" width="112" height="5" fill={`url(#${shade})`} stroke="none" />

      <rect
        x="28"
        y="38"
        width="110"
        height="62"
        rx="2"
        fill="var(--color-surface)"
        strokeWidth="1.2"
      />

      {/* The head rule is printed on the card, not applied to the drawing. */}
      <line x1="36" y1="52" x2="130" y2="52" stroke="var(--color-stamp)" strokeWidth="1.4" />

      <g strokeWidth="0.7" opacity="0.72">
        <line x1="48" y1="44" x2="48" y2="90" />
        {[63, 74, 85].map((y) => (
          <line key={y} x1="36" y1={y} x2="130" y2={y} />
        ))}
      </g>

      {/* The rod punch. No other sheet of paper has one. */}
      <circle cx="83" cy="94.5" r="2.8" strokeWidth="0.9" fill="var(--color-surface)" />
    </svg>
  );
}

/**
 * A schedule, closed out and struck.
 *
 * Every line answered, a double rule under the last figure — the accountant's
 * mark for an account that is finished — and a chop landed slightly off
 * square. The angle is the point: a stamp set perfectly straight was applied
 * by a machine, and this one was applied by somebody who was done.
 *
 * Use for: "You're all caught up" (review queue at zero), and any state that
 * means the work is complete rather than absent.
 */
export function StampedVignette({ className }: VignetteProps) {
  const uid = useId();
  const shade = `${uid}-s`;
  const rows: [number, number][] = [
    [42, 79],
    [51, 72],
    [60, 81],
    [69, 74],
    [78, 78],
  ];

  return (
    <svg viewBox="0 0 176 120" className={cn('w-44', className)} {...engraved}>
      <defs>
        <Hatch id={shade} gap={2.8} weight={0.5} angle={-45} />
      </defs>

      <rect x="36" y="106" width="112" height="5" fill={`url(#${shade})`} stroke="none" />

      <rect
        x="30"
        y="12"
        width="112"
        height="94"
        rx="1.5"
        fill="var(--color-surface)"
        strokeWidth="1.2"
      />

      <line x1="41" y1="25" x2="77" y2="25" strokeWidth="1.9" />
      <line x1="41" y1="32.5" x2="131" y2="32.5" strokeWidth="0.7" />

      <g strokeWidth="0.75" opacity="0.78">
        {rows.map(([y, end]) => (
          <g key={y}>
            <line x1="41" y1={y} x2={end} y2={y} />
            <line x1="99" y1={y} x2="131" y2={y} />
          </g>
        ))}
        <line x1="99" y1="90" x2="131" y2="90" />
        <line x1="99" y1="93.2" x2="131" y2="93.2" />
      </g>

      <g stroke="var(--color-stamp)" transform="rotate(-7 92 62)">
        <rect x="64" y="39" width="56" height="46" rx="2" strokeWidth="1.7" />
        <rect x="67.4" y="42.4" width="49.2" height="39.2" rx="1" strokeWidth="0.7" />
        <path d="M77 63.5 86 73 108 50" strokeWidth="4.8" strokeLinecap="square" />
      </g>
    </svg>
  );
}

/**
 * The seal.
 *
 * A real guilloché rosette: two families of ellipses swept around a common
 * centre, which is arithmetically what a rose-engine lathe cuts into a
 * printing plate. Generating it rather than drawing it is the point — the
 * symmetry is exact, and exactness is the difference between an engraved seal
 * and a picture of one.
 *
 * Vermilion, because this is the one place in the product where somebody is
 * told the thing is finished.
 *
 * Use for: the taxpayer portal's done state and season-complete milestones.
 * Do not render it below about 112px; under that the rosette closes into a disc.
 */
export function SealVignette({ className }: VignetteProps) {
  const uid = useId();
  const petal = `${uid}-p`;
  const core = `${uid}-c`;
  const sweep = (n: number) => Array.from({ length: n }, (_, i) => (i * 360) / n);

  return (
    <svg
      viewBox="0 0 132 132"
      className={cn('w-32', className)}
      fill="none"
      stroke="var(--color-stamp)"
      aria-hidden
      focusable="false"
    >
      <defs>
        <ellipse id={petal} cx="66" cy="42" rx="10.5" ry="19.5" />
        <ellipse id={core} cx="66" cy="52" rx="4.6" ry="10" />
      </defs>

      <circle cx="66" cy="66" r="62.6" strokeWidth="0.6" />
      <circle cx="66" cy="66" r="59.4" strokeWidth="1.5" />
      {/* Reeded edge, drawn as a fine dashed ring rather than ninety ticks. */}
      <circle cx="66" cy="66" r="55.6" strokeWidth="3" strokeDasharray="1 2.88" opacity="0.85" />
      <circle cx="66" cy="66" r="50.6" strokeWidth="0.9" />
      <circle cx="66" cy="66" r="48.4" strokeWidth="0.5" />

      <g strokeWidth="0.4" opacity="0.85">
        {sweep(30).map((a) => (
          <use key={a} href={`#${petal}`} transform={`rotate(${a} 66 66)`} />
        ))}
        {sweep(18).map((a) => (
          <use key={`c${a}`} href={`#${core}`} transform={`rotate(${a} 66 66)`} />
        ))}
      </g>

      <circle cx="66" cy="66" r="4.4" strokeWidth="0.9" />
      <circle cx="66" cy="66" r="1.5" fill="var(--color-stamp)" stroke="none" />
    </svg>
  );
}
