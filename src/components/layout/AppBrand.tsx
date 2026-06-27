import { cn } from '@/lib/utils';

type AppBrandProps = {
  compact?: boolean;
  className?: string;
};

export function AppBrand({ compact, className }: AppBrandProps) {
  return (
    <div className={cn('flex items-center gap-[11px]', className)}>
      <div className="grid size-[38px] shrink-0 place-items-center rounded-[11px] bg-violet-400 font-display text-[19px] font-extrabold text-[#160a2e]">
        V
      </div>
      <div className={cn(compact && 'hidden min-[561px]:block')}>
        <div className="font-display text-[15.5px] font-bold leading-tight tracking-tight text-shell-ink">
          Village Stock
        </div>
        {!compact && (
          <div className="text-[11px] text-shell-muted">Computer Village OS</div>
        )}
      </div>
    </div>
  );
}
