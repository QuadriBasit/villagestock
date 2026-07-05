import type { AdminBusinessRow, AdminDashboardSnapshot } from '@/types/admin';

export type AdminAttentionItem = {
  id: string;
  shop_name: string;
  kind: 'trial_expiring' | 'inactive' | 'disabled' | 'onboarding_pending';
  detail: string;
};

export type AdminPlatformMetrics = {
  onboarded: AdminBusinessRow[];
  pendingOnboarding: AdminBusinessRow[];
  disabledAccounts: AdminBusinessRow[];
  totalInventory: number;
  totalSales: number;
  avgInventoryPerShop: number;
  avgSalesPerShop: number;
  inactiveShops: AdminBusinessRow[];
  trialsExpiringSoon: AdminBusinessRow[];
  recentSignups: AdminBusinessRow[];
  topBySales: AdminBusinessRow[];
  attention: AdminAttentionItem[];
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function computeAdminPlatformMetrics(snapshot: AdminDashboardSnapshot): AdminPlatformMetrics {
  const onboarded = snapshot.businesses.filter(b => b.onboarding_complete);
  const pendingOnboarding = snapshot.businesses.filter(b => !b.onboarding_complete);
  const disabledAccounts = onboarded.filter(b => b.account_disabled);
  const totalInventory = onboarded.reduce((sum, b) => sum + b.inventory_count, 0);
  const totalSales = onboarded.reduce((sum, b) => sum + b.sales_count, 0);
  const shopCount = onboarded.length || 1;

  const now = Date.now();
  const trialsExpiringSoon = onboarded.filter(b => {
    if (b.plan !== 'trial' || b.plan_status !== 'active') return false;
    const end = new Date(b.trial_end_date).getTime();
    return Number.isFinite(end) && end > now && end - now <= WEEK_MS;
  });

  const inactiveShops = onboarded.filter(
    b => !b.account_disabled && b.sales_count === 0 && b.inventory_count < 5,
  );

  const recentSignups = [...onboarded]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8);

  const topBySales = [...onboarded]
    .filter(b => b.sales_count > 0)
    .sort((a, b) => b.sales_count - a.sales_count || b.inventory_count - a.inventory_count)
    .slice(0, 6);

  const attention: AdminAttentionItem[] = [
    ...trialsExpiringSoon.map(b => ({
      id: b.id,
      shop_name: b.shop_name || 'Unnamed shop',
      kind: 'trial_expiring' as const,
      detail: `Trial ends ${formatShortDate(b.trial_end_date)}`,
    })),
    ...disabledAccounts.slice(0, 5).map(b => ({
      id: `${b.id}-disabled`,
      shop_name: b.shop_name || 'Unnamed shop',
      kind: 'disabled' as const,
      detail: 'Account disabled',
    })),
    ...inactiveShops.slice(0, 5).map(b => ({
      id: `${b.id}-inactive`,
      shop_name: b.shop_name || 'Unnamed shop',
      kind: 'inactive' as const,
      detail: `${b.inventory_count} items · ${b.sales_count} sales`,
    })),
    ...pendingOnboarding.slice(0, 5).map(b => ({
      id: `${b.id}-pending`,
      shop_name: b.shop_name || b.owner_name || 'New signup',
      kind: 'onboarding_pending' as const,
      detail: 'Onboarding not finished',
    })),
  ].slice(0, 12);

  return {
    onboarded,
    pendingOnboarding,
    disabledAccounts,
    totalInventory,
    totalSales,
    avgInventoryPerShop: Math.round(totalInventory / shopCount),
    avgSalesPerShop: Math.round((totalSales / shopCount) * 10) / 10,
    inactiveShops,
    trialsExpiringSoon,
    recentSignups,
    topBySales,
    attention,
  };
}

function formatShortDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
}

export function formatAdminGeneratedAt(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
