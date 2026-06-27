import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import type { InventoryItem } from '@/types';

/** Serialized units sharing the same product line at this branch (name + brand + category). */
export function useProductUnits(item: InventoryItem | undefined) {
  const { shopOwnerId } = useShopAccess();

  const units = useLiveQuery(async (): Promise<InventoryItem[]> => {
    if (!shopOwnerId || !item || item.mode !== 'serialized') return [];
    const rows = await db.inventory_items
      .where('user_id')
      .equals(shopOwnerId)
      .filter(
        i =>
          !i.deleted &&
          i.mode === 'serialized' &&
          i.location_id === item.location_id &&
          i.name === item.name &&
          i.brand === item.brand &&
          i.category === item.category
      )
      .toArray();
    return rows.sort((a, b) => {
      const ac = a.imei ?? a.serial_number ?? '';
      const bc = b.imei ?? b.serial_number ?? '';
      return ac.localeCompare(bc);
    });
  }, [shopOwnerId, item?.id, item?.name, item?.brand, item?.category, item?.location_id, item?.mode]);

  return { units: units ?? [], isLoading: units === undefined };
}
