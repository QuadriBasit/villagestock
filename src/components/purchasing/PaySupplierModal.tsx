import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { ModalSheetClose } from '@/components/ui/ModalSheetClose';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { cn, formatCurrency } from '@/lib/utils';
import { modalSheetBodyScroll, modalSheetPanelMd } from '@/lib/modalSheet';
import type { ContactRecord } from '@/types';

type PaySupplierModalProps = {
  supplier: ContactRecord | null;
  onClose: () => void;
  onPay: (contactId: string, amount: number) => Promise<void>;
};

export default function PaySupplierModal({ supplier, onClose, onPay }: PaySupplierModalProps) {
  const [amount, setAmount] = useState(0);
  const [done, setDone] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [saving, setSaving] = useState(false);

  const owed = supplier?.balance_owed ?? 0;

  useEffect(() => {
    if (!supplier) return;
    setAmount(0);
    setDone(false);
    setPaidAmount(0);
    setRemaining(supplier.balance_owed);
    setSaving(false);
  }, [supplier]);

  const chips = useMemo(() => {
    if (owed <= 0) return [];
    return [
      { label: '₦50k', value: 50_000 },
      { label: '₦100k', value: 100_000 },
      { label: 'Half', value: Math.round(owed / 2 / 1000) * 1000 },
      { label: 'Clear all', value: owed },
    ].filter(chip => chip.value > 0 && chip.value <= owed);
  }, [owed]);

  if (!supplier) return null;

  const pay = async () => {
    if (amount <= 0) return;
    setSaving(true);
    try {
      const applied = Math.min(amount, owed);
      await onPay(supplier.id, applied);
      setPaidAmount(applied);
      setRemaining(Math.max(0, owed - applied));
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
                {done ? 'Payment sent' : 'Pay supplier'}
              </h2>
              {!done ? <p className="text-xs text-shell-muted">{supplier.name}</p> : null}
            </div>
            <ModalSheetClose onClick={onClose} />
          </div>

          <div className={cn(modalSheetBodyScroll, 'px-5 py-4')}>
            {done ? (
              <div className="py-2 text-center">
                <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <Check size={28} strokeWidth={2.4} />
                </div>
                <p className="font-mono text-2xl font-bold tabular-nums text-shell-ink">{formatCurrency(paidAmount)}</p>
                <p className="mt-2 text-sm text-shell-muted">
                  {remaining === 0
                    ? `${supplier.name} fully settled.`
                    : `${formatCurrency(remaining)} still owed to ${supplier.name}.`}
                </p>
                <Button className="mt-5 w-full bg-violet-400 text-[#160a2e] hover:bg-violet-300" onClick={onClose}>
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3">
                  <span className="text-xs text-shell-muted">You currently owe</span>
                  <span className="font-mono text-lg font-bold tabular-nums text-amber-300">{formatCurrency(owed)}</span>
                </div>

                <div>
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-shell-muted">
                    Amount to pay
                  </span>
                  <CurrencyInput value={amount} onValueChange={v => setAmount(Math.min(v ?? 0, owed))} />
                </div>

                {chips.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {chips.map(chip => (
                      <Button
                        key={chip.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAmount(chip.value)}
                        className={cn(
                          'h-auto rounded-full px-3 py-1.5 text-xs font-semibold shadow-none active:scale-100',
                          amount === chip.value
                            ? 'border-violet-400/50 bg-violet-400/15 text-shell-ink'
                            : 'border-shell-line bg-shell-surface-2/30 text-shell-muted hover:text-shell-ink',
                        )}
                      >
                        {chip.label}
                      </Button>
                    ))}
                  </div>
                ) : null}

                <Button
                  className="w-full bg-violet-400 text-[#160a2e] hover:bg-violet-300"
                  disabled={amount <= 0 || saving}
                  onClick={() => void pay()}
                >
                  {saving ? 'Processing…' : amount > 0 ? `Pay ${formatCurrency(amount)}` : 'Pay supplier'}
                </Button>
              </div>
            )}
          </div>
        
      </ModalSheetFrame>
    </ModalSheetPortal>
  );
}
