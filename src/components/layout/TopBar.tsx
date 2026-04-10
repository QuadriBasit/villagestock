import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronsLeft, ChevronsRight, LogOut, Moon, Search, Settings, Sun, Wifi, WifiOff } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useBusinessProfile } from '@/hooks/useBusinessProfile';
import { getAccountInitial } from '@/lib/userDisplay';
import { useSidebarLayout } from './SidebarLayoutContext';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useInventoryStore } from '@/store/inventory';
import { useShopAccess } from '@/context/ShopAccessContext';
import { signOutApp } from '@/lib/signOutApp';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/inventory': 'Inventory',
  '/inventory/new': 'Add Item',
  '/alerts': 'Low Stock Alerts',
  '/sales': 'Sales History',
  '/credits': 'Credits',
  '/repair': 'Repair',
  '/reports': 'Reports',
  '/reports/stock-sessions': 'Stock sessions',
  '/settings': 'Settings',
  '/audit-log': 'Audit log',
};

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { canManageBusinessSettings, status: shopAccessStatus } = useShopAccess();
  const { profile: businessProfile } = useBusinessProfile();
  const { collapsed: sidebarCollapsed, toggleCollapsed } = useSidebarLayout();
  const { isOnline, pendingCount } = useSyncStatus();
  const { resolved, toggle } = useTheme();
  const filtersSearch = useInventoryStore((s) => s.filters.search);
  const setInventoryFilters = useInventoryStore((s) => s.setFilters);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [accountOpen]);

  const isEditPage = location.pathname.includes('/edit');
  const title = isEditPage
    ? 'Edit Item'
    : location.pathname.startsWith('/stock/close/')
      ? 'Close stock'
      : /^\/reports\/stock-sessions\/.+/.test(location.pathname)
        ? 'Stock session'
        : (PAGE_TITLES[location.pathname] ?? 'VillageStock');
  const avatarLetter = getAccountInitial({
    ownerName: businessProfile?.owner_name,
    email: user?.email,
    phone: user?.phone,
  });
  const accountTitle = [businessProfile?.owner_name?.trim(), user?.email ?? user?.phone]
    .filter(Boolean)
    .join(' · ') || 'Account';

  useEffect(() => {
    if (location.pathname === '/inventory') setSearchQuery(filtersSearch);
  }, [location.pathname, filtersSearch]);

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    setInventoryFilters({ search: q });
    navigate('/inventory');
  };

  return (
    <header
      className="relative flex h-[3.65rem] items-center overflow-visible border-b border-zinc-200/80 bg-white/90 px-3 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#111827]/90 md:h-[3.85rem] md:px-5 lg:px-6"
    >
      <div className="relative flex min-w-0 flex-1 min-h-0 items-center gap-2.5 md:gap-3">
        <div className="flex items-center gap-2 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-primary to-[#5849c4] shadow-sm shadow-[#6c5ce7]/20">
            <span className="text-[10px] font-extrabold tracking-tight text-white">VS</span>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden shrink-0 rounded-xl p-2 text-zinc-600 transition-colors hover:bg-zinc-100 lg:inline-flex dark:text-zinc-300 dark:hover:bg-white/10"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronsRight size={20} strokeWidth={2} /> : <ChevronsLeft size={20} strokeWidth={2} />}
        </button>
        <h1 className="truncate text-[1.05rem] font-semibold leading-none tracking-tight text-[#0f172a] dark:text-white md:text-lg">
          {title}
        </h1>
      </div>

      <form
        onSubmit={onSearchSubmit}
        className="mx-2 hidden min-w-0 max-w-xl flex-1 md:block"
        role="search"
      >
        <label className="relative block w-full">
          <span className="sr-only">Search inventory</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
            aria-hidden
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inventory…"
            className="w-full rounded-xl border border-zinc-200/90 bg-zinc-50/95 py-2 pl-9 pr-3 text-sm text-[#0f172a] outline-none transition placeholder:text-zinc-400 focus:border-primary/35 focus:ring-2 focus:ring-primary/15 dark:border-zinc-700/90 dark:bg-zinc-900/70 dark:text-white dark:placeholder:text-zinc-500"
          />
        </label>
      </form>

      <div className="relative flex shrink-0 items-center gap-0.5 sm:gap-1">
        <span
          className="hidden items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 sm:flex"
          title={isOnline ? 'Online' : 'Offline'}
        >
          {isOnline ? (
            <Wifi size={15} className="shrink-0 text-teal-600 dark:text-teal-400" />
          ) : (
            <WifiOff size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
          )}
          {!isOnline && <span>Offline</span>}
          {pendingCount > 0 && (
            <span className="ml-0.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
              {pendingCount}
            </span>
          )}
        </span>

        <button
          type="button"
          onClick={toggle}
          className="rounded-xl p-2.5 text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10"
          aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {resolved === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>

        <button
          onClick={() => navigate('/alerts')}
          className="relative rounded-xl p-2.5 text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10"
          aria-label="Alerts"
        >
          <Bell size={20} />
        </button>

        <div className="relative" ref={accountMenuRef}>
          <button
            type="button"
            onClick={() => setAccountOpen(o => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 text-sm font-semibold text-primary transition-colors hover:bg-primary/18 dark:bg-primary/20 dark:text-violet-200 dark:hover:bg-primary/28"
            title={accountTitle}
            aria-expanded={accountOpen}
            aria-haspopup="menu"
            aria-label="Account menu"
          >
            {avatarLetter}
          </button>
          {accountOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+0.35rem)] z-[200] min-w-[12.5rem] rounded-xl border border-zinc-200/90 bg-white py-1 shadow-xl dark:border-zinc-600 dark:bg-zinc-900 dark:shadow-black/40"
            >
              <p className="truncate px-3 py-2 text-[11px] text-zinc-500 dark:text-zinc-400" title={user?.email ?? ''}>
                {user?.email ?? 'Signed in'}
              </p>
              {shopAccessStatus === 'ready' && canManageBusinessSettings ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-white/10"
                  onClick={() => {
                    setAccountOpen(false);
                    navigate('/settings');
                  }}
                >
                  <Settings size={16} className="shrink-0 text-zinc-500" />
                  Shop settings
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-white/10"
                onClick={() => {
                  setAccountOpen(false);
                  void signOutApp();
                }}
              >
                <LogOut size={16} className="shrink-0 text-zinc-500" />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
