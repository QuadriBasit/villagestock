import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { cn } from '@/lib/utils';
import 'react-day-picker/style.css';

export type CalendarProps = DayPickerProps;

/** Shadcn-style wrapper: uses DayPicker defaults + app theme variables (see index.css `.reports-calendar`). */
function Calendar({ className, ...props }: CalendarProps) {
  return <DayPicker className={cn('reports-calendar rounded-xl border border-shell-line p-2', className)} {...props} />;
}
Calendar.displayName = 'Calendar';

export { Calendar };
