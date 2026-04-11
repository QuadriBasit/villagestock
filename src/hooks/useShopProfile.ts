import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { setSetting, db } from '@/lib/db';
import { flushSyncQueue, queueSync } from '@/lib/sync';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { logShopAudit } from '@/lib/audit';
import { resolveAuditActorLabel } from '@/lib/auditActorLabel';
import type { ShopProfile, BusinessProfile } from '@/types';
import { useBusinessProfileQuery } from '@/hooks/useBusinessProfileQuery';
import { TRIAL_PLACEHOLDER } from '@/lib/trial';

const SETTINGS_KEY = 'shop_profile';

const DEFAULT_PROFILE: ShopProfile = {
  shop_name: '',
  address: '',
  phone: '',
  logo_data_url: undefined,
};

export function useShopProfile() {
  const user = useAuthStore(s => s.user);
  const { shopOwnerId, actorUserId } = useShopAccess();
  const businessId = shopOwnerId ?? user?.id;
  const bpQuery = useBusinessProfileQuery(businessId);

  const legacySetting = useLiveQuery(
    () => db.settings.get(SETTINGS_KEY),
    []
  );

  const profile: ShopProfile = useMemo(() => {
    const legacy = (legacySetting?.value ?? null) as ShopProfile | null;
    const bp = bpQuery.status === 'ready' ? bpQuery.profile : null;
    return {
      shop_name: bp?.shop_name ?? legacy?.shop_name ?? DEFAULT_PROFILE.shop_name,
      address: bp?.address ?? legacy?.address ?? DEFAULT_PROFILE.address,
      phone: bp?.phone ?? legacy?.phone ?? DEFAULT_PROFILE.phone,
      logo_data_url: legacy?.logo_data_url ?? DEFAULT_PROFILE.logo_data_url,
    };
  }, [bpQuery, legacySetting]);

  const isLoading = bpQuery.status === 'pending';

  const saveProfile = useCallback(
    async (updated: ShopProfile) => {
      await setSetting(SETTINGS_KEY, updated);

      if (user && businessId) {
        const existing = await db.business_profiles.get(businessId);
        const now = new Date().toISOString();
        const next: BusinessProfile = {
          id: businessId,
          shop_name: updated.shop_name,
          owner_name: existing?.owner_name ?? '',
          phone: updated.phone,
          email: existing?.email,
          address: updated.address,
          trial_start_date: existing?.trial_start_date ?? TRIAL_PLACEHOLDER,
          trial_end_date: existing?.trial_end_date ?? TRIAL_PLACEHOLDER,
          plan: existing?.plan ?? 'trial',
          plan_status: existing?.plan_status ?? 'active',
          subscription_id: existing?.subscription_id,
          onboarding_complete: existing?.onboarding_complete ?? true,
          created_at: existing?.created_at ?? now,
          account_disabled: existing?.account_disabled ?? false,
          updated_at: now,
          sync_status: 'pending',
        };
        if (existing) {
          await db.business_profiles.put(next);
          await queueSync('business_profiles', 'update', next as unknown as Record<string, unknown>);
          await flushSyncQueue();
          if (actorUserId && shopOwnerId) {
            const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
            void logShopAudit({
              businessId: shopOwnerId,
              actorUserId,
              action: 'shop.profile_updated',
              entityType: 'business_profile',
              entityId: businessId,
              metadata: {
                shop_name: updated.shop_name,
                address: updated.address,
                phone: updated.phone,
              },
              actorLabel,
            });
          }
        }
      }
    },
    [user, businessId, actorUserId, shopOwnerId]
  );

  return { profile, isLoading, saveProfile };
}
