import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Settings,
  Plus,
  HandCoins,
  Bell,
  BarChart3,
  Wrench,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
} from 'lucide-react';
import { useTrialAccess } from '@/hooks/useTrialAccess';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useSidebarLayout } from './SidebarLayoutContext';

const MAIN_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/sales', icon: ShoppingCart, label: 'Sales' },
  { to: '/credits', icon: HandCoins, label: 'Credits' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const SECONDARY_NAV = [
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/audit-log', icon: ClipboardList, label: 'Audit log' },
  { to: '/repair', icon: Wrench, label: 'Repair' },
];

const linkBase =
  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-150';

export default function DesktopSidebar() {
  const navigate = useNavigate();
  const { mutationsBlocked } = useTrialAccess();
  const { collapsed, toggleCollapsed } = useSidebarLayout();
  const { canAccessFinancialNav } = useShopAccess();

  const mainNavItems = MAIN_NAV.filter(
    item => canAccessFinancialNav || (item.to !== '/credits' && item.to !== '/settings')
  );
  const secondaryNavItems = SECONDARY_NAV.filter(
    item => canAccessFinancialNav || (item.to !== '/reports' && item.to !== '/audit-log')
  );

  return (
    <aside
      className={`fixed bottom-0 left-0 top-0 z-30 hidden flex-col border-r border-zinc-200/90 bg-zinc-50/95 backdrop-blur-xl transition-[width] duration-200 ease-out dark:border-white/[0.06] dark:bg-[#111827] lg:flex ${
        collapsed ? 'w-[4.5rem]' : 'w-64'
      }`}
      aria-label="Main navigation"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_-30%,rgb(108_92_231/0.1),transparent_55%)] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_-40%,rgb(108_92_231/0.16),transparent_55%)]" />
      <div className="relative border-b border-zinc-200/80 p-3 dark:border-white/[0.06]">
        <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : ''}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-[#5849c4] shadow-sm shadow-[#6c5ce7]/25">
            <span className="text-xs font-extrabold tracking-tight text-white">VS</span>
          </div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight tracking-tight text-zinc-900 dark:text-white">
                VillageStock
              </p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
                Inventory
              </p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={toggleCollapsed}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-white/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-100 ${
              collapsed ? 'mt-1' : ''
            }`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight size={18} strokeWidth={2} /> : <ChevronsLeft size={18} strokeWidth={2} />}
          </button>
        </div>
      </div>

      <nav className="relative flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden p-2.5">
        {mainNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            title={label}
            className={({ isActive }) =>
              `${linkBase} ${collapsed ? 'justify-center px-2' : ''} ${
                isActive
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-white/[0.09] dark:text-white'
                  : 'text-zinc-600 hover:bg-white/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary/12 text-primary dark:bg-primary/25 dark:text-violet-200'
                      : 'bg-zinc-200/60 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500'
                  }`}
                >
                  <Icon size={17} strokeWidth={isActive ? 2.25 : 1.75} />
                </span>
                {collapsed ? <span className="sr-only">{label}</span> : label}
              </>
            )}
          </NavLink>
        ))}

        {!collapsed ? (
          <div className="pb-1 pt-3">
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-600">More</p>
          </div>
        ) : (
          <div className="pb-1 pt-2" aria-hidden />
        )}
        {secondaryNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              `${linkBase} ${collapsed ? 'justify-center px-2' : ''} ${
                isActive
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-white/[0.09] dark:text-white'
                  : 'text-zinc-600 hover:bg-white/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary/12 text-primary dark:bg-primary/25 dark:text-violet-200'
                      : 'bg-zinc-200/60 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500'
                  }`}
                >
                  <Icon size={17} strokeWidth={isActive ? 2.25 : 1.75} />
                </span>
                {collapsed ? <span className="sr-only">{label}</span> : label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="relative border-t border-zinc-200/80 p-2.5 dark:border-white/[0.06]">
        <button
          type="button"
          onClick={() => !mutationsBlocked && navigate('/inventory/new')}
          disabled={mutationsBlocked}
          title="Add item"
          className={`flex w-full items-center justify-center gap-2 rounded-full py-3 font-heading text-sm font-bold text-white transition-all ${
            collapsed ? 'px-0' : 'px-4'
          } ${
            mutationsBlocked
              ? 'cursor-not-allowed bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-500'
              : 'bg-linear-to-r from-primary to-primary-dark shadow-md shadow-primary/25 hover:brightness-110 active:scale-[0.98]'
          }`}
        >
          <Plus size={19} strokeWidth={2.5} />
          {collapsed ? <span className="sr-only">Add item</span> : 'Add item'}
        </button>
      </div>
    </aside>
  );
}
