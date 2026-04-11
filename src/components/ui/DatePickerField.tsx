import { useState } from 'react';
import { format, parse, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/Calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface DatePickerFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (ymd: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePickerField({
  id,
  label,
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  className,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = value && isValid(parse(value, 'yyyy-MM-dd', new Date()))
    ? parse(value, 'yyyy-MM-dd', new Date())
    : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            id={id}
            variant="outline"
            disabled={disabled}
            className={cn(
              'h-11 w-full justify-start gap-2 rounded-xl border-zinc-200 bg-white px-3 font-normal shadow-sm dark:border-zinc-700 dark:bg-zinc-900/95',
              !value && 'text-zinc-500 dark:text-zinc-400'
            )}
          >
            <CalendarIcon className="size-4 shrink-0 opacity-70" aria-hidden />
            {selected ? format(selected, 'd MMM yyyy') : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={d => {
              if (d) {
                onChange(format(d, 'yyyy-MM-dd'));
                setOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
