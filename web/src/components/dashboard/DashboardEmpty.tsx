import { Link } from '@tanstack/react-router';
import { ArrowRight, FileText, ListChecks, Send } from 'lucide-react';
import { Button } from '@/components/ui';
import { CardVignette } from '@/components/brand';

const STEPS = [
  { icon: FileText, title: 'Import your clients', body: "Bring in last season's list — a CSV or your prior software export." },
  { icon: ListChecks, title: 'Checklists build themselves', body: 'We read each prior-year return and list exactly what to collect.' },
  { icon: Send, title: 'The chase runs itself', body: 'Escalating email and SMS reminders go out until every document is in.' },
];

/** First-run. A good, warm state — not a sad grey box. */
export function DashboardEmpty({ firmName }: { firmName: string }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-16 text-center sm:py-24">
      <CardVignette className="mb-6 text-ink-faint" />
      <p className="label-eyebrow text-ink-faint">{firmName}</p>
      <h1 className="display mt-3 text-4xl text-ink sm:text-5xl">Let's build your season.</h1>
      <p className="mt-4 max-w-md text-pretty text-[15px] leading-relaxed text-ink-muted">
        TaxFax turns last year's returns into this year's checklists, then does the chasing for you.
        Bring in your clients and the queue fills itself.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Button variant="primary" asChild>
          <Link to="/clients">
            Import clients <ArrowRight />
          </Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link to="/chase">Set up the chase cadence</Link>
        </Button>
      </div>

      <ol className="mt-14 grid w-full gap-3 text-left sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-surface-sunken text-ink-muted">
                <Icon className="size-4" />
              </span>
              <span className="font-mono text-2xs tabular-nums text-ink-faint">{i + 1}</span>
            </div>
            <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
