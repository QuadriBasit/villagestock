import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Zap,
  Package,
  ShoppingCart,
  Share2,
  Wallet,
  Wrench,
  Users,
  ShoppingBag,
  BarChart3,
  ScanLine,
  Bell,
  ClipboardList,
  Settings,
  HandCoins,
} from 'lucide-react';
import type { ShopPermissionKey } from '@/lib/shopPermissions';

export type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  permission?: ShopPermissionKey | ShopPermissionKey[];
};

export const MAIN_NAV: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/till', icon: Zap, label: 'Quick till', permission: 'access_till' },
  { to: '/inventory', icon: Package, label: 'Inventory', permission: 'view_inventory' },
  { to: '/sales', icon: ShoppingCart, label: 'Sales', permission: 'access_sales' },
  { to: '/share', icon: Share2, label: 'Price list', permission: 'access_price_list' },
  { to: '/cashup', icon: Wallet, label: 'Cash & expenses', permission: 'access_cashup' },
  { to: '/repair', icon: Wrench, label: 'Repairs', permission: 'access_repairs' },
  { to: '/contacts', icon: Users, label: 'Contacts', permission: 'access_contacts' },
  { to: '/purchasing', icon: ShoppingBag, label: 'Purchasing', permission: 'access_purchasing' },
];

export const SECONDARY_NAV: NavItem[] = [
  { to: '/analytics', icon: BarChart3, label: 'Pricing & profit', permission: 'access_analytics' },
  { to: '/reports/stock-sessions', icon: ScanLine, label: 'Stock-take', permission: 'access_stock_take' },
  { to: '/credits', icon: HandCoins, label: 'Credits', permission: 'manage_credits' },
  { to: '/alerts', icon: Bell, label: 'Alerts', permission: 'access_alerts' },
  { to: '/audit-log', icon: ClipboardList, label: 'Audit log', permission: 'access_audit_log' },
  {
    to: '/settings',
    icon: Settings,
    label: 'Settings',
    permission: ['access_settings', 'manage_shop_settings', 'manage_team', 'manage_roles'],
  },
];

export const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/till': 'Quick till',
  '/inventory': 'Inventory',
  '/inventory/new': 'Add item',
  '/alerts': 'Low stock alerts',
  '/sales': 'Sales & orders',
  '/share': 'Price list',
  '/cashup': 'Cash & expenses',
  '/repairs': 'Repairs & refurb',
  '/repair': 'Repairs & refurb',
  '/contacts': 'Suppliers & customers',
  '/purchasing': 'Purchasing',
  '/analytics': 'Pricing & profit',
  '/reports': 'Reports',
  '/reports/stock-sessions': 'Stock-take',
  '/credits': 'Credits',
  '/settings': 'Settings',
  '/audit-log': 'Audit log',
};

export const COMMAND_PAGES = [
  ...MAIN_NAV,
  ...SECONDARY_NAV.filter(n => n.to !== '/credits'),
];
