import { cn } from '@/lib/utils';

type SegmentedTabsProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedTabsProps<T>) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors md:text-sm',
            value === opt.value
              ? 'border-violet-400/40 bg-violet-500 text-white'
              : 'border-shell-line bg-shell-surface text-shell-muted hover:border-shell-muted/50 hover:text-shell-ink'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
