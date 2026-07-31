import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/Button';

/**
 * A masthead, not a nav bar. The page has two destinations, so there is nothing
 * to navigate; the bar's job is to say what this is and how to get in. It does
 * not stick: the page is a document, and a lit bar would cut across the one
 * full-bleed dark band on the way past it.
 */
export function Masthead() {
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex h-14 w-full max-w-[76rem] items-center gap-4 px-5 sm:h-16 sm:px-8">
        <a href="#top" className="display shrink-0 text-[1.375rem] leading-none text-ink">
          TaxFax
        </a>
        <span aria-hidden className="hidden h-4 w-px shrink-0 bg-line-strong sm:block" />
        <p className="hidden min-w-0 truncate text-2xs tracking-[0.02em] text-ink-muted sm:block">
          Document collection for tax and accounting firms
        </p>

        <nav aria-label="Account" className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild variant="primary" size="sm">
            <Link to="/signup">Start a season</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
