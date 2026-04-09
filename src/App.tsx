import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { flushSyncQueue, pullAllRemoteShopData } from '@/lib/sync';
import AppLayout from '@/components/layout/AppLayout';
import AuthPage from '@/pages/AuthPage';
import OnboardingPage from '@/pages/OnboardingPage';
import { useBusinessProfileQuery } from '@/hooks/useBusinessProfileQuery';
import { useIsAdminUser } from '@/hooks/useIsAdminUser';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminLoginPage from '@/pages/admin/AdminLoginPage';
import AdminOverviewPage from '@/pages/admin/AdminOverviewPage';
import AdminBusinessesPage from '@/pages/admin/AdminBusinessesPage';
import DashboardPage from '@/pages/DashboardPage';
import InventoryPage from '@/pages/InventoryPage';
import AddItemPage from '@/pages/AddItemPage';
import EditItemPage from '@/pages/EditItemPage';
import AlertsPage from '@/pages/AlertsPage';
import SalesHistoryPage from '@/pages/SalesHistoryPage';
import SettingsPage from '@/pages/SettingsPage';
import ReportsPage from '@/pages/ReportsPage';
import CloseStockPage from '@/pages/CloseStockPage';
import StockSessionsPage from '@/pages/StockSessionsPage';
import StockSessionDetailPage from '@/pages/StockSessionDetailPage';
import CreditsPage from '@/pages/CreditsPage';
import EngineersPage from '@/pages/EngineersPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <div className="flex h-screen items-center justify-center text-primary">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const q = useBusinessProfileQuery(user?.id);
  const { data: isAdmin, isLoading: adminLoading } = useIsAdminUser(user?.id);
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

export default function App() {
  const { setSession, setLoading, user } = useAuthStore();

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

  // Sync on mount and on reconnect
  useEffect(() => {
    if (!user) return;

    const sync = async () => {
      try {
        await flushSyncQueue();
      } catch (err) {
        console.error('[sync] flush failed', err);
      }
      await pullAllRemoteShopData(user.id);
    };

    sync();

    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, [user]);

  return (
    <Routes>
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
        path="/"
        element={
          <ProtectedRoute>
            <OnboardingGate>
              <AppLayout />
            </OnboardingGate>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="inventory/new" element={<AddItemPage />} />
        <Route path="inventory/:id/edit" element={<EditItemPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="sales" element={<SalesHistoryPage />} />
        <Route path="credits" element={<CreditsPage />} />
        <Route path="engineers" element={<EngineersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/stock-sessions" element={<StockSessionsPage />} />
        <Route path="reports/stock-sessions/:sessionId" element={<StockSessionDetailPage />} />
        <Route path="stock/close/:sessionId" element={<CloseStockPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
