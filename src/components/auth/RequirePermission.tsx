import { Navigate, useLocation } from 'react-router-dom';
import { useShopAccess } from '@/context/ShopAccessContext';
import { AppLoadingScreen } from '@/components/ui/AppLoadingScreen';
import {
  canAccessPath,
  hasAnyShopPermission,
  permissionKeysForPath,
  type ShopPermissionKey,
} from '@/lib/shopPermissions';

type RequirePermissionProps = {
  permission?: ShopPermissionKey | ShopPermissionKey[];
  children: React.ReactNode;
  redirectTo?: string;
};

export function RequirePermission({
  permission,
  children,
  redirectTo = '/dashboard',
}: RequirePermissionProps) {
  const { status, permissions, isOwner } = useShopAccess();
  const location = useLocation();

  if (status !== 'ready') return <AppLoadingScreen label="Loading access…" />;
  if (isOwner) return <>{children}</>;

  const required =
    permission ??
    permissionKeysForPath(location.pathname) ??
    null;

  if (!required) return <>{children}</>;

  if (hasAnyShopPermission(permissions, required)) {
    return <>{children}</>;
  }

  if (canAccessPath(redirectTo, permissions)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

export function AccessDeniedCard({ title = 'Access restricted' }: { title?: string }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-shell-line bg-shell-surface-2/40 px-5 py-6 text-center">
      <p className="font-display text-base font-semibold text-shell-ink">{title}</p>
      <p className="mt-2 text-sm text-shell-muted">
        Your role does not include permission for this area. Ask the shop owner to update your role in
        Settings.
      </p>
    </div>
  );
}
