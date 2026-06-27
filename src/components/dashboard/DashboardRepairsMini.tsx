import { useNavigate } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { useActiveRepairs } from '@/hooks/useRepairs';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { DashboardSectionHead } from './DashboardSectionHead';
import type { RepairStatus } from '@/types';

const STATUS_LABEL: Record<RepairStatus, string> = {
  sent: 'Diagnosing',
  in_progress: 'In progress',
  completed: 'Ready for pickup',
  collected: 'Collected',
};

const STATUS_CLASS: Record<RepairStatus, string> = {
  sent: 'border-violet-500/25 bg-violet-500/10 text-violet-300',
  in_progress: 'border-blue-500/25 bg-blue-500/10 text-blue-300',
  completed: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  collected: 'border-zinc-500/25 bg-zinc-500/10 text-zinc-400',
};

export function DashboardRepairsMini() {
  const navigate = useNavigate();
  const { repairs, isLoading } = useActiveRepairs();
  const active = repairs.filter(r => r.repair_status !== 'collected').slice(0, 5);

  return (
    <Card className="border-shell-line bg-shell-surface">
      <CardContent className="p-4 md:p-5">
        <DashboardSectionHead title="On the bench" action="Repairs" onAction={() => navigate('/repair')} />

        {isLoading ? (
          <p className="py-4 text-sm text-shell-muted">Loading…</p>
        ) : active.length === 0 ? (
          <p className="py-4 text-sm text-shell-muted">No active repair tickets.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {active.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => navigate('/repair')}
                className="flex items-center gap-2.5 rounded-lg text-left transition-colors hover:bg-shell-surface-2"
              >
                <span className="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-shell-surface-2 text-violet-400">
                  <Wrench size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-shell-ink">{r.issue_description}</p>
                  <p className="truncate text-xs text-shell-muted">{r.engineer_name}</p>
                </div>
                <Badge className={STATUS_CLASS[r.repair_status]}>{STATUS_LABEL[r.repair_status]}</Badge>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
