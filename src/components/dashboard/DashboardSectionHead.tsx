import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type DashboardSectionHeadProps = {
  title: string;
  action?: string;
  onAction?: () => void;
  className?: string;
};

export function DashboardSectionHead({ title, action, onAction, className }: DashboardSectionHeadProps) {
  return (
    <div className={cn('mb-3.5 flex items-center justify-between gap-2', className)}>
      <h3 className="font-display text-[15.5px] font-semibold text-shell-ink">{title}</h3>
      {action && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-violet-400 transition-colors hover:text-violet-300"
        >
          {action}
          <ChevronRight size={14} />
        </button>
      ) : null}
    </div>
  );
}
