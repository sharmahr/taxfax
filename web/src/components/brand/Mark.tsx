import { cn } from '@/lib/cn';

/**
 * The chop.
 *
 * A Clarendon-cut T punched into a vermilion field — the register of a revenue
 * stamp or a notary's chop, not an app icon. The system reserves vermilion for
 * identity and status; a mark is identity, so this is the one place it is
 * spent unconditionally.
 *
 * The letter is drawn, not set: slab serifs with bracketed fillets that read at
 * 96px and simply thicken the stem at 16px. Nothing in it depends on a font
 * being loaded, and nothing in it needs a second file for dark mode.
 */
const T_PATH =
  'M5.6 5.8H26.4V12H23.9V10.8Q23.9 9.4 22.5 9.4H19.5Q18.1 9.4 18.1 10.8V21.5Q18.1 22.9 19.5 22.9H21.6V26.2H10.4V22.9H12.5Q13.9 22.9 13.9 21.5V10.8Q13.9 9.4 12.5 9.4H9.5Q8.1 9.4 8.1 10.8V12H5.6Z';

/**
 * The knockout is a brand constant, not a theme value: the letter is the same
 * light on every ground, so the mark on screen is the same mark as the favicon
 * and the app icon. Only the field follows the theme, which is what keeps the
 * vermilion sitting correctly on dark.
 */
const KNOCKOUT = '#F9F8F5';

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-6', className)} aria-hidden focusable="false">
      <rect width="32" height="32" rx="6" fill="var(--color-stamp)" />
      <path d={T_PATH} fill={KNOCKOUT} />
    </svg>
  );
}

/**
 * The letter without its field, in `currentColor` — for places that already
 * carry the brand and only need a glyph: a favicon fallback, an avatar
 * initial, a monochrome print.
 */
export function MarkGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-6', className)} aria-hidden focusable="false">
      <path d={T_PATH} fill="currentColor" />
    </svg>
  );
}

/**
 * Chop plus name. The mark is set to the wordmark's cap height rather than its
 * em, which is why the size ratio looks small written down and correct on
 * screen. Give it a font size and it scales as one object.
 */
export function Wordmark({
  className,
  as: Tag = 'span',
}: {
  className?: string;
  as?: 'span' | 'div' | 'h1';
}) {
  return (
    <Tag className={cn('inline-flex items-center gap-[0.34em] text-[1.375rem]', className)}>
      <Mark className="size-[0.79em] shrink-0" />
      <span className="display leading-none">TaxFax</span>
    </Tag>
  );
}
