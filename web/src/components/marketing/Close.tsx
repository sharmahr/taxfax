import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/Button';

/** The five first-run steps, in the order `ONBOARDING_STEPS` runs them. */
const SETUP: [string, string][] = [
  ['Your firm', 'Name, timezone, and the reply-to address clients will see.'],
  ['Your clients', 'Last season\u2019s roster from a CSV. The columns get mapped for you.'],
  ['One checklist', 'Point it at a prior-year return and watch the list build.'],
  ['Your team', 'Add colleagues and set what each of them can do.'],
  ['The chase', 'How hard it nudges, and the hours it stays quiet.'],
];

export function Close() {
  return (
    <section id="start" className="border-t border-line bg-surface-sunken">
      <div className="mx-auto w-full max-w-[76rem] px-5 sm:px-8">
        <div className="grid gap-y-8 py-16 md:grid-cols-[7.5rem_minmax(0,1fr)] md:gap-x-10 md:py-24 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-x-16">
          <div className="md:sticky md:top-24 md:self-start">
            <p className="mk-eyebrow text-ink-muted">Start</p>
          </div>

          <div className="grid min-w-0 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:gap-x-14">
            <div className="min-w-0">
              <h2 className="display mk-hang max-w-[14ch] text-pretty text-[clamp(2.25rem,6.5vw,4rem)] leading-[0.98] text-ink">
                Start with twenty clients.
              </h2>
              <div className="mt-6 max-w-[58ch] space-y-4 text-pretty text-[0.9375rem] leading-[1.68] text-ink-muted">
                <p>
                  TaxFax has not been through a filing season yet, and we are not going to pretend
                  otherwise with a wall of logos. So do not move the practice onto it in January.
                </p>
                <p>
                  Put twenty clients on it. The twenty who were late last year, the ones whose names
                  your staff say out loud in March. If they are not a week ahead of last February by
                  the middle of this one, stop paying for it.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild variant="primary" size="md">
                  <Link to="/signup">Start a season</Link>
                </Button>
                <Button asChild variant="ghost" size="md">
                  <Link to="/login">Sign in</Link>
                </Button>
              </div>
            </div>

            <div className="min-w-0 lg:pt-2">
              <p className="mk-eyebrow text-ink-muted border-b border-line-strong pb-2">
                Setting up, in order
              </p>
              <ol className="mt-1" data-tabular>
                {SETUP.map(([step, line], i) => (
                  <li
                    key={step}
                    className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-baseline gap-x-3 border-b border-line py-2.5 last:border-b-0"
                  >
                    <span className="ticket text-ink-muted">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="text-[0.8125rem] font-medium text-ink">{step}</span>
                      <span className="mt-0.5 block text-[0.75rem] leading-[1.5] text-ink-muted">
                        {line}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[0.75rem] leading-[1.5] text-ink-muted">
                Skip any of them. Nothing sends to a client until you send it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Outside `<main>` so it is a real contentinfo landmark rather than a generic
 * block, which is what a `<footer>` nested in a section would be.
 */
export function Colophon() {
  return (
    <footer className="border-t border-line bg-surface-sunken">
      <div className="mx-auto w-full max-w-[76rem] px-5 sm:px-8">
        <div className="grid gap-y-4 py-8 pb-[5.5rem] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-x-8 md:pb-8">
          <div>
            <p className="display text-[1.125rem] leading-none text-ink">TaxFax</p>
            <p className="mt-2 text-[0.8125rem] leading-[1.5] text-ink-muted">
              Document collection for tax and accounting firms. Stop chasing, start filing.
            </p>
          </div>
          <p className="ticket text-ink-muted sm:text-right">
            Set in Instrument Serif, Inter and Geist Mono
          </p>
        </div>
      </div>
    </footer>
  );
}
