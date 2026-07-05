import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

type ChoiceGridOption<T extends string> = {
  value: T;
  label: string;
};

type ChoiceGridProps<T extends string> = {
  options: ChoiceGridOption<T>[];
  value: T;
  onChange: (value: T) => void;
  columns?: 2 | 3;
  className?: string;
};

export function ChoiceGrid<T extends string>({
  options,
  value,
  onChange,
  columns = 3,
  className,
}: ChoiceGridProps<T>) {
  return (
    <div
      className={cn(
        'grid divide-x divide-shell-line overflow-hidden rounded-lg border border-shell-line',
        columns === 2 ? 'grid-cols-2' : 'grid-cols-3',
        className,
      )}
    >
      {options.map(opt => (
        <Button
          key={opt.value}
          type="button"
          variant="ghost"
          onClick={() => onChange(opt.value)}
          className={cn(
            'h-auto rounded-none py-2.5 text-xs font-medium shadow-none active:scale-100',
            value === opt.value
              ? 'bg-shell-surface-2 text-shell-ink'
              : 'text-shell-muted hover:bg-shell-surface-2/40 hover:text-shell-ink',
          )}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
