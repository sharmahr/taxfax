import { CardVignette } from '@/components/brand';

/** Nothing filed yet — a clean starting line, not an error. A blank card, ruled and waiting. */
export function ChaseEmpty() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 py-16">
      <div className="rise-in max-w-md text-center">
        <CardVignette className="mx-auto mb-6 text-ink-faint" />
        <h1 className="display text-4xl text-ink">Nothing to chase — yet.</h1>
        <p className="mt-3 text-pretty text-sm/relaxed text-ink-muted">
          Once a client has an open checklist, the cadence starts on its own: a warm opener, then escalating
          reminders by email and text until every document is in.
        </p>
        <p className="mt-6 text-2xs text-ink-faint">You'll see every message here before it sends.</p>
      </div>
    </div>
  );
}
