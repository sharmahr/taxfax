import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router';
import { Stamp } from 'lucide-react';
import { authReady, getAuthSnapshot } from '@/lib/auth';

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    await authReady();
    if (getAuthSnapshot().user) throw redirect({ to: '/dashboard' });
  },
  component: AuthLayout,
});

const LEDGER = [
  'Build each client\u2019s checklist from last year\u2019s return',
  'Chase every missing document across email and text',
  'Rename and file each upload the moment it lands',
];

function Wordmark({ tone }: { tone: 'ink' | 'paper' }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2 outline-hidden">
      <span className="inline-flex size-7 items-center justify-center rounded-md bg-stamp text-paper">
        <Stamp className="size-4" />
      </span>
      <span className={tone === 'paper' ? 'display text-lg leading-none text-paper' : 'display text-lg leading-none text-ink'}>
        TaxFax
      </span>
    </Link>
  );
}

function AuthLayout() {
  return (
    <div className="flex min-h-dvh bg-paper">
      {/* Cover — the inverse of the form, like the cover sheet of a filing. */}
      <aside className="relative hidden w-[44%] max-w-[38rem] flex-col justify-between overflow-hidden bg-ink px-10 py-12 lg:flex xl:px-14">
        <Wordmark tone="paper" />

        <div className="max-w-md">
          <p className="label-eyebrow text-paper/45">Document collection for CPA firms</p>
          <h1 className="display mt-4 text-balance text-5xl leading-[1.02] text-paper xl:text-6xl">
            Stop chasing. Start filing.
          </h1>
          <p className="mt-5 text-pretty text-sm/relaxed text-paper/70">
            One workspace for every client document tax season demands — requested, chased, and
            filed — so the follow-ups stop landing on you.
          </p>

          <dl className="mt-10">
            {LEDGER.map((line, i) => (
              <div key={line} className="flex gap-4 border-t border-paper/15 py-3 first:border-t-0">
                <dt className="pt-px font-mono text-2xs tabular-nums text-stamp">
                  {String(i + 1).padStart(2, '0')}
                </dt>
                <dd className="text-sm text-paper/80">{line}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="font-mono text-2xs text-paper/40">
          Built for firms filing 200&ndash;2,000 returns between January and April.
        </p>

        <div
          aria-hidden
          className="pointer-events-none absolute right-12 top-11 hidden rotate-[7deg] select-none rounded-md border-2 border-stamp/35 px-3 py-1.5 xl:block"
        >
          <span className="font-mono text-2xs uppercase tracking-[0.3em] text-stamp/60">
            Received
          </span>
        </div>
      </aside>

      {/* Form column. */}
      <main className="flex min-h-dvh flex-1 flex-col">
        <div className="flex items-center justify-between px-6 pt-6 lg:hidden">
          <Wordmark tone="ink" />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
