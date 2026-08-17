import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useBusinessProfile } from '@/hooks/useBusinessProfile';
import { useAuthStore } from '@/store/auth';
import { getAccountInitial } from '@/lib/userDisplay';
import { useSidebarLayout } from './SidebarLayoutContext';
import { MAIN_NAV, SECONDARY_NAV } from '@/config/navigation';
import { AppBrand } from './AppBrand';
import { shellNavLinkClass } from './shellNavLinkClass';
import { cn } from '@/lib/utils';

export default function DesktopSidebar() {
  const location = useLocation();
  const { canAccessFinancialNav } = useShopAccess();
  const { profile } = useBusinessProfile();
  const { user } = useAuthStore();
  const { mobileOpen, closeMobile } = useSidebarLayout();

  useEffect(() => {
    closeMobile();
  }, [location.pathname, closeMobile]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const mainNav = MAIN_NAV.filter(item => canAccessFinancialNav || !item.financial);
  const secondaryNav = SECONDARY_NAV.filter(item => canAccessFinancialNav || !item.financial);
  const avatar = getAccountInitial({
    ownerName: profile?.owner_name,
    email: user?.email,
    phone: user?.phone,
  });

  return (
    <>
      <div
        className={cn(
          /* z-45: above shell chrome (z-40), below modal overlays (z-50) */
          'fixed inset-0 z-[45] bg-[#04070e]/60 transition-opacity lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={closeMobile}
        onTouchEnd={e => {
          if (e.target === e.currentTarget) closeMobile();
        }}
        aria-hidden={!mobileOpen}
      />
      <aside
        className={cn(
          /* lg:z-30 keeps desktop sidebar under modal backdrops; z-[46] when drawer open on mobile */
          'fixed inset-y-0 left-0 z-30 flex h-full w-[252px] flex-col border-r border-shell-line bg-shell-surface transition-transform duration-200 ease-out lg:translate-x-0',
          mobileOpen ? 'pointer-events-auto z-[46] translate-x-0' : 'pointer-events-none -translate-x-full lg:pointer-events-auto'
        )}
      >
        <div className="relative px-5 pb-[18px] pt-[22px]">
          <AppBrand />
          <button
            type="button"
            className="absolute right-1 top-[18px] grid size-9 place-items-center rounded-lg text-shell-muted shell-hover-accent lg:hidden"
            onClick={closeMobile}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3 pb-3">
          {mainNav.map(n => {
            const Icon = n.icon;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/dashboard'}
                onClick={closeMobile}
                className={({ isActive }) => shellNavLinkClass(isActive)}
              >
                <Icon size={19} strokeWidth={2} className="shrink-0" />
                {n.label}
              </NavLink>
            );
          })}

          <div className="px-[13px] pb-1.5 pt-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-shell-muted">
            More
          </div>

          {secondaryNav.map(n => {
            const Icon = n.icon;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                onClick={closeMobile}
                className={({ isActive }) => shellNavLinkClass(isActive)}
              >
                <Icon size={19} strokeWidth={2} className="shrink-0" />
                {n.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="m-3 rounded-[14px] border border-shell-line bg-shell-bg p-3.5 dark:bg-shell-surface-2">
          <div className="flex items-center gap-[11px]">
            <div className="grid size-9 shrink-0 place-items-center rounded-full shell-accent-bg font-display text-sm font-bold">
              {avatar}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-semibold text-shell-ink">
                {profile?.owner_name?.trim() || 'Shop owner'}
              </div>
              <div className="truncate text-[11.5px] text-shell-muted">{profile?.shop_name || 'Your shop'}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
