import { type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input, inputShellClass } from '@/components/ui/Input';
import { ComboboxField } from '@/components/ui/ComboboxField';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { mergeModelSuggestions, useInventoryModelNames } from '@/lib/modelNameSuggestions';
import { PURCHASE_CATEGORIES, resizeUnitIds } from '@/lib/purchasing';
import { getCategoryMode, type PurchaseLine } from '@/types';

type PurchaseLineFieldsProps = {
  lines: PurchaseLine[];
  onChange: (lines: PurchaseLine[]) => void;
  /** Selling price and IMEI/serial, shown when the goods are being stocked. */
  stockFields?: boolean;
  allowAdd?: boolean;
};

export function PurchaseLineFields({
  lines,
  onChange,
  stockFields = false,
  allowAdd = true,
}: PurchaseLineFieldsProps) {
  const inventoryNames = useInventoryModelNames();
  const setLine = (index: number, patch: Partial<PurchaseLine>) => {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-shell-muted">Items</p>
      <div className="space-y-3">
        {lines.map((line, index) => {
          const serialized = !!line.category && getCategoryMode(line.category) === 'serialized';
          const idLabel = line.category === 'laptops' ? 'Serial' : 'IMEI';
          return (
            <div key={index} className="space-y-2.5 rounded-lg border border-shell-line p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-shell-muted">
                  Item {index + 1}
                </span>
                {allowAdd ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onChange(lines.length > 1 ? lines.filter((_, i) => i !== index) : lines)}
                    disabled={lines.length <= 1}
                    className="size-8 rounded-lg text-shell-muted hover:text-shell-ink disabled:opacity-35"
                    aria-label="Remove line"
                  >
                    <X size={14} />
                  </Button>
                ) : null}
              </div>
              <ComboboxField
                id={`purchase-line-${index}-name`}
                label="Product"
                options={mergeModelSuggestions(line.category ?? 'accessories', line.brand ?? '', inventoryNames)}
                value={line.name}
                onChange={e => setLine(index, { name: e.target.value })}
                placeholder="iPhone 13, charger, screen…"
                emptyHint="Names you have used before show up here."
              />
              <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
                <Field label="Kind">
                  <Select
                    value={line.category}
                    onValueChange={category =>
                      setLine(index, {
                        category: category as PurchaseLine['category'],
                        unit_ids: resizeUnitIds(line.unit_ids, line.qty),
                      })
                    }
                  >
                    <SelectTrigger className="shell-inset-field h-10 w-full rounded-lg border border-shell-line bg-shell-surface-2/40 px-3 text-sm text-shell-ink shadow-none">
                      <SelectValue placeholder="Kind" />
                    </SelectTrigger>
                    <SelectContent>
                      {PURCHASE_CATEGORIES.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Qty">
                  <Input
                    type="number"
                    min={1}
                    value={line.qty}
                    onChange={e => {
                      const qty = Math.max(0, Number(e.target.value) || 0);
                      setLine(index, { qty, unit_ids: resizeUnitIds(line.unit_ids, qty) });
                    }}
                  />
                </Field>
              </div>
              <div className={stockFields ? 'grid grid-cols-2 gap-2' : undefined}>
                <Field label="Cost">
                  <CurrencyInput
                    value={line.unit_cost}
                    onValueChange={v => setLine(index, { unit_cost: v ?? 0 })}
                    className={cn(inputShellClass, 'font-mono')}
                  />
                </Field>
                {stockFields ? (
                  <Field label="Sell at">
                    <CurrencyInput
                      value={line.sell_price ?? 0}
                      onValueChange={v => setLine(index, { sell_price: v ?? 0 })}
                      className={cn(inputShellClass, 'font-mono')}
                    />
                  </Field>
                ) : null}
              </div>
              {stockFields && serialized
                ? resizeUnitIds(line.unit_ids, line.qty).map((id, unitIndex) => (
                    <Field key={unitIndex} label={`${idLabel} ${unitIndex + 1}`}>
                      <Input
                        value={id}
                        onChange={e => {
                          const unit_ids = resizeUnitIds(line.unit_ids, line.qty);
                          unit_ids[unitIndex] = e.target.value;
                          setLine(index, { unit_ids });
                        }}
                        placeholder={idLabel === 'IMEI' ? '14–17 digits' : 'Serial number'}
                        className="font-mono"
                      />
                    </Field>
                  ))
                : null}
            </div>
          );
        })}
      </div>
      {allowAdd ? (
        <Button
          type="button"
          variant="link"
          className="mt-2 h-auto p-0 text-xs font-semibold text-brand-300 hover:text-brand-200"
          onClick={() =>
            onChange([
              ...lines,
              { name: '', qty: 1, unit_cost: 0, category: 'accessories', sell_price: 0, unit_ids: [] },
            ])
          }
        >
          <Plus size={14} />
          Add line
        </Button>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-shell-muted">{label}</span>
      {children}
    </label>
  );
}
