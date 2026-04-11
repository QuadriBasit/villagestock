import { useAuthStore } from '@/store/auth';
import { db } from '@/lib/db';

/** Human-readable label for the person who performed an action (stored in audit metadata). */
export function auditActorLabel(actorUserId: string, shopOwnerId: string, ownerDisplayName?: string | null): string {
  if (actorUserId === shopOwnerId) {
    const n = ownerDisplayName?.trim();
    return n || 'Shop owner';
  }
  const u = useAuthStore.getState().user;
  if (u?.id === actorUserId) {
    return u.email?.trim() || u.phone?.trim() || 'Team member';
  }
  return 'Team member';
}

/** Resolves owner name from local business profile when the actor is the shop owner. */
export async function resolveAuditActorLabel(actorUserId: string, shopOwnerId: string): Promise<string> {
  if (actorUserId === shopOwnerId) {
    const bp = await db.business_profiles.get(shopOwnerId);
    return auditActorLabel(actorUserId, shopOwnerId, bp?.owner_name);
  }
  return auditActorLabel(actorUserId, shopOwnerId);
}
