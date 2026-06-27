import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import type { ContactRecord, ContactType } from '@/types';

export function useContacts(type?: ContactType) {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const contacts = useLiveQuery(async (): Promise<ContactRecord[]> => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return [];
    let rows = await db.contacts
      .where('user_id')
      .equals(shopOwnerId)
      .filter(c => c.location_id === activeLocationId || !c.location_id)
      .toArray();
    if (type) rows = rows.filter(c => c.type === type);
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [shopOwnerId, activeLocationId, locationReady, type]);

  return { contacts: contacts ?? [], isLoading: contacts === undefined };
}
