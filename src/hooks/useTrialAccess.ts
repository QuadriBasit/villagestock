import { useBusinessProfileQuery } from '@/hooks/useBusinessProfileQuery';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { trialBannerState, showTrialEndedOverlay, trialBlocksMutations } from '@/lib/trial';

export function useTrialAccess() {
  const user = useAuthStore(s => s.user);
  const { shopOwnerId } = useShopAccess();
  const q = useBusinessProfileQuery(shopOwnerId ?? user?.id);
  const bp = q.status === 'ready' ? q.profile : undefined;

  const accountSuspended = !!bp?.account_disabled;
  const banner = accountSuspended ? { visible: false, daysRemaining: 0, urgent: false } : trialBannerState(bp ?? undefined);
  const overlay = !accountSuspended && showTrialEndedOverlay(bp ?? undefined);
  const mutationsBlocked = trialBlocksMutations(bp ?? undefined);

  return {
    businessProfile: bp,
    profileQuery: q,
    banner,
    accountSuspended,
    showExpiredOverlay: overlay,
    mutationsBlocked,
  };
}
