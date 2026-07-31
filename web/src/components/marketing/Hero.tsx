import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/Button';

/**
 * A worked example, set the way a schedule sets one: inputs, a rule, a total.
 * Every figure is arithmetic the reader can check, which is the only kind of
 * number a product with no filing season behind it has any business showing.
 */
const INPUTS: [string, string][] = [
  ['Individual returns this season', '420'],
  ['Items on each checklist', '15'],
  ['Times each one is asked for', '3'],
];

export function Hero() {
  return (
    <div
      id="top"
      className="mx-auto w-full max-w-[76rem] px-5 pb-14 pt-12 sm:px-8 md:pb-20 md:pt-16"
    >
      <div className="grid gap-y-12 lg:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)] lg:items-end lg:gap-x-16">
        <div className="min-w-0">
          <h1 className="display mk-hang text-[clamp(2.875rem,8.5vw,5rem)] leading-[0.94] tracking-[-0.02em] text-ink">
            <span className="block">Stop chasing.</span>
            <span className="block">Start filing.</span>
          </h1>

          <p className="mt-7 max-w-[52ch] text-pretty text-[0.9375rem] leading-[1.62] text-ink-muted sm:text-[1.0625rem] sm:leading-[1.6]">
            Between January and April your preparers are not preparing returns. They are asking a
            client for a W-2, then asking again, then asking a third time. TaxFax builds each
            client&rsquo;s checklist out of last year&rsquo;s return, keeps asking until it is
            complete, and files every upload under a name a preparer can read.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-3">
            <Button asChild variant="primary" className="h-11 px-6 text-[0.9375rem]">
              <Link to="/signup">Start a season</Link>
            </Button>
            <Button asChild variant="secondary" className="h-11 px-5 text-[0.9375rem]">
              <Link to="/login">Sign in</Link>
            </Button>
            <span className="text-[0.8125rem] text-ink-muted sm:ml-2">
              Billed monthly. Stop paying for it in May.
            </span>
          </div>
        </div>

        <figure className="min-w-0">
          <figcaption className="mk-eyebrow text-ink-muted border-b border-line-strong pb-2">
            One firm, one season
          </figcaption>

          <dl className="mt-1" data-tabular>
            {INPUTS.map(([label, value]) => (
              <div key={label} className="mk-lead-row py-2">
                <dt className="text-[0.8125rem] leading-snug text-ink-muted">{label}</dt>
                <span className="mk-leader" aria-hidden="true" />
                <dd className="ticket shrink-0 text-[0.9375rem] text-ink">{value}</dd>
              </div>
            ))}

            <div className="mk-lead-row border-t border-line-strong pt-3">
              <dt className="text-[0.8125rem] leading-snug text-ink">
                Messages that have to go out
                <span className="ticket ml-2 hidden text-ink-muted sm:inline">
                  420 &times; 15 &times; 3
                </span>
              </dt>
              <span className="mk-leader" aria-hidden="true" />
              <dd className="ticket shrink-0 text-[1.0625rem] text-ink">18,900</dd>
            </div>

            <div className="mk-lead-row border-b-[3px] border-double border-ink pb-2 pt-5">
              <dt className="text-[0.875rem] font-medium leading-snug text-ink">
                Messages your staff has to write
              </dt>
              <dd className="display -mr-[0.06em] ml-auto shrink-0 text-[3.25rem] leading-[0.8] text-stamp">
                0
              </dd>
            </div>
          </dl>

          <p className="mt-3 text-[0.8125rem] leading-[1.55] text-ink-muted">
            Change any input you like. The last line does not move.
          </p>
        </figure>
      </div>
    </div>
  );
}
