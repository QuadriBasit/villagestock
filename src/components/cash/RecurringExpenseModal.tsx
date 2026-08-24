import { useEffect, useState } from 'react';
import { Check, Wallet } from 'lucide-react';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { ModalSheetClose } from '@/components/ui/ModalSheetClose';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { modalSheetBodyScroll, modalSheetPanelMd } from '@/lib/modalSheet';
import { RECURRENCE_LABELS } from '@/lib/moneyPeriods';
import { EXPENSE_CATEGORY_META } from '@/lib/expenseCategories';
import type { ExpenseCategory, ExpenseRecurrence, PaymentMethod, RecurringExpenseInput } from '@/types';

const CATEGORIES = EXPENSE_CATEGORY_META;

const PAY_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Transfer',
  pos: 'POS',
};

type RecurringExpenseModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (input: RecurringExpenseInput) => Promise<void>;
};

export default function RecurringExpenseModal({ open, onClose, onSave }: RecurringExpenseModalProps) {
  const [category, setCategory] = useState<ExpenseCategory>('rent');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [recurrence, setRecurrence] = useState<ExpenseRecurrence>('monthly');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCategory('rent');
      setLabel('');
      setAmount(0);
      setMethod('bank_transfer');
      setRecurrence('monthly');
      setDone(false);
    }
  }, [open]);

  if (!open) return null;

  const save = async () => {
    if (amount <= 0 || saving) return;
    setSaving(true);
    try {
      await onSave({
        category,
        label: label.trim() || CATEGORIES.find(c => c.key === category)?.label || 'Recurring cost',
        amount,
        payment_method: method,
        recurrence,
      });
      setDone(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheetPortal>
      <ModalSheetFrame onClose={onClose} panelClassName={modalSheetPanelMd} backdropClassName="bg-black/70">
        <div className="flex items-center justify-between border-b border-shell-line px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-shell-ink">
              {done ? 'Saved' : 'Fixed recurring cost'}
            </h2>
            {!done ? (
              <p className="text-xs text-shell-muted">Rent, salaries, LAWMA, security — counted in period overview</p>
            ) : null}
          </div>
          <ModalSheetClose onClick={onClose} />
        </div>

        <div className={cn(modalSheetBodyScroll, 'space-y-4 px-5 py-4')}>
          {done ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
                <Check size={24} />
              </span>
              <p className="text-sm font-medium text-shell-ink">Recurring cost saved</p>
              <p className="text-xs text-shell-muted">
                Included in your {RECURRENCE_LABELS[recurrence].toLowerCase()} overview estimate.
              </p>
              <Button onClick={onClose}>Done</Button>
            </div>
          ) : (
            <>
              <div>
                <p className="mb-2 text-xs font-semibold text-shell-muted">Category</p>
                <Select value={category} onValueChange={v => setCategory(v as ExpenseCategory)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-shell-muted" htmlFor="recurring-label">
                  Label
                </label>
                <Input
                  id="recurring-label"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Shop rent, gateman salary, LAWMA bill"
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-shell-muted">How often</p>
                <SegmentedTabs
                  options={(
                    Object.entries(RECURRENCE_LABELS) as [ExpenseRecurrence, string][]
                  ).map(([value, lbl]) => ({ value, label: lbl }))}
                  value={recurrence}
                  onChange={setRecurrence}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-shell-muted" htmlFor="recurring-amount">
                  Amount per period (₦)
                </label>
                <CurrencyInput
                  id="recurring-amount"
                  value={amount}
                  onValueChange={v => setAmount(v ?? 0)}
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-shell-muted">Usually paid via</p>
                <SegmentedTabs
                  options={(['cash', 'bank_transfer', 'pos'] as PaymentMethod[]).map(m => ({
                    value: m,
                    label: PAY_LABELS[m],
                  }))}
                  value={method}
                  onChange={setMethod}
                />
              </div>
            </>
          )}
        </div>

        {!done ? (
          <div className="border-t border-shell-line px-5 py-4">
            <Button
              className="w-full bg-brand-400 text-[#04231d] hover:bg-brand-300"
              disabled={amount <= 0 || saving}
              onClick={() => void save()}
            >
              <Wallet size={16} />
              Save recurring cost
            </Button>
          </div>
        ) : null}
      </ModalSheetFrame>
    </ModalSheetPortal>
  );
}
