import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useBusinessProfile } from '@/hooks/useBusinessProfile';

/** Name of the signed-in person, not the shop owner (unless they are the owner). */
export function useSignedInDisplayName(): string {
  const { actorDisplayName, isOwner } = useShopAccess();
  const { profile } = useBusinessProfile();
  const { user } = useAuthStore();
  const fromMember = actorDisplayName?.trim();
  if (fromMember) return fromMember;
  if (isOwner) {
    const owner = profile?.owner_name?.trim();
    if (owner) return owner;
  }
  const email = user?.email?.trim();
  if (email?.includes('@')) {
    const local = email.split('@')[0]?.trim();
    if (local) return local;
  }
  return user?.phone?.trim() || 'Team member';
}
