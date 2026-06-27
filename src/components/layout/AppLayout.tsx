import { Outlet, useLocation } from 'react-router-dom';
import DesktopSidebar from './DesktopSidebar';
import TopBar from './TopBar';
import { SidebarLayoutProvider } from './SidebarLayoutContext';
import TrialExpiredOverlay from '@/components/billing/TrialExpiredOverlay';
import { useTrialAccess } from '@/hooks/useTrialAccess';

export default function AppLayout() {
  return (
    <SidebarLayoutProvider>
      <AppLayoutInner />
    </SidebarLayoutProvider>
  );
}

function AppLayoutInner() {
  const location = useLocation();
  const { accountSuspended } = useTrialAccess();

  return (
    <div className="app-shell dark flex min-h-svh bg-shell-bg font-body text-sm text-shell-ink antialiased">
      <DesktopSidebar />
      <div className="flex min-h-svh min-w-0 flex-1 flex-col lg:ml-[252px]">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div key={location.pathname} className="route-enter w-full px-4 py-0 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
            <Outlet />
          </div>
        </main>
      </div>
      {accountSuspended ? <TrialExpiredOverlay variant="account_suspended" /> : null}
    </div>
  );
}
