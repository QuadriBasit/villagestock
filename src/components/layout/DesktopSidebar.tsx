import { NavLink } from 'react-router-dom';
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
  const { canAccessFinancialNav } = useShopAccess();
  const { profile } = useBusinessProfile();
  const { user } = useAuthStore();
  const { mobileOpen, closeMobile } = useSidebarLayout();

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
          'fixed inset-0 z-[55] bg-[#04070e]/60 transition-opacity lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={closeMobile}
        aria-hidden={!mobileOpen}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-[60] flex h-full w-[252px] flex-col border-r border-shell-line bg-[#0e1320] transition-transform duration-200 ease-out lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="px-5 pb-[18px] pt-[22px]">
          <AppBrand />
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

        <div className="m-3 rounded-[14px] border border-shell-line bg-shell-surface-2 p-3.5">
          <div className="flex items-center gap-[11px]">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-400 font-display text-sm font-bold text-[#160a2e]">
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
