import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type DashboardTrendPoint = {
  date: string;
  label: string;
  revenue: number;
  profit: number;
};

export function useDashboardTrend(days = 14): { series: DashboardTrendPoint[]; isLoading: boolean } {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const raw = useLiveQuery(async () => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return [];
    return db.sales_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(s => s.location_id === activeLocationId)
      .toArray();
  }, [shopOwnerId, activeLocationId, locationReady]);

  const series = useMemo(() => {
    if (!raw) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const points: DashboardTrendPoint[] = [];
    const revMap = new Map<string, number>();
    const profMap = new Map<string, number>();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = localYmd(d);
      revMap.set(key, 0);
      profMap.set(key, 0);
      points.push({
        date: key,
        label: d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
        revenue: 0,
        profit: 0,
      });
    }

    for (const s of raw) {
      const key = localYmd(new Date(s.sold_at));
      if (revMap.has(key)) {
        revMap.set(key, (revMap.get(key) ?? 0) + s.sale_price * s.quantity_sold);
        profMap.set(key, (profMap.get(key) ?? 0) + s.profit);
      }
    }

    return points.map(p => ({
      ...p,
      revenue: revMap.get(p.date) ?? 0,
      profit: profMap.get(p.date) ?? 0,
    }));
  }, [raw, days]);

  return { series, isLoading: raw === undefined };
}

export function useProfitByCategory(days = 14) {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const slices = useLiveQuery(async () => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (days - 1));
    cutoff.setHours(0, 0, 0, 0);

    const sales = await db.sales_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(s => s.location_id === activeLocationId && new Date(s.sold_at) >= cutoff)
      .toArray();

    const byCat = new Map<string, number>();
    for (const s of sales) {
      byCat.set(s.item_category, (byCat.get(s.item_category) ?? 0) + s.profit);
    }

    const total = [...byCat.values()].reduce((a, b) => a + b, 0);
    const colors: Record<string, string> = {
      phones: '#a78bfa',
      laptops: '#34d399',
      tablets: '#60a5fa',
      accessories: '#fbbf24',
      parts: '#f472b6',
    };

    return [...byCat.entries()]
      .map(([cat, profit]) => ({
        cat,
        profit,
        share: total > 0 ? Math.round((profit / total) * 100) : 0,
        color: colors[cat] ?? '#8794ab',
      }))
      .sort((a, b) => b.profit - a.profit);
  }, [shopOwnerId, activeLocationId, locationReady, days]);

  return { slices: slices ?? [], isLoading: slices === undefined };
}

export type TopEarnerRow = {
  key: string;
  name: string;
  category: string;
  profit: number;
  sold: number;
};

export function useTopEarners(days = 14) {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const earners = useLiveQuery(async (): Promise<TopEarnerRow[]> => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (days - 1));
    cutoff.setHours(0, 0, 0, 0);

    const sales = await db.sales_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(s => s.location_id === activeLocationId && new Date(s.sold_at) >= cutoff)
      .toArray();

    const byItem = new Map<string, TopEarnerRow>();
    for (const sale of sales) {
      const key = `${sale.item_brand} ${sale.item_name}`.trim() || sale.item_name;
      const row = byItem.get(key) ?? {
        key,
        name: key,
        category: sale.item_category,
        profit: 0,
        sold: 0,
      };
      row.profit += sale.profit;
      row.sold += sale.quantity_sold;
      byItem.set(key, row);
    }

    return [...byItem.values()].sort((a, b) => b.profit - a.profit).slice(0, 6);
  }, [shopOwnerId, activeLocationId, locationReady, days]);

  return { earners: earners ?? [], isLoading: earners === undefined };
}
