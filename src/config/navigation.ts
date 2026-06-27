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

export type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  /** Hide for staff without financial nav access */
  financial?: boolean;
};

export const MAIN_NAV: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/till', icon: Zap, label: 'Quick till' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/sales', icon: ShoppingCart, label: 'Sales' },
  { to: '/share', icon: Share2, label: 'Price list' },
  { to: '/cashup', icon: Wallet, label: 'Cash & expenses', financial: true },
  { to: '/repair', icon: Wrench, label: 'Repairs' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/purchasing', icon: ShoppingBag, label: 'Purchasing', financial: true },
];

export const SECONDARY_NAV: NavItem[] = [
  { to: '/analytics', icon: BarChart3, label: 'Pricing & profit', financial: true },
  { to: '/reports/stock-sessions', icon: ScanLine, label: 'Stock-take', financial: true },
  { to: '/credits', icon: HandCoins, label: 'Credits', financial: true },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/audit-log', icon: ClipboardList, label: 'Audit log', financial: true },
  { to: '/settings', icon: Settings, label: 'Settings', financial: true },
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
