import { useLiveQuery } from 'dexie-react-hooks';
import { endOfDay, endOfWeek, format, startOfDay, startOfWeek, subDays } from 'date-fns';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import type { Category, PaymentMethod, ReturnRecord, SalesRecord, SwapRecord } from '@/types';

export type ReportPreset = 'today' | 'week' | 'custom';

export interface ReportRange {
  start: Date;
  end: Date;
  label: string;
}

export interface ReportMetricCard {
  label: string;
  value: number;
}

export interface ReportBreakdownPoint {
  label: string;
  value: number;
  color: string;
}

export interface ReportMetrics {
  range: ReportRange;
  salesCount: number;
  revenue: number;
  profit: number;
  returnsCount: number;
  refundValue: number;
  netProfit: number;
  totalSwaps: number;
  totalTradeInValue: number;
  averageBalanceCollected: number;
  serializedCounts: Record<'phones' | 'laptops' | 'tablets', number>;
  bestSellingModel: { label: string; units: number } | null;
  highestProfitItem: { label: string; profit: number } | null;
  categoryBreakdown: ReportBreakdownPoint[];
  paymentBreakdown: ReportBreakdownPoint[];
  sales: SalesRecord[];
  returns: ReturnRecord[];
  swaps: SwapRecord[];
}

const CATEGORY_LABELS: Record<Category, string> = {
  phones: 'Phones',
  laptops: 'Laptops',
  tablets: 'Tablets',
  accessories: 'Accessories',
  parts: 'Parts',
};

const CATEGORY_COLORS: Record<Category, string> = {
  phones: '#2563eb',
  laptops: '#7c3aed',
  tablets: '#0f766e',
  accessories: '#ea580c',
  parts: '#4b5563',
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Transfer',
  pos: 'POS',
};

const PAYMENT_COLORS: Record<PaymentMethod, string> = {
  cash: '#16a34a',
  bank_transfer: '#0284c7',
  pos: '#f59e0b',
};

export function getPresetRange(preset: Exclude<ReportPreset, 'custom'>): ReportRange {
  const now = new Date();
  if (preset === 'today') {
    return {
      start: startOfDay(now),
      end: endOfDay(now),
      label: 'Today',
    };
  }

  return {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 }),
    label: 'This Week',
  };
}

export function getDefaultCustomRange(): ReportRange {
  const end = endOfDay(new Date());
  const start = startOfDay(subDays(end, 6));
  return {
    start,
    end,
    label: `${format(start, 'd MMM')} - ${format(end, 'd MMM yyyy')}`,
  };
}

export function getLastDaysRange(days: number): ReportRange {
  const end = endOfDay(new Date());
  const start = startOfDay(subDays(end, days - 1));
  return {
    start,
    end,
    label: `Last ${days} days`,
  };
}

export function buildCustomRange(start: string, end: string): ReportRange {
  const startDate = startOfDay(new Date(start));
  const endDate = endOfDay(new Date(end));

  return {
    start: startDate,
    end: endDate,
    label: `${format(startDate, 'd MMM')} - ${format(endDate, 'd MMM yyyy')}`,
  };
}

export function useReportMetrics(range: ReportRange) {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const metrics = useLiveQuery(async (): Promise<ReportMetrics> => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return emptyReport(range);

    const sales = await db.sales_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter((sale) => {
        if (sale.location_id !== activeLocationId) return false;
        const soldAt = new Date(sale.sold_at);
        return soldAt >= range.start && soldAt <= range.end;
      })
      .toArray();

    const returns = await db.return_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter((record) => {
        if (record.location_id !== activeLocationId) return false;
        const returnedAt = new Date(record.returned_at);
        return returnedAt >= range.start && returnedAt <= range.end;
      })
      .toArray();

    const swaps = await db.swap_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter((swap) => {
        if (swap.location_id !== activeLocationId) return false;
        const date = new Date(swap.date);
        return date >= range.start && date <= range.end;
      })
      .toArray();

    return buildMetrics(range, sales, returns, swaps);
  }, [shopOwnerId, activeLocationId, locationReady, range.start.getTime(), range.end.getTime(), range.label]);

  return { metrics: metrics ?? emptyReport(range), isLoading: metrics === undefined };
}

function emptyReport(range: ReportRange): ReportMetrics {
  return {
    range,
    salesCount: 0,
    revenue: 0,
    profit: 0,
    returnsCount: 0,
    refundValue: 0,
    netProfit: 0,
    totalSwaps: 0,
    totalTradeInValue: 0,
    averageBalanceCollected: 0,
    serializedCounts: {
      phones: 0,
      laptops: 0,
      tablets: 0,
    },
    bestSellingModel: null,
    highestProfitItem: null,
    categoryBreakdown: [],
    paymentBreakdown: [],
    sales: [],
    returns: [],
    swaps: [],
  };
}

function buildMetrics(range: ReportRange, sales: SalesRecord[], returns: ReturnRecord[], swaps: SwapRecord[]): ReportMetrics {
  const categoryTotals = new Map<Category, number>();
  const paymentTotals = new Map<PaymentMethod, number>();
  const modelTotals = new Map<string, number>();
  const itemProfitTotals = new Map<string, number>();

  let salesCount = 0;
  let revenue = 0;
  let profit = 0;

  const serializedCounts: ReportMetrics['serializedCounts'] = {
    phones: 0,
    laptops: 0,
    tablets: 0,
  };

  for (const sale of sales) {
    salesCount += sale.quantity_sold;
    revenue += sale.sale_price * sale.quantity_sold;
    profit += sale.profit;

    categoryTotals.set(
      sale.item_category,
      (categoryTotals.get(sale.item_category) ?? 0) + sale.quantity_sold
    );
    if (sale.payment_method) {
      paymentTotals.set(
        sale.payment_method,
        (paymentTotals.get(sale.payment_method) ?? 0) + sale.sale_price * sale.quantity_sold
      );
    }

    if (sale.item_category === 'phones' || sale.item_category === 'laptops' || sale.item_category === 'tablets') {
      serializedCounts[sale.item_category] += sale.quantity_sold;
      const modelKey = `${sale.item_brand} ${sale.item_name}`.trim();
      modelTotals.set(modelKey, (modelTotals.get(modelKey) ?? 0) + sale.quantity_sold);
    }

    const profitKey = `${sale.item_brand} ${sale.item_name}`.trim();
    itemProfitTotals.set(profitKey, (itemProfitTotals.get(profitKey) ?? 0) + sale.profit);
  }

  const refundValue = returns.reduce((sum, record) => sum + record.refund_amount, 0);
  const totalTradeInValue = swaps.reduce((sum, swap) => sum + swap.trade_in_value, 0);
  const totalBalanceCollected = swaps.reduce((sum, swap) => sum + swap.balance_paid, 0);
  const bestSellingModel = getHighestEntry(modelTotals, 'units');
  const highestProfitItem = getHighestEntry(itemProfitTotals, 'profit');

  return {
    range,
    salesCount,
    revenue,
    profit,
    returnsCount: returns.length,
    refundValue,
    netProfit: profit - refundValue,
    totalSwaps: swaps.length,
    totalTradeInValue,
    averageBalanceCollected: swaps.length > 0 ? totalBalanceCollected / swaps.length : 0,
    serializedCounts,
    bestSellingModel,
    highestProfitItem,
    categoryBreakdown: (Object.keys(CATEGORY_LABELS) as Category[])
      .map((category) => ({
        label: CATEGORY_LABELS[category],
        value: categoryTotals.get(category) ?? 0,
        color: CATEGORY_COLORS[category],
      }))
      .filter((entry) => entry.value > 0),
    paymentBreakdown: (Object.keys(PAYMENT_LABELS) as PaymentMethod[])
      .map((paymentMethod) => ({
        label: PAYMENT_LABELS[paymentMethod],
        value: paymentTotals.get(paymentMethod) ?? 0,
        color: PAYMENT_COLORS[paymentMethod],
      }))
      .filter((entry) => entry.value > 0),
    sales,
    returns,
    swaps,
  };
}

function getHighestEntry(
  totals: Map<string, number>,
  field: 'units'
): { label: string; units: number } | null;
function getHighestEntry(
  totals: Map<string, number>,
  field: 'profit'
): { label: string; profit: number } | null;
function getHighestEntry(totals: Map<string, number>, field: 'units' | 'profit') {
  const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  const [label, value] = entries[0];
  return field === 'units' ? { label, units: value } : { label, profit: value };
}
