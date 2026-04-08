import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { BusinessProfile } from '@/types';

export type BusinessProfileQueryState =
  | { status: 'pending' }
  | { status: 'ready'; profile: BusinessProfile | null };

export function useBusinessProfileQuery(userId: string | undefined): BusinessProfileQueryState {
  return (
    useLiveQuery(
      async (): Promise<BusinessProfileQueryState> => {
        if (!userId) return { status: 'ready', profile: null };
        const row = await db.business_profiles.get(userId);
        return { status: 'ready', profile: row ?? null };
      },
      [userId],
      { status: 'pending' } as BusinessProfileQueryState
    ) ?? { status: 'pending' }
  );
}
