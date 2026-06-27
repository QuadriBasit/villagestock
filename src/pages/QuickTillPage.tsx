import { useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Minus, Plus, Search, ShoppingCart } from 'lucide-react';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { useSalesActions } from '@/hooks/useSalesActions';
import { useContacts } from '@/hooks/useContacts';
import { useTradingGateState } from '@/hooks/useStockSessions';
import { useCreditActions } from '@/hooks/useCreditActions';
import { getItemQty, itemSpecLine } from '@/lib/inventoryDisplay';
import { cn, formatCurrency } from '@/lib/utils';
import type { Category, ContactRecord, InventoryItem, PaymentMethod } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { Input } from '@/components/ui/Input';
import { CategoryThumb } from '@/components/inventory/CategoryThumb';
import { settingsField } from '@/components/settings/settingsUi';

type CartLine = { item: InventoryItem; qty: number };
type PayTerms = 'paid' | 'part' | 'credit';

const CATEGORY_TABS = ['All', 'Phones', 'Laptops', 'Accessories'] as const;
type CategoryTab = (typeof CATEGORY_TABS)[number];

const PAY_OPTIONS: { label: string; method: PaymentMethod }[] = [
  { label: 'Cash', method: 'cash' },
  { label: 'Transfer', method: 'bank_transfer' },
  { label: 'POS', method: 'pos' },
];

const PAY_TERMS: { label: string; value: PayTerms }[] = [
  { label: 'Paid', value: 'paid' },
  { label: 'Part pay', value: 'part' },
  { label: 'Credit', value: 'credit' },
];

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function lineTotal(line: CartLine): number {
  const qty = line.item.mode === 'serialized' ? 1 : line.qty;
  return line.item.price * qty;
}

/** Split a cart-level deposit across line totals (last line gets rounding remainder). */
function allocatePaid(totalPaid: number, amounts: number[]): number[] {
  if (amounts.length === 0) return [];
  if (totalPaid <= 0) return amounts.map(() => 0);
  const sum = amounts.reduce((a, b) => a + b, 0);
  if (sum <= 0) return amounts.map(() => 0);
  const shares: number[] = [];
  let allocated = 0;
  for (let i = 0; i < amounts.length; i++) {
    if (i === amounts.length - 1) {
      shares.push(Math.max(0, totalPaid - allocated));
    } else {
      const share = Math.round((amounts[i] / sum) * totalPaid);
      shares.push(share);
      allocated += share;
    }
  }
  return shares;
}

function matchesCategoryTab(item: InventoryItem, tab: CategoryTab): boolean {
  if (tab === 'All') return true;
  if (tab === 'Phones') return item.category === 'phones' || item.category === 'tablets';
  if (tab === 'Laptops') return item.category === 'laptops';
  return item.category === 'accessories' || item.category === 'parts';
}

function isSellable(item: InventoryItem): boolean {
  if (item.mode === 'serialized') return item.status === 'in_stock';
  return item.quantity > 0;
}

function maxQty(item: InventoryItem): number {
  return item.mode === 'serialized' ? 1 : item.quantity;
}

export default function QuickTillPage() {
  const { shopOwnerId, canViewProfit } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();
  const { recordSale } = useSalesActions();
  const { createCreditRecord } = useCreditActions();
  const { contacts } = useContacts('customer');
  const tradingGate = useTradingGateState();

  const items = useLiveQuery(async () => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return [];
    const rows = await db.inventory_items
      .where('user_id')
      .equals(shopOwnerId)
      .filter(i => !i.deleted && i.location_id === activeLocationId)
      .toArray();
    return rows.filter(isSellable);
  }, [shopOwnerId, activeLocationId, locationReady]);

  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<CategoryTab>('All');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payTerms, setPayTerms] = useState<PayTerms>('paid');
  const [amountPaidTotal, setAmountPaidTotal] = useState(0);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [done, setDone] = useState<{
    total: number;
    profit: number;
    receipt?: string;
    owed?: number;
  } | null>(null);

  const customerOptions = useMemo(() => contacts.slice(0, 8), [contacts]);

  const selectCustomer = (choice: 'walk-in' | ContactRecord) => {
    if (choice === 'walk-in') {
      setCustomerName('');
      setCustomerPhone('');
      return;
    }
    setCustomerName(choice.name);
    setCustomerPhone(choice.phone ?? '');
  };

  const isWalkIn = !customerName.trim() && !customerPhone.trim();

  const prods = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (items ?? []).filter(i => {
      if (!matchesCategoryTab(i, cat)) return false;
      if (!query) return true;
      return (
        i.name.toLowerCase().includes(query) ||
        i.brand.toLowerCase().includes(query) ||
        i.imei?.toLowerCase().includes(query) ||
        i.serial_number?.toLowerCase().includes(query)
      );
    });
  }, [items, q, cat]);

  const lines = Object.values(cart);
  const total = lines.reduce((s, l) => s + lineTotal(l), 0);
  const profit = lines.reduce(
    (s, l) => s + (l.item.price - (l.item.cost_price ?? 0)) * (l.item.mode === 'serialized' ? 1 : l.qty),
    0,
  );
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const paidNow =
    payTerms === 'paid' ? total : payTerms === 'part' ? Math.min(Math.max(0, amountPaidTotal), total) : 0;
  const balanceOwed = Math.max(0, total - paidNow);

  const tradeLocked = tradingGate.gateApplies && tradingGate.isReady && tradingGate.tradingBlocked;

  const add = (item: InventoryItem) => {
    if (tradeLocked) return;
    setCart(c => {
      const cur = c[item.id]?.qty ?? 0;
      if (cur >= maxQty(item)) return c;
      return { ...c, [item.id]: { item, qty: cur + 1 } };
    });
  };

  const setQty = (id: string, qty: number) => {
    setCart(c => {
      if (qty <= 0) {
        const next = { ...c };
        delete next[id];
        return next;
      }
      const line = c[id];
      if (!line) return c;
      return { ...c, [id]: { ...line, qty: Math.min(qty, maxQty(line.item)) } };
    });
  };

  const checkout = async () => {
    if (!count || checkingOut || tradeLocked) return;
    setCheckoutError(null);

    const name = customerName.trim();
    const phone = customerPhone.trim();
    if (balanceOwed > 0) {
      if (!name || !phone) {
        setCheckoutError('Credit sales need customer name and phone.');
        return;
      }
      if (!dueDate) {
        setCheckoutError('Pick a due date for the balance.');
        return;
      }
    }
    if (payTerms === 'part' && paidNow <= 0) {
      setCheckoutError('Enter how much they paid now.');
      return;
    }
    if (payTerms === 'part' && paidNow >= total) {
      setCheckoutError('Part pay must be less than the total.');
      return;
    }

    setCheckingOut(true);
    const soldAt = new Date().toISOString();
    const dueIso = dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : undefined;
    const lineTotals = lines.map(lineTotal);
    const paidShares = payTerms === 'paid' ? lineTotals : allocatePaid(paidNow, lineTotals);
    let lastReceipt: string | undefined;
    let totalOwed = 0;

    try {
      for (let i = 0; i < lines.length; i++) {
        const { item, qty } = lines[i];
        const qtySold = item.mode === 'serialized' ? 1 : qty;
        const lineAmt = lineTotals[i];
        const linePaid = paidShares[i] ?? 0;
        const lineOwed = Math.max(0, lineAmt - linePaid);
        totalOwed += lineOwed;

        const record = await recordSale({
          item_id: item.id,
          item_name: item.name,
          item_category: item.category,
          item_brand: item.brand,
          item_mode: item.mode,
          sale_price: item.price,
          cost_price: item.cost_price ?? 0,
          payment_method: payMethod,
          payment_status: lineOwed > 0 ? 'credit' : 'paid',
          amount_paid: linePaid,
          balance_owed: lineOwed,
          due_date: lineOwed > 0 ? dueIso : undefined,
          customer_name: name || undefined,
          customer_phone: phone || undefined,
          sold_at: soldAt,
          serial_number: item.serial_number,
          imei: item.imei,
          device_details: item.deviceDetails,
          quantity_sold: qtySold,
          profit: (item.price - (item.cost_price ?? 0)) * qtySold,
        });
        lastReceipt = record.receipt_number;

        if (lineOwed > 0) {
          await createCreditRecord({
            sale_id: record.id,
            customer_name: name,
            customer_phone: phone,
            item_name: item.name,
            total_amount: lineAmt,
            amount_paid: linePaid,
            due_date: dueIso!,
            payments:
              linePaid > 0
                ? [{ amount: linePaid, date: soldAt, method: payMethod }]
                : [],
            notes: undefined,
          });
        }
      }
      setDone({ total, profit, receipt: lastReceipt, owed: totalOwed > 0 ? totalOwed : undefined });
      setCart({});
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Could not complete sale.');
    } finally {
      setCheckingOut(false);
    }
  };

  const reset = () => {
    setDone(null);
    setCustomerName('');
    setCustomerPhone('');
    setPayMethod('cash');
    setPayTerms('paid');
    setAmountPaidTotal(0);
    setDueDate(defaultDueDate());
    setCheckoutError(null);
    setQ('');
  };

  if (items === undefined) {
    return (
      <div className="app-page py-8 text-sm text-shell-muted">Loading till…</div>
    );
  }

  if (done) {
    return (
      <div className="app-page flex min-h-[50vh] items-center justify-center py-8">
        <Card className="w-full max-w-md border-shell-line bg-shell-surface text-center">
          <CardContent className="px-6 py-10">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
              <Check size={32} strokeWidth={2.4} />
            </div>
            <p className="font-display text-lg font-semibold text-shell-ink">
              Sale complete{done.receipt ? ` · ${done.receipt}` : ''}
            </p>
            <p className="mt-2 font-mono text-4xl font-bold text-shell-ink">{formatCurrency(done.total)}</p>
            {canViewProfit && (
              <p className="mt-2 text-sm font-semibold text-emerald-400">
                Profit {formatCurrency(done.profit)} ·{' '}
                {PAY_OPTIONS.find(p => p.method === payMethod)?.label ?? payMethod}
              </p>
            )}
            {done.owed ? (
              <p className="mt-1 text-sm font-medium text-amber-300">
                Balance owing {formatCurrency(done.owed)} · added to Credits
              </p>
            ) : null}
            <p className="mt-1 text-xs text-shell-muted">Stock, sales and cash-up updated.</p>
            <Button
              className="mt-6 w-full bg-violet-400 text-[#160a2e] hover:bg-violet-300"
              onClick={reset}
            >
              <ShoppingCart size={18} />
              Start next sale
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <PageHeader title="Quick till" subtitle="Tap to sell — stock, sales and the drawer all update at once">
        <Badge className="gap-1.5 border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Till open
        </Badge>
      </PageHeader>

      {tradeLocked && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {tradingGate.message}
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        {/* Product grid */}
        <div className="flex flex-col gap-3.5">
          <TillCatalogToolbar q={q} onQChange={setQ} cat={cat} onCatChange={setCat} />

          <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-3">
            {prods.map(item => (
              <ProductTile
                key={item.id}
                item={item}
                inCart={cart[item.id]?.qty ?? 0}
                disabled={tradeLocked || (cart[item.id]?.qty ?? 0) >= maxQty(item)}
                onAdd={() => add(item)}
              />
            ))}
            {prods.length === 0 && (
              <p className="col-span-full py-16 text-center text-sm text-shell-muted">
                Nothing in stock matches that.
              </p>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="xl:sticky xl:top-20">
          <TillCartPanel
            lines={lines}
            count={count}
            total={total}
            profit={profit}
            canViewProfit={canViewProfit}
          customerName={customerName}
          customerPhone={customerPhone}
          onCustomerNameChange={setCustomerName}
          onCustomerPhoneChange={setCustomerPhone}
          customerOptions={customerOptions}
          isWalkIn={isWalkIn}
          onSelectWalkIn={() => selectCustomer('walk-in')}
            onSelectContact={selectCustomer}
            payTerms={payTerms}
            onPayTermsChange={setPayTerms}
            amountPaidTotal={amountPaidTotal}
            onAmountPaidTotalChange={setAmountPaidTotal}
            dueDate={dueDate}
            onDueDateChange={setDueDate}
            paidNow={paidNow}
            balanceOwed={balanceOwed}
            checkoutError={checkoutError}
            payMethod={payMethod}
            onPayMethodChange={setPayMethod}
            onClear={() => setCart({})}
            onQtyChange={setQty}
            onCheckout={() => void checkout()}
            checkingOut={checkingOut}
            tradeLocked={tradeLocked}
          />
        </div>
      </div>
    </div>
  );
}

function TillCartPanel({
  lines,
  count,
  total,
  profit,
  canViewProfit,
  customerName,
  customerPhone,
  onCustomerNameChange,
  onCustomerPhoneChange,
  customerOptions,
  isWalkIn,
  onSelectWalkIn,
  onSelectContact,
  payTerms,
  onPayTermsChange,
  amountPaidTotal,
  onAmountPaidTotalChange,
  dueDate,
  onDueDateChange,
  paidNow,
  balanceOwed,
  checkoutError,
  payMethod,
  onPayMethodChange,
  onClear,
  onQtyChange,
  onCheckout,
  checkingOut,
  tradeLocked,
}: {
  lines: CartLine[];
  count: number;
  total: number;
  profit: number;
  canViewProfit: boolean;
  customerName: string;
  customerPhone: string;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  customerOptions: ContactRecord[];
  isWalkIn: boolean;
  onSelectWalkIn: () => void;
  onSelectContact: (contact: ContactRecord) => void;
  payTerms: PayTerms;
  onPayTermsChange: (value: PayTerms) => void;
  amountPaidTotal: number;
  onAmountPaidTotalChange: (value: number) => void;
  dueDate: string;
  onDueDateChange: (value: string) => void;
  paidNow: number;
  balanceOwed: number;
  checkoutError: string | null;
  payMethod: PaymentMethod;
  onPayMethodChange: (value: PaymentMethod) => void;
  onClear: () => void;
  onQtyChange: (id: string, qty: number) => void;
  onCheckout: () => void;
  checkingOut: boolean;
  tradeLocked: boolean;
}) {
  const canCharge = count > 0 && !checkingOut && !tradeLocked;
  const needsCreditDetails = payTerms !== 'paid';

  return (
    <Card className="flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden border-shell-line bg-shell-surface p-0 shadow-none">
      <div className="flex items-center justify-between gap-3 border-b border-shell-line px-4 py-3">
        <div className="inline-flex min-w-0 items-center gap-2">
          <ShoppingCart size={17} className="shrink-0 text-shell-muted" />
          <span className="font-display text-[15px] font-semibold text-shell-ink">Cart</span>
          {count > 0 ? (
            <span className="rounded-md bg-shell-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-medium text-shell-muted">
              {count}
            </span>
          ) : null}
        </div>
        {count > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-shell-muted transition-colors hover:text-shell-ink"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="min-h-[7rem] flex-1 overflow-y-auto">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-3 grid size-11 place-items-center rounded-lg border border-shell-line bg-shell-surface-2/60 text-shell-muted">
              <ShoppingCart size={20} strokeWidth={1.6} />
            </div>
            <p className="text-sm font-medium text-shell-ink">No items yet</p>
            <p className="mt-1 max-w-[200px] text-xs leading-relaxed text-shell-muted">
              Tap a product on the left to add it here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-shell-line">
            {lines.map(({ item, qty }) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <CategoryThumb category={item.category} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-shell-ink">{item.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-shell-muted">
                    {formatCurrency(item.price)}
                    {qty > 1 ? ` × ${qty}` : ''}
                  </p>
                </div>
                <QtyStepper
                  qty={qty}
                  onDec={() => onQtyChange(item.id, qty - 1)}
                  onInc={() => onQtyChange(item.id, qty + 1)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-shell-line p-4">
        {(count > 0 || canViewProfit) && (
          <div className="rounded-lg border border-shell-line bg-shell-surface-2/35 px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-shell-muted">Total</span>
              <span className="font-mono text-lg font-semibold tabular-nums text-shell-ink">
                {formatCurrency(total)}
              </span>
            </div>
            {canViewProfit ? (
              <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-shell-line/70 pt-1.5">
                <span className="text-[11px] text-shell-muted">Est. profit</span>
                <span className="font-mono text-xs font-medium tabular-nums text-emerald-400/90">
                  {formatCurrency(profit)}
                </span>
              </div>
            ) : null}
            {balanceOwed > 0 ? (
              <>
                <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-shell-line/70 pt-1.5">
                  <span className="text-[11px] text-shell-muted">Paid now</span>
                  <span className="font-mono text-xs font-medium tabular-nums text-shell-ink">
                    {formatCurrency(paidNow)}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <span className="text-[11px] text-shell-muted">Balance</span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-amber-300/90">
                    {formatCurrency(balanceOwed)}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        )}

        <TillPanelSection label="Customer">
          <div className="flex flex-wrap gap-1.5 border-b border-shell-line px-2 py-2">
            <button
              type="button"
              onClick={onSelectWalkIn}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                isWalkIn
                  ? 'border-violet-400/40 bg-violet-400/15 text-violet-200'
                  : 'border-shell-line bg-shell-surface-2/40 text-shell-muted hover:text-shell-ink',
              )}
            >
              Walk-in
            </button>
            {customerOptions.map(c => {
              const active =
                customerName.trim() === c.name.trim() &&
                (customerPhone.trim() || '') === (c.phone?.trim() || '');
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectContact(c)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                    active
                      ? 'border-violet-400/40 bg-violet-400/15 text-violet-200'
                      : 'border-shell-line bg-shell-surface-2/40 text-shell-muted hover:text-shell-ink',
                  )}
                >
                  {c.name.split('(')[0].trim()}
                </button>
              );
            })}
          </div>
          <div className="space-y-2 p-3">
            <Input
              type="text"
              value={customerName}
              onChange={e => onCustomerNameChange(e.target.value)}
              placeholder="Customer name"
              autoComplete="name"
              className={cn(settingsField, 'h-9 py-2 text-sm')}
            />
            <Input
              type="tel"
              inputMode="tel"
              value={customerPhone}
              onChange={e => onCustomerPhoneChange(e.target.value)}
              placeholder="Phone number"
              autoComplete="tel"
              className={cn(settingsField, 'h-9 py-2 text-sm')}
            />
          </div>
        </TillPanelSection>

        <TillPanelSection label="Payment">
          <div className="grid grid-cols-3 divide-x divide-shell-line border-b border-shell-line">
            {PAY_TERMS.map(({ label, value }) => {
              const active = payTerms === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onPayTermsChange(value)}
                  className={cn(
                    'relative py-2.5 text-xs font-medium transition-colors',
                    active
                      ? 'bg-violet-400/10 text-violet-200'
                      : 'text-shell-muted hover:bg-shell-surface-2/25 hover:text-shell-ink',
                  )}
                >
                  {label}
                  {active ? (
                    <span className="absolute inset-x-0 bottom-0 h-px bg-violet-400/60" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>
          {payTerms === 'part' ? (
            <div className="space-y-1.5 border-b border-shell-line p-3">
              <label className="text-[11px] font-medium text-shell-muted">Amount paid now</label>
              <CurrencyInput
                value={amountPaidTotal}
                onValueChange={v => onAmountPaidTotalChange(v ?? 0)}
                className={cn(settingsField, 'h-9 py-2 text-sm font-mono')}
              />
            </div>
          ) : null}
          {needsCreditDetails ? (
            <div className="space-y-1.5 border-b border-shell-line p-3">
              <DatePickerField
                id="till-due-date"
                label="Balance due by"
                value={dueDate}
                onChange={onDueDateChange}
              />
              <p className="text-[10px] leading-relaxed text-shell-muted">
                Name and phone required — balance goes to Credits.
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-3 divide-x divide-shell-line">
            {PAY_OPTIONS.map(({ label, method }) => {
              const active = payMethod === method;
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => onPayMethodChange(method)}
                  className={cn(
                    'relative py-2.5 text-xs font-medium transition-colors',
                    active
                      ? 'bg-shell-surface-2/50 text-shell-ink'
                      : 'text-shell-muted hover:bg-shell-surface-2/25 hover:text-shell-ink'
                  )}
                >
                  {label}
                  {active ? (
                    <span className="absolute inset-x-0 bottom-0 h-px bg-shell-ink/70" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>
        </TillPanelSection>

        {checkoutError ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {checkoutError}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!canCharge}
          onClick={onCheckout}
          className={cn(
            'shell-inset-field flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors',
            canCharge
              ? 'bg-violet-400 text-[#160a2e] hover:bg-violet-300'
              : 'cursor-not-allowed border border-shell-line bg-shell-surface-2/40 text-shell-muted'
          )}
        >
          <span className="inline-flex items-center gap-2">
            <Check size={17} strokeWidth={2.2} />
            {checkingOut
              ? 'Processing…'
              : payTerms === 'credit'
                ? 'Record credit'
                : payTerms === 'part'
                  ? 'Charge deposit'
                  : 'Charge'}
          </span>
          <span className="font-mono text-base font-bold tabular-nums">
            {formatCurrency(payTerms === 'paid' ? total : paidNow || total)}
          </span>
        </button>
      </div>
    </Card>
  );
}

function TillPanelSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-shell-line">
      <p className="border-b border-shell-line px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-shell-muted">
        {label}
      </p>
      {children}
    </div>
  );
}

function TillCatalogToolbar({
  q,
  onQChange,
  cat,
  onCatChange,
}: {
  q: string;
  onQChange: (value: string) => void;
  cat: CategoryTab;
  onCatChange: (value: CategoryTab) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-shell-line bg-shell-surface">
      <div className="flex items-center gap-2.5 border-b border-shell-line px-3 py-2 transition-colors focus-within:bg-shell-surface-2/30">
        <Search className="size-[15px] shrink-0 text-shell-muted" aria-hidden />
        <Input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={q}
          onChange={e => onQChange(e.target.value)}
          placeholder="Search products, brand, IMEI…"
          autoComplete="off"
          className="shell-inset-field h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm text-shell-ink outline-none placeholder:text-shell-muted focus:outline-none focus-visible:outline-none focus-visible:ring-0"
        />
      </div>
      <div
        className="flex gap-0 overflow-x-auto px-1"
        role="tablist"
        aria-label="Product category"
      >
        {CATEGORY_TABS.map(c => {
          const active = cat === c;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onCatChange(c)}
              className={cn(
                'relative shrink-0 px-3.5 py-2.5 text-xs font-medium transition-colors',
                active
                  ? 'text-shell-ink after:absolute after:inset-x-3.5 after:bottom-0 after:h-px after:bg-shell-ink/70'
                  : 'text-shell-muted hover:text-shell-ink'
              )}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProductTile({
  item,
  inCart,
  disabled,
  onAdd,
}: {
  item: InventoryItem;
  inCart: number;
  disabled?: boolean;
  onAdd: () => void;
}) {
  const stock = getItemQty(item);
  const low = stock <= item.low_stock_threshold;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onAdd}
      className={cn(
        'relative flex flex-col gap-2 rounded-[14px] border p-3 text-left transition-all',
        'bg-shell-surface hover:border-violet-400/50 hover:-translate-y-0.5',
        inCart > 0 ? 'border-violet-400/55' : 'border-shell-line',
        disabled && 'opacity-55 hover:translate-y-0'
      )}
    >
      {inCart > 0 && (
        <span className="absolute right-2 top-2 grid min-w-[22px] place-items-center rounded-full bg-violet-400 px-1.5 py-0.5 font-mono text-xs font-bold text-[#160a2e]">
          {inCart}
        </span>
      )}
      <CategoryThumb category={item.category as Category} size="sm" className="!h-10 !w-10" />
      <div className="min-w-0">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-shell-ink">{item.name}</p>
        <p className="mt-0.5 truncate text-[11px] text-shell-muted">{itemSpecLine(item)}</p>
      </div>
      <div className="mt-auto flex items-center justify-between gap-1">
        <span className="font-mono text-[13px] font-bold text-shell-ink">{formatCurrency(item.price)}</span>
        <span className={cn('font-mono text-[11px]', low ? 'text-amber-400' : 'text-shell-muted')}>
          {stock} left
        </span>
      </div>
    </button>
  );
}

function QtyStepper({ qty, onDec, onInc }: { qty: number; onDec: () => void; onInc: () => void }) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-md border border-shell-line bg-shell-surface-2/50">
      <button
        type="button"
        onClick={onDec}
        className="shell-inset-field grid h-7 w-6 place-items-center text-shell-muted transition-colors hover:bg-shell-surface-2 hover:text-shell-ink"
        aria-label="Decrease quantity"
      >
        <Minus size={13} />
      </button>
      <span className="w-5 text-center font-mono text-xs font-semibold tabular-nums text-shell-ink">{qty}</span>
      <button
        type="button"
        onClick={onInc}
        className="shell-inset-field grid h-7 w-6 place-items-center text-shell-muted transition-colors hover:bg-shell-surface-2 hover:text-shell-ink"
        aria-label="Increase quantity"
      >
        <Plus size={13} />
      </button>
    </div>
  );
}
