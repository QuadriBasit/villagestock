import { type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type AnimatedAccordionProps = {
  open: boolean;
  onToggle: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  nested?: boolean;
  hideChevron?: boolean;
};

export function AnimatedAccordion({
  open,
  onToggle,
  title,
  subtitle,
  trailing,
  children,
  className,
  triggerClassName,
  contentClassName,
  nested = false,
  hideChevron = false,
}: AnimatedAccordionProps) {
  return (
    <div
      className={cn(
        'rounded-xl border transition-[border-color,background-color,box-shadow] duration-300',
        nested
          ? 'border-shell-line/80 bg-shell-surface-2/15'
          : 'border-shell-line bg-shell-surface-2/20 shadow-none',
        open && !nested && 'shell-accent-subtle-border bg-shell-surface-2/35 shadow-sm',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2',
          nested ? 'px-3 py-2' : 'px-3 py-2.5',
          triggerClassName,
        )}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className={cn('font-semibold text-shell-ink', nested ? 'text-xs' : 'text-sm')}>
              {title}
            </div>
            {subtitle ? (
              <div className={cn('mt-0.5 text-shell-muted', nested ? 'text-[10px]' : 'text-[11px]')}>
                {subtitle}
              </div>
            ) : null}
          </div>
          {!hideChevron ? (
            <ChevronDown
              size={nested ? 14 : 16}
              className={cn(
                'shrink-0 text-shell-muted transition-transform duration-300 ease-out',
                open && 'rotate-180',
              )}
            />
          ) : null}
        </button>
        {trailing ? (
          <div className="shrink-0" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
            {trailing}
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className={cn('overflow-hidden', contentClassName)}>
          <div
            className={cn(
              'border-t border-shell-line px-3 pb-3 pt-2',
              nested && 'border-shell-line/80',
              !nested && 'px-4 pb-4 pt-3',
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
