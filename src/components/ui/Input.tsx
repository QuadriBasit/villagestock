import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-[#0f172a] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-zinc-600/80 dark:bg-zinc-900/60 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-primary/50 dark:focus:ring-primary/25',
          className
        )}
        {...props}
      />
    );
  }
);
