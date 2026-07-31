import { StampedVignette } from '@/components/brand';

/** Review queue at zero — the work is finished, not merely absent. The chop says so. */
export function ReviewEmpty() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 py-16">
      <div className="rise-in max-w-md text-center">
        <StampedVignette className="mx-auto mb-6 text-ink-faint" />
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
