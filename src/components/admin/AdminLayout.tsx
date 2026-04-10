import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, LogOut, Shield } from 'lucide-react';
import { signOutApp } from '@/lib/signOutApp';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-white/12 text-white shadow-sm' : 'text-slate-400 hover:bg-white/6 hover:text-white'
  }`;

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOutApp();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-svh flex bg-slate-100/90">
      <aside className="flex w-56 sm:w-64 bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex-col shrink-0 border-r border-white/5 shadow-xl shadow-slate-900/20">
        <div className="p-5 border-b border-white/8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25">
            <Shield size={20} />
          </div>
          <div>
            <p className="font-heading font-bold text-sm leading-tight tracking-tight">VillageStock</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Admin</p>
          </div>
        </div>
        <nav className="p-3 space-y-1 flex-1">
          <NavLink to="/admin" end className={linkClass}>
            <LayoutDashboard size={18} className="opacity-90" />
            Overview
          </NavLink>
          <NavLink to="/admin/businesses" className={linkClass}>
            <Building2 size={18} className="opacity-90" />
            Businesses
          </NavLink>
        </nav>
        <div className="p-3 border-t border-white/8">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-white/6 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-5 sm:p-6 lg:p-8 xl:p-10 overflow-auto max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
