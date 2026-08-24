import {
  Building2,
  Fuel,
  Package,
  Shield,
  Trash2,
  Truck,
  Users,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { ExpenseCategory } from '@/types';

export type ExpenseCategoryMeta = {
  key: ExpenseCategory;
  label: string;
  icon: LucideIcon;
  tone: string;
};

/** Fixed costs first — then day-to-day outgoings. */
export const EXPENSE_CATEGORY_META: ExpenseCategoryMeta[] = [
  { key: 'rent', label: 'Rent / shop levy', icon: Wallet, tone: 'text-brand-300' },
  { key: 'salary', label: 'Salaries / wages', icon: Users, tone: 'text-violet-300' },
  { key: 'security', label: 'Security / gateman', icon: Shield, tone: 'text-slate-300' },
  { key: 'lawma', label: 'LAWMA / waste', icon: Trash2, tone: 'text-lime-300' },
  { key: 'market_levy', label: 'Market / association levy', icon: Building2, tone: 'text-orange-300' },
  { key: 'generator', label: 'Generator / diesel', icon: Fuel, tone: 'text-amber-300' },
  { key: 'nepa', label: 'NEPA / power', icon: Zap, tone: 'text-yellow-300' },
  { key: 'internet', label: 'Internet / data', icon: Wifi, tone: 'text-cyan-300' },
  { key: 'transport', label: 'Transport', icon: Truck, tone: 'text-sky-300' },
  { key: 'feeding', label: 'Feeding / lunch', icon: Utensils, tone: 'text-orange-300' },
  { key: 'repairs', label: 'Repairs / maintenance', icon: Wrench, tone: 'text-rose-300' },
  { key: 'supplies', label: 'Shop supplies', icon: Package, tone: 'text-emerald-300' },
  { key: 'other', label: 'Other', icon: Wallet, tone: 'text-shell-muted' },
];

export const EXPENSE_CATEGORY_LABELS = Object.fromEntries(
  EXPENSE_CATEGORY_META.map(c => [c.key, c.label]),
) as Record<ExpenseCategory, string>;

export const EXPENSE_CATEGORY_ICONS = Object.fromEntries(
  EXPENSE_CATEGORY_META.map(c => [c.key, c.icon]),
) as Record<ExpenseCategory, LucideIcon>;

export function expenseCategoryLabel(key: ExpenseCategory): string {
  return EXPENSE_CATEGORY_LABELS[key] ?? key.replace(/_/g, ' ');
}
