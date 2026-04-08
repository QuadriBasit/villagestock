import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse bg-slate-200/80 rounded-2xl', className)} />
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
          className="bg-white rounded-3xl px-4 py-3.5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.1)] ring-1 ring-slate-900/[0.04] flex items-center gap-3"
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
    <div className="app-page space-y-3 pt-4 pb-4">
      <Skeleton className="h-4 w-40 mb-2 rounded-lg" />
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-3xl px-4 py-3.5 shadow-sm flex items-center gap-3 border-l-4 border-slate-200 ring-1 ring-slate-900/[0.04]"
        >
          <Skeleton className="w-10 h-10 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="w-12 h-4 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
