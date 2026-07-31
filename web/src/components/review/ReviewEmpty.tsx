import { CardVignette, StampedVignette } from '@/components/brand';

/**
 * Two different zeroes, and the difference matters.
 *
 * A firm four seconds old has an empty queue for the same reason it has an
 * empty everything: nothing has ever been uploaded. Congratulating it for work
 * it has never done is the first thing a buyer reads, and it is false. So the
 * card vignette — the brand's mark for "nothing on file yet" — and instruction:
 * what will appear here, and how it gets here.
 *
 * A firm that has actually cleared its queue gets the stamp, which is the mark
 * for finished work, and the reward line it earned.
 *
 * `hasReviewed` is decided the way `/chase` decides its own reward state
 * (`counts.sent > 0`): from evidence of finished work in data already loaded,
 * never assumed from the emptiness itself.
 */
export function ReviewEmpty({ hasReviewed }: { hasReviewed: boolean }) {
  if (!hasReviewed) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6 py-16">
        <div className="rise-in max-w-md text-center">
          <CardVignette className="mx-auto mb-6 text-ink-faint" />
          <h1 className="display text-4xl text-ink">Nothing to review — yet.</h1>
          <p className="mt-3 text-pretty text-sm/relaxed text-ink-muted">
            Every document a client uploads lands here first. TaxFax reads it, renames it, and files it
            against the checklist on its own — then shows you the ones it isn't sure about.
          </p>
          <p className="mt-6 text-2xs text-ink-faint">
            Add a client and send their checklist; the first upload usually arrives the same day.
          </p>
        </div>
      </div>
    );
  }

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
