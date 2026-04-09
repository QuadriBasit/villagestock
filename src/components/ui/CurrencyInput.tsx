import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn, formatCurrency, parseMoneyDigits } from '@/lib/utils';

export type CurrencyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'defaultValue'
> & {
  value: number | undefined;
  onValueChange: (value: number | undefined) => void;
  /**
   * When true, clearing the field sets `undefined` (optional money fields).
   * When false, clearing sets `0`.
   */
  allowEmpty?: boolean;
};

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput(
    {
      value,
      onValueChange,
      allowEmpty = false,
      className,
      disabled,
      id,
      placeholder,
      ...rest
    },
    ref
  ) {
    const display =
      value === undefined || value === null || Number.isNaN(value)
        ? allowEmpty
          ? ''
          : formatCurrency(0)
        : formatCurrency(value);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = parseMoneyDigits(e.target.value);
      if (parsed === null) {
        onValueChange(allowEmpty ? undefined : 0);
      } else {
        onValueChange(parsed);
      }
    };

    return (
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        className={cn(className)}
        value={display}
        onChange={handleChange}
        {...rest}
      />
    );
  }
);
