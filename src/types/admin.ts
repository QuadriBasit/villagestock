import type { Json } from '@/types/supabase';

export type AdminBusinessRow = {
  id: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  email: string | null;
  address: string;
  plan: string;
  plan_status: string;
  onboarding_complete: boolean;
  trial_start_date: string;
  trial_end_date: string;
  created_at: string;
  account_disabled: boolean;
  updated_at: string;
  inventory_count: number;
  sales_count: number;
};

export type AdminTotals = {
  total_businesses: number;
  signups_today: number;
  signups_week: number;
  signups_month: number;
  trials_active: number;
  trials_expired: number;
  paid_starter: number;
  paid_pro: number;
  paid_business: number;
  revenue_ngn: number;
};

export type AdminSignupsByDay = { day: string; count: number };

export type AdminDashboardSnapshot = {
  generated_at: string;
  businesses: AdminBusinessRow[];
  totals: AdminTotals;
  signups_by_day: AdminSignupsByDay[];
};

export function parseAdminSnapshot(raw: Json): AdminDashboardSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, Json>;
  const businesses = Array.isArray(o.businesses) ? o.businesses : [];
  const totals = o.totals && typeof o.totals === 'object' && !Array.isArray(o.totals) ? o.totals : {};
  const signups_by_day = Array.isArray(o.signups_by_day) ? o.signups_by_day : [];
  return {
    generated_at: String(o.generated_at ?? ''),
    businesses: businesses.map(parseBizRow).filter(Boolean) as AdminBusinessRow[],
    totals: parseTotals(totals as Record<string, Json>),
    signups_by_day: signups_by_day.map(parseDay).filter(Boolean) as AdminSignupsByDay[],
  };
}

function parseBizRow(x: Json): AdminBusinessRow | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const r = x as Record<string, Json>;
  return {
    id: String(r.id ?? ''),
    shop_name: String(r.shop_name ?? ''),
    owner_name: String(r.owner_name ?? ''),
    phone: String(r.phone ?? ''),
    email: r.email != null ? String(r.email) : null,
    address: String(r.address ?? ''),
    plan: String(r.plan ?? ''),
    plan_status: String(r.plan_status ?? ''),
    onboarding_complete: Boolean(r.onboarding_complete),
    trial_start_date: String(r.trial_start_date ?? ''),
    trial_end_date: String(r.trial_end_date ?? ''),
    created_at: String(r.created_at ?? ''),
    account_disabled: Boolean(r.account_disabled),
    updated_at: String(r.updated_at ?? ''),
    inventory_count: Number(r.inventory_count ?? 0),
    sales_count: Number(r.sales_count ?? 0),
  };
}

function parseTotals(t: Record<string, Json>): AdminTotals {
  return {
    total_businesses: Number(t.total_businesses ?? 0),
    signups_today: Number(t.signups_today ?? 0),
    signups_week: Number(t.signups_week ?? 0),
    signups_month: Number(t.signups_month ?? 0),
    trials_active: Number(t.trials_active ?? 0),
    trials_expired: Number(t.trials_expired ?? 0),
    paid_starter: Number(t.paid_starter ?? 0),
    paid_pro: Number(t.paid_pro ?? 0),
    paid_business: Number(t.paid_business ?? 0),
    revenue_ngn: Number(t.revenue_ngn ?? 0),
  };
}

function parseDay(x: Json): AdminSignupsByDay | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const r = x as Record<string, Json>;
  return { day: String(r.day ?? ''), count: Number(r.count ?? 0) };
}
