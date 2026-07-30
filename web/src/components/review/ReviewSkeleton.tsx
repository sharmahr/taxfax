import { Skeleton } from '@/components/ui';

/** Mirrors the master–detail geometry so the layout doesn't jump on first paint. */
export function ReviewSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-6">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="hidden h-5 w-52 md:block" />
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(280px,320px)_1fr_minmax(360px,400px)]">
        <div className="hidden flex-col gap-px border-r border-line p-1.5 lg:flex">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-2 py-2.5">
              <Skeleton className="mt-0.5 size-2 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-6" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden p-4 lg:block">
          <Skeleton className="h-full w-full rounded-xl" />
        </div>
        <div className="hidden flex-col border-l border-line lg:flex">
          <div className="border-b border-line px-5 py-3">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex-1 space-y-5 px-5 py-4">
            <div className="flex justify-between">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-8 w-12" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="flex gap-2 border-t border-line px-5 py-3">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="ml-auto h-9 w-28" />
          </div>
        </div>
      </div>
    </div>
  );
}
