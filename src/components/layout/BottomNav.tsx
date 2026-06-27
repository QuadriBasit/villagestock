import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Plus, Zap } from 'lucide-react';
import { useTrialAccess } from '@/hooks/useTrialAccess';
import { cn } from '@/lib/utils';

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
      className="bottom-nav-animated fixed bottom-[max(0.4rem,env(safe-area-inset-bottom,0px))] left-2.5 right-2.5 z-40 flex h-[3.45rem] items-center justify-around overflow-visible rounded-2xl border border-shell-line bg-shell-bg/92 px-1 shadow-lg shadow-black/20 backdrop-blur-xl lg:hidden"
      aria-label="Primary"
    >
      {LEFT_NAV.map(({ to, icon: Icon, label }) => (
        <NavItem key={to} to={to} icon={Icon} label={label} />
      ))}

      <span className={cn('fab-pulse-host -mt-7', mutationsBlocked && 'fab-pulse-host--off')}>
        <button
          type="button"
          onClick={() => !mutationsBlocked && navigate('/inventory?add=1')}
          disabled={mutationsBlocked}
          className={cn(
            'relative z-[1] flex h-[3.1rem] w-[3.1rem] items-center justify-center rounded-full shadow-md ring-4 ring-shell-bg transition-transform active:scale-95',
            mutationsBlocked
              ? 'cursor-not-allowed bg-shell-surface-2 text-shell-muted opacity-50'
              : 'shell-accent-bg text-[#160a2e] hover:brightness-105',
          )}
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
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
              isActive ? 'shell-accent-subtle shell-accent-text-soft' : 'text-shell-muted',
            )}
          >
            <Icon size={19} strokeWidth={isActive ? 2.35 : 1.85} />
          </span>
          <span
            className={cn(
              'max-w-[3.25rem] truncate text-center text-[8px] font-bold uppercase leading-none tracking-tight',
              isActive ? 'shell-accent-text-soft' : 'text-shell-muted',
            )}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}
