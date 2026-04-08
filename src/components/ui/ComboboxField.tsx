import { type InputHTMLAttributes, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const labelCls = 'mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200';
const errorCls = 'mt-1 text-xs text-red-500';

const baseInputCls =
  'w-full rounded-lg border bg-white px-3 py-2.5 pr-9 text-sm text-zinc-900 transition focus:outline-none focus:ring-2 dark:bg-zinc-900/80 dark:text-zinc-100';

export type ComboboxFieldProps = {
  id: string;
  label: string;
  options: readonly string[];
  error?: string;
  emptyHint?: string;
  /** Class on the outer field wrapper */
  wrapperClassName?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'list'>;

/**
 * Native combobox: `<input list="…">` + `<datalist>` — pick a suggestion or type freely.
 * Border/background show whether the current value matches the quick list or is custom.
 */
export function ComboboxField({
  id,
  label,
  options,
  error,
  emptyHint,
  wrapperClassName,
  ...inputProps
}: ComboboxFieldProps) {
  const listId = `${id}-datalist`;
  const { className: inputClassName, ...restInput } = inputProps;
  const strVal =
    restInput.value === undefined || restInput.value === null ? '' : String(restInput.value);
  const trimmed = strVal.trim();

  const presetLookup = useMemo(() => new Set(options.map((o) => o.toLowerCase())), [options]);

  const matchesPreset = trimmed.length > 0 && presetLookup.has(trimmed.toLowerCase());

  const modeClass =
    trimmed.length === 0
      ? 'border-zinc-200 focus:border-primary focus:ring-primary/30 dark:border-zinc-700'
      : matchesPreset
        ? 'border-primary/50 bg-primary/[0.07] ring-1 ring-primary/30 focus:border-primary focus:ring-primary/35 dark:bg-primary/12 dark:ring-primary/35'
        : 'border-dashed border-amber-500/45 bg-amber-50/50 focus:border-amber-600 focus:ring-amber-400/25 dark:border-amber-500/40 dark:bg-amber-500/10 dark:focus:border-amber-500 dark:focus:ring-amber-500/20';

  return (
    <div className={wrapperClassName}>
      <label className={labelCls} htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          {...restInput}
          id={id}
          type="text"
          list={listId}
          autoComplete="off"
          spellCheck={false}
          className={cn(baseInputCls, modeClass, inputClassName)}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${id}-error` : trimmed ? `${id}-mode` : emptyHint ? `${id}-hint` : undefined
          }
        />
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
          aria-hidden
        />
        <datalist id={listId}>
          {options.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      </div>
      {emptyHint && !trimmed && !error && (
        <p id={`${id}-hint`} className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          {emptyHint}
        </p>
      )}
      {trimmed && !error && (
        <p
          id={`${id}-mode`}
          className={cn(
            'mt-1 text-[11px] font-medium',
            matchesPreset ? 'text-primary dark:text-violet-300' : 'text-amber-700 dark:text-amber-300'
          )}
        >
          {matchesPreset ? 'Quick list — suggestions match your text' : 'Custom name — saved as you typed'}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={errorCls}>
          {error}
        </p>
      )}
    </div>
  );
}
