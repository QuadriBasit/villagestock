import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

type StatCardProps = {
  label: string;
  value: string;
  icon?: LucideIcon;
  iconClassName?: string;
  hint?: string;
  hintClassName?: string;
};

export function StatCard({ label, value, icon: Icon, iconClassName, hint, hintClassName }: StatCardProps) {
  return (
    <Card className="border-shell-line bg-shell-surface">
      <CardContent className="flex flex-col gap-3 p-4 md:p-5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium text-shell-muted">{label}</span>
          {Icon ? (
            <span
              className={cn(
                'grid size-8 place-items-center rounded-lg bg-shell-surface-2 text-brand-300',
                iconClassName
              )}
            >
              <Icon size={16} strokeWidth={2} />
            </span>
          ) : null}
        </div>
        <div>
          <div className="font-display text-xl font-bold tabular-nums tracking-tight text-shell-ink md:text-2xl">
            {value}
          </div>
          {hint ? (
            <div className={cn('mt-1 text-xs font-semibold', hintClassName ?? 'text-shell-muted')}>
              {hint}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
      {children}
    </div>
  );
}
