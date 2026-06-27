import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Plus, Zap } from 'lucide-react';
import { useTrialAccess } from '@/hooks/useTrialAccess';

const LEFT_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/inventory', icon: Package, label: 'Stock' },
];
const RIGHT_NAV = [
  { to: '/till', icon: Zap, label: 'Till' },
  { to: '/sales', icon: ShoppingCart, label: 'Sales' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const { mutationsBlocked } = useTrialAccess();

  return (
    <nav
      className="bottom-nav-animated fixed bottom-[max(0.4rem,env(safe-area-inset-bottom,0px))] left-2.5 right-2.5 z-40 flex h-[3.45rem] items-center justify-around overflow-visible rounded-2xl border border-zinc-200/90 bg-white/95 px-1 shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-[#111827]/96 lg:hidden"
      aria-label="Primary"
    >
      {LEFT_NAV.map(({ to, icon: Icon, label }) => (
        <NavItem key={to} to={to} icon={Icon} label={label} />
      ))}

      <span className={`fab-pulse-host -mt-7 ${mutationsBlocked ? 'fab-pulse-host--off' : ''}`}>
        <button
          type="button"
          onClick={() => !mutationsBlocked && navigate('/inventory?add=1')}
          disabled={mutationsBlocked}
          className={`relative z-[1] flex h-[3.1rem] w-[3.1rem] items-center justify-center rounded-full text-white shadow-md shadow-primary/30 ring-4 ring-white transition-transform active:scale-95 dark:ring-[#0f172a] ${
            mutationsBlocked
              ? 'cursor-not-allowed bg-zinc-400 opacity-50 grayscale'
              : 'bg-linear-to-br from-primary to-primary-dark hover:brightness-110'
          }`}
          aria-label="Add item"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      </span>

      {RIGHT_NAV.map(({ to, icon: Icon, label }) => (
        <NavItem key={to} to={to} icon={Icon} label={label} />
      ))}
    </nav>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className="group relative flex min-w-[2.75rem] flex-col items-center justify-center gap-0.5 px-1 py-0.5"
    >
      {({ isActive }) => (
        <>
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
              isActive
                ? 'bg-primary/12 text-primary dark:bg-primary/20 dark:text-violet-200'
                : 'text-zinc-500 dark:text-zinc-500'
            }`}
          >
            <Icon size={19} strokeWidth={isActive ? 2.35 : 1.85} />
          </span>
          <span
            className={`max-w-[3.25rem] truncate text-center text-[8px] font-bold uppercase leading-none tracking-tight ${
              isActive ? 'text-primary dark:text-violet-200' : 'text-zinc-500 dark:text-zinc-500'
            }`}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}
