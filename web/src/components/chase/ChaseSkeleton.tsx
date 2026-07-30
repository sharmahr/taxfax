import { Skeleton } from '@/components/ui';

/** Mirrors the summary strip + two-pane console so nothing reflows on load. */
export function ChaseSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-6 border-b border-line px-4 py-3.5 sm:px-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24" />
        ))}
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(300px,340px)_1fr]">
        <div className="hidden flex-col border-r border-line lg:flex">
          <div className="flex gap-4 border-b border-line px-4 py-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-14" />
          </div>
          <div className="flex flex-col gap-px p-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-1.5 px-2 py-2.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        </div>
        <div className="hidden flex-col lg:flex">
          <div className="border-b border-line px-5 py-3">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="mt-2 h-3 w-64" />
          </div>
          <div className="space-y-4 p-5">
            <Skeleton className="h-16 w-full rounded-xl" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-24" />
            </div>
            <Skeleton className="h-52 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
