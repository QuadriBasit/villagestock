import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import DesktopSidebar from './DesktopSidebar';
import TopBar from './TopBar';
import TrialBanner from '@/components/billing/TrialBanner';
import TrialExpiredOverlay from '@/components/billing/TrialExpiredOverlay';
import { useTrialAccess } from '@/hooks/useTrialAccess';

function isItemFormRoute(pathname: string): boolean {
  return (
    pathname === '/inventory/new' || /^\/inventory\/[^/]+\/edit$/.test(pathname)
  );
}

export default function AppLayout() {
  const location = useLocation();
  const { businessProfile, banner, showExpiredOverlay, accountSuspended } = useTrialAccess();
  const mainTopClass = banner.visible ? 'pt-[7.25rem]' : 'pt-16';
  const mainBottomLg = isItemFormRoute(location.pathname) ? 'lg:pb-0' : 'lg:pb-8';

  return (
    <div className="min-h-svh">
      <DesktopSidebar />
      <div className="lg:pl-64 flex flex-col min-h-svh">
        <div className="fixed top-0 left-0 right-0 z-40 flex flex-col lg:left-64">
          <TopBar />
          <TrialBanner profile={businessProfile} />
        </div>
        <main
          className={`flex-1 overflow-y-auto max-lg:pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] ${mainBottomLg} ${mainTopClass}`}
        >
          <div key={location.pathname} className="route-enter min-h-full">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </div>
      {accountSuspended && <TrialExpiredOverlay variant="account_suspended" />}
      {showExpiredOverlay && <TrialExpiredOverlay />}
    </div>
  );
}
