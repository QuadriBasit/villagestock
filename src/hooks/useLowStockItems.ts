import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { getItemQty } from '@/lib/inventoryDisplay';
import type { InventoryItem } from '@/types';

export type LowStockRow = {
  item: InventoryItem;
  qty: number;
  tone: 'empty' | 'low';
};

export function useLowStockItems(limit = 8) {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const rows = useLiveQuery(async (): Promise<LowStockRow[]> => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return [];

    const items = await db.inventory_items
      .where('user_id')
      .equals(shopOwnerId)
      .filter(i => !i.deleted && i.location_id === activeLocationId)
      .toArray();

    const low: LowStockRow[] = [];

    for (const item of items) {
      if (item.mode === 'serialized') {
        if (item.status === 'in_stock') continue;
        if (item.status === 'sold' || item.status === 'returned') continue;
        continue;
      }
      const qty = getItemQty(item);
      if (qty <= item.low_stock_threshold) {
        low.push({ item, qty, tone: qty === 0 ? 'empty' : 'low' });
      }
    }

    // Serialized in_stock with low model counts handled via summary; include single in_stock serialized as informational only if needed
    return low.sort((a, b) => a.qty - b.qty).slice(0, limit);
  }, [shopOwnerId, activeLocationId, locationReady, limit]);

  return { rows: rows ?? [], isLoading: rows === undefined };
}
