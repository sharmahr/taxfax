import { Link } from '@tanstack/react-router';
import { Section, SectionHead } from './Section';

const TIERS = [
  { returns: 'Up to 300', seats: '5', price: '249' },
  { returns: 'Up to 900', seats: '15', price: '449' },
  { returns: 'Up to 2,500', seats: 'No limit', price: '899' },
];

export function Terms() {
  return (
    <Section id="terms" label="Terms">
      <SectionHead title="One schedule of fees.">
        Everything is in every plan: the checklist derived from last year&rsquo;s return, the email
        and text chase, the naming and filing, and the taxpayer link. The only thing that changes is
        how many returns you run through it.
      </SectionHead>

      <div className="mt-10 grid gap-x-14 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
        <div className="min-w-0">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">TaxFax pricing by season volume</caption>
          <thead>
            <tr className="border-b-[3px] border-double border-ink">
              <th scope="col" className="mk-eyebrow text-ink-muted pb-2 font-normal">
                Returns a season
              </th>
              <th scope="col" className="mk-eyebrow text-ink-muted pb-2 font-normal">
                Staff seats
              </th>
              <th scope="col" className="mk-eyebrow text-ink-muted pb-2 text-right font-normal">
                Monthly
              </th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((tier) => (
              <tr key={tier.price} className="mk-fee border-b border-line">
                <th
                  scope="row"
                  className="py-4 pr-4 text-[0.9375rem] font-normal leading-tight text-ink"
                >
                  {tier.returns}
                </th>
                <td className="py-4 pr-4 text-[0.9375rem] leading-tight text-ink-muted">
                  {tier.seats}
                </td>
                <td className="p-0 text-right">
                  <Link
                    to="/signup"
                    aria-label={`Start a season on the line for ${tier.returns.toLowerCase()} returns, $${tier.price} a month`}
                    className="mk-fee-link inline-flex items-baseline gap-2.5 rounded-sm py-4 pl-2 pr-0 font-mono text-[1.25rem] leading-none tabular-nums text-ink sm:pl-6 sm:text-[1.5rem]"
                  >
                    <span className="mk-fee-figure">
                      <span className="text-ink-muted">$</span>
                      {tier.price}
                    </span>
                    <span aria-hidden className="mk-fee-mark text-[0.875rem] leading-none">
                      &rarr;
                    </span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3 text-[0.8125rem] leading-[1.55] text-ink-muted">
          Start on any line. There is no call to book.
        </p>
        </div>

        <div className="min-w-0">
          <p className="mk-eyebrow text-ink-muted border-b border-line-strong pb-2">How it is counted</p>
          <dl className="mt-3 space-y-3 text-[0.75rem] leading-[1.55] text-ink-muted">
            <div>
              <dt className="inline font-medium text-ink-muted">A return. </dt>
              <dd className="inline">One client, one season, however many documents that takes.</dd>
            </div>
            <div>
              <dt className="inline font-medium text-ink-muted">A seat. </dt>
              <dd className="inline">
                Someone at the firm who signs in. Taxpayers never sign in, so they never count.
              </dd>
            </div>
            <div>
              <dt className="inline font-medium text-ink-muted">A month. </dt>
              <dd className="inline">
                Billed monthly, cancellable the month the season ends. No setup fee, no onboarding
                engagement, no annual contract signed in October for work that happens in March.
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </Section>
  );
}
