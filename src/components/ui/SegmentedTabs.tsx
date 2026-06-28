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
    <div className={cn(shellSegmentTrack, className)}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={shellSegmentBtn(value === opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
