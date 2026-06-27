import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InventoryItem } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { computeProductUnitMix } from '@/lib/productUnitMix';
import { identifierKindForItem } from '@/lib/inventoryDisplay';

function intakeTone(label: string): string {
  if (label === 'New') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200';
  if (label === 'Used') return 'border-blue-500/25 bg-blue-500/10 text-blue-200';
  return 'border-shell-line bg-shell-surface-2 text-shell-muted';
}

type ItemConditionMixPanelProps = {
  units: InventoryItem[];
};

export function ItemConditionMixPanel({ units }: ItemConditionMixPanelProps) {
  if (units.length <= 1) return null;

  const mix = computeProductUnitMix(units);
  const idKind = identifierKindForItem(units[0]!);
  const intakeEntries = Object.entries(mix.byIntake).sort((a, b) => b[1] - a[1]);
  const batteryWarn = mix.batteryMin != null && mix.batteryMin < 80;

  return (
    <div className="border-t border-shell-line pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-[13px] font-semibold text-shell-ink">Condition mix</h3>
        {mix.serviceCount > 0 ? (
          <Badge className="border-amber-500/25 bg-amber-500/10 text-[11px] text-amber-200">
            {mix.serviceCount} need service
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-col gap-2.5">
        {intakeEntries.map(([label, count]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <Badge className={cn('text-[11px]', intakeTone(label))}>{label}</Badge>
            <span className="font-mono text-[13px] font-semibold tabular-nums text-shell-ink">
              {count} unit{count !== 1 ? 's' : ''}
            </span>
          </div>
        ))}

        {mix.batteryMin != null ? (
          <div className="flex items-center justify-between gap-3 border-t border-shell-line/70 pt-2.5">
            <span className="text-[13px] text-shell-muted">Battery health</span>
            <span
              className={cn(
                'font-mono text-[13px] font-semibold tabular-nums',
                batteryWarn ? 'text-amber-300' : 'text-shell-ink',
              )}
            >
              {mix.batteryMin === mix.batteryMax
                ? `${mix.batteryMin}%`
                : `${mix.batteryMin}–${mix.batteryMax}%`}
            </span>
          </div>
        ) : null}

        {mix.idmCount > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-shell-muted">Screen changed (IDM)</span>
            <span className="font-mono text-[13px] font-semibold tabular-nums text-amber-300">
              {mix.idmCount} unit{mix.idmCount !== 1 ? 's' : ''}
            </span>
          </div>
        ) : null}

        {mix.onBench > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-shell-muted">On bench</span>
            <span className="font-mono text-[13px] font-semibold tabular-nums text-shell-ink">
              {mix.onBench} unit{mix.onBench !== 1 ? 's' : ''}
            </span>
          </div>
        ) : null}
      </div>

      {mix.serviceCount > 0 ? (
        <div className="mt-3 flex gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-300" />
          <p className="text-xs leading-relaxed text-shell-ink">
            {mix.serviceCount} unit{mix.serviceCount !== 1 ? 's' : ''} need attention before sale
            {mix.batteryMin != null && mix.batteryMin < 80 ? ' (low battery or on bench)' : ''}. Use the{' '}
            {idKind ?? 'unit'} register to open a unit and send it to the bench.
          </p>
        </div>
      ) : null}
    </div>
  );
}
