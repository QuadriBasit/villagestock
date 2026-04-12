import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import LandingPage from '@/pages/LandingPage';
import { useBusinessProfileQuery } from '@/hooks/useBusinessProfileQuery';
import { useIsAdminUser } from '@/hooks/useIsAdminUser';
import { useShopAccess } from '@/context/ShopAccessContext';
import { ShopAccessProvider, ShopSyncEffects } from '@/context/ShopAccessContext';
import { ShopLocationProvider } from '@/context/ShopLocationContext';

const AppLayout = lazy(() => import('@/components/layout/AppLayout'));
const AuthPage = lazy(() => import('@/pages/AuthPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'));
const AdminLoginPage = lazy(() => import('@/pages/admin/AdminLoginPage'));
const AdminOverviewPage = lazy(() => import('@/pages/admin/AdminOverviewPage'));
const AdminBusinessesPage = lazy(() => import('@/pages/admin/AdminBusinessesPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const InventoryPage = lazy(() => import('@/pages/InventoryPage'));
const AddItemPage = lazy(() => import('@/pages/AddItemPage'));
const EditItemPage = lazy(() => import('@/pages/EditItemPage'));
const AlertsPage = lazy(() => import('@/pages/AlertsPage'));
const SalesHistoryPage = lazy(() => import('@/pages/SalesHistoryPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const CloseStockPage = lazy(() => import('@/pages/CloseStockPage'));
const StockSessionsPage = lazy(() => import('@/pages/StockSessionsPage'));
const StockSessionDetailPage = lazy(() => import('@/pages/StockSessionDetailPage'));
const CreditsPage = lazy(() => import('@/pages/CreditsPage'));
const RepairPage = lazy(() => import('@/pages/RepairPage'));
const AuditLogPage = lazy(() => import('@/pages/AuditLogPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <div className="flex h-screen items-center justify-center text-primary">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const { status: shopStatus, shopOwnerId } = useShopAccess();
  const q = useBusinessProfileQuery(shopStatus === 'ready' ? shopOwnerId ?? undefined : undefined);
  const { data: isAdmin, isLoading: adminLoading } = useIsAdminUser(user?.id);
  if (user && (shopStatus === 'loading' || shopStatus === 'idle')) {
    return <div className="flex h-screen items-center justify-center text-primary">Loading…</div>;
  }
  if (q.status === 'pending' || (user && adminLoading)) {
    return <div className="flex h-screen items-center justify-center text-primary">Loading...</div>;
  }
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  if (!q.profile?.onboarding_complete) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

function StaffRedirect({ children }: { children: React.ReactNode }) {
  // Staff blocked from audit/credits/reports/settings — disabled so all roles have full routes.
  // const { role, status } = useShopAccess();
  // if (status !== 'ready') return null;
  // if (role === 'staff') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  const { data: isAdmin, isLoading: checking } = useIsAdminUser(user?.id);
  if (isLoading || (user && checking)) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 text-slate-600 text-sm">Loading admin…</div>
    );
  }
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 px-6 text-center">
        <p className="text-slate-900 font-heading font-semibold">Admin access only</p>
        <p className="text-slate-500 text-sm mt-2 max-w-sm">
          This account is not in the admin roster. Use the main app to manage your shop.
        </p>
        <a href="/auth" className="mt-6 text-primary font-medium text-sm hover:underline">
          Retailer sign-in
        </a>
      </div>
    );
  }
  return <>{children}</>;
}

function RouteFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface text-primary">
      Loading…
    </div>
  );
}

function RetailAppProviders({ children }: { children: ReactNode }) {
  return (
    <ShopAccessProvider>
      <ShopLocationProvider>
        <ShopSyncEffects />
        {children}
      </ShopLocationProvider>
    </ShopAccessProvider>
  );
}

function AuthBootstrap() {
  const location = useLocation();
  const { setSession, setLoading, user } = useAuthStore();
  const previousUserIdRef = useRef<string | undefined>(undefined);
  const shouldBootstrapAuth = location.pathname !== '/';

  useEffect(() => {
    const id = user?.id;
    const prev = previousUserIdRef.current;
    if (prev !== undefined && id !== undefined && prev !== id) {
      void import('@/lib/db').then(({ clearAllLocalShopData }) => clearAllLocalShopData());
    }
    previousUserIdRef.current = id;
  }, [user?.id]);

  useEffect(() => {
    if (!shouldBootstrapAuth) return;

    let active = true;
    let unsubscribe: (() => void) | undefined;

    void import('@/lib/supabase').then(({ supabase }) => {
      if (!active) return;

      supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
      });

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        setSession(session);
        setLoading(false);
      });

      unsubscribe = () => listener.subscription.unsubscribe();
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [setSession, setLoading, shouldBootstrapAuth]);

  return null;
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <AuthBootstrap />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          }
        >
          <Route index element={<AdminOverviewPage />} />
          <Route path="businesses" element={<AdminBusinessesPage />} />
        </Route>
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <RetailAppProviders>
                <OnboardingGate>
                  <AppLayout />
                </OnboardingGate>
              </RetailAppProviders>
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="inventory/new" element={<AddItemPage />} />
          <Route path="inventory/:id/edit" element={<EditItemPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="sales" element={<SalesHistoryPage />} />
          <Route
            path="audit-log"
            element={
              <StaffRedirect>
                <AuditLogPage />
              </StaffRedirect>
            }
          />
          <Route
            path="credits"
            element={
              <StaffRedirect>
                <CreditsPage />
              </StaffRedirect>
            }
          />
          <Route path="repair" element={<RepairPage />} />
          <Route path="engineers" element={<Navigate to="/repair" replace />} />
          <Route
            path="reports"
            element={
              <StaffRedirect>
                <ReportsPage />
              </StaffRedirect>
            }
          />
          <Route
            path="reports/stock-sessions"
            element={
              <StaffRedirect>
                <StockSessionsPage />
              </StaffRedirect>
            }
          />
          <Route
            path="reports/stock-sessions/:sessionId"
            element={
              <StaffRedirect>
                <StockSessionDetailPage />
              </StaffRedirect>
            }
          />
          <Route
            path="stock/close/:sessionId"
            element={
              <StaffRedirect>
                <CloseStockPage />
              </StaffRedirect>
            }
          />
          <Route
            path="settings"
            element={
              <StaffRedirect>
                <SettingsPage />
              </StaffRedirect>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
