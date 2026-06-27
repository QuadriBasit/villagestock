import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'shell-inset-field flex min-h-[5.5rem] w-full rounded-xl border border-shell-line bg-shell-surface-2/40 px-3 py-2.5 text-sm text-shell-ink outline-none placeholder:text-shell-muted transition focus:border-violet-400/45 focus:ring-2 focus:ring-violet-400/12 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export { Textarea };
