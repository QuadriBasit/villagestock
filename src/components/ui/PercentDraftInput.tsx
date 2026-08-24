import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

type PercentDraftInputProps = {
  id?: string;
  value?: number;
  onChange: (value: number | undefined) => void;
  onBlur?: () => void;
  min?: number;
  max?: number;
  /** Applied on blur when the field was cleared while typing. */
  emptyDefault?: number;
  className?: string;
  placeholder?: string;
  suffix?: string;
};

export function PercentDraftInput({
  id,
  value,
  onChange,
  onBlur,
  min = 0,
  max = 100,
  emptyDefault,
  className,
  placeholder,
  suffix,
}: PercentDraftInputProps) {
  const [draft, setDraft] = useState(value != null ? String(value) : '');

  useEffect(() => {
    setDraft(value != null ? String(value) : '');
  }, [value]);

  const commit = (raw: string) => {
    if (raw === '') {
      if (emptyDefault != null) {
        setDraft(String(emptyDefault));
        onChange(emptyDefault);
        return;
      }
      setDraft('');
      onChange(undefined);
      return;
    }

    const n = Math.min(max, Math.max(min, Number(raw)));
    setDraft(String(n));
    onChange(n);
  };

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={draft}
        onChange={e => {
          const raw = e.target.value.replace(/[^\d]/g, '');
          setDraft(raw);
          if (raw === '') return;
          const n = Number(raw);
          if (n <= max) onChange(n);
        }}
        onBlur={() => {
          commit(draft);
          onBlur?.();
        }}
        className={cn(suffix && 'pr-8', className)}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-shell-muted">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}
