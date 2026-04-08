import { v4 as uuidv4 } from 'uuid';
import { useCallback } from 'react';
import { db } from '@/lib/db';
import { queueSync } from '@/lib/sync';
import { assertTrialAllowsMutations } from '@/lib/trial';
import { useAuthStore } from '@/store/auth';
import type { InventoryItem, SerializedItemStatus, StockSession } from '@/types';
import {
  buildSessionCloseSummary,
  computeExpectedClosingIds,
  hasStockAccountabilityPlan,
  loadInventoryMap,
  localSessionDateKey,
} from '@/lib/stockSessionUtils';

export class PriorDayStockOpenError extends Error {
  constructor() {
    super('PRIOR_DAY_OPEN');
    this.name = 'PriorDayStockOpenError';
  }
}

export function useStockSessionActions() {
  const user = useAuthStore((s) => s.user);

  const openTodaySession = useCallback(async (): Promise<StockSession> => {
    if (!user) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(user.id);
    const profile = await db.business_profiles.get(user.id);
    if (!hasStockAccountabilityPlan(profile)) throw new Error('Business plan required');

    const date = localSessionDateKey();
    const todays = await db.stock_sessions.where('[user_id+date]').equals([user.id, date]).toArray();
    if (todays.some((s) => s.status === 'open')) throw new Error('Stock is already open for today');
    if (todays.length > 0) {
      throw new Error("Today's stock session is already closed.");
    }

    const staleOpens = await db.stock_sessions
      .where('user_id')
      .equals(user.id)
      .filter((s) => s.status === 'open')
      .toArray();
    if (staleOpens.some((s) => s.date < date)) {
      throw new PriorDayStockOpenError();
    }

    const inStock = await db.inventory_items
      .where('user_id')
      .equals(user.id)
      .filter((i) => !i.deleted && i.mode === 'serialized' && i.status === 'in_stock')
      .toArray();

    const now = new Date().toISOString();
    const session: StockSession = {
      id: uuidv4(),
      user_id: user.id,
      date,
      opened_at: now,
      opened_by_user_id: user.id,
      opening_snapshot_ids: inStock.map((i) => i.id),
      expected_closing_ids: [],
      actual_closing_ids: [],
      missing_item_ids: [],
      missing_notes_by_item_id: {},
      status: 'open',
      audit_log: [
        {
          at: now,
          user_id: user.id,
          action: 'opened',
          detail: `${inStock.length} serialized units in stock`,
        },
      ],
      sync_status: 'pending',
    };

    await db.stock_sessions.add(session);
    return session;
  }, [user]);

  const forceAbandonOpenSession = useCallback(
    async (sessionId: string, detail?: string): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      await assertTrialAllowsMutations(user.id);
      const session = await db.stock_sessions.get(sessionId);
      if (!session || session.user_id !== user.id || session.status !== 'open') {
        throw new Error('Invalid session');
      }
      const now = new Date().toISOString();
      const audit = [
        ...session.audit_log,
        {
          at: now,
          user_id: user.id,
          action: 'skipped_abandoned' as const,
          detail: detail ?? 'Closed from prior day without reconciliation',
        },
      ];
      await db.stock_sessions.update(sessionId, {
        status: 'closed_with_discrepancy',
        closed_at: now,
        closed_by_user_id: user.id,
        notes: detail ?? session.notes,
        audit_log: audit,
        sync_status: 'pending',
      });
    },
    [user]
  );

  const loadCloseState = useCallback(
    async (sessionId: string) => {
      if (!user) throw new Error('Not authenticated');
      const session = await db.stock_sessions.get(sessionId);
      if (!session || session.user_id !== user.id) throw new Error('Session not found');
      if (session.status !== 'open') throw new Error('Session is not open');

      const items = [...(await loadInventoryMap(user.id)).values()];
      const expectedIds = computeExpectedClosingIds(session, items);
      const summary = await buildSessionCloseSummary(user.id, session, items, expectedIds);

      await db.stock_sessions.update(sessionId, {
        expected_closing_ids: expectedIds,
        summary,
        sync_status: 'pending',
      });

      const fresh = await db.stock_sessions.get(sessionId);
      const checklistItems = expectedIds
        .map((id) => items.find((i) => i.id === id))
        .filter((i): i is InventoryItem => !!i);

      return { session: fresh!, expectedIds, summary, checklistItems };
    },
    [user]
  );

  const confirmCloseSession = useCallback(
    async (sessionId: string, confirmedPresentIds: string[], missingNotesByItemId: Record<string, string>) => {
      if (!user) throw new Error('Not authenticated');
      await assertTrialAllowsMutations(user.id);

      const session = await db.stock_sessions.get(sessionId);
      if (!session || session.user_id !== user.id || session.status !== 'open') {
        throw new Error('Session not found or not open');
      }

      const expected = new Set(session.expected_closing_ids);
      const actualSet = new Set(confirmedPresentIds.filter((id) => expected.has(id)));
      const missing = [...expected].filter((id) => !actualSet.has(id));

      for (const id of missing) {
        if (!missingNotesByItemId[id]?.trim()) {
          throw new Error(`Add a note for each missing device (${id})`);
        }
      }

      const now = new Date().toISOString();
      const hasDisc = missing.length > 0;
      const nextStatus = hasDisc ? 'closed_with_discrepancy' : 'closed';

      for (const id of missing) {
        const item = await db.inventory_items.get(id);
        if (item) {
          await db.inventory_items.update(id, {
            status: 'missing',
            missing_resolution: undefined,
            missing_resolution_note: undefined,
            missing_resolved_at: undefined,
            updated_at: now,
            sync_status: 'pending',
          });
          const updated = await db.inventory_items.get(id);
          if (updated) {
            await queueSync('inventory_items', 'update', updated as unknown as Record<string, unknown>);
          }
        }
      }

      const audit = [
        ...session.audit_log,
        {
          at: now,
          user_id: user.id,
          action: 'closed' as const,
          detail: hasDisc ? `${missing.length} missing` : 'All accounted for',
        },
      ];

      if (hasDisc) {
        for (const id of missing) {
          audit.push({
            at: now,
            user_id: user.id,
            action: 'missing_item_noted' as const,
            detail: `${id}: ${missingNotesByItemId[id]}`,
          });
        }
      }

      await db.stock_sessions.update(sessionId, {
        status: nextStatus,
        closed_at: now,
        closed_by_user_id: user.id,
        actual_closing_ids: [...actualSet],
        missing_item_ids: missing,
        missing_notes_by_item_id: missing.reduce(
          (acc, id) => {
            acc[id] = missingNotesByItemId[id]?.trim() ?? '';
            return acc;
          },
          {} as Record<string, string>
        ),
        audit_log: audit,
        sync_status: 'pending',
      });
    },
    [user]
  );

  const resolveMissingItem = useCallback(
    async (
      itemId: string,
      resolution: NonNullable<InventoryItem['missing_resolution']>,
      note: string
    ): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      await assertTrialAllowsMutations(user.id);
      const item = await db.inventory_items.get(itemId);
      if (!item || item.user_id !== user.id) throw new Error('Item not found');
      if (item.status !== 'missing') throw new Error('Item is not marked missing');

      const now = new Date().toISOString();
      const nextStatus: SerializedItemStatus =
        resolution === 'found' ? 'in_stock' : 'defective';

      await db.inventory_items.update(itemId, {
        status: nextStatus,
        missing_resolution: resolution,
        missing_resolution_note: note,
        missing_resolved_at: now,
        updated_at: now,
        sync_status: 'pending',
      });

      const updated = await db.inventory_items.get(itemId);
      if (updated) {
        await queueSync('inventory_items', 'update', updated as unknown as Record<string, unknown>);
      }

      const affectedSessions = await db.stock_sessions
        .where('user_id')
        .equals(user.id)
        .filter((s) => (s.missing_item_ids ?? []).includes(itemId))
        .toArray();

      for (const s of affectedSessions) {
        const log = [
          ...s.audit_log,
          {
            at: now,
            user_id: user.id,
            action: 'missing_resolved' as const,
            detail: `${itemId} → ${resolution}: ${note}`,
          },
        ];
        await db.stock_sessions.update(s.id, { audit_log: log, sync_status: 'pending' });
      }
    },
    [user]
  );

  return {
    openTodaySession,
    forceAbandonOpenSession,
    loadCloseState,
    confirmCloseSession,
    resolveMissingItem,
  };
}
