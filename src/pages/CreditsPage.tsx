import { useMemo, useState } from 'react';
import { AlertTriangle, CreditCard, Loader2, MessageCircle, Trash2, Users, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useCredits, useCreditRecord, useOutstandingCreditsSummary } from '@/hooks/useCredits';
import { useCreditActions } from '@/hooks/useCreditActions';
import { useShopProfile } from '@/hooks/useShopProfile';
import { buildCreditReminderText, openWhatsApp } from '@/lib/whatsapp';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { ModalSheetClose } from '@/components/ui/ModalSheetClose';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DateTimeField, toLocalDatetimeValue } from '@/components/ui/DateTimeField';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { AlertsSkeletonList } from '@/components/ui/Skeleton';
import type { CreditRecord, CreditStatus, PaymentMethod } from '@/types';
import { modalSheetBodyScroll, modalSheetFooter, modalSheetHeader, modalSheetPanelMd } from '@/lib/modalSheet';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { settingsBtnOutline, settingsField } from '@/components/settings/settingsUi';

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Transfer',
  pos: 'POS',
};

export default function CreditsPage() {
  const { credits, isLoading } = useCredits();
  const { summary, isLoading: summaryLoading } = useOutstandingCreditsSummary();
  const outstanding = useMemo(
    () => [...credits].filter(record => record.balance_owed > 0).sort((a, b) => a.due_date.localeCompare(b.due_date)),
    [credits],
  );
  const cleared = useMemo(
    () =>
      [...credits]
        .filter(record => record.balance_owed <= 0)
        .sort((a, b) => b.due_date.localeCompare(a.due_date)),
    [credits],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading || summaryLoading) return <AlertsSkeletonList />;

  if (credits.length === 0) {
    return (
      <div className="app-page flex flex-col items-center px-4 py-20 text-center">
        <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-brand-400/10">
          <CreditCard size={28} className="text-brand-300" />
        </div>
        <h2 className="font-display text-lg font-semibold text-shell-ink">No credit sales yet</h2>
        <p className="mt-1 max-w-sm text-sm text-shell-muted">
          Customer balances from credit sales will show here.
        </p>
      </div>
    );
  }

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <PageHeader
        title="Credits"
        subtitle={
          outstanding.length > 0
            ? `${outstanding.length} open balance${outstanding.length !== 1 ? 's' : ''} · sorted by due date`
            : 'No open balances'
        }
      />

      {outstanding.length > 0 ? (
        <>
          <StatGrid className="lg:grid-cols-3">
            <StatCard
              label="Outstanding"
              value={formatCurrency(summary.outstanding_amount)}
              icon={Wallet}
              iconClassName=" text-brand-300"
            />
            <StatCard
              label="Overdue"
              value={String(summary.overdue_count)}
              icon={AlertTriangle}
              iconClassName=" text-red-400"
              hint={summary.overdue_count > 0 ? 'Needs follow-up' : undefined}
              hintClassName="text-red-400"
            />
            <StatCard
              label="Open accounts"
              value={String(outstanding.length)}
              icon={Users}
              iconClassName=" text-amber-400"
            />
          </StatGrid>

          <Card className="overflow-hidden border-shell-line bg-shell-surface p-0 shadow-none">
            <div className="border-b border-shell-line px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-shell-muted">Open balances</p>
            </div>
            {outstanding.map(record => (
              <CreditRow key={record.id} record={record} onOpen={() => setSelectedId(record.id)} />
            ))}
          </Card>
        </>
      ) : (
        <Card className="border-shell-line bg-shell-surface p-4 shadow-none">
          <p className="text-sm text-shell-muted">All credit accounts are cleared. Use the section below to fix mistaken payments.</p>
        </Card>
      )}

      {cleared.length > 0 ? (
        <Card className="overflow-hidden border-shell-line bg-shell-surface p-0 shadow-none">
          <div className="border-b border-shell-line px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-shell-muted">Cleared balances</p>
            <p className="mt-1 text-xs text-shell-muted">Tap to review payment history or remove a mistaken entry.</p>
          </div>
          {cleared.map(record => (
            <CreditRow key={record.id} record={record} onOpen={() => setSelectedId(record.id)} />
          ))}
        </Card>
      ) : null}

      {selectedId ? <CreditDetailsModal creditId={selectedId} onClose={() => setSelectedId(null)} /> : null}
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

function CreditDetailsModal({ creditId, onClose }: { creditId: string; onClose: () => void }) {
  const { record: liveRecord } = useCreditRecord(creditId);
  const record = liveRecord
    ? {
        ...liveRecord,
        status:
          liveRecord.balance_owed <= 0
            ? ('paid' as const)
            : liveRecord.amount_paid > 0
              ? new Date(liveRecord.due_date) < new Date()
                ? ('overdue' as const)
                : ('partially_paid' as const)
              : liveRecord.status,
      }
    : null;
  const { recordPayment, removeCreditPayment } = useCreditActions();
  const { profile } = useShopProfile();
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [date, setDate] = useState(toLocalDatetimeValue(new Date()));
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [isSaving, setIsSaving] = useState(false);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [submitBlocked, setSubmitBlocked] = useState(false);

  if (!record) return null;

  const paymentRows = record.payments
    .map((payment, index) => ({ payment, index }))
    .sort((a, b) => new Date(b.payment.date).getTime() - new Date(a.payment.date).getTime());
  const canSubmit =
    !isSaving &&
    !submitBlocked &&
    amount != null &&
    amount > 0 &&
    amount <= record.balance_owed;

  const blockAccidentalSubmit = () => {
    setSubmitBlocked(true);
    window.setTimeout(() => setSubmitBlocked(false), 450);
  };

  const remindViaWhatsApp = () => {
    openWhatsApp(record.customer_phone, buildCreditReminderText(record, profile));
    toast.success('Opening WhatsApp…');
  };

  const submitPayment = async () => {
    if (!canSubmit || amount == null) return;
    setIsSaving(true);
    try {
      await recordPayment(record.id, amount, new Date(date).toISOString(), method);
      setAmount(undefined);
      setDate(toLocalDatetimeValue(new Date()));
      toast.success('Payment recorded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not record payment');
    } finally {
      setIsSaving(false);
    }
  };

  const removePayment = async (paymentIndex: number) => {
    const payment = record.payments[paymentIndex];
    if (!payment) return;
    const ok = window.confirm(
      `Remove ${formatCurrency(payment.amount)} recorded on ${formatPaymentDate(payment.date)}? The balance will be restored.`,
    );
    if (!ok) return;
    setRemovingIndex(paymentIndex);
    try {
      await removeCreditPayment(record.id, paymentIndex);
      toast.success('Payment removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove payment');
    } finally {
      setRemovingIndex(null);
    }
  };

  return (
    <ModalSheetPortal>
      <ModalSheetFrame onClose={onClose} panelClassName={cn(
            modalSheetPanelMd,
            'border-shell-line bg-shell-surface ring-shell-line/40 dark:border-shell-line dark:bg-shell-surface',
          )}>
<div className={cn(modalSheetHeader, 'border-shell-line')}>
            <div className="min-w-0">
              <h3 className="font-display text-lg font-semibold text-shell-ink">{record.customer_name}</h3>
              <p className="truncate text-sm text-shell-muted">{record.item_name}</p>
            </div>
            <ModalSheetClose onClick={onClose} />
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
            {paymentRows.length > 0 ? (
              <Card className="border-shell-line bg-shell-surface shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base text-shell-ink">Payment history</CardTitle>
                  <p className="text-xs leading-relaxed text-shell-muted">
                    Remove any entry recorded by mistake — balance and amount paid update immediately.
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {paymentRows.map(({ payment, index }) => (
                      <div
                        key={`${payment.date}-${payment.amount}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-shell-line bg-shell-surface-2/30 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="font-medium tabular-nums text-shell-ink">
                            {formatCurrency(payment.amount)}
                          </p>
                          <p className="text-[11px] text-shell-muted">
                            {formatPaymentDate(payment.date)}
                            {payment.method ? ` · ${PAYMENT_METHOD_LABEL[payment.method]}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void removePayment(index)}
                          disabled={removingIndex === index || isSaving}
                          className={cn(
                            settingsBtnOutline,
                            'shrink-0 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/10 hover:text-red-200',
                          )}
                        >
                          {removingIndex === index ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <>
                              <Trash2 size={14} /> Remove
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                </CardContent>
              </Card>
            ) : null}
            {record.balance_owed > 0 ? (
            <Card className="border-shell-line bg-shell-surface shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base text-shell-ink">Record payment</CardTitle>
                <p className="text-xs leading-relaxed text-shell-muted">
                  Type the amount received now, then tap Record payment. Nothing saves until you confirm
                  at the bottom.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-shell-muted">
                    Amount received
                  </label>
                  <CurrencyInput
                    allowEmpty
                    value={amount}
                    onValueChange={setAmount}
                    className={settingsField}
                    placeholder={`e.g. ${formatCurrency(Math.min(record.balance_owed, 200_000))}`}
                  />
                  <p className="mt-1 text-[11px] text-shell-muted">
                    Balance owed: {formatCurrency(record.balance_owed)}
                    {amount != null && amount > 0 ? (
                      <>
                        {' '}
                        · After payment:{' '}
                        <span className="font-medium tabular-nums text-shell-ink">
                          {formatCurrency(Math.max(0, record.balance_owed - amount))}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <DateTimeField id="payment_date" label="Date & time" value={date} onChange={setDate} />
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-shell-muted">Method</label>
                  <Select
                    value={method}
                    onValueChange={v => setMethod(v as PaymentMethod)}
                    onOpenChange={open => {
                      if (!open) blockAccidentalSubmit();
                    }}
                  >
                    <SelectTrigger className="w-full border-shell-line bg-shell-surface-2/40 text-shell-ink">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={6}>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Transfer</SelectItem>
                      <SelectItem value="pos">POS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {amount == null || amount <= 0 ? (
                  <p className="text-xs text-shell-muted">Enter an amount above zero to enable Record payment.</p>
                ) : amount > record.balance_owed ? (
                  <p className="text-xs text-amber-300/90">
                    Amount cannot exceed the balance owed ({formatCurrency(record.balance_owed)}).
                  </p>
                ) : null}
              </CardContent>
            </Card>
            ) : (
              <Card className="border-shell-line bg-shell-surface shadow-none">
                <CardContent className="p-4 text-sm text-shell-muted">
                  This account is fully paid. Remove mistaken payments above to reopen the balance.
                </CardContent>
              </Card>
            )}
          </div>
          {record.balance_owed > 0 ? (
          <div
            className={cn(
              modalSheetFooter,
              'border-shell-line bg-shell-surface pb-[max(1rem,env(safe-area-inset-bottom))]',
            )}
          >
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Button
                type="button"
                size="lg"
                className="w-full bg-brand-400 text-[#04231d] shadow-[0_0_0_1px_rgba(0,179,152,0.35)] hover:bg-brand-300 disabled:bg-brand-400/35 disabled:text-[#04231d]/70"
                onClick={() => void submitPayment()}
                disabled={!canSubmit}
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
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                title={record.customer_phone ? 'Send a payment reminder via WhatsApp' : 'No phone number on this credit'}
                className="border-[#25d366]/40 bg-[#25d366]/10 text-[#25d366] hover:bg-[#25d366]/20"
                onClick={remindViaWhatsApp}
                disabled={!record.customer_phone}
              >
                <MessageCircle size={16} />
                <span className="hidden sm:inline">Remind via WhatsApp</span>
              </Button>
            </div>
          </div>
          ) : null}
        
      </ModalSheetFrame>
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
          highlight ? 'font-display text-base font-bold text-brand-200' : 'text-shell-ink',
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

function formatPaymentDate(iso: string) {
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
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
