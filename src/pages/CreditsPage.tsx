import { useMemo, useState } from 'react';
import { AlertTriangle, CreditCard, Loader2, Users, Wallet, X } from 'lucide-react';
import { useCredits, useOutstandingCreditsSummary } from '@/hooks/useCredits';
import { useCreditActions } from '@/hooks/useCreditActions';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DateTimeField, toLocalDatetimeValue } from '@/components/ui/DateTimeField';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { AlertsSkeletonList } from '@/components/ui/Skeleton';
import type { CreditRecord, CreditStatus, PaymentMethod } from '@/types';
import {
  modalSheetBackdrop,
  modalSheetBodyScroll,
  modalSheetHandle,
  modalSheetHeader,
  modalSheetPanelMd,
} from '@/lib/modalSheet';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { settingsBtnPrimary, settingsField } from '@/components/settings/settingsUi';

export default function CreditsPage() {
  const { credits, isLoading } = useCredits();
  const { summary, isLoading: summaryLoading } = useOutstandingCreditsSummary();
  const outstanding = useMemo(
    () => [...credits].filter(record => record.status !== 'paid').sort((a, b) => a.due_date.localeCompare(b.due_date)),
    [credits],
  );
  const [selected, setSelected] = useState<CreditRecord | null>(null);

  if (isLoading || summaryLoading) return <AlertsSkeletonList />;

  if (outstanding.length === 0) {
    return (
      <div className="app-page flex flex-col items-center px-4 py-20 text-center">
        <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-violet-400/10">
          <CreditCard size={28} className="text-violet-300" />
        </div>
        <h2 className="font-display text-lg font-semibold text-shell-ink">No outstanding credits</h2>
        <p className="mt-1 max-w-sm text-sm text-shell-muted">
          Customer balances from credit sales will show here, sorted by due date.
        </p>
      </div>
    );
  }

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <PageHeader
        title="Credits"
        subtitle={`${outstanding.length} open balance${outstanding.length !== 1 ? 's' : ''} · sorted by due date`}
      />

      <StatGrid className="lg:grid-cols-3">
        <StatCard
          label="Outstanding"
          value={formatCurrency(summary.outstanding_amount)}
          icon={Wallet}
          iconClassName="bg-violet-400/10 text-violet-300"
        />
        <StatCard
          label="Overdue"
          value={String(summary.overdue_count)}
          icon={AlertTriangle}
          iconClassName="bg-red-500/10 text-red-400"
          hint={summary.overdue_count > 0 ? 'Needs follow-up' : undefined}
          hintClassName="text-red-400"
        />
        <StatCard
          label="Open accounts"
          value={String(outstanding.length)}
          icon={Users}
          iconClassName="bg-amber-500/10 text-amber-400"
        />
      </StatGrid>

      <Card className="overflow-hidden border-shell-line bg-shell-surface p-0 shadow-none">
        <div className="border-b border-shell-line px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-shell-muted">Customer balances</p>
        </div>
        {outstanding.map(record => (
          <CreditRow key={record.id} record={record} onOpen={() => setSelected(record)} />
        ))}
      </Card>

      {selected ? <CreditDetailsModal record={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function CreditRow({ record, onOpen }: { record: CreditRecord; onOpen: () => void }) {
  const overdue = record.status === 'overdue';
  const due = dueText(record.due_date);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full items-center justify-between gap-4 border-b border-shell-line/80 px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-shell-surface-2/40',
        overdue && 'bg-red-500/[0.03]',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium text-shell-ink">{record.customer_name}</p>
          <StatusBadge status={record.status} />
        </div>
        <p className="mt-0.5 truncate text-xs text-shell-muted">{record.item_name}</p>
        {record.customer_phone ? (
          <p className="mt-0.5 text-[11px] text-shell-muted">{record.customer_phone}</p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="font-display text-lg font-bold tabular-nums text-shell-ink">
          {formatCurrency(record.balance_owed)}
        </p>
        <p className={cn('text-xs', overdue ? 'font-medium text-red-400' : 'text-shell-muted')}>{due}</p>
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status: CreditStatus | string }) {
  if (status === 'overdue') {
    return (
      <Badge variant="destructive" className="border-red-500/25 bg-red-500/10 text-red-300">
        Overdue
      </Badge>
    );
  }
  if (status === 'partially_paid') {
    return (
      <Badge variant="secondary" className="border-shell-line bg-shell-surface-2 text-shell-muted">
        Partial
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="border-shell-line bg-shell-surface-2 text-shell-muted">
      Pending
    </Badge>
  );
}

function CreditDetailsModal({ record, onClose }: { record: CreditRecord; onClose: () => void }) {
  const { recordPayment } = useCreditActions();
  const [amount, setAmount] = useState(record.balance_owed);
  const [date, setDate] = useState(toLocalDatetimeValue(new Date()));
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [isSaving, setIsSaving] = useState(false);

  return (
    <ModalSheetPortal>
      <div className={modalSheetBackdrop} onClick={onClose}>
        <div
          className={cn(
            modalSheetPanelMd,
            'border-shell-line bg-shell-surface ring-shell-line/40 dark:border-shell-line dark:bg-shell-surface',
          )}
          onClick={e => e.stopPropagation()}
        >
          <div className={modalSheetHandle}>
            <div className="h-1 w-10 rounded-full bg-shell-line" />
          </div>
          <div className={cn(modalSheetHeader, 'border-shell-line')}>
            <div className="min-w-0">
              <h3 className="font-display text-lg font-semibold text-shell-ink">{record.customer_name}</h3>
              <p className="truncate text-sm text-shell-muted">{record.item_name}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-shell-muted transition hover:bg-shell-surface-2 hover:text-shell-ink"
            >
              <X size={18} />
            </button>
          </div>
          <div className={cn(modalSheetBodyScroll, 'space-y-4 bg-shell-surface-2/20')}>
            <Card className="border-shell-line bg-shell-surface shadow-none">
              <CardContent className="space-y-2.5 p-4">
                <Detail label="Phone" value={record.customer_phone} />
                <Detail label="Total amount" value={formatCurrency(record.total_amount)} />
                <Detail label="Amount paid" value={formatCurrency(record.amount_paid)} />
                <Detail label="Balance owed" value={formatCurrency(record.balance_owed)} highlight />
                <Detail label="Due date" value={formatDate(record.due_date)} />
                <Detail label="Status" value={readable(record.status)} />
              </CardContent>
            </Card>
            <Card className="border-shell-line bg-shell-surface shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base text-shell-ink">Record payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-shell-muted">Amount</label>
                  <CurrencyInput value={amount} onValueChange={v => setAmount(v ?? 0)} className={settingsField} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DateTimeField id="payment_date" label="Date" value={date} onChange={setDate} />
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-shell-muted">Method</label>
                    <Select value={method} onValueChange={v => setMethod(v as PaymentMethod)}>
                      <SelectTrigger className="w-full border-shell-line bg-shell-surface-2/40 text-shell-ink">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank_transfer">Transfer</SelectItem>
                        <SelectItem value="pos">POS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setIsSaving(true);
                    await recordPayment(record.id, amount, new Date(date).toISOString(), method);
                    setIsSaving(false);
                    onClose();
                  }}
                  disabled={isSaving || amount <= 0}
                  className={cn(settingsBtnPrimary, 'w-full py-3')}
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <CreditCard size={16} /> Record payment
                    </>
                  )}
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ModalSheetPortal>
  );
}

function Detail({ label, value, highlight }: { label: string; value?: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-shell-muted">{label}</span>
      <span
        className={cn(
          'text-right font-medium tabular-nums',
          highlight ? 'font-display text-base font-bold text-violet-200' : 'text-shell-ink',
        )}
      >
        {value || '—'}
      </span>
    </div>
  );
}

function readable(value: string) {
  return value.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function dueText(dueDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`;
  if (days === 0) return 'Due today';
  return `${days} day${days !== 1 ? 's' : ''} remaining`;
}
