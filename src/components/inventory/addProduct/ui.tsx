import { useState, type ComponentProps, type ReactNode } from 'react';
import { AlertTriangle, Check, Hash, Laptop, Plus, Smartphone, Tag } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import type { ProductCat } from './types';

const fieldClass =
  'shell-inset-field w-full rounded-[10px] border border-shell-line bg-shell-surface-2/40 px-3 py-2.5 text-sm text-shell-ink outline-none placeholder:text-shell-muted focus:border-shell-muted/60';

export function APTextField({ className, ...props }: ComponentProps<typeof Input>) {
  return <Input className={cn(fieldClass, className)} {...props} />;
}

export function APLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-shell-muted">{label}</span>
        {hint ? <span className="text-[11.5px] text-shell-muted/80">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

export function APChoiceStack<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string; hint?: string }[];
  value: T | '';
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {options.map(o => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-[11px] border px-3.5 py-2.5 text-left transition-colors',
              on
                ? 'border-violet-400/40 bg-violet-400/10'
                : 'border-shell-line bg-shell-surface-2/40 hover:border-shell-muted/40',
            )}
          >
            <span className={cn('block text-[13.5px] font-semibold', on ? 'text-violet-200' : 'text-shell-ink')}>
              {o.label}
            </span>
            {o.hint ? (
              <span className="mt-0.5 block text-[11.5px] leading-snug text-shell-muted">{o.hint}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function APSeg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[] | readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-[11px] border border-shell-line bg-shell-surface-2/40 p-1">
      {options.map(o => {
        const v = typeof o === 'object' ? o.value : o;
        const l = typeof o === 'object' ? o.label : o;
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              'flex-1 rounded-lg px-1.5 py-2 text-[13px] font-semibold leading-tight transition-colors',
              on ? 'bg-violet-400 text-[#160a2e]' : 'text-shell-muted hover:text-shell-ink',
            )}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

export function APMulti({
  options,
  value,
  onChange,
  addLabel,
  single = false,
}: {
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
  addLabel?: string;
  single?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const toggle = (o: string) => {
    if (single) {
      onChange(value.includes(o) ? [] : [o]);
      return;
    }
    onChange(value.includes(o) ? value.filter(x => x !== o) : [...value, o]);
  };
  const all = [...options, ...value.filter(v => !options.includes(v))];

  const commitDraft = () => {
    const trimmed = draft.trim();
    if (trimmed) onChange(single ? [trimmed] : [...value, trimmed]);
    setDraft('');
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {all.map(o => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors',
              on
                ? 'bg-violet-400 text-[#160a2e]'
                : 'border border-shell-line bg-shell-surface-2/40 text-shell-ink hover:bg-shell-surface-2',
            )}
          >
            {on ? <Check size={13} strokeWidth={2.6} /> : null}
            {o}
          </button>
        );
      })}
      {adding ? (
        <APTextField
          autoFocus
          value={draft}
          placeholder={addLabel || 'Add…'}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commitDraft();
            if (e.key === 'Escape') {
              setAdding(false);
              setDraft('');
            }
          }}
          onBlur={commitDraft}
          className="w-[120px] rounded-full px-3 py-2"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-shell-line bg-transparent px-3 py-2 text-[13px] font-semibold text-shell-muted hover:text-shell-ink"
        >
          <Plus size={13} strokeWidth={2.2} />
          {addLabel || 'Add'}
        </button>
      )}
    </div>
  );
}

export function APStepper({
  value,
  onChange,
  min = 0,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-shell-line bg-shell-surface-2/40">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="grid h-8 w-[30px] place-items-center font-mono text-lg text-shell-ink hover:bg-shell-surface-2"
      >
        −
      </button>
      <span className="min-w-[26px] text-center font-mono text-[13.5px] font-semibold text-shell-ink">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="grid h-8 w-[30px] place-items-center font-mono text-lg text-shell-ink hover:bg-shell-surface-2"
      >
        +
      </button>
    </div>
  );
}

export function APMoney({
  value,
  onChange,
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
}) {
  return (
    <CurrencyInput
      value={value || undefined}
      onValueChange={v => onChange(v ?? 0)}
      placeholder={placeholder || '0'}
      className={fieldClass}
    />
  );
}

export function APMsg({ code, title, text }: { code: string; title: string; text: string }) {
  return (
    <div className="-mt-1.5 flex items-start gap-2.5 rounded-[11px] border border-amber-400/30 bg-amber-400/10 px-3 py-2.5">
      <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-300" />
      <p className="text-[12.5px] leading-relaxed text-shell-ink">
        <b>
          {code} — {title}.
        </b>{' '}
        {text}
      </p>
    </div>
  );
}

export function APToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-[42px] shrink-0 rounded-full border-none transition-colors',
        checked ? 'bg-violet-400' : 'bg-shell-line',
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] size-[18px] rounded-full bg-white transition-[left]',
          checked ? 'left-[21px]' : 'left-[3px]',
        )}
      />
    </button>
  );
}

export function CategoryPicker({
  cat,
  onChange,
  disabled,
}: {
  cat: ProductCat;
  onChange: (cat: ProductCat) => void;
  disabled?: boolean;
}) {
  const options: { key: ProductCat; label: string; icon: typeof Smartphone }[] = [
    { key: 'Phone', label: 'Phone', icon: Smartphone },
    { key: 'Laptop', label: 'Laptop', icon: Laptop },
    { key: 'Accessory', label: 'Accessory', icon: Tag },
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {options.map(({ key, label, icon: Icon }) => {
        const on = cat === key;
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(key)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-[13px] border px-2.5 py-4 transition-colors',
              disabled && 'cursor-default opacity-70',
              on
                ? 'border-violet-400/60 bg-violet-400/10 text-shell-ink'
                : 'border-shell-line bg-shell-surface-2/40 text-shell-muted hover:text-shell-ink',
            )}
          >
            <Icon size={22} strokeWidth={1.75} />
            <span className="text-[13.5px] font-semibold">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TrackToggle({
  idType,
  track,
  onChange,
}: {
  idType: 'IMEI' | 'Serial';
  track: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-shell-line bg-shell-surface-2/40 px-3.5 py-3">
      <div className="flex items-center gap-2.5">
        <Hash size={17} className="text-violet-400" />
        <div>
          <p className="text-[13.5px] font-semibold text-shell-ink">Track {idType} per unit</p>
          <p className="text-[11.5px] text-shell-muted">Record each handset&apos;s unique {idType}</p>
        </div>
      </div>
      <APToggle checked={track} onChange={onChange} />
    </div>
  );
}

export function StepProgress({ steps, step }: { steps: string[]; step: number }) {
  return (
    <div className="mt-4 flex gap-1.5">
      {steps.map((st, i) => (
        <div key={st} className="min-w-0 flex-1">
          <div
            className={cn('h-1 rounded-full transition-colors', i <= step ? 'bg-violet-400' : 'bg-shell-line')}
          />
          <p
            className={cn(
              'mt-1.5 truncate text-[11px] font-semibold',
              i === step ? 'text-shell-ink' : 'text-shell-muted',
            )}
          >
            {st}
          </p>
        </div>
      ))}
    </div>
  );
}

export function VariantTable({
  variants,
  totalUnits,
  stockValue,
  onQty,
  onPrice,
  lockQty,
  existingStock,
}: {
  variants: { label: string; qty: number; price: number }[];
  totalUnits: number;
  stockValue: number;
  onQty: (i: number, qty: number) => void;
  onPrice: (i: number, price: number) => void;
  lockQty?: boolean;
  /** In-stock count already on hand per variant label. */
  existingStock?: Record<string, number>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-shell-line">
      <div className="grid grid-cols-[1fr_96px_1fr] gap-2.5 bg-shell-surface-2/60 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-shell-muted">
        <span>Variant</span>
        <span className="text-center">Qty</span>
        <span>Price</span>
      </div>
      {variants.map((v, i) => (
        <div
          key={v.label}
          className="grid grid-cols-[1fr_96px_1fr] items-center gap-2.5 border-t border-shell-line px-3.5 py-2.5"
        >
          <div className="min-w-0">
            <span className="text-[13.5px] font-semibold text-shell-ink">{v.label}</span>
            {existingStock?.[v.label] ? (
              <p className="text-[11px] text-emerald-400">{existingStock[v.label]} in stock</p>
            ) : null}
          </div>
          <div className="flex justify-center">
            {lockQty ? (
              <span className="font-mono text-[13.5px] font-semibold text-shell-ink">{v.qty}</span>
            ) : (
              <APStepper value={v.qty} onChange={n => onQty(i, n)} min={0} />
            )}
          </div>
          <APMoney value={v.price} onChange={n => onPrice(i, n)} />
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-shell-line bg-shell-surface-2/60 px-3.5 py-2.5 text-[12.5px] text-shell-muted">
        <span>
          {variants.length} variants · {totalUnits} units
        </span>
        <span className="font-mono font-semibold text-shell-ink">{formatCurrency(stockValue)}</span>
      </div>
    </div>
  );
}

export { fieldClass };
