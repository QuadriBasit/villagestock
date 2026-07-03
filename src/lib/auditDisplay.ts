import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import {
  ClipboardList,
  CreditCard,
  DollarSign,
  Package,
  RotateCcw,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  Wrench,
  ArrowRightLeft,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import type { AuditEvent } from '@/types';

export type AuditCategory = 'all' | 'sales' | 'money' | 'stock' | 'repairs' | 'staff';

export const AUDIT_CATEGORIES: { value: AuditCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'sales', label: 'Sales' },
  { value: 'money', label: 'Money' },
  { value: 'stock', label: 'Stock' },
  { value: 'repairs', label: 'Repairs' },
  { value: 'staff', label: 'Staff' },
];

const CATEGORY_TONE: Record<Exclude<AuditCategory, 'all'>, string> = {
  sales: '#34d399',
  money: '#fbbf24',
  stock: '#60a5fa',
  repairs: '#a78bfa',
  staff: '#8794ab',
};

type ActionMeta = { label: string; icon: LucideIcon; category: Exclude<AuditCategory, 'all'> };

const ACTION_MAP: Record<string, ActionMeta> = {
  'sale.recorded': { label: 'Sale recorded', icon: ShoppingCart, category: 'sales' },
  'return.processed': { label: 'Return processed', icon: RotateCcw, category: 'sales' },
  'swap.completed': { label: 'Swap completed', icon: ArrowRightLeft, category: 'sales' },
  'credit.created': { label: 'Credit created', icon: CreditCard, category: 'money' },
  'credit.payment_recorded': { label: 'Credit payment', icon: CreditCard, category: 'money' },
  'credit.payment_removed': { label: 'Credit payment removed', icon: CreditCard, category: 'money' },
  'purchase.recorded': { label: 'Purchase recorded', icon: Wallet, category: 'money' },
  'expense.recorded': { label: 'Expense logged', icon: DollarSign, category: 'money' },
  'cashup.closed': { label: 'Cash-up closed', icon: Wallet, category: 'money' },
  'inventory.item_created': { label: 'Item added', icon: Package, category: 'stock' },
  'inventory.item_updated': { label: 'Item updated', icon: Package, category: 'stock' },
  'inventory.status_changed': { label: 'Status changed', icon: Package, category: 'stock' },
  'inventory.item_archived': { label: 'Item archived', icon: Package, category: 'stock' },
  'inventory.stock_adjusted': { label: 'Stock adjusted', icon: Warehouse, category: 'stock' },
  'inventory.item_transferred_branch': { label: 'Branch transfer', icon: Warehouse, category: 'stock' },
  'repair.sent': { label: 'Sent for repair', icon: Wrench, category: 'repairs' },
  'repair.status_updated': { label: 'Repair updated', icon: Wrench, category: 'repairs' },
  'repair.collected': { label: 'Repair collected', icon: Wrench, category: 'repairs' },
  'shop.profile_updated': { label: 'Shop profile updated', icon: Settings, category: 'staff' },
  'team.member_added': { label: 'Team member added', icon: Users, category: 'staff' },
  'team.member_removed': { label: 'Team member removed', icon: Users, category: 'staff' },
  'team.member_invited': { label: 'Team invite sent', icon: Users, category: 'staff' },
  'team.member_branch_scope_updated': { label: 'Branch access updated', icon: Users, category: 'staff' },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ENTITY_FALLBACK: Record<string, string> = {
  sale: 'Sale',
  sales_record: 'Sale',
  return: 'Return',
  return_record: 'Return',
  swap: 'Swap',
  swap_record: 'Swap',
  credit: 'Credit',
  credit_record: 'Credit',
  purchase: 'Purchase',
  expense: 'Expense',
  cash_session: 'Cash-up',
  inventory_item: 'Item',
  repair_record: 'Repair',
  shop_profile: 'Shop',
  business_member: 'Team',
  staff_invite: 'Invite',
  business_profile: 'Business',
};

export function auditCategoryForAction(action: string): Exclude<AuditCategory, 'all'> {
  return ACTION_MAP[action]?.category ?? 'stock';
}

export function auditActionMeta(action: string): ActionMeta & { tone: string } {
  const meta = ACTION_MAP[action] ?? {
    label: action.replace(/\./g, ' · '),
    icon: ClipboardList,
    category: 'stock' as const,
  };
  return { ...meta, tone: CATEGORY_TONE[meta.category] };
}

export function auditDayLabel(iso: string): string {
  const date = parseISO(iso);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEE d MMM');
}

export function auditTimeLabel(iso: string): string {
  return format(parseISO(iso), 'HH:mm');
}

export function auditRelativeTime(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true });
}

export function groupAuditEventsByDay(events: AuditEvent[]): { day: string; items: AuditEvent[] }[] {
  const groups: { day: string; items: AuditEvent[] }[] = [];
  for (const event of events) {
    const day = auditDayLabel(event.created_at);
    const group = groups.find(g => g.day === day);
    if (group) group.items.push(event);
    else groups.push({ day, items: [event] });
  }
  return groups;
}

export function filterAuditEvents(
  events: AuditEvent[],
  category: AuditCategory,
  query: string
): AuditEvent[] {
  const q = query.trim().toLowerCase();
  return events.filter(event => {
    const cat = auditCategoryForAction(event.action);
    if (category !== 'all' && cat !== category) return false;
    if (!q) return true;
    const meta = auditActionMeta(event.action);
    const hay = `${meta.label} ${event.action} ${JSON.stringify(event.metadata ?? {})}`.toLowerCase();
    return hay.includes(q);
  });
}

export function auditStats(events: AuditEvent[]) {
  const todayCount = events.filter(e => isToday(parseISO(e.created_at))).length;
  const byCat = (cat: Exclude<AuditCategory, 'all'>) =>
    events.filter(e => auditCategoryForAction(e.action) === cat).length;
  return {
    todayCount,
    salesCount: byCat('sales'),
    stockCount: byCat('stock'),
    moneyCount: byCat('money'),
  };
}

function isUuidLike(s: string): boolean {
  return UUID_RE.test(s.trim());
}

export function formatAuditMetadata(
  meta: Record<string, unknown> | null | undefined,
  skipKeys: Set<string>
): { key: string; value: string }[] {
  if (!meta || typeof meta !== 'object') return [];
  const out: { key: string; value: string }[] = [];
  for (const [k, v] of Object.entries(meta)) {
    if (v === null || v === undefined) continue;
    if (skipKeys.has(k)) continue;
    if (k.endsWith('_id') && typeof v === 'string' && isUuidLike(v)) continue;
    let display = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (typeof v === 'string' && isUuidLike(v)) continue;
    if (Array.isArray(v) && v.every(x => typeof x === 'string' && isUuidLike(x))) {
      display = `${v.length} branch(es)`;
    }
    out.push({ key: k.replace(/_/g, ' '), value: display.length > 120 ? `${display.slice(0, 117)}…` : display });
  }
  return out;
}

export function auditActorLabel(
  ev: AuditEvent,
  shopOwnerId: string | null,
  ownerName: string | undefined,
  memberDisplayByUserId: Map<string, string>,
  viewerUserId: string | undefined,
  viewerEmail: string | undefined,
  viewerPhone: string | undefined
): string {
  const meta = ev.metadata && typeof ev.metadata === 'object' ? (ev.metadata as { actor_name?: unknown }) : null;
  if (meta && typeof meta.actor_name === 'string' && meta.actor_name.trim()) {
    return meta.actor_name.trim();
  }
  const actorId = ev.actor_user_id;
  if (!actorId) return 'Team member';
  if (shopOwnerId && actorId === shopOwnerId) {
    return ownerName?.trim() || memberDisplayByUserId.get(actorId) || 'Shop owner';
  }
  const fromRoster = memberDisplayByUserId.get(actorId);
  if (fromRoster) return fromRoster;
  if (viewerUserId === actorId) {
    const u = viewerEmail?.trim() || viewerPhone?.trim();
    if (u) return u;
  }
  return 'Team member';
}

export function auditTargetDescription(
  ev: AuditEvent,
  inventoryNames: Map<string, string>
): { title: string; detail?: string } {
  const meta = (ev.metadata && typeof ev.metadata === 'object' ? ev.metadata : {}) as Record<string, unknown>;
  const metaRows = formatAuditMetadata(meta, new Set(['actor_name']));

  switch (ev.entity_type) {
    case 'inventory_item': {
      const name =
        (typeof meta.item === 'string' && meta.item) ||
        (ev.entity_id ? inventoryNames.get(ev.entity_id) : undefined);
      return { title: name || 'Inventory item', detail: metaRows.map(r => r.value).join(' · ') || undefined };
    }
    case 'sales_record':
      return {
        title: typeof meta.receipt === 'string' ? `Receipt ${meta.receipt}` : 'Sale',
        detail:
          [typeof meta.item === 'string' ? meta.item : null, metaRows.map(r => `${r.key}: ${r.value}`).join(' · ')]
            .filter(Boolean)
            .join(' · ') || undefined,
      };
    case 'return_record':
      return {
        title: typeof meta.receipt === 'string' ? `Return · ${meta.receipt}` : 'Return',
        detail: typeof meta.item === 'string' ? meta.item : undefined,
      };
    case 'swap_record':
      return {
        title: typeof meta.receipt === 'string' ? `Swap · ${meta.receipt}` : 'Swap',
        detail:
          typeof meta.traded_out === 'string'
            ? [meta.traded_out, typeof meta.traded_in === 'string' ? meta.traded_in : null]
                .filter(Boolean)
                .join(' → ')
            : undefined,
      };
    case 'credit_record':
      return {
        title: typeof meta.customer === 'string' ? `Credit · ${meta.customer}` : 'Credit',
        detail: metaRows.map(r => r.value).join(' · ') || undefined,
      };
    case 'repair_record':
      return {
        title: typeof meta.item === 'string' ? meta.item : 'Repair',
        detail:
          [typeof meta.engineer === 'string' ? meta.engineer : null, typeof meta.status === 'string' ? meta.status : null]
            .filter(Boolean)
            .join(' · ') || undefined,
      };
    case 'purchase':
      return {
        title: typeof meta.supplier === 'string' ? `Purchase · ${meta.supplier}` : 'Purchase',
        detail: metaRows.map(r => r.value).join(' · ') || undefined,
      };
    case 'expense':
      return {
        title: typeof meta.label === 'string' ? `Expense · ${meta.label}` : 'Expense',
        detail: metaRows.map(r => r.value).join(' · ') || undefined,
      };
    case 'business_profile':
      return { title: 'Shop profile' };
    case 'business_member':
      return { title: typeof meta.name === 'string' && meta.name.trim() ? meta.name : 'Team member' };
    case 'staff_invite':
      return {
        title: typeof meta.email === 'string' ? `Invite · ${meta.email}` : 'Email invite',
        detail: typeof meta.display_name === 'string' ? meta.display_name : undefined,
      };
    default:
      return {
        title: ENTITY_FALLBACK[ev.entity_type] ?? 'Record',
        detail: metaRows.map(r => r.value).join(' · ') || undefined,
      };
  }
}

export function auditEventCode(id: string): string {
  return id.slice(0, 8).toUpperCase();
}
