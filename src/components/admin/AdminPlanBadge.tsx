import { cn } from '@/lib/utils';
import { planBadgeClass } from '@/lib/adminPlanHelpers';

export function AdminPlanBadge({ plan, status }: { plan: string; status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold capitalize ring-1',
        planBadgeClass(plan, status),
      )}
    >
      {plan}
      {status !== 'active' ? ` · ${status}` : ''}
    </span>
  );
}
