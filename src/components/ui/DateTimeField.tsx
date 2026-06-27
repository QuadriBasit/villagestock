import { DatePickerField } from '@/components/ui/DatePickerField';
import { Label } from '@/components/ui/Label';
import { TimePickerField } from '@/components/ui/TimePickerField';
import { cn } from '@/lib/utils';

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseLocalDatetime(iso: string | undefined): { date: string; time: string } {
  const base = (iso?.trim() || toLocalDatetimeValue(new Date())).slice(0, 16);
  const t = base.indexOf('T');
  if (t === -1) {
    const d = base.slice(0, 10) || new Date().toISOString().slice(0, 10);
    return { date: d, time: '12:00' };
  }
  const date = base.slice(0, t);
  const timeRaw = base.slice(t + 1);
  const time = timeRaw.length >= 5 ? timeRaw.slice(0, 5) : '12:00';
  return { date, time };
}

export interface DateTimeFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (localDatetime: string) => void;
  disabled?: boolean;
  className?: string;
  hint?: string;
}

export function DateTimeField({
  id,
  label,
  value,
  onChange,
  disabled,
  className,
  hint,
}: DateTimeFieldProps) {
  const { date, time } = parseLocalDatetime(value);

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="mb-1 block text-sm font-medium text-shell-muted">{label}</Label>
      {hint ? (
        <p className="mb-3 text-[11px] leading-snug text-shell-muted">{hint}</p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DatePickerField
          id={id ? `${id}_date` : undefined}
          label="Date"
          value={date}
          onChange={ymd => onChange(`${ymd}T${time}`)}
          disabled={disabled}
        />
        <TimePickerField
          id={id ? `${id}_time` : undefined}
          label="Time"
          value={time}
          onChange={next => onChange(`${date}T${next}`)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export { toLocalDatetimeValue };
