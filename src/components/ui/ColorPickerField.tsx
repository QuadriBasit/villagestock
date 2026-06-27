import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { cn } from '@/lib/utils';

export interface ColorPickerFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Hex color with swatch picker — native color input lives only in this wrapper. */
export function ColorPickerField({ id, label, value, onChange, className }: ColorPickerFieldProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label htmlFor={id ? `${id}_hex` : undefined} className="text-xs font-medium text-shell-muted">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <label
          htmlFor={id ? `${id}_swatch` : undefined}
          className="relative flex h-10 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-border bg-white p-1 dark:border-zinc-600/80 dark:bg-zinc-900/60"
          aria-label={`${label} swatch`}
        >
          <span
            className="size-full rounded-md border border-black/10"
            style={{ backgroundColor: value }}
            aria-hidden
          />
          <input
            id={id ? `${id}_swatch` : undefined}
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <Input
          id={id ? `${id}_hex` : undefined}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="font-mono uppercase"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
