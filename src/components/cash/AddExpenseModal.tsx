import { useEffect, useState } from 'react';
import { Check, Fuel, Utensils, Truck, Zap, Wallet, Package } from 'lucide-react';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { ModalSheetClose } from '@/components/ui/ModalSheetClose';
import { ChoiceGrid } from '@/components/ui/ChoiceGrid';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { cn, formatCurrency } from '@/lib/utils';
import { modalSheetBodyScroll, modalSheetPanelMd } from '@/lib/modalSheet';
import type { ExpenseCategory, PaymentMethod } from '@/types';

const EXPENSE_CATS: {
  key: ExpenseCategory;
  label: string;
  icon: typeof Fuel;
  tone: string;
}[] = [
  { key: 'generator', label: 'Generator / diesel', icon: Fuel, tone: 'text-amber-300' },
  { key: 'nepa', label: 'NEPA / power', icon: Zap, tone: 'text-yellow-300' },
  { key: 'transport', label: 'Transport', icon: Truck, tone: 'text-sky-300' },
  { key: 'feeding', label: 'Feeding / lunch', icon: Utensils, tone: 'text-orange-300' },
  { key: 'rent', label: 'Rent / levies', icon: Wallet, tone: 'text-brand-300' },
  { key: 'supplies', label: 'Shop supplies', icon: Package, tone: 'text-emerald-300' },
  { key: 'other', label: 'Other', icon: Wallet, tone: 'text-shell-muted' },
];

const PAY_OPTIONS: PaymentMethod[] = ['cash', 'bank_transfer', 'pos'];

const PAY_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Transfer',
  pos: 'POS',
};

type AddExpenseModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (input: {
    category: ExpenseCategory;
    label: string;
    amount: number;
    payment_method: PaymentMethod;
  }) => Promise<void>;
};

export default function AddExpenseModal({ open, onClose, onSave }: AddExpenseModalProps) {
  const [cat, setCat] = useState<ExpenseCategory>('generator');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCat('generator');
      setLabel('');
      setAmount(0);
      setMethod('cash');
      setDone(false);
    }
  }, [open]);

  if (!open) return null;

  const catMeta = EXPENSE_CATS.find(c => c.key === cat);

  const save = async () => {
    if (amount <= 0 || saving) return;
    setSaving(true);
    try {
      await onSave({
        category: cat,
        label: label.trim() || catMeta?.label || 'Expense',
        amount,
        payment_method: method,
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
                {done ? 'Expense logged' : 'Record expense'}
              </h2>
              {!done ? <p className="text-xs text-shell-muted">Money leaving the shop today</p> : null}
            </div>
            <ModalSheetClose onClick={onClose} />
          </div>

          <div className={cn(modalSheetBodyScroll, 'space-y-4 px-5 py-4')}>
            {done ? (
              <div className="py-2 text-center">
                <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-amber-500/15 text-amber-300">
                  <Check size={28} strokeWidth={2.2} />
                </div>
                <p className="font-mono text-2xl font-bold text-shell-ink">−{formatCurrency(amount)}</p>
                <p className="mt-2 text-sm text-shell-muted">
                  {catMeta?.label} · paid by {PAY_LABELS[method]}. Logged to the audit trail.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                    onClick={() => setDone(false)}
                  >
                    Add another
                  </Button>
                  <Button className="bg-brand-400 text-[#04231d] hover:bg-brand-300" onClick={onClose}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-shell-muted">Category</p>
                  <div className="grid grid-cols-2 gap-2">
                    {EXPENSE_CATS.map(c => {
                      const Icon = c.icon;
                      const on = cat === c.key;
                      return (
                        <Button
                          key={c.key}
                          type="button"
                          variant="outline"
                          onClick={() => setCat(c.key)}
                          className={cn(
                            'h-auto justify-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-medium shadow-none active:scale-100',
                            on
                              ? 'border-brand-400/50 bg-brand-400/10 text-shell-ink'
                              : 'border-shell-line bg-shell-surface-2/30 text-shell-muted hover:text-shell-ink',
                          )}
                        >
                          <Icon size={16} className={c.tone} />
                          {c.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-shell-muted">
                    What was it for?
                  </span>
                  <Input
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    placeholder="e.g. Diesel for the generator"
                    className="shell-inset-field h-10 w-full rounded-lg border border-shell-line bg-shell-surface-2/40 px-3 text-sm text-shell-ink outline-none placeholder:text-shell-muted focus:border-shell-muted/60"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-shell-muted">
                    Amount
                  </span>
                  <CurrencyInput value={amount} onValueChange={v => setAmount(v ?? 0)} />
                </label>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-shell-muted">Paid with</p>
                  <ChoiceGrid
                    options={PAY_OPTIONS.map(m => ({ value: m, label: PAY_LABELS[m] }))}
                    value={method}
                    onChange={setMethod}
                  />
                </div>

                {method === 'cash' && amount > 0 ? (
                  <p className="flex items-center gap-2 text-xs text-shell-muted">
                    <Wallet size={14} />
                    Comes out of the drawer — expected cash drops by {formatCurrency(amount)}.
                  </p>
                ) : null}

                <Button
                  className="w-full bg-brand-400 text-[#04231d] hover:bg-brand-300"
                  disabled={amount <= 0 || saving}
                  onClick={() => void save()}
                >
                  {saving ? 'Saving…' : `Log ${amount > 0 ? formatCurrency(amount) : 'expense'}`}
                </Button>
              </>
            )}
          </div>
        
      </ModalSheetFrame>
    </ModalSheetPortal>
  );
}
