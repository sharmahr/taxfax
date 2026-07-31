import { createFileRoute } from '@tanstack/react-router';
import { Cadence } from '@/components/marketing/Cadence';
import { Close, Colophon } from '@/components/marketing/Close';
import { Derivation } from '@/components/marketing/Derivation';
import { Hero } from '@/components/marketing/Hero';
import { Intake } from '@/components/marketing/Intake';
import { Masthead } from '@/components/marketing/Masthead';
import { MobileAction } from '@/components/marketing/MobileAction';
import { Scope } from '@/components/marketing/Scope';
import { Terms } from '@/components/marketing/Terms';
import '@/components/marketing/marketing.css';

export const Route = createFileRoute('/')({ component: Landing });

/**
 * The argument, in the order it persuades: the cost of the season, then the
 * three things that remove it, then what we are deliberately not, then the
 * price, then how to start. Every product surface shown here is rendered by
 * the same engines the product runs on.
 */
function Landing() {
  return (
    <div className="mk-paper min-h-dvh bg-paper text-ink">
      <a
        href="#main"
        className="sr-only rounded-md border border-line-strong bg-paper px-3 py-2 text-sm font-medium text-ink focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-50"
      >
        Skip to the page
      </a>

      <Masthead />

      <main id="main">
        <Hero />
        <Derivation />
        <Cadence />
        <Intake />
        <Scope />
        <Terms />
        <Close />
      </main>

      <Colophon />
      <MobileAction />
    </div>
  );
}
