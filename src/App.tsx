import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import LandingPage from '@/pages/LandingPage';
import { useBusinessProfileQuery } from '@/hooks/useBusinessProfileQuery';
import { useIsAdminUser } from '@/hooks/useIsAdminUser';
import { useShopAccess } from '@/context/ShopAccessContext';
import { RequirePermission } from '@/components/auth/RequirePermission';
import { ShopAccessProvider, ShopSyncEffects } from '@/context/ShopAccessContext';
import { ShopLocationProvider } from '@/context/ShopLocationContext';
import { AppLoadingScreen } from '@/components/ui/AppLoadingScreen';

const AppLayout = lazy(() => import('@/components/layout/AppLayout'));
const AuthPage = lazy(() => import('@/pages/AuthPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'));
const AdminLoginPage = lazy(() => import('@/pages/admin/AdminLoginPage'));
const AdminOverviewPage = lazy(() => import('@/pages/admin/AdminOverviewPage'));
const AdminBusinessesPage = lazy(() => import('@/pages/admin/AdminBusinessesPage'));
const AdminSubscriptionsPage = lazy(() => import('@/pages/admin/AdminSubscriptionsPage'));
const AdminTrialsPage = lazy(() => import('@/pages/admin/AdminTrialsPage'));
const AdminRevenuePage = lazy(() => import('@/pages/admin/AdminRevenuePage'));
const AdminActivityPage = lazy(() => import('@/pages/admin/AdminActivityPage'));
const AdminHealthPage = lazy(() => import('@/pages/admin/AdminHealthPage'));
const AdminSignupsPage = lazy(() => import('@/pages/admin/AdminSignupsPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const InventoryPage = lazy(() => import('@/pages/InventoryPage'));
const AddItemPage = lazy(() => import('@/pages/AddItemPage'));
const EditItemPage = lazy(() => import('@/pages/EditItemPage'));
const ItemDetailPage = lazy(() => import('@/pages/ItemDetailPage'));
const AlertsPage = lazy(() => import('@/pages/AlertsPage'));
const SalesHistoryPage = lazy(() => import('@/pages/SalesHistoryPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const CloseStockPage = lazy(() => import('@/pages/CloseStockPage'));
const OpenStockPage = lazy(() => import('@/pages/OpenStockPage'));
const StockSessionsPage = lazy(() => import('@/pages/StockSessionsPage'));
const StockSessionDetailPage = lazy(() => import('@/pages/StockSessionDetailPage'));
const CreditsPage = lazy(() => import('@/pages/CreditsPage'));
const RepairPage = lazy(() => import('@/pages/RepairPage'));
const AuditLogPage = lazy(() => import('@/pages/AuditLogPage'));
const QuickTillPage = lazy(() => import('@/pages/QuickTillPage'));
const PriceListPage = lazy(() => import('@/pages/PriceListPage'));
const CashUpPage = lazy(() => import('@/pages/CashUpPage'));
const ContactsPage = lazy(() => import('@/pages/ContactsPage'));
const PurchasingPage = lazy(() => import('@/pages/PurchasingPage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <AppLoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const { status: shopStatus, shopOwnerId } = useShopAccess();
  const q = useBusinessProfileQuery(shopStatus === 'ready' ? shopOwnerId ?? undefined : undefined);
  const { data: isAdmin, isLoading: adminLoading } = useIsAdminUser(user?.id);
  if (user && (shopStatus === 'loading' || shopStatus === 'idle')) {
    return <AppLoadingScreen />;
  }
  if (q.status === 'pending' || (user && adminLoading)) {
    return <AppLoadingScreen />;
  }
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  if (!q.profile?.onboarding_complete) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

function PermissionRoute({ children }: { children: React.ReactNode }) {
  return <RequirePermission>{children}</RequirePermission>;
}

function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  const { data: isAdmin, isLoading: checking } = useIsAdminUser(user?.id);
  if (isLoading || (user && checking)) {
    return <AppLoadingScreen label="Loading admin…" />;
  }
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }
  if (!isAdmin) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-shell-bg px-6 text-center">
        <p className="font-display font-semibold text-shell-ink">Admin access only</p>
        <p className="mt-2 max-w-sm text-sm text-shell-muted">
          This account is not in the admin roster. Use the main app to manage your shop.
        </p>
        <a href="/auth" className="mt-6 text-sm font-medium text-brand-300 hover:underline">
          Retailer sign-in
        </a>
      </div>
    );
  }
  return <>{children}</>;
}

function RouteFallback() {
  return <AppLoadingScreen />;
}

/** Signed-in users should never see the marketing landing page. */
function LandingRoute() {
  const { user, isLoading } = useAuthStore();
  const { status: shopStatus, shopOwnerId } = useShopAccess();
  const q = useBusinessProfileQuery(shopStatus === 'ready' ? shopOwnerId ?? undefined : undefined);

  if (isLoading) return <AppLoadingScreen label="Loading…" />;
  if (!user) return <LandingPage />;
  if (shopStatus === 'loading' || shopStatus === 'idle') return <AppLoadingScreen label="Loading…" />;
  if (q.status === 'pending') return <AppLoadingScreen label="Loading…" />;
  if (q.profile?.onboarding_complete) return <Navigate to="/dashboard" replace />;
  return <Navigate to="/onboarding" replace />;
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
  const { setSession, setLoading, user } = useAuthStore();
  const previousUserIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const id = user?.id;
    const prev = previousUserIdRef.current;
    if (prev !== undefined && id !== undefined && prev !== id) {
      void import('@/lib/db').then(({ clearAllLocalShopData }) => clearAllLocalShopData());
    }
    previousUserIdRef.current = id;
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void import('@/lib/supabase').then(({ supabase }) => {
      if (!active) return;

      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!active) return;
          setSession(data.session);
        })
        .catch(() => {
          if (!active) return;
          setSession(null);
        })
        .finally(() => {
          if (!active) return;
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
  }, [setSession, setLoading]);

  return null;
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <AuthBootstrap />
      <Routes>
        <Route
          path="/"
          element={
            <ShopAccessProvider>
              <LandingRoute />
            </ShopAccessProvider>
          }
        />
        <Route
          path="/auth"
          element={
            <ShopAccessProvider>
              <AuthPage />
            </ShopAccessProvider>
          }
        />
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
          <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
          <Route path="trials" element={<AdminTrialsPage />} />
          <Route path="revenue" element={<AdminRevenuePage />} />
          <Route path="activity" element={<AdminActivityPage />} />
          <Route path="health" element={<AdminHealthPage />} />
          <Route path="signups" element={<AdminSignupsPage />} />
        </Route>
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <RetailAppProviders>
                <OnboardingPage />
              </RetailAppProviders>
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
          <Route path="till" element={<PermissionRoute><QuickTillPage /></PermissionRoute>} />
          <Route path="inventory" element={<PermissionRoute><InventoryPage /></PermissionRoute>} />
          <Route path="inventory/new" element={<PermissionRoute><AddItemPage /></PermissionRoute>} />
          <Route path="inventory/:id/edit" element={<PermissionRoute><EditItemPage /></PermissionRoute>} />
          <Route path="inventory/:id" element={<PermissionRoute><ItemDetailPage /></PermissionRoute>} />
          <Route path="alerts" element={<PermissionRoute><AlertsPage /></PermissionRoute>} />
          <Route path="sales" element={<PermissionRoute><SalesHistoryPage /></PermissionRoute>} />
          <Route path="share" element={<PermissionRoute><PriceListPage /></PermissionRoute>} />
          <Route
            path="cashup"
            element={
              <PermissionRoute>
                <CashUpPage />
              </PermissionRoute>
            }
          />
          <Route path="contacts" element={<PermissionRoute><ContactsPage /></PermissionRoute>} />
          <Route
            path="purchasing"
            element={
              <PermissionRoute>
                <PurchasingPage />
              </PermissionRoute>
            }
          />
          <Route
            path="analytics"
            element={
              <PermissionRoute>
                <AnalyticsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="audit-log"
            element={
              <PermissionRoute>
                <AuditLogPage />
              </PermissionRoute>
            }
          />
          <Route
            path="credits"
            element={
              <PermissionRoute>
                <CreditsPage />
              </PermissionRoute>
            }
          />
          <Route path="repair" element={<PermissionRoute><RepairPage /></PermissionRoute>} />
          <Route path="repairs" element={<Navigate to="/repair" replace />} />
          <Route path="engineers" element={<Navigate to="/repair" replace />} />
          <Route
            path="reports"
            element={
              <PermissionRoute>
                <ReportsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="reports/stock-sessions"
            element={
              <PermissionRoute>
                <StockSessionsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="reports/stock-sessions/:sessionId"
            element={
              <PermissionRoute>
                <StockSessionDetailPage />
              </PermissionRoute>
            }
          />
          <Route
            path="stock/open/:sessionId"
            element={
              <PermissionRoute>
                <OpenStockPage />
              </PermissionRoute>
            }
          />
          <Route
            path="stock/close/:sessionId"
            element={
              <PermissionRoute>
                <CloseStockPage />
              </PermissionRoute>
            }
          />
          <Route
            path="settings"
            element={
              <PermissionRoute>
                <SettingsPage />
              </PermissionRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
