import {
  type ChangeEvent,
  type InputHTMLAttributes,
  useMemo,
  useState,
  useRef,
  useLayoutEffect,
  useEffect,
  forwardRef,
  useCallback,
} from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/Popover';
import { Label } from '@/components/ui/Label';
import { cn } from '@/lib/utils';

const labelCls = 'mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200';
const errorCls = 'mt-1 text-xs text-red-500';

const baseInputCls =
  'h-11 w-full rounded-xl border bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm shadow-zinc-900/[0.04] ring-offset-white transition-[color,box-shadow] focus:outline-none focus:ring-2 focus:ring-offset-0 dark:bg-zinc-900/95 dark:text-zinc-100 dark:ring-offset-zinc-950';

const optionBtnCls =
  'flex w-full cursor-pointer select-none items-center rounded-lg px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-zinc-100 focus-visible:bg-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800';

export type ComboboxFieldProps = {
  id: string;
  label: string;
  options: readonly string[];
  error?: string;
  emptyHint?: string;
  wrapperClassName?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'list'>;

/**
 * Combobox: `Popover` + anchored text input + native listbox (`button` options).
 * Avoids cmdk inside a portaled popover (pointer events / dismiss layer issues).
 */
export const ComboboxField = forwardRef<HTMLInputElement, ComboboxFieldProps>(function ComboboxField(
  { id, label, options, error, emptyHint, wrapperClassName, ...inputProps },
  ref
) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [popoverWidth, setPopoverWidth] = useState<number>();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBlurTimer = useCallback(() => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  }, []);

  const isFocusInsideCombobox = useCallback(() => {
    const ae = document.activeElement;
    if (!ae) return false;
    return Boolean(rootRef.current?.contains(ae) || contentRef.current?.contains(ae));
  }, []);

  const { className: inputClassName, onChange, onBlur, onFocus, onKeyDown, value, ...restInput } = inputProps;

  const strVal = value === undefined || value === null ? '' : String(value);
  const trimmed = strVal.trim();

  const presetLookup = useMemo(() => new Set(options.map(o => o.toLowerCase())), [options]);
  const matchesPreset = trimmed.length > 0 && presetLookup.has(trimmed.toLowerCase());

  const filtered = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q) return [...options];
    return options.filter(o => o.toLowerCase().includes(q));
  }, [options, trimmed]);

  useEffect(() => {
    setHighlight(-1);
  }, [filtered]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPopoverWidth(el.offsetWidth));
    ro.observe(el);
    setPopoverWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (highlight < 0) return;
    optionRefs.current[highlight]?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const emitValue = useCallback(
    (next: string) => {
      if (!onChange) return;
      onChange({ target: { value: next } } as ChangeEvent<HTMLInputElement>);
    },
    [onChange]
  );

  const pickOption = useCallback(
    (choice: string) => {
      clearBlurTimer();
      emitValue(choice);
      setOpen(false);
      setHighlight(-1);
    },
    [clearBlurTimer, emitValue]
  );

  const modeClass =
    trimmed.length === 0
      ? 'border-zinc-200 focus:border-primary focus:ring-primary/25 dark:border-zinc-700 dark:focus:ring-primary/30'
      : matchesPreset
        ? 'border-primary/50 bg-primary/[0.07] ring-1 ring-primary/30 focus:border-primary focus:ring-primary/30 dark:bg-primary/12 dark:ring-primary/35'
        : 'border-dashed border-amber-500/45 bg-amber-50/50 focus:border-amber-600 focus:ring-amber-400/25 dark:border-amber-500/40 dark:bg-amber-500/10 dark:focus:border-amber-500 dark:focus:ring-amber-500/20';

  const showList = options.length > 0 && open;
  const listboxId = `${id}-listbox`;

  return (
    <div ref={rootRef} className={cn('relative w-full', wrapperClassName)}>
      <Label className={labelCls} htmlFor={id}>
        {label}
      </Label>
      <Popover
        modal={false}
        open={showList}
        onOpenChange={next => {
          if (!next) setOpen(false);
        }}
      >
        <PopoverAnchor asChild>
          <div className="relative">
            <input
              {...restInput}
              ref={ref}
              id={id}
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={strVal}
              role="combobox"
              aria-expanded={showList}
              aria-controls={showList ? listboxId : undefined}
              aria-activedescendant={showList && highlight >= 0 ? `${id}-opt-${highlight}` : undefined}
              aria-autocomplete="list"
              className={cn(baseInputCls, trimmed ? 'pr-20' : 'pr-10', modeClass, inputClassName)}
              aria-invalid={error ? true : undefined}
              aria-describedby={
                error ? `${id}-error` : trimmed ? `${id}-mode` : emptyHint ? `${id}-hint` : undefined
              }
              onChange={e => {
                onChange?.(e);
                if (options.length > 0) setOpen(true);
              }}
              onFocus={e => {
                onFocus?.(e);
                if (options.length > 0) setOpen(true);
              }}
              onBlur={e => {
                onBlur?.(e);
                clearBlurTimer();
                blurTimer.current = setTimeout(() => {
                  if (isFocusInsideCombobox()) return;
                  setOpen(false);
                }, 175);
              }}
              onKeyDown={e => {
                onKeyDown?.(e);

                if (e.key === 'Escape') {
                  setOpen(false);
                  setHighlight(-1);
                  return;
                }

                if (!showList || filtered.length === 0) return;

                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlight(h => {
                    if (h < 0) return 0;
                    return Math.min(h + 1, filtered.length - 1);
                  });
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlight(h => {
                    if (h <= 0) return filtered.length - 1;
                    return h - 1;
                  });
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (highlight >= 0 && highlight < filtered.length) {
                    pickOption(filtered[highlight]);
                    return;
                  }
                  const exact = filtered.find(o => o.toLowerCase() === trimmed.toLowerCase());
                  pickOption(exact ?? filtered[0]);
                }
              }}
            />
            {trimmed.length > 0 ? (
              <button
                type="button"
                tabIndex={-1}
                aria-label={`Clear ${label}`}
                className="absolute right-10 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                onMouseDown={e => {
                  e.preventDefault();
                  clearBlurTimer();
                  emitValue('');
                  setOpen(false);
                  setHighlight(-1);
                }}
              >
                <X strokeWidth={2} className="size-4" aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              tabIndex={-1}
              aria-label={`Show suggestions for ${label}`}
              className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              onMouseDown={e => {
                e.preventDefault();
                clearBlurTimer();
                if (options.length === 0) return;
                setOpen(o => !o);
              }}
            >
              <ChevronDown strokeWidth={2} className="size-4 opacity-60" aria-hidden />
            </button>
          </div>
        </PopoverAnchor>
        <PopoverContent
          ref={contentRef}
          id={`${id}-popover`}
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={e => e.preventDefault()}
          onCloseAutoFocus={e => e.preventDefault()}
          onMouseDown={clearBlurTimer}
          onInteractOutside={e => {
            const t = e.target as Node | null;
            if (t && rootRef.current?.contains(t)) {
              e.preventDefault();
              return;
            }
            clearBlurTimer();
          }}
          onPointerDownOutside={e => {
            const t = e.target as Node | null;
            if (t && rootRef.current?.contains(t)) {
              e.preventDefault();
            }
          }}
          className="rounded-xl border-zinc-200 p-0 dark:border-zinc-700"
          style={popoverWidth ? { width: popoverWidth } : undefined}
        >
          <div
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="max-h-[min(18rem,70vh)] touch-pan-y overflow-y-auto overscroll-y-contain p-1 outline-none [-webkit-overflow-scrolling:touch]"
          >
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No matches — your custom text will be saved.
              </div>
            ) : (
              filtered.map((opt, i) => (
                <button
                  key={`${opt}-${i}`}
                  id={`${id}-opt-${i}`}
                  ref={el => {
                    optionRefs.current[i] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  className={cn(
                    optionBtnCls,
                    i === highlight && 'bg-zinc-100 dark:bg-zinc-800',
                    trimmed.toLowerCase() === opt.toLowerCase() && 'bg-primary/10 dark:bg-primary/15'
                  )}
                                   tabIndex={-1}
                  onMouseEnter={() => setHighlight(i)}
                  onPointerDown={e => {
                    // Touch: do not preventDefault — allows scroll. Mouse: avoid input blur before click.
                    if (e.pointerType === 'mouse' && e.button === 0) e.preventDefault();
                  }}
                  onClick={() => pickOption(opt)}
                >
                  <Check
                    strokeWidth={2}
                    className={cn(
                      'mr-2 size-4 shrink-0 text-primary',
                      trimmed.toLowerCase() === opt.toLowerCase() ? 'opacity-100' : 'opacity-0'
                    )}
                    aria-hidden
                  />
                  {opt}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
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
});
