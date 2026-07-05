import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type AdminSaleFeedRow = {
  id: string;
  user_id: string;
  item_name: string;
  sale_price: number;
  quantity_sold: number;
  sold_at: string;
};

export type AdminSalesByDay = {
  day: string;
  count: number;
  revenue: number;
};

export type AdminPlatformActivity = {
  recent: AdminSaleFeedRow[];
  sales_by_day: AdminSalesByDay[];
  total_in_period: number;
  shop_names: Record<string, string>;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function useAdminPlatformActivity(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-platform-activity'],
    queryFn: async (): Promise<AdminPlatformActivity> => {
      const since = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

      const [salesRes, shopsRes] = await Promise.all([
        supabase
          .from('sales_records')
          .select('id, user_id, item_name, sale_price, quantity_sold, sold_at')
          .gte('sold_at', since)
          .order('sold_at', { ascending: false })
          .limit(600),
        supabase.from('business_profiles').select('id, shop_name'),
      ]);

      if (salesRes.error) throw salesRes.error;
      if (shopsRes.error) throw shopsRes.error;

      const shopNames: Record<string, string> = {};
      for (const shop of shopsRes.data ?? []) {
        shopNames[String(shop.id)] = String(shop.shop_name ?? '');
      }

      const byDay = new Map<string, { count: number; revenue: number }>();
      for (const row of salesRes.data ?? []) {
        const soldAt = String(row.sold_at ?? '');
        const day = soldAt.slice(0, 10);
        if (!day) continue;
        const prev = byDay.get(day) ?? { count: 0, revenue: 0 };
        const qty = Number(row.quantity_sold ?? 1);
        const price = Number(row.sale_price ?? 0);
        byDay.set(day, {
          count: prev.count + 1,
          revenue: prev.revenue + price * qty,
        });
      }

      const sales_by_day = [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, stats]) => ({ day, ...stats }));

      const recent = (salesRes.data ?? []).slice(0, 60).map(row => ({
        id: String(row.id),
        user_id: String(row.user_id),
        item_name: String(row.item_name ?? ''),
        sale_price: Number(row.sale_price ?? 0),
        quantity_sold: Number(row.quantity_sold ?? 1),
        sold_at: String(row.sold_at),
      }));

      return {
        recent,
        sales_by_day,
        total_in_period: salesRes.data?.length ?? 0,
        shop_names: shopNames,
      };
    },
    enabled,
    staleTime: 1000 * 60,
  });
}
