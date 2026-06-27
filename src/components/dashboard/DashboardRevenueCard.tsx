import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDashboardTrend } from '@/hooks/useDashboardTrend';
import { useShopAccess } from '@/context/ShopAccessContext';
import { cn, formatCurrency } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { DashboardSectionHead } from './DashboardSectionHead';
import type { DashboardTrendPoint } from '@/hooks/useDashboardTrend';

const CHART_H = 240;
const PAD = { top: 20, right: 12, bottom: 12, left: 12 };

function activeRange(data: DashboardTrendPoint[]) {
  let start = 0;
  let end = data.length - 1;
  const active = (d: DashboardTrendPoint) => d.revenue > 0 || d.profit > 0;
  while (start < end && !active(data[start])) start++;
  while (end > start && !active(data[end])) end--;
  return { start, end };
}

function buildSegments(
  data: DashboardTrendPoint[],
  key: 'revenue' | 'profit',
  start: number,
  end: number,
  xAt: (i: number) => number,
  yAt: (v: number) => number,
): string[] {
  const segments: string[] = [];
  let current: string | null = null;

  for (let i = start; i <= end; i++) {
    const v = data[i][key];
    if (v <= 0) {
      if (current) {
        segments.push(current);
        current = null;
      }
      continue;
    }
    const pt = `L${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`;
    current = current ? `${current} ${pt}` : `M${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`;
  }
  if (current) segments.push(current);
  return segments;
}

function DualTrendChart({ data, showProfit }: { data: DashboardTrendPoint[]; showProfit: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [width, setWidth] = useState(640);

  const measure = useCallback(() => {
    const el = wrapRef.current;
    if (el) setWidth(Math.max(el.clientWidth, 320));
  }, []);

  useEffect(() => {
    measure();
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const chartW = width;
  const innerW = chartW - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  const { start, end } = useMemo(() => activeRange(data), [data]);
  const slice = useMemo(() => data.slice(start, end + 1), [data, start, end]);

  const max = useMemo(() => {
    const vals = slice.flatMap(d => [d.revenue, ...(showProfit ? [d.profit] : [])]);
    return Math.max(...vals, 1) * 1.12;
  }, [slice, showProfit]);

  const xAt = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * innerW;
  const yAt = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const revenueSegments = useMemo(
    () => buildSegments(data, 'revenue', start, end, xAt, yAt),
    [data, start, end, innerW, max, chartW],
  );

  const profitSegments = useMemo(
    () => (showProfit ? buildSegments(data, 'profit', start, end, xAt, yAt) : []),
    [data, start, end, innerW, max, chartW, showProfit],
  );

  const areaPath = useMemo(() => {
    if (slice.length === 0) return '';
    const pts = slice.map((d, j) => {
      const i = start + j;
      return `${j ? 'L' : 'M'}${xAt(i).toFixed(1)} ${yAt(d.revenue).toFixed(1)}`;
    });
    const lastI = start + slice.length - 1;
    return `${pts.join(' ')} L${xAt(lastI).toFixed(1)} ${PAD.top + innerH} L${xAt(start).toFixed(1)} ${PAD.top + innerH} Z`;
  }, [slice, start, innerW, max, chartW]);

  const pickIndex = (clientX: number) => {
    const el = wrapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * Math.max(data.length - 1, 0));
  };

  const onPointer = (clientX: number) => {
    measure();
    setHoverIndex(pickIndex(clientX));
  };

  const hover = hoverIndex != null ? data[hoverIndex] : null;
  const hoverX = hoverIndex != null ? xAt(hoverIndex) : 0;

  return (
    <div
      ref={wrapRef}
      className="relative mt-2 w-full"
      style={{ height: CHART_H }}
      onMouseEnter={measure}
      onMouseMove={e => onPointer(e.clientX)}
      onMouseLeave={() => setHoverIndex(null)}
      onTouchStart={e => {
        measure();
        onPointer(e.touches[0]?.clientX ?? 0);
      }}
      onTouchMove={e => onPointer(e.touches[0]?.clientX ?? 0)}
      onTouchEnd={() => setHoverIndex(null)}
    >
      <svg
        viewBox={`0 0 ${chartW} ${CHART_H}`}
        width="100%"
        height={CHART_H}
        preserveAspectRatio="none"
        className="block select-none"
        role="img"
        aria-label="Revenue and profit trend"
      >
        <defs>
          <linearGradient id="dashAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </linearGradient>
        </defs>

        {slice.length > 0 && <path d={areaPath} fill="url(#dashAreaFill)" />}

        {revenueSegments.map((d, i) => (
          <path
            key={`rev-${i}`}
            d={d}
            fill="none"
            stroke="#a78bfa"
            strokeWidth="2.75"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {profitSegments.map((d, i) => (
          <path
            key={`prof-${i}`}
            d={d}
            fill="none"
            stroke="#34d399"
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {hoverIndex != null && hover && (
          <>
            <line
              x1={hoverX}
              x2={hoverX}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
            />
            {hover.revenue > 0 && (
              <circle cx={hoverX} cy={yAt(hover.revenue)} r="5" fill="#a78bfa" stroke="#141a28" strokeWidth="2" />
            )}
            {showProfit && hover.profit > 0 && (
              <circle cx={hoverX} cy={yAt(hover.profit)} r="4" fill="#34d399" stroke="#141a28" strokeWidth="2" />
            )}
          </>
        )}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 min-w-[148px] rounded-xl border border-shell-line bg-shell-surface/95 px-3 py-2 shadow-lg backdrop-blur-sm"
          style={{
            left: `${Math.min(Math.max((hoverX / chartW) * 100, 8), 72)}%`,
            top: 8,
            transform: hoverX / chartW > 0.72 ? 'translateX(-100%)' : undefined,
          }}
        >
          <p className="text-[11px] font-semibold text-shell-muted">{hover.label}</p>
          <p className="mt-1 font-mono text-sm font-semibold text-violet-300">{formatCurrency(hover.revenue)}</p>
          {showProfit && (
            <p className="font-mono text-xs font-medium text-emerald-400">{formatCurrency(hover.profit)} profit</p>
          )}
        </div>
      )}
    </div>
  );
}

export function DashboardRevenueCard() {
  const { canViewProfit } = useShopAccess();
  const { series, isLoading } = useDashboardTrend(14);

  const totals = useMemo(() => {
    const revenue = series.reduce((a, p) => a + p.revenue, 0);
    const profit = series.reduce((a, p) => a + p.profit, 0);
    const mid = Math.floor(series.length / 2);
    const firstHalf = series.slice(0, mid).reduce((a, p) => a + p.revenue, 0);
    const secondHalf = series.slice(mid).reduce((a, p) => a + p.revenue, 0);
    const pctChange =
      firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : secondHalf > 0 ? 100 : 0;
    return { revenue, profit, pctChange };
  }, [series]);

  const firstLabel = series[0]?.label ?? '';
  const midLabel = series[Math.floor(series.length / 2)]?.label ?? '';
  const lastLabel = series[series.length - 1]?.label ?? '';

  return (
    <Card className="border-shell-line bg-shell-surface">
      <CardContent className="p-4 md:p-5">
        <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <DashboardSectionHead title="Revenue · last 14 days" className="mb-2" />
            <div className="flex flex-wrap gap-4">
              <span className="inline-flex items-center gap-1.5 text-xs text-shell-muted">
                <span className="h-0.5 w-2.5 rounded-sm bg-violet-400" />
                Revenue
              </span>
              {canViewProfit && (
                <span className="inline-flex items-center gap-1.5 text-xs text-shell-muted">
                  <span className="h-0.5 w-2.5 rounded-sm bg-emerald-400" />
                  Profit
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-[22px] font-semibold text-shell-ink">{formatCurrency(totals.revenue)}</p>
            {canViewProfit && (
              <p className="text-xs font-semibold text-emerald-400">
                {totals.pctChange >= 0 ? '+' : ''}
                {totals.pctChange}% vs prior half
              </p>
            )}
          </div>
        </div>

        {isLoading ? (
          <div
            className={cn('flex items-center justify-center text-sm text-shell-muted')}
            style={{ height: CHART_H }}
          >
            Loading chart…
          </div>
        ) : series.every(p => p.revenue === 0) ? (
          <div
            className="flex items-center justify-center text-sm text-shell-muted"
            style={{ height: CHART_H }}
          >
            Sales will appear here as you record them.
          </div>
        ) : (
          <DualTrendChart data={series} showProfit={canViewProfit} />
        )}

        <div className="mt-2 flex justify-between text-[11px] text-shell-muted">
          <span>{firstLabel}</span>
          <span>{midLabel}</span>
          <span>{lastLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
}
