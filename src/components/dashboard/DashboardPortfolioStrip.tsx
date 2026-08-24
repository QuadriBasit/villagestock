import { useNavigate } from 'react-router-dom';
import { TrendingUp, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import type { StockSummary } from '@/types';

type DashboardPortfolioStripProps = {
  summary: StockSummary | null;
  alertCount: number;
  shelfHealthPct: number;
};

export function DashboardPortfolioStrip({ summary, alertCount, shelfHealthPct }: DashboardPortfolioStripProps) {
  const navigate = useNavigate();

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <button
        type="button"
        onClick={() => navigate('/inventory')}
        className="group relative overflow-hidden rounded-2xl border border-shell-line bg-shell-surface text-left transition-colors hover:border-brand-400/40"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 via-transparent to-emerald-500/5" />
        <CardContent className="relative p-4 md:p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-shell-muted">Portfolio value</span>
            <TrendingUp size={20} className="text-brand-400" />
          </div>
          <p className="font-mono text-3xl font-bold tracking-tight text-shell-ink md:text-4xl">
            {formatCurrency(summary?.total_value ?? 0)}
          </p>
          <p className="mt-1 text-sm text-shell-muted">
            {summary?.total_items ?? 0} SKU{(summary?.total_items ?? 0) !== 1 ? 's' : ''} at selling price
          </p>
        </CardContent>
      </button>

      <Card className="border-shell-line bg-shell-surface">
        <CardContent className="space-y-3 p-4 md:p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-shell-ink">Shelf health</p>
              <p className="text-xs text-shell-muted">{alertCount} items need attention</p>
            </div>
            <span className="font-mono text-lg font-bold text-shell-ink">{shelfHealthPct}%</span>
          </div>
          <Progress value={shelfHealthPct} className="h-2 bg-shell-surface-2" />
          <button
            type="button"
            onClick={() => navigate('/alerts')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-400 hover:text-brand-300"
          >
            <Package size={14} />
            View alert queue
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
