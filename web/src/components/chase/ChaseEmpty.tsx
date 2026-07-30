import { Send } from 'lucide-react';

/** No one is being chased yet — a clean starting line, not an error. */
export function ChaseEmpty() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 py-16">
      <div className="rise-in max-w-md text-center">
        <div className="relative mx-auto mb-7 size-20" aria-hidden>
          <div className="absolute inset-0 -rotate-6 rounded-full border-2 border-stamp/30" />
          <div className="absolute inset-0 grid place-items-center text-stamp">
            <Send className="size-7" strokeWidth={2} />
          </div>
        </div>
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
