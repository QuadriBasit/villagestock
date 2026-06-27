import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isValid, parseISO } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  BarChart3,
  CalendarRange,
  ChevronRight,
  FileDown,
  Laptop,
  PiggyBank,
  RotateCcw,
  Smartphone,
  Tablet,
  TrendingUp,
  Warehouse,
} from 'lucide-react';
import {
  useReportMetrics,
  buildCustomRange,
  getDefaultCustomRange,
  getPresetRange,
  type ReportBreakdownPoint,
  type ReportPreset,
} from '@/hooks/useReports';
import { useShopProfile } from '@/hooks/useShopProfile';
import { cn, formatCurrency } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { AlertsSkeletonList } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Calendar } from '@/components/ui/Calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';

type ActiveView = Exclude<ReportPreset, 'custom'> | 'custom';

const PERIOD_TABS: { value: ActiveView; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'custom', label: 'Custom' },
];

const todayRange = getPresetRange('today');
const weekRange = getPresetRange('week');
const defaultCustomRange = getDefaultCustomRange();

function ymdParse(s: string): Date {
  const d = parseISO(s);
  return isValid(d) ? d : new Date();
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const { profile, isLoading: isProfileLoading } = useShopProfile();
  const [activeView, setActiveView] = useState<ActiveView>('today');
  const [customStart, setCustomStart] = useState(format(defaultCustomRange.start, 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(defaultCustomRange.end, 'yyyy-MM-dd'));
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeDraft, setRangeDraft] = useState<DateRange | undefined>(() => ({
    from: defaultCustomRange.start,
    to: defaultCustomRange.end,
  }));
  const exportRef = useRef(false);

  const selectedRange = useMemo(() => {
    if (activeView === 'custom') return buildCustomRange(customStart, customEnd);
    return activeView === 'today' ? todayRange : weekRange;
  }, [activeView, customStart, customEnd]);

  const { metrics, isLoading } = useReportMetrics(selectedRange);

  const handleExport = async () => {
    if (exportRef.current) return;
    exportRef.current = true;

    try {
      const jsPdfModule = await import('jspdf');
      const jsPDF = jsPdfModule.default;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      let y = 16;
      const left = 14;

      const writeLine = (text: string, options?: { size?: number; bold?: boolean; color?: [number, number, number] }) => {
        pdf.setFont('helvetica', options?.bold ? 'bold' : 'normal');
        pdf.setFontSize(options?.size ?? 11);
        if (options?.color) {
          pdf.setTextColor(options.color[0], options.color[1], options.color[2]);
        } else {
          pdf.setTextColor(34, 34, 34);
        }
        pdf.text(text, left, y);
        y += (options?.size ?? 11) > 13 ? 7 : 5.5;
      };

      const writeMetric = (label: string, value: string) => {
        writeLine(`${label}: ${value}`);
      };

      writeLine(profile.shop_name || 'VillageStock', { size: 18, bold: true });
      writeLine('Sales Report', { size: 14, bold: true, color: [0, 86, 179] });
      writeLine(`Period: ${metrics.range.label}`);
      writeLine(`Generated: ${format(new Date(), 'd MMM yyyy, HH:mm')}`);
      y += 3;

      writeLine('Summary', { size: 13, bold: true });
      writeMetric('Total items sold', String(metrics.salesCount));
      writeMetric('Total revenue', formatCurrency(metrics.revenue));
      writeMetric('Total profit', formatCurrency(metrics.profit));
      writeMetric('Total returns', String(metrics.returnsCount));
      writeMetric('Refund value', formatCurrency(metrics.refundValue));
      writeMetric('Net profit', formatCurrency(metrics.netProfit));
      y += 3;

      writeLine('Serialized Counts', { size: 13, bold: true });
      writeMetric('Phones sold', String(metrics.serializedCounts.phones));
      writeMetric('Laptops sold', String(metrics.serializedCounts.laptops));
      writeMetric('Tablets sold', String(metrics.serializedCounts.tablets));
      y += 3;

      writeLine('Highlights', { size: 13, bold: true });
      writeMetric(
        'Best selling model',
        metrics.bestSellingModel
          ? `${metrics.bestSellingModel.label} (${metrics.bestSellingModel.units})`
          : 'No data',
      );
      writeMetric(
        'Highest profit item',
        metrics.highestProfitItem
          ? `${metrics.highestProfitItem.label} (${formatCurrency(metrics.highestProfitItem.profit)})`
          : 'No data',
      );
      y += 3;

      writeLine('Swap Summary', { size: 13, bold: true });
      writeMetric('Total swaps', String(metrics.totalSwaps));
      writeMetric('Trade-in value received', formatCurrency(metrics.totalTradeInValue));
      writeMetric('Average balance collected', formatCurrency(metrics.averageBalanceCollected));
      y += 3;

      writeLine('Sales by Category', { size: 13, bold: true });
      if (metrics.categoryBreakdown.length === 0) {
        writeMetric('Category breakdown', 'No data');
      } else {
        metrics.categoryBreakdown.forEach(entry => writeMetric(entry.label, `${entry.value} sold`));
      }
      y += 3;

      writeLine('Sales by Payment Method', { size: 13, bold: true });
      if (metrics.paymentBreakdown.length === 0) {
        writeMetric('Payment breakdown', 'No data');
      } else {
        metrics.paymentBreakdown.forEach(entry => writeMetric(entry.label, formatCurrency(entry.value)));
      }

      const fileName = `${(profile.shop_name || 'villagestock').replace(/\s+/g, '-').toLowerCase()}-report-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`;
      pdf.save(fileName);
    } finally {
      exportRef.current = false;
    }
  };

  if (isLoading || isProfileLoading) return <AlertsSkeletonList />;

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <PageHeader
        title="Reports"
        subtitle={`${profile.shop_name || 'Your shop'} · ${metrics.range.label}`}
      >
        <Button
          size="sm"
          className="bg-violet-400 text-[#160a2e] hover:bg-violet-300"
          onClick={handleExport}
        >
          <FileDown size={16} />
          Export PDF
        </Button>
      </PageHeader>

      <button
        type="button"
        onClick={() => navigate('/reports/stock-sessions')}
        className="flex w-full items-center gap-3 rounded-xl border border-shell-line bg-shell-surface p-4 text-left transition-colors hover:bg-shell-surface-2/40 md:p-5"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-violet-400/15 text-violet-300">
          <Warehouse size={20} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-shell-ink">Stock sessions</p>
          <p className="text-xs text-shell-muted">
            Calendar of daily opening &amp; closing stock (Business plan history)
          </p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-shell-muted" />
      </button>

      <Card className="border-shell-line bg-shell-surface shadow-none">
        <CardHeader className="gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="font-display text-shell-ink">Period</CardTitle>
              <CardDescription className="text-shell-muted">
                Switch between quick views or apply a custom range.
              </CardDescription>
            </div>
            <span className="grid size-9 place-items-center rounded-[10px] bg-violet-400/15 text-violet-300">
              <CalendarRange size={18} />
            </span>
          </div>
          <div className="overflow-hidden rounded-lg border border-shell-line bg-shell-surface-2/30">
            <div className="flex gap-0 overflow-x-auto px-1" role="tablist" aria-label="Report period">
              {PERIOD_TABS.map(tab => {
                const active = activeView === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveView(tab.value)}
                    className={cn(
                      'relative shrink-0 px-3.5 py-2.5 text-xs font-medium transition-colors',
                      active
                        ? 'text-shell-ink after:absolute after:inset-x-3.5 after:bottom-0 after:h-px after:bg-violet-400/70'
                        : 'text-shell-muted hover:text-shell-ink',
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeView === 'custom' ? (
            <div className="flex flex-col gap-3">
              <Popover
                open={rangeOpen}
                onOpenChange={open => {
                  setRangeOpen(open);
                  if (open) {
                    setRangeDraft({ from: ymdParse(customStart), to: ymdParse(customEnd) });
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-2 border-shell-line bg-shell-surface-2/40 text-shell-ink hover:bg-shell-surface-2 sm:w-auto"
                  >
                    <CalendarRange size={16} className="shrink-0 text-violet-300" />
                    <span className="tabular-nums">
                      {format(ymdParse(customStart), 'd MMM yyyy')} – {format(ymdParse(customEnd), 'd MMM yyyy')}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto max-w-[calc(100vw-1.5rem)] border-shell-line bg-shell-surface p-0"
                  align="start"
                >
                  <div className="p-2">
                    <Calendar
                      mode="range"
                      defaultMonth={ymdParse(customStart)}
                      selected={rangeDraft}
                      onSelect={setRangeDraft}
                      numberOfMonths={1}
                    />
                  </div>
                  <div className="flex justify-end gap-2 border-t border-shell-line p-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setRangeOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-violet-400 text-[#160a2e] hover:bg-violet-300"
                      onClick={() => {
                        if (rangeDraft?.from) {
                          setCustomStart(format(rangeDraft.from, 'yyyy-MM-dd'));
                          setCustomEnd(format(rangeDraft.to ?? rangeDraft.from, 'yyyy-MM-dd'));
                        }
                        setRangeOpen(false);
                      }}
                      disabled={
                        !rangeDraft?.from ||
                        (rangeDraft.from != null &&
                          rangeDraft.to != null &&
                          rangeDraft.to < rangeDraft.from)
                      }
                    >
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-shell-muted">
                Tap the date range to open the calendar. Choose two days for a period, or one day twice.
              </p>
            </div>
          ) : (
            <p className="text-sm text-shell-muted">
              {activeView === 'today'
                ? 'Showing figures for today only.'
                : 'Showing figures for the current calendar week (Mon–Sun).'}
            </p>
          )}
        </CardContent>
      </Card>

      <ReportSection title="Sales summary">
        <StatGrid className="sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Items sold" value={String(metrics.salesCount)} icon={TrendingUp} />
          <StatCard label="Revenue" value={formatCurrency(metrics.revenue)} icon={BarChart3} />
          <StatCard
            label="Profit"
            value={formatCurrency(metrics.profit)}
            icon={PiggyBank}
            iconClassName="bg-emerald-500/10 text-emerald-400"
          />
          <StatCard label="Returns" value={String(metrics.returnsCount)} icon={RotateCcw} />
          <StatCard
            label="Refund value"
            value={formatCurrency(metrics.refundValue)}
            icon={RotateCcw}
            iconClassName="bg-red-500/10 text-red-400"
          />
          <StatCard
            label="Net profit"
            value={formatCurrency(metrics.netProfit)}
            icon={TrendingUp}
            iconClassName="bg-violet-400/15 text-violet-300"
            hint="After returns"
          />
        </StatGrid>
      </ReportSection>

      <ReportSection title="Swaps">
        <StatGrid className="sm:grid-cols-3">
          <StatCard label="Total swaps" value={String(metrics.totalSwaps)} icon={CalendarRange} />
          <StatCard label="Trade-in value" value={formatCurrency(metrics.totalTradeInValue)} icon={BarChart3} />
          <StatCard label="Avg balance" value={formatCurrency(metrics.averageBalanceCollected)} icon={PiggyBank} />
        </StatGrid>
      </ReportSection>

      <ReportSection title="Serialized sales">
        <StatGrid className="sm:grid-cols-3">
          <StatCard label="Phones sold" value={String(metrics.serializedCounts.phones)} icon={Smartphone} />
          <StatCard label="Laptops sold" value={String(metrics.serializedCounts.laptops)} icon={Laptop} />
          <StatCard label="Tablets sold" value={String(metrics.serializedCounts.tablets)} icon={Tablet} />
        </StatGrid>
      </ReportSection>

      <section className="grid gap-3 lg:grid-cols-2">
        <HighlightCard
          title="Best selling model"
          description="Most units sold across serialized devices."
          value={metrics.bestSellingModel?.label ?? 'No sales yet'}
          subvalue={
            metrics.bestSellingModel
              ? `${metrics.bestSellingModel.units} unit${metrics.bestSellingModel.units !== 1 ? 's' : ''}`
              : undefined
          }
        />
        <HighlightCard
          title="Highest profit item"
          description="Top profit contributor in this period."
          value={metrics.highestProfitItem?.label ?? 'No sales yet'}
          subvalue={metrics.highestProfitItem ? formatCurrency(metrics.highestProfitItem.profit) : undefined}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <BreakdownCard
          title="Sales by category"
          description="Units sold per category"
          emptyLabel="No category sales for this period."
          data={metrics.categoryBreakdown}
          valueFormatter={value => `${value} sold`}
        />
        <BreakdownCard
          title="Payment method mix"
          description="Revenue by payment method"
          emptyLabel="No payment data for this period."
          data={metrics.paymentBreakdown}
          valueFormatter={value => formatCurrency(value)}
        />
      </section>
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="font-display text-sm font-semibold text-shell-ink">{title}</h3>
      {children}
    </section>
  );
}

function HighlightCard({
  title,
  description,
  value,
  subvalue,
}: {
  title: string;
  description: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <Card className="border-shell-line bg-shell-surface shadow-none">
      <CardHeader>
        <CardTitle className="font-display text-shell-ink">{title}</CardTitle>
        <CardDescription className="text-shell-muted">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-lg font-semibold text-shell-ink">{value}</div>
        {subvalue ? <div className="text-sm font-medium text-violet-300">{subvalue}</div> : null}
      </CardContent>
    </Card>
  );
}

function BreakdownCard({
  title,
  description,
  data,
  emptyLabel,
  valueFormatter,
}: {
  title: string;
  description: string;
  data: ReportBreakdownPoint[];
  emptyLabel: string;
  valueFormatter: (value: number) => string;
}) {
  const maxValue = Math.max(...data.map(entry => entry.value), 0);

  return (
    <Card className="border-shell-line bg-shell-surface shadow-none">
      <CardHeader>
        <CardTitle className="font-display text-shell-ink">{title}</CardTitle>
        <CardDescription className="text-shell-muted">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-shell-line px-4 py-8 text-center text-sm text-shell-muted">
            {emptyLabel}
          </div>
        ) : (
          <div className="space-y-4">
            {data.map(entry => (
              <div key={entry.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-shell-ink">{entry.label}</span>
                  <span className="tabular-nums text-shell-muted">{valueFormatter(entry.value)}</span>
                </div>
                <div className="h-2 rounded-full bg-shell-surface-2">
                  <div
                    className="h-2 rounded-full transition-[width]"
                    style={{
                      width: `${maxValue === 0 ? 0 : (entry.value / maxValue) * 100}%`,
                      backgroundColor: entry.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
