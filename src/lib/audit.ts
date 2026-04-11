import { v4 as uuidv4 } from 'uuid';
import { supabase, isOnline } from '@/lib/supabase';
import { db } from '@/lib/db';
import type { AuditEvent } from '@/types';
import type { Json } from '@/types/supabase';

export async function logShopAudit(params: {
  businessId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  /** Shown in audit log instead of raw user id */
  actorLabel?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const meta = { ...(params.metadata ?? {}) };
  if (params.actorLabel) {
    meta.actor_name = params.actorLabel;
  }
  const row: AuditEvent = {
    id: uuidv4(),
    business_id: params.businessId,
    actor_user_id: params.actorUserId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    metadata: meta,
    created_at: now,
    sync_status: 'pending',
  };

  try {
    await db.audit_events.add(row);
  } catch (e) {
    console.warn('[audit] local write failed', e);
  }

  if (!isOnline()) return;

  const { error } = await supabase.from('audit_events').insert({
    id: row.id,
    business_id: row.business_id,
    actor_user_id: row.actor_user_id,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    metadata: row.metadata as Json,
    created_at: row.created_at,
  });

  if (error) {
    console.warn('[audit] remote insert failed', error);
    return;
  }

  await db.audit_events.update(row.id, { sync_status: 'synced' }).catch(() => {});
}
