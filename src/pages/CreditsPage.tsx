import { useMemo, useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { useCreditActions } from '@/hooks/useCreditActions';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import type { CreditRecord, PaymentMethod } from '@/types';

export default function CreditsPage() {
  const { credits, isLoading } = useCredits();
  const outstanding = useMemo(
    () => [...credits].filter(record => record.status !== 'paid').sort((a, b) => a.due_date.localeCompare(b.due_date)),
    [credits]
  );
  const [selected, setSelected] = useState<CreditRecord | null>(null);

  if (isLoading) return <div className="px-4 py-8 text-sm text-muted">Loading credits…</div>;

  return (
    <div className="app-page py-5 md:py-8 space-y-4">
      <div>
        <h2 className="font-heading text-xl font-bold text-dark">Credits</h2>
        <p className="text-sm text-muted">Outstanding customer balances sorted by due date.</p>
      </div>
      {outstanding.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted">No outstanding credits.</CardContent></Card>
      ) : outstanding.map(record => (
        <button key={record.id} onClick={() => setSelected(record)} className="w-full text-left">
          <Card className={record.status === 'overdue' ? 'border-red-200' : undefined}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>{record.customer_name}</CardTitle>
                  <CardDescription>{record.item_name}</CardDescription>
                </div>
                <div className="text-right">
                  <div className="font-heading text-lg font-bold text-dark">{formatCurrency(record.balance_owed)}</div>
                  <div className={`text-xs ${record.status === 'overdue' ? 'text-red-500' : 'text-muted'}`}>{dueText(record.due_date)}</div>
                </div>
              </div>
            </CardHeader>
          </Card>
        </button>
      ))}
      {selected && <CreditDetailsModal record={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CreditDetailsModal({ record, onClose }: { record: CreditRecord; onClose: () => void }) {
  const { recordPayment } = useCreditActions();
  const [amount, setAmount] = useState(String(record.balance_owed));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [isSaving, setIsSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-heading text-lg font-semibold text-dark">{record.customer_name}</h3>
          <p className="text-sm text-muted">{record.item_name}</p>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-2">
              <Detail label="Phone" value={record.customer_phone} />
              <Detail label="Total Amount" value={formatCurrency(record.total_amount)} />
              <Detail label="Amount Paid" value={formatCurrency(record.amount_paid)} />
              <Detail label="Balance Owed" value={formatCurrency(record.balance_owed)} />
              <Detail label="Due Date" value={formatDate(record.due_date)} />
              <Detail label="Status" value={readable(record.status)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Record Payment</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-dark mb-1">Amount</label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-dark mb-1">Date</label>
                  <Input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark mb-1">Method</label>
                  <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)} className="flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-dark outline-none">
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Transfer</option>
                    <option value="pos">POS</option>
                  </select>
                </div>
              </div>
              <Button
                onClick={async () => {
                  setIsSaving(true);
                  await recordPayment(record.id, Number(amount), new Date(date).toISOString(), method);
                  setIsSaving(false);
                  onClose();
                }}
                disabled={isSaving || Number(amount) <= 0}
                className="w-full"
              >
                {isSaving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><CreditCard size={16} /> Record Payment</>}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted">{label}</span><span className="text-dark font-medium text-right">{value || '—'}</span></div>;
}

function readable(value: string) {
  return value.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function dueText(dueDate: string) {
  const today = new Date();
  const due = new Date(dueDate);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`;
  return `${days} day${days !== 1 ? 's' : ''} remaining`;
}
