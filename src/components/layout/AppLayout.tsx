import { Outlet, useLocation } from 'react-router-dom';
import DesktopSidebar from './DesktopSidebar';
import TopBar from './TopBar';
import { SidebarLayoutProvider } from './SidebarLayoutContext';
import TrialExpiredOverlay from '@/components/billing/TrialExpiredOverlay';
import BottomNav from './BottomNav';
import { ShellAccentSync } from './ShellAccentSync';
import { useTrialAccess } from '@/hooks/useTrialAccess';
import { useTheme } from '@/components/theme/ThemeProvider';
import { cn } from '@/lib/utils';

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
  const { resolved } = useTheme();

  return (
    <div
      className={cn(
        'app-shell flex min-h-svh bg-shell-bg font-body text-sm text-shell-ink antialiased',
        resolved === 'dark' && 'dark',
      )}
    >
      <ShellAccentSync />
      <DesktopSidebar />
      <div className="flex min-h-svh min-w-0 flex-1 flex-col lg:ml-[252px]">
        <TopBar />
        <main className="flex-1 overflow-y-auto pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
          <div key={location.pathname} className="route-enter w-full px-4 py-0 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </div>
      {accountSuspended ? <TrialExpiredOverlay variant="account_suspended" /> : null}
    </div>
  );
}
