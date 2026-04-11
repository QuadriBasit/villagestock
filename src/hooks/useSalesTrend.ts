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

export type SalesTrendPoint = { date: string; label: string; revenue: number };

/** Last `days` calendar days of revenue (local timezone), including zeros. */
export function useSalesTrend(days: number = 7): { series: SalesTrendPoint[]; isLoading: boolean } {
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
    const points: SalesTrendPoint[] = [];
    const map = new Map<string, number>();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = localYmd(d);
      map.set(key, 0);
      points.push({
        date: key,
        label: d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' }),
        revenue: 0,
      });
    }

    const start = points[0]?.date;
    if (!start) return [];

    for (const s of raw) {
      const sold = new Date(s.sold_at);
      const key = localYmd(sold);
      if (map.has(key)) {
        map.set(key, (map.get(key) ?? 0) + s.sale_price * s.quantity_sold);
      }
    }

    return points.map((p) => ({ ...p, revenue: map.get(p.date) ?? 0 }));
  }, [raw, days]);

  return { series, isLoading: raw === undefined };
}
