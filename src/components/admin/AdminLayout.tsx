import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  Activity,
  Building2,
  Clock,
  CreditCard,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Shield,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { signOutApp } from '@/lib/signOutApp';
import { cn } from '@/lib/utils';
import { ShellAccentSync } from '@/components/layout/ShellAccentSync';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-violet-500/15 text-violet-200 shadow-sm ring-1 ring-violet-400/20'
      : 'text-shell-muted hover:bg-shell-surface-2/60 hover:text-shell-ink',
  );

function NavSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-shell-muted/80">{label}</p>
      {children}
    </div>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOutApp();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="app-shell dark flex min-h-svh bg-shell-bg font-body text-shell-ink">
      <ShellAccentSync />
      <aside className="flex w-56 shrink-0 flex-col border-r border-shell-line bg-[#0e1320] sm:w-64">
        <div className="flex items-center gap-3 border-b border-shell-line p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/25">
            <Shield size={20} />
          </div>
          <div>
            <p className="font-display text-sm font-bold leading-tight tracking-tight">VillageStock</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-shell-muted">Admin</p>
          </div>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          <NavSection label="Monitor">
            <NavLink to="/admin" end className={linkClass}>
              <LayoutDashboard size={18} className="opacity-90" />
              Overview
            </NavLink>
            <NavLink to="/admin/activity" className={linkClass}>
              <Activity size={18} className="opacity-90" />
              Activity
            </NavLink>
            <NavLink to="/admin/health" className={linkClass}>
              <HeartPulse size={18} className="opacity-90" />
              Health
            </NavLink>
            <NavLink to="/admin/signups" className={linkClass}>
              <UserPlus size={18} className="opacity-90" />
              Signups
            </NavLink>
          </NavSection>
          <NavSection label="Accounts">
            <NavLink to="/admin/businesses" className={linkClass}>
              <Building2 size={18} className="opacity-90" />
              Businesses
            </NavLink>
            <NavLink to="/admin/subscriptions" className={linkClass}>
              <CreditCard size={18} className="opacity-90" />
              Subscriptions
            </NavLink>
            <NavLink to="/admin/trials" className={linkClass}>
              <Clock size={18} className="opacity-90" />
              Trials
            </NavLink>
          </NavSection>
          <NavSection label="Revenue">
            <NavLink to="/admin/revenue" className={linkClass}>
              <Wallet size={18} className="opacity-90" />
              Revenue
            </NavLink>
          </NavSection>
        </nav>
        <div className="border-t border-shell-line p-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-shell-muted transition-colors hover:bg-shell-surface-2/60 hover:text-shell-ink"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-[1600px] flex-1 overflow-auto p-5 sm:p-6 lg:p-8 xl:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
