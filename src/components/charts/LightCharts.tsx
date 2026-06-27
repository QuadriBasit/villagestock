import { formatCurrency } from '@/lib/utils';

type ValuePoint = {
  label: string;
  value: number;
};

type DonutSlice = {
  label: string;
  value: number;
  color: string;
};

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ');
}

export function SimpleAreaChart({
  data,
  isDark,
  color = '#6C5CE7',
  valueFormatter = formatCurrency,
}: {
  data: ValuePoint[];
  isDark: boolean;
  color?: string;
  valueFormatter?: (value: number) => string;
}) {
  const width = 560;
  const height = 220;
  const padding = { top: 16, right: 12, bottom: 32, left: 44 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...data.map(point => point.value), 0);
  const topValue = maxValue <= 0 ? 1 : maxValue;
  const ticks = [topValue, topValue / 2, 0];
  const gridColor = isDark ? '#27272a' : '#e4e4e7';
  const axisColor = isDark ? '#a1a1aa' : '#71717a';
  const labelStride = Math.max(1, Math.ceil(data.length / 6));

  const getX = (index: number) =>
    data.length <= 1 ? padding.left + chartWidth / 2 : padding.left + (index / (data.length - 1)) * chartWidth;
  const getY = (value: number) => padding.top + chartHeight - (value / topValue) * chartHeight;

  const linePath = data
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(point.value)}`)
    .join(' ');
  const areaPath =
    data.length > 0
      ? `${linePath} L ${getX(data.length - 1)} ${padding.top + chartHeight} L ${getX(0)} ${padding.top + chartHeight} Z`
      : '';

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" role="img" aria-label="Area chart">
        <defs>
          <linearGradient id="light-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {ticks.map(tick => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line x1={padding.left} x2={padding.left + chartWidth} y1={y} y2={y} stroke={gridColor} strokeDasharray="4 4" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill={axisColor}>
                {valueFormatter(tick)}
              </text>
            </g>
          );
        })}

        {data.length > 0 && <path d={areaPath} fill="url(#light-chart-fill)" />}
        {data.length > 0 && <path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}

        {data.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle cx={getX(index)} cy={getY(point.value)} r="3.5" fill={color} />
            {(index % labelStride === 0 || index === data.length - 1) && (
              <text
                x={getX(index)}
                y={height - 10}
                textAnchor="middle"
                fontSize="11"
                fill={axisColor}
              >
                {point.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      <div className="grid grid-cols-2 gap-2 text-xs text-shell-muted md:grid-cols-4">
        {data.slice(-4).map(point => (
          <div key={point.label} className="rounded-lg bg-shell-surface-2/40 px-2.5 py-2">
            <p className="truncate">{point.label}</p>
            <p className="mt-0.5 font-semibold text-shell-ink">{valueFormatter(point.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SimpleDonutChart({
  data,
  totalLabel,
}: {
  data: DonutSlice[];
  totalLabel?: string;
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  const radius = 54;
  let startAngle = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-44 w-44">
        <svg viewBox="0 0 140 140" className="h-full w-full" role="img" aria-label="Donut chart">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="18" />
          {data.map(slice => {
            const angle = total > 0 ? (slice.value / total) * 360 : 0;
            const endAngle = startAngle + angle;
            const path = describeArc(70, 70, radius, startAngle, endAngle);
            startAngle = endAngle;

            return (
              <path
                key={slice.label}
                d={path}
                fill="none"
                stroke={slice.color}
                strokeWidth="18"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-shell-ink">{total.toLocaleString()}</span>
          {totalLabel && <span className="text-xs text-shell-muted">{totalLabel}</span>}
        </div>
      </div>

      <div className="w-full space-y-2">
        {data.map(slice => {
          const percent = total > 0 ? (slice.value / total) * 100 : 0;
          return (
            <div key={slice.label} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className="capitalize text-shell-ink">{slice.label}</span>
                </div>
                <span className="text-shell-muted">{percent.toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full bg-shell-surface-2">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${percent}%`, backgroundColor: slice.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SimpleBarChart({
  data,
  isDark,
  color = '#2563eb',
}: {
  data: ValuePoint[];
  isDark: boolean;
  color?: string;
}) {
  const maxValue = Math.max(...data.map(item => item.value), 0);
  const topValue = maxValue <= 0 ? 1 : maxValue;
  const axisColor = isDark ? '#a1a1aa' : '#64748b';

  return (
    <div className="flex h-full items-end gap-3">
      {data.map(item => {
        const heightPercent = (item.value / topValue) * 100;
        return (
          <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span className="text-xs font-semibold tabular-nums text-shell-muted">
              {item.value}
            </span>
            <div className="flex h-52 w-full items-end rounded-t-2xl bg-shell-surface-2/70 px-1.5">
              <div
                className="w-full rounded-t-xl transition-[height]"
                style={{
                  height: `${Math.max(heightPercent, item.value > 0 ? 8 : 0)}%`,
                  background: `linear-gradient(180deg, ${color} 0%, rgba(37,99,235,0.55) 100%)`,
                }}
              />
            </div>
            <span
              className="truncate text-center text-[11px]"
              style={{ color: axisColor }}
              title={item.label}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
