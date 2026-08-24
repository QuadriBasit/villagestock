import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/utils';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { getGreetingFirstName } from '@/lib/userDisplay';

type DashboardTodayHeaderProps = {
  ownerName?: string | null;
  email?: string | null;
  branchName?: string;
  todayRevenue: number;
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardTodayHeader({
  ownerName,
  email,
  branchName,
  todayRevenue,
}: DashboardTodayHeaderProps) {
  const { isOnline } = useSyncStatus();
  const firstName = getGreetingFirstName({ ownerName, email });

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[13.5px] text-shell-muted">
          {new Date().toLocaleDateString('en-NG', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
          {branchName ? ` · ${branchName}` : ''}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-shell-ink md:text-[25px]">
          {greeting()}, {firstName}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge
          variant={isOnline ? 'success' : 'secondary'}
          className="gap-1.5 border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-emerald-300"
        >
          <span className="size-1.5 rounded-full bg-emerald-400" />
          {isOnline ? 'Shop open' : 'Offline mode'}
        </Badge>
        <p className="font-mono text-[13.5px] text-shell-muted">
          Today:{' '}
          <span className="font-semibold text-shell-ink">{formatCurrency(todayRevenue)}</span>
        </p>
      </div>
    </header>
  );
}
