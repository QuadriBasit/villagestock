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
              ? 'border-primary bg-primary text-white dark:border-primary dark:bg-primary'
              : 'border-zinc-200/90 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
