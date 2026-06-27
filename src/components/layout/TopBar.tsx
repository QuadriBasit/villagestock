import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, ShoppingCart, Truck } from 'lucide-react';
import { useBusinessProfile } from '@/hooks/useBusinessProfile';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { useAuthStore } from '@/store/auth';
import { signOutApp } from '@/lib/signOutApp';
import { PAGE_TITLES } from '@/config/navigation';
import { useSidebarLayout } from './SidebarLayoutContext';
import { CommandPalette } from './CommandPalette';
import { NotificationsDropdown } from './NotificationsDropdown';
import { AppBrand } from './AppBrand';
import { settingsBtnPrimary } from '@/components/settings/settingsUi';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { cn } from '@/lib/utils';

function ShellIconButton({
  children,
  className,
  badge,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { badge?: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        'relative grid size-[38px] shrink-0 place-items-center rounded-[10px] border border-shell-line bg-shell-surface text-shell-muted transition-colors shell-hover-accent hover:text-shell-ink',
        className
      )}
      {...props}
    >
      {children}
      {badge}
    </button>
  );
}

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { canManageBusinessSettings, status: shopAccessStatus } = useShopAccess();
  const { locations, activeLocationId, setActiveLocationId, ready: locationReady } = useShopLocation();
  const { profile } = useBusinessProfile();
  const { setMobileOpen } = useSidebarLayout();
  const [commandOpen, setCommandOpen] = useState(false);

  const isEditPage = location.pathname.includes('/edit');
  const title = isEditPage
    ? 'Edit item'
    : location.pathname.startsWith('/stock/close/')
      ? 'Close stock'
      : /^\/reports\/stock-sessions\/.+/.test(location.pathname)
        ? 'Stock session'
        : (PAGE_TITLES[location.pathname] ?? 'Village Stock');

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(o => !o);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const accountInitial = (profile?.owner_name?.[0] ?? user?.email?.[0] ?? 'A').toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-shell-line bg-shell-bg/82 px-3 py-3 backdrop-blur-md sm:gap-4 sm:px-[26px] max-lg:gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <ShellIconButton className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </ShellIconButton>

          <div className="lg:hidden">
            <AppBrand compact />
          </div>

          <span className="hidden font-display text-sm font-semibold text-shell-ink lg:inline">{title}</span>

          {shopAccessStatus === 'ready' && locationReady && locations.length > 0 ? (
            <div className="flex h-[38px] min-w-0 shrink items-center gap-2 rounded-[10px] border border-shell-line bg-shell-surface px-2.5 pl-3 text-shell-muted sm:gap-2">
              <Truck size={15} className="shrink-0" />
              <Select
                value={activeLocationId ?? undefined}
                onValueChange={setActiveLocationId}
              >
                <SelectTrigger
                  aria-label="Branch"
                  className="h-auto min-w-0 max-w-[96px] gap-1 border-none bg-transparent px-0 py-0 font-semibold text-[13.5px] text-shell-ink shadow-none focus:ring-0 sm:max-w-[140px] [&>svg]:size-3.5 [&>svg]:opacity-50"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="hidden h-[38px] w-60 items-center gap-2 rounded-[10px] border border-shell-line bg-shell-surface px-3 text-left text-shell-muted transition-colors shell-hover-accent hover:text-shell-ink md:flex"
          >
            <Search size={16} className="shrink-0" />
            <span className="flex-1 text-[13.5px]">Search anything…</span>
            <kbd className="rounded-md border border-shell-line bg-shell-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-shell-muted">
              ⌘K
            </kbd>
          </button>

          <NotificationsDropdown />

          <button
            type="button"
            className={cn(settingsBtnPrimary, 'inline-flex h-9 shrink-0 items-center gap-2 px-3.5 text-sm')}
            onClick={() => navigate('/till')}
          >
            <ShoppingCart size={16} />
            <span className="hidden min-[561px]:inline">New sale</span>
          </button>

          <Popover>
            <PopoverTrigger asChild>
              <ShellIconButton aria-label="Account">{accountInitial}</ShellIconButton>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 border-shell-line bg-shell-surface p-1 text-shell-ink">
              <p className="px-2.5 py-2 text-[11px] text-shell-muted">{user?.email}</p>
              {canManageBusinessSettings ? (
                <button
                  type="button"
                  className="flex w-full rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-shell-ink hover:bg-shell-surface-2"
                  onClick={() => navigate('/settings')}
                >
                  Settings
                </button>
              ) : null}
              <button
                type="button"
                className="flex w-full rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-shell-ink hover:bg-shell-surface-2"
                onClick={() => void signOutApp()}
              >
                Sign out
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </>
  );
}
