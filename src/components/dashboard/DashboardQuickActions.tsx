import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Zap,
  Share2,
  Wrench,
  Package,
  ScanLine,
  Wallet,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DashboardSectionHead } from './DashboardSectionHead';

export function DashboardQuickActions() {
  const navigate = useNavigate();

  const actions: {
    label: string;
    icon: typeof ShoppingCart;
    to: string;
    primary?: boolean;
  }[] = [
    { label: 'New sale', icon: ShoppingCart, primary: true, to: '/till' },
    { label: 'Quick till', icon: Zap, to: '/till' },
    { label: 'Price list', icon: Share2, to: '/share' },
    { label: 'Log repair', icon: Wrench, to: '/repair' },
    { label: 'Add product', icon: Package, to: '/inventory?add=1' },
    { label: 'Stock-take', icon: ScanLine, to: '/reports/stock-sessions' },
  ];

  return (
    <Card className="border-shell-line bg-gradient-to-br from-violet-400/[0.18] to-shell-surface">
      <CardContent className="p-4 md:p-5">
        <DashboardSectionHead title="Quick actions" />
        <div className="grid grid-cols-2 gap-2.5">
          {actions.map(({ label, icon: Icon, primary, to }) => (
            <Button
              key={label}
              type="button"
              variant={primary ? 'default' : 'outline'}
              className={
                primary
                  ? 'h-10 w-full bg-violet-400 text-[#160a2e] hover:bg-violet-300'
                  : 'h-10 w-full border-shell-line bg-shell-surface-2 text-shell-ink hover:bg-shell-surface'
              }
              onClick={() => navigate(to)}
            >
              <Icon size={16} />
              {label}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="mt-3 h-9 w-full text-shell-muted hover:text-shell-ink"
          onClick={() => navigate('/cashup')}
        >
          <Wallet size={16} />
          Cash desk & expenses
        </Button>
      </CardContent>
    </Card>
  );
}
