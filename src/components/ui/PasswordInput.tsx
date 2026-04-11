import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className, ...props },
  ref
) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative w-full">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn(className, 'pr-10')}
        {...props}
      />
      <button
        type="button"
        className={cn(
          'absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5',
          'text-muted hover:bg-black/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          'dark:text-zinc-400 dark:hover:bg-white/10 dark:focus-visible:ring-primary/35'
        )}
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={18} strokeWidth={2} aria-hidden /> : <Eye size={18} strokeWidth={2} aria-hidden />}
      </button>
    </div>
  );
});
