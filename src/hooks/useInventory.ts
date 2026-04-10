import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useInventoryStore } from '@/store/inventory';
import { getDeviceDetailsSearchText } from '@/types';
import type { InventoryItem, StockSummary } from '@/types';

export function useInventory() {
  const { shopOwnerId } = useShopAccess();
  const { filters } = useInventoryStore();

  const items = useLiveQuery(async () => {
    if (!shopOwnerId) return [];

    let arr = await db.inventory_items
      .where('user_id')
      .equals(shopOwnerId)
      .filter(item => !item.deleted)
      .toArray();

    // By default hide sold/defective serialized units unless showSold is on
    if (!filters.showSold) {
      arr = arr.filter(
        i =>
          i.mode !== 'serialized' ||
          i.status === 'in_stock' ||
          i.status === 'reserved' ||
          i.status === 'missing'
      );
    }

    if (filters.category !== 'all') {
      arr = arr.filter(i => i.category === filters.category);
    }

    if (filters.lowStockOnly) {
      arr = arr.filter(i => {
        if (i.mode === 'serialized') return false; // handled separately
        return i.quantity <= i.low_stock_threshold;
      });
    }

    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      arr = arr.filter(
        i =>
          i.name.toLowerCase().includes(q) ||
          i.brand.toLowerCase().includes(q) ||
          i.serial_number?.toLowerCase().includes(q) ||
          i.imei?.toLowerCase().includes(q) ||
          i.barcode?.toLowerCase().includes(q) ||
          getDeviceDetailsSearchText(i.deviceDetails).includes(q)
      );
    }

    arr.sort((a, b) => {
      const dir = filters.sortDir === 'asc' ? 1 : -1;
      const key = filters.sortBy as keyof InventoryItem;
      const av = a[key] ?? '';
      const bv = b[key] ?? '';
      return av < bv ? -dir : av > bv ? dir : 0;
    });

    return arr;
  }, [shopOwnerId, filters]);

  return { items: items ?? [], isLoading: items === undefined };
}

export function useInventoryItem(id: string) {
  const item = useLiveQuery(
    () => db.inventory_items.get(id),
    [id]
  );
  return { item, isLoading: item === undefined };
}

export function useStockSummary() {
  const { shopOwnerId } = useShopAccess();

  const summary = useLiveQuery(async () => {
    if (!shopOwnerId) return null;
    const items = await db.inventory_items
      .where('user_id')
      .equals(shopOwnerId)
      .filter(i => !i.deleted)
      .toArray();

    const categories = ['phones', 'laptops', 'tablets', 'accessories', 'parts'] as const;
    const by_category = Object.fromEntries(
      categories.map(cat => [cat, { count: 0, value: 0 }])
    ) as StockSummary['by_category'];

    let total_value = 0;
    let low_stock_count = 0;
    let out_of_stock_count = 0;
    let total_items = 0;

    for (const item of items) {
      const cat = by_category[item.category];

      if (item.mode === 'serialized') {
        // Count only in_stock units
        if (item.status === 'in_stock') {
          if (cat) { cat.count += 1; cat.value += item.price; }
          total_value += item.price;
          total_items += 1;
        }
      } else {
        // Non-serialized: use quantity
        const qty = item.quantity;
        if (cat) { cat.count += qty; cat.value += qty * item.price; }
        total_value += qty * item.price;
        total_items += 1; // count SKUs, not units
        if (qty === 0) out_of_stock_count++;
        else if (qty <= item.low_stock_threshold) low_stock_count++;
      }
    }

    // For serialized: "last unit" warning — model name groups where only 1 in_stock left
    const serializedInStock = items.filter(i => i.mode === 'serialized' && i.status === 'in_stock');
    const modelCounts = new Map<string, number>();
    for (const item of serializedInStock) {
      const key = `${item.brand}|${item.name}`;
      modelCounts.set(key, (modelCounts.get(key) ?? 0) + 1);
    }
    const lastUnitCount = [...modelCounts.values()].filter(c => c === 1).length;
    low_stock_count += lastUnitCount;

    return { total_items, total_value, low_stock_count, out_of_stock_count, by_category } satisfies StockSummary;
  }, [shopOwnerId]);

  return { summary: summary ?? null, isLoading: summary === undefined };
}
