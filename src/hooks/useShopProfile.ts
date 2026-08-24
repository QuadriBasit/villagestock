import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { setSetting, db } from '@/lib/db';
import { flushSyncQueue, queueSync } from '@/lib/sync';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { logShopAudit } from '@/lib/audit';
import { resolveAuditActorLabel } from '@/lib/auditActorLabel';
import type { ShopProfile, BusinessProfile, ReceiptTheme } from '@/types';
import { mergeWarrantyPolicy } from '@/lib/warranty';
import { useBusinessProfileQuery } from '@/hooks/useBusinessProfileQuery';
import { TRIAL_PLACEHOLDER } from '@/lib/trial';
import { supabase, isOnline } from '@/lib/supabase';

const SETTINGS_KEY = 'shop_profile';
const SHOP_ASSETS_BUCKET = 'shop-assets';
export const DEFAULT_RECEIPT_THEME: ReceiptTheme = {
  header_color: '#00b398',
  accent_color: '#00b398',
  text_color: '#0f172a',
  paper_color: '#ffffff',
};

const DEFAULT_PROFILE: ShopProfile = {
  shop_name: '',
  address: '',
  phone: '',
  logo_data_url: undefined,
  logo_path: undefined,
  receipt_theme: DEFAULT_RECEIPT_THEME,
};

function getPublicLogoUrl(path?: string) {
  if (!path) return undefined;
  const { data } = supabase.storage.from(SHOP_ASSETS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function getFileExtension(file: File) {
  const nameExt = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : undefined;
  if (nameExt) return nameExt;
  const mimeExt = file.type.split('/')[1]?.toLowerCase();
  return mimeExt || 'png';
}

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
      logo_data_url:
        (bp?.logo_path ? getPublicLogoUrl(bp.logo_path) : undefined) ??
        legacy?.logo_data_url ??
        DEFAULT_PROFILE.logo_data_url,
      logo_path: bp?.logo_path ?? legacy?.logo_path ?? DEFAULT_PROFILE.logo_path,
      receipt_theme: {
        ...DEFAULT_RECEIPT_THEME,
        ...(legacy?.receipt_theme ?? {}),
      },
      warranty_policy: mergeWarrantyPolicy(legacy?.warranty_policy),
    };
  }, [bpQuery, legacySetting]);

  const isLoading = bpQuery.status === 'pending';

  const saveProfile = useCallback(
    async (updated: ShopProfile, options?: { logoFile?: File | null }) => {
      let logoPath = updated.logo_path;
      let logoUrl = updated.logo_data_url;

      if (options?.logoFile) {
        if (!businessId) throw new Error('Not authenticated');
        if (!isOnline()) throw new Error('Connect to the internet before uploading a shop logo.');

        const ext = getFileExtension(options.logoFile);
        const nextLogoPath = `${businessId}/logo.${ext}`;
        const previousLogoPath = logoPath;

        const { error: uploadError } = await supabase.storage
          .from(SHOP_ASSETS_BUCKET)
          .upload(nextLogoPath, options.logoFile, {
            upsert: true,
            contentType: options.logoFile.type || undefined,
            cacheControl: '3600',
          });

        if (uploadError) throw uploadError;

        if (previousLogoPath && previousLogoPath !== nextLogoPath) {
          await supabase.storage.from(SHOP_ASSETS_BUCKET).remove([previousLogoPath]).catch(() => undefined);
        }

        logoPath = nextLogoPath;
        logoUrl = getPublicLogoUrl(nextLogoPath);
      }

      const profileToStore: ShopProfile = {
        ...updated,
        logo_path: logoPath,
        logo_data_url: logoUrl,
      };

      await setSetting(SETTINGS_KEY, profileToStore);

      if (user && businessId) {
        const existing = await db.business_profiles.get(businessId);
        const now = new Date().toISOString();
        const next: BusinessProfile = {
          id: businessId,
          shop_name: profileToStore.shop_name,
          owner_name: existing?.owner_name ?? '',
          phone: profileToStore.phone,
          email: existing?.email,
          address: profileToStore.address,
          logo_path: profileToStore.logo_path,
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
                shop_name: profileToStore.shop_name,
                address: profileToStore.address,
                phone: profileToStore.phone,
                logo_path: profileToStore.logo_path,
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
