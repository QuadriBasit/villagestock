import { Label } from '@/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function parseTime(value: string): { hour: string; minute: string } {
  const raw = (value || '12:00').trim();
  const [h = '12', m = '00'] = raw.split(':');
  const hour = HOURS.includes(h.padStart(2, '0')) ? h.padStart(2, '0') : '12';
  const minute = MINUTES.includes(m.padStart(2, '0')) ? m.padStart(2, '0') : '00';
  return { hour, minute };
}

export interface TimePickerFieldProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (hhmm: string) => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}

export function TimePickerField({
  id,
  label = 'Time',
  value,
  onChange,
  disabled,
  className,
  triggerClassName,
}: TimePickerFieldProps) {
  const { hour, minute } = parseTime(value);
  const setPart = (nextHour: string, nextMinute: string) => {
    onChange(`${nextHour}:${nextMinute}`);
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <Label
          className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          htmlFor={id ? `${id}_hour` : undefined}
        >
          {label}
        </Label>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={hour}
          onValueChange={h => setPart(h, minute)}
          disabled={disabled}
        >
          <SelectTrigger
            id={id ? `${id}_hour` : undefined}
            className={cn('h-11', triggerClassName)}
            aria-label={`${label} hour`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {HOURS.map(h => (
              <SelectItem key={h} value={h}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={minute}
          onValueChange={m => setPart(hour, m)}
          disabled={disabled}
        >
          <SelectTrigger
            id={id ? `${id}_minute` : undefined}
            className={cn('h-11', triggerClassName)}
            aria-label={`${label} minute`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {MINUTES.map(m => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
