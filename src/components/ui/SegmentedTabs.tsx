import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { shellSegmentBtn, shellSegmentTrack } from '@/components/settings/settingsUi';

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
    <div className={cn(shellSegmentTrack, 'inline-flex w-fit max-w-full', className)}>
      {options.map(opt => (
        <Button
          key={opt.value}
          type="button"
          variant="ghost"
          onClick={() => onChange(opt.value)}
          className={cn(shellSegmentBtn(value === opt.value), 'h-auto shadow-none active:scale-100')}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
