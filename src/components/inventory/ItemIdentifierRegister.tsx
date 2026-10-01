import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hash, Wrench } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { InventoryItem } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import {
  formatIdentifier,
  getMarginPct,
  identifierKindForItem,
  primaryIdentifier,
  SERIALIZED_STATUS_LABELS,
} from '@/lib/inventoryDisplay';
import { unitRegisterMeta } from '@/lib/productUnitMix';
import { useProductUnits } from '@/hooks/useProductUnits';

function statusTone(status?: string): string {
  if (status === 'sold') return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300';
  if (status === 'with_engineer' || status === 'defective') return 'border-amber-500/25 bg-amber-500/10 text-amber-200';
  if (status === 'missing') return 'border-red-500/25 bg-red-500/10 text-red-300';
  if (status === 'in_stock') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300';
  return 'border-shell-line bg-shell-surface-2 text-shell-muted';
}

function intakeTone(label: string): string {
  if (label === 'New') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200';
  if (label === 'Used') return 'border-blue-500/25 bg-blue-500/10 text-blue-200';
  return 'border-shell-line bg-shell-surface-2 text-shell-muted';
}

export function ItemIdentifierRegister({
  item,
  activeId,
  onSendToBench,
}: {
  item: InventoryItem;
  activeId: string;
  onSendToBench?: (unit: InventoryItem) => void;
}) {
  const navigate = useNavigate();
  const kind = identifierKindForItem(item);
  const { units } = useProductUnits(item);
  const [q, setQ] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const sellable = useMemo(
    () => units.filter(u => u.status === 'in_stock' || u.status === 'reserved'),
    [units],
  );
  const soldCount = units.length - sellable.length;
  const pool = showHistory ? units : sellable;

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return pool;
    return pool.filter(u => {
      const code = primaryIdentifier(u) ?? '';
      const meta = unitRegisterMeta(u);
      const haystack = [code, meta.intake, meta.variant, meta.grade ?? ''].join(' ').toLowerCase();
      return haystack.includes(query) || u.id.toLowerCase().includes(query);
    });
  }, [pool, q]);

  if (!kind) return null;

  const label = kind;

  return (
    <Card className="border-shell-line bg-shell-surface p-0 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-shell-line px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-shell-ink">
          <Hash size={15} className="text-shell-muted" />
          {sellable.length === 1 ? `${label} on hand` : `${label}s to sell`}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-shell-muted">
            {sellable.length} {sellable.length === 1 ? 'unit' : 'units'}
          </span>
          {soldCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] text-shell-muted hover:text-shell-ink"
              onClick={() => setShowHistory(v => !v)}
            >
              {showHistory ? 'Hide sold' : `Sold (${soldCount})`}
            </Button>
          ) : null}
        </div>
      </div>

      {pool.length > 4 ? (
        <div className="border-b border-shell-line px-3 py-2">
          <Input
            type="text"
            inputMode="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={`Search ${label}, intake, variant…`}
            className="shell-inset-field h-8 w-full rounded-md border border-shell-line bg-shell-surface-2/40 px-3 text-sm text-shell-ink outline-none placeholder:text-shell-muted focus:border-shell-muted/60"
          />
        </div>
      ) : null}

      <div className="max-h-[420px] overflow-y-auto">
        {shown.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-shell-muted">
            {showHistory ? `No ${label} matches that.` : 'Nothing in stock to sell right now.'}
          </p>
        ) : (
          <ul className="divide-y divide-shell-line">
            {shown.map(unit => {
              const code = primaryIdentifier(unit);
              const active = unit.id === activeId;
              const status = unit.status ?? 'in_stock';
              const meta = unitRegisterMeta(unit);
              const canBench = onSendToBench && status === 'in_stock' && meta.needsService;

              return (
                <li key={unit.id}>
                  <div
                    className={cn(
                      'px-4 py-3 transition-colors',
                      active ? 'bg-brand-400/8' : 'hover:bg-shell-surface-2/40',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!active) navigate(`/inventory/${unit.id}`);
                      }}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate font-mono text-[13px] tracking-wide',
                            code ? 'text-shell-ink' : 'text-shell-muted',
                          )}
                        >
                          {formatIdentifier(code, kind)}
                        </span>
                        <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-shell-ink">
                          {formatCurrency(unit.price)}
                        </span>
                        <Badge className={cn('shrink-0 text-[10px]', statusTone(status))}>
                          {SERIALIZED_STATUS_LABELS[status] ?? status}
                        </Badge>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge className={cn('text-[10px]', intakeTone(meta.intake))}>{meta.intake}</Badge>
                        {meta.variant !== 'Standard' ? (
                          <span className="text-[11px] text-shell-muted">{meta.variant}</span>
                        ) : null}
                        {meta.grade ? (
                          <span className="text-[11px] text-shell-muted">Grade {meta.grade}</span>
                        ) : null}
                        {meta.battery != null ? (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums',
                              meta.battery < 80 ? 'text-amber-300' : 'text-shell-muted',
                            )}
                          >
                            {meta.battery < 80 ? <Wrench size={11} /> : null}
                            Batt {meta.battery}%
                          </span>
                        ) : null}
                        {meta.idm ? (
                          <Badge className="border-amber-500/25 bg-amber-500/10 text-[10px] text-amber-200">
                            IDM
                          </Badge>
                        ) : null}
                        {meta.flags
                          .filter(f => f !== 'IDM')
                          .map(f => (
                            <Badge
                              key={f}
                              className="border-amber-500/25 bg-amber-500/10 text-[10px] text-amber-200"
                            >
                              {f}
                            </Badge>
                          ))}
                        <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] tabular-nums">
                          {unit.cost_price != null ? (
                            <span className="text-shell-muted">
                              cost {formatCurrency(unit.cost_price)}
                            </span>
                          ) : null}
                          {getMarginPct(unit) > 0 ? (
                            <span className="text-emerald-400/90">{getMarginPct(unit)}%</span>
                          ) : null}
                        </span>
                      </div>
                    </button>

                    {canBench ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-8 w-full justify-start gap-1.5 text-xs text-brand-300 hover:bg-brand-400/10 hover:text-brand-200"
                        onClick={e => {
                          e.stopPropagation();
                          onSendToBench?.(unit);
                        }}
                      >
                        <Wrench size={13} />
                        Send to bench
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
