import { useLiveQuery } from 'dexie-react-hooks';
import { useRef } from 'react';
import { db } from '@/lib/db';
import { effectiveBusinessProfileForBilling } from '@/lib/devBillingOverride';
import type { BusinessProfile } from '@/types';

export type BusinessProfileQueryState =
  | { status: 'pending' }
  | { status: 'ready'; profile: BusinessProfile | null };

/**
 * Dexie liveQuery can briefly re-enter "pending" while a read re-runs after `business_profiles` updates.
 * OnboardingGate treated that as full-screen loading — keep last ready snapshot per userId until the new read finishes.
 */
export function useBusinessProfileQuery(userId: string | undefined): BusinessProfileQueryState {
  const lastKey = useRef<string | undefined>(undefined);
  const readySnapshot = useRef<Extract<BusinessProfileQueryState, { status: 'ready' }> | null>(null);

  if (userId !== lastKey.current) {
    lastKey.current = userId;
    readySnapshot.current = null;
  }

  const live =
    useLiveQuery(
      async (): Promise<BusinessProfileQueryState> => {
        if (!userId) return { status: 'ready', profile: null };
        const row = await db.business_profiles.get(userId);
        return {
          status: 'ready',
          profile: effectiveBusinessProfileForBilling(row ?? null) ?? null,
        };
      },
      [userId],
      { status: 'pending' } as BusinessProfileQueryState
    ) ?? { status: 'pending' };

  if (live.status === 'ready') {
    readySnapshot.current = live;
    return live;
  }

  if (readySnapshot.current) return readySnapshot.current;

  return live;
}
