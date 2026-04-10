import { useCallback } from 'react';
import { db } from '@/lib/db';
import { flushSyncQueue, queueSync } from '@/lib/sync';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import type { BusinessProfile } from '@/types';
import { TRIAL_PLACEHOLDER } from '@/lib/trial';
import { useBusinessProfileQuery } from '@/hooks/useBusinessProfileQuery';

export function useBusinessProfile() {
  const user = useAuthStore(s => s.user);
  const { shopOwnerId } = useShopAccess();
  const businessId = shopOwnerId ?? user?.id;
  const q = useBusinessProfileQuery(businessId);

  const saveDraft = useCallback(
    async (partial: Partial<Omit<BusinessProfile, 'id' | 'updated_at' | 'sync_status'>>) => {
      if (!user || !businessId) throw new Error('Not authenticated');
      const now = new Date().toISOString();
      const existing = await db.business_profiles.get(businessId);
      const next: BusinessProfile = {
        id: businessId,
        shop_name: partial.shop_name ?? existing?.shop_name ?? '',
        owner_name: partial.owner_name ?? existing?.owner_name ?? '',
        phone: partial.phone ?? existing?.phone ?? user.phone ?? '',
        email: partial.email ?? existing?.email,
        address: partial.address ?? existing?.address ?? '',
        trial_start_date: partial.trial_start_date ?? existing?.trial_start_date ?? TRIAL_PLACEHOLDER,
        trial_end_date: partial.trial_end_date ?? existing?.trial_end_date ?? TRIAL_PLACEHOLDER,
        plan: partial.plan ?? existing?.plan ?? 'trial',
        plan_status: partial.plan_status ?? existing?.plan_status ?? 'active',
        subscription_id: partial.subscription_id ?? existing?.subscription_id,
        onboarding_complete: partial.onboarding_complete ?? existing?.onboarding_complete ?? false,
        created_at: partial.created_at ?? existing?.created_at ?? now,
        account_disabled: partial.account_disabled ?? existing?.account_disabled ?? false,
        updated_at: now,
        sync_status: 'pending',
      };
      await db.business_profiles.put(next);
      await queueSync('business_profiles', existing ? 'update' : 'insert', next as unknown as Record<string, unknown>);
      await flushSyncQueue();
    },
    [user, businessId]
  );

  const startTrialAndCompleteOnboarding = useCallback(async () => {
    if (!user) throw new Error('Not authenticated');
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 14);
    await saveDraft({
      trial_start_date: start.toISOString(),
      trial_end_date: end.toISOString(),
      plan: 'trial',
      plan_status: 'active',
      onboarding_complete: true,
    });
  }, [user, saveDraft]);

  const profile = q.status === 'ready' ? q.profile : undefined;
  const isLoading = q.status === 'pending';

  return {
    profile,
    isLoading,
    isReady: q.status === 'ready',
    saveDraft,
    startTrialAndCompleteOnboarding,
  };
}
