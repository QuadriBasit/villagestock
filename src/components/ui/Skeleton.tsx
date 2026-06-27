import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-2xl bg-shell-surface-2/50',
        className,
      )}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="app-page space-y-6 py-5 md:space-y-8 md:py-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 rounded-2xl" />
        <Skeleton className="h-4 w-64 rounded-xl" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[7.5rem] rounded-3xl" />
        ))}
      </div>

      <Skeleton className="h-36 w-full rounded-3xl" />
      <Skeleton className="h-32 w-full rounded-3xl" />

      <div className="space-y-3">
        <Skeleton className="h-5 w-32 rounded-lg mb-1" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[4.25rem] rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

export function InventorySkeletonList() {
  return (
    <div className="app-page space-y-3 py-2">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-3xl border border-shell-line bg-shell-surface px-4 py-3.5"
        >
          <Skeleton className="w-11 h-11 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="w-8 h-8 rounded-xl" />
            <Skeleton className="w-8 h-8 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AlertsSkeletonList() {
  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44 rounded-xl" />
        <Skeleton className="h-4 w-56 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-[7.5rem] rounded-xl" />
        ))}
      </div>
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-shell-line bg-shell-surface px-4 py-3.5"
        >
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-12 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
