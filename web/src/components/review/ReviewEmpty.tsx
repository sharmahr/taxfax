import { Check } from 'lucide-react';

/** "Nothing to review" is a win, not a void. Read like a cleared desk. */
export function ReviewEmpty() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 py-16">
      <div className="rise-in max-w-md text-center">
        <div className="relative mx-auto mb-7 size-20" aria-hidden>
          <div className="absolute inset-0 -rotate-6 rounded-full border-2 border-stamp/30" />
          <div className="absolute inset-0 grid place-items-center text-stamp">
            <Check className="size-8" strokeWidth={2.25} />
          </div>
        </div>
        <h1 className="display text-4xl text-ink">You're all caught up.</h1>
        <p className="mt-3 text-pretty text-sm/relaxed text-ink-muted">
          Every upload has been classified, renamed, and filed. New documents land here the moment they
          arrive — most are sorted before you'd think to look.
        </p>
        <p className="mt-6 text-2xs text-ink-faint">
          High-confidence uploads file themselves. You only see what needs a human.
        </p>
      </div>
    </div>
  );
}
