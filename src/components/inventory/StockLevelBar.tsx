import { cn } from '@/lib/utils';

export function StockLevelBar({
  qty,
  reorder,
  className,
}: {
  qty: number;
  reorder: number;
  className?: string;
}) {
  const max = Math.max(reorder * 3, qty, 1);
  const pct = Math.min(100, (qty / max) * 100);
  const tone =
    qty === 0
      ? 'bg-red-500'
      : qty <= reorder
        ? 'bg-amber-400'
        : 'bg-primary';

  return (
    <div className={cn('h-1.5 w-12 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700', className)}>
      <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}
