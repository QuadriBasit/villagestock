import { lazy, Suspense, useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { clearAllLocalShopData } from '@/lib/db';
import LandingPage from '@/pages/LandingPage';
import { useBusinessProfileQuery } from '@/hooks/useBusinessProfileQuery';
import { useIsAdminUser } from '@/hooks/useIsAdminUser';
import { useShopAccess } from '@/context/ShopAccessContext';

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

export default function App() {
  const { setSession, setLoading, user } = useAuthStore();
  const previousUserIdRef = useRef<string | undefined>(undefined);

  // If the signed-in account changes without a full reload, drop stale IndexedDB (other shop's rows).
  useEffect(() => {
    const id = user?.id;
    const prev = previousUserIdRef.current;
    if (prev !== undefined && id !== undefined && prev !== id) {
      void clearAllLocalShopData();
    }
    previousUserIdRef.current = id;
  }, [user?.id]);

  // Bootstrap Supabase auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, [setSession, setLoading]);

  return (
    <Suspense fallback={<RouteFallback />}>
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
              <OnboardingGate>
                <AppLayout />
              </OnboardingGate>
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
