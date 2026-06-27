import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import type { ContactRecord, ContactRecordInput } from '@/types';

export function useContactActions() {
  const { user } = useAuthStore();
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  async function addContact(input: ContactRecordInput): Promise<ContactRecord> {
    if (!user || !shopOwnerId) throw new Error('Not authenticated');
    if (!locationReady || !activeLocationId) throw new Error('Select a branch first');
    const now = new Date().toISOString();
    const record: ContactRecord = {
      ...input,
      id: uuidv4(),
      user_id: shopOwnerId,
      location_id: activeLocationId,
      deal_count: 0,
      created_at: now,
      updated_at: now,
    };
    await db.contacts.add(record);
    return record;
  }

  async function updateContact(id: string, patch: Partial<ContactRecordInput>): Promise<void> {
    await db.contacts.update(id, { ...patch, updated_at: new Date().toISOString() });
  }

  async function adjustSupplierBalance(id: string, delta: number): Promise<void> {
    const row = await db.contacts.get(id);
    if (!row) throw new Error('Contact not found');
    await db.contacts.update(id, {
      balance_owed: Math.max(0, row.balance_owed + delta),
      updated_at: new Date().toISOString(),
    });
  }

  async function deleteContact(id: string): Promise<void> {
    await db.contacts.delete(id);
  }

  return { addContact, updateContact, adjustSupplierBalance, deleteContact };
}
