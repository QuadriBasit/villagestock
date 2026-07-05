import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { ModalSheetClose } from '@/components/ui/ModalSheetClose';
import { ChoiceGrid } from '@/components/ui/ChoiceGrid';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { purchaseOrderLabel, purchaseOwed } from '@/lib/purchasing';
import { cn, formatCurrency } from '@/lib/utils';
import { modalSheetBodyScroll, modalSheetPanelMd } from '@/lib/modalSheet';
import type { ContactRecord, PaymentMethod, PurchaseLine, PurchaseRecord, PurchaseTerms } from '@/types';

const TERMS_OPTIONS: { value: PurchaseTerms; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Part-pay' },
  { value: 'credit', label: 'Credit' },
];

const PAY_OPTIONS: PaymentMethod[] = ['cash', 'bank_transfer', 'pos'];

const PAY_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Transfer',
  pos: 'POS',
};

type RecordPurchaseModalProps = {
  open: boolean;
  suppliers: ContactRecord[];
  presetSupplierId?: string;
  onClose: () => void;
  onSave: (input: {
    supplier_contact_id: string;
    supplier_name: string;
    items: PurchaseLine[];
    total: number;
    paid: number;
    payment_method: PaymentMethod;
    terms: PurchaseTerms;
    purchased_at: string;
  }) => Promise<PurchaseRecord>;
};

export default function RecordPurchaseModal({
  open,
  suppliers,
  presetSupplierId,
  onClose,
  onSave,
}: RecordPurchaseModalProps) {
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<PurchaseLine[]>([{ name: '', qty: 1, unit_cost: 0 }]);
  const [terms, setTerms] = useState<PurchaseTerms>('paid');
  const [paidNow, setPaidNow] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [done, setDone] = useState<PurchaseRecord | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSupplierId(presetSupplierId || suppliers[0]?.id || '');
    setLines([{ name: '', qty: 1, unit_cost: 0 }]);
    setTerms('paid');
    setPaidNow(0);
    setMethod('bank_transfer');
    setDone(null);
    setSaving(false);
  }, [open, presetSupplierId, suppliers]);

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + (line.qty || 0) * (line.unit_cost || 0), 0),
    [lines]
  );
  const paid = terms === 'paid' ? total : terms === 'credit' ? 0 : Math.min(paidNow, total);
  const owed = total - paid;
  const valid = !!supplierId && lines.some(l => l.name.trim() && l.qty > 0 && l.unit_cost > 0);
  const supplier = suppliers.find(s => s.id === supplierId);

  const setLine = (index: number, patch: Partial<PurchaseLine>) => {
    setLines(current => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const save = async () => {
    if (!valid || !supplier) return;
    setSaving(true);
    try {
      const items = lines.filter(l => l.name.trim() && l.qty > 0 && l.unit_cost > 0);
      const record = await onSave({
        supplier_contact_id: supplier.id,
        supplier_name: supplier.name,
        items,
        total,
        paid,
        payment_method: method,
        terms,
        purchased_at: new Date().toISOString(),
      });
      setDone(record);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <ModalSheetPortal>
      <ModalSheetFrame onClose={onClose} panelClassName={cn(modalSheetPanelMd, 'max-w-xl')} backdropClassName="bg-black/70">
<div className="flex items-center justify-between border-b border-shell-line px-5 py-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-shell-ink">
                {done ? 'Purchase recorded' : 'Record purchase'}
              </h2>
              {!done ? <p className="text-xs text-shell-muted">Stock bought in from a supplier</p> : null}
            </div>
            <ModalSheetClose onClick={onClose} />
          </div>

          <div className={cn(modalSheetBodyScroll, 'px-5 py-4')}>
            {done ? (
              <div className="py-2 text-center">
                <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <Check size={28} strokeWidth={2.4} />
                </div>
                <p className="font-mono text-2xl font-bold tabular-nums text-shell-ink">{formatCurrency(done.total)}</p>
                <p className="mt-2 text-sm text-shell-muted">
                  {purchaseOrderLabel(done)} · {supplier?.name ?? done.supplier_name}
                  {purchaseOwed(done) > 0
                    ? ` · ${formatCurrency(purchaseOwed(done))} on credit`
                    : ' · paid in full'}
                  .
                </p>
                <Button className="mt-5 w-full bg-violet-400 text-[#160a2e] hover:bg-violet-300" onClick={onClose}>
                  Done
                </Button>
              </div>
            ) : suppliers.length === 0 ? (
              <div className="py-6 text-center text-sm text-shell-muted">
                Add a supplier in Contacts before recording a purchase.
              </div>
            ) : (
              <div className="space-y-4">
                <Field label="Supplier">
                  <Select value={supplierId || undefined} onValueChange={setSupplierId}>
                    <SelectTrigger className="shell-inset-field h-10 w-full rounded-lg border border-shell-line bg-shell-surface-2/40 px-3 text-sm text-shell-ink shadow-none">
                      <SelectValue placeholder="Choose supplier…" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {s.balance_owed > 0 ? ` — owe ${formatCurrency(s.balance_owed)}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-shell-muted">Items</p>
                  <div className="space-y-2">
                    {lines.map((line, index) => (
                      <div key={index} className="grid grid-cols-[1fr_3.5rem_6.5rem_1.75rem] items-center gap-2">
                        <Input
                          value={line.name}
                          onChange={e => setLine(index, { name: e.target.value })}
                          placeholder="Product"
                          className="shell-inset-field h-10 rounded-lg border border-shell-line bg-shell-surface-2/40 px-3 text-sm text-shell-ink outline-none placeholder:text-shell-muted"
                        />
                        <Input
                          type="number"
                          min={1}
                          value={line.qty}
                          onChange={e => setLine(index, { qty: Math.max(0, Number(e.target.value) || 0) })}
                          className="shell-inset-field h-10 rounded-lg border border-shell-line bg-shell-surface-2/40 px-2 text-center font-mono text-sm text-shell-ink outline-none"
                        />
                        <CurrencyInput
                          value={line.unit_cost}
                          onValueChange={v => setLine(index, { unit_cost: v ?? 0 })}
                          className="h-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setLines(current =>
                              current.length > 1 ? current.filter((_, i) => i !== index) : current
                            )
                          }
                          disabled={lines.length <= 1}
                          className="size-7 rounded-lg text-shell-muted hover:text-shell-ink disabled:opacity-35"
                          aria-label="Remove line"
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    className="mt-2 h-auto p-0 text-xs font-semibold text-violet-300 hover:text-violet-200"
                    onClick={() => setLines(current => [...current, { name: '', qty: 1, unit_cost: 0 }])}
                  >
                    <Plus size={14} />
                    Add line
                  </Button>
                </div>

                <Field label="Terms">
                  <ChoiceGrid
                    options={TERMS_OPTIONS}
                    value={terms}
                    onChange={setTerms}
                  />
                </Field>

                {terms === 'partial' ? (
                  <Field label="Paid now">
                    <CurrencyInput value={paidNow} onValueChange={v => setPaidNow(Math.min(v ?? 0, total))} />
                  </Field>
                ) : null}

                {terms !== 'credit' ? (
                  <Field label="Method">
                    <ChoiceGrid
                      options={PAY_OPTIONS.map(opt => ({ value: opt, label: PAY_LABELS[opt] }))}
                      value={method}
                      onChange={setMethod}
                    />
                  </Field>
                ) : null}

                <div className="flex items-center justify-between gap-4 rounded-lg border border-violet-400/20 bg-violet-400/10 px-4 py-3.5">
                  <div>
                    <p className="text-xs text-shell-muted">
                      {owed > 0 ? `Total · ${formatCurrency(owed)} will be owed` : 'Total · paid in full'}
                    </p>
                    <p className="font-mono text-xl font-bold tabular-nums text-shell-ink">{formatCurrency(total)}</p>
                  </div>
                  <Button
                    className="bg-violet-400 text-[#160a2e] hover:bg-violet-300"
                    disabled={!valid || total <= 0 || saving}
                    onClick={() => void save()}
                  >
                    {saving ? 'Saving…' : 'Record'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        
      </ModalSheetFrame>
    </ModalSheetPortal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-shell-muted">{label}</span>
      {children}
    </div>
  );
}
