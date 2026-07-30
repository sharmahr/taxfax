import { Skeleton } from '@/components/ui';

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-2.5 py-2.5">
      <Skeleton className="size-6 rounded-md" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="h-8 w-24 rounded-md" />
    </div>
  );
}

/** Matches the real dashboard geometry so first paint doesn't jump. */
export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="rule pb-6">
        <Skeleton className="h-3 w-52" />
        <div className="mt-4 flex items-end justify-between">
          <div className="space-y-3">
            <Skeleton className="h-11 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="hidden gap-9 sm:flex">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <div>
            <Skeleton className="mb-3 h-4 w-36" />
            {Array.from({ length: 3 }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
          <Skeleton className="h-[76px] w-full rounded-xl" />
          <div>
            <Skeleton className="mb-3 h-4 w-28" />
            {Array.from({ length: 3 }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-3 w-28" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="mt-1 size-2 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
