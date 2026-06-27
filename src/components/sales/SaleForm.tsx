import { useState, lazy, Suspense, useRef, useEffect, useMemo } from "react";
import { useShopAccess } from "@/context/ShopAccessContext";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Loader2, ShoppingCart, Receipt as ReceiptIcon } from "lucide-react";
import { useSalesActions } from "@/hooks/useSalesActions";
import { useTradingGateState } from "@/hooks/useStockSessions";
import { useCreditActions } from "@/hooks/useCreditActions";
import {
  modalSheetBackdrop,
  modalSheetFooter,
  modalSheetHandle,
  modalSheetPanelMd,
} from "@/lib/modalSheet";
import { ModalSheetPortal } from "@/components/ui/ModalSheetPortal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { Input } from "@/components/ui/Input";
import { TimePickerField } from "@/components/ui/TimePickerField";
import { formatCurrency, cn } from "@/lib/utils";
import {
  salesField,
  salesLabel,
  salesReadonlyField,
  salesModalHeader,
  salesModalBody,
} from "./salesModalUi";
import { saleBlockedMissingIdentifiers } from "@/lib/serializedIdentifiers";
import type {
  InventoryItem,
  PaymentMethod,
  PaymentStatus,
  SalesRecord,
} from "@/types";

const ReceiptModal = lazy(() => import("./ReceiptModal"));

const schema = z.object({
  sale_price: z.coerce.number().positive("Sale price must be greater than 0"),
  payment_status: z.enum(["paid", "credit"]),
  payment_method: z.enum(["cash", "bank_transfer", "pos"]).optional(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  amount_paid: z.coerce.number().min(0).optional(),
  due_date: z.string().optional(),
  sold_at: z.string().min(1),
  quantity_sold: z.coerce.number().int().positive().optional(),
});
type FormData = z.infer<typeof schema>;

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  pos: "POS / Card",
};

interface SaleFormProps {
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
}

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parse `sold_at` (`YYYY-MM-DDTHH:mm`) for split date / time inputs. */
function parseSoldAtLocal(iso: string | undefined): {
  date: string;
  time: string;
} {
  const base = (iso?.trim() || toLocalDatetimeValue(new Date())).slice(0, 16);
  const t = base.indexOf("T");
  if (t === -1) {
    const d = base.slice(0, 10) || new Date().toISOString().slice(0, 10);
    return { date: d, time: "12:00" };
  }
  const date = base.slice(0, t);
  const timeRaw = base.slice(t + 1);
  const time = timeRaw.length >= 5 ? timeRaw.slice(0, 5) : "12:00";
  return { date, time };
}

const itemMetaPill =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium";
const itemPillNeutral = `${itemMetaPill} border-shell-line bg-shell-surface-2/40 text-shell-muted`;
const itemPillTeal = `${itemMetaPill} border-emerald-400/30 bg-emerald-500/10 text-emerald-300`;
const itemPillMono = `${itemMetaPill} border-shell-line bg-shell-surface-2/40 font-mono text-[10px] tracking-tight text-shell-muted`;

export default function SaleForm({ item, onClose, onSuccess }: SaleFormProps) {
  const { recordSale } = useSalesActions();
  const { createCreditRecord } = useCreditActions();
  const tradingGate = useTradingGateState();
  const { canViewProfit } = useShopAccess();
  const [completedSale, setCompletedSale] = useState<SalesRecord | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitErrorRef = useRef<HTMLParagraphElement>(null);

  const isSerialized = item.mode === "serialized";
  const identifierBlock = useMemo(
    () => (isSerialized ? saleBlockedMissingIdentifiers(item) : null),
    [isSerialized, item],
  );

  useEffect(() => {
    if (!submitError) return;
    submitErrorRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [submitError]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      sale_price: item.price,
      payment_status: "paid",
      payment_method: "cash",
      amount_paid: 0,
      sold_at: toLocalDatetimeValue(new Date()),
      quantity_sold: 1,
    },
  });

  const salePrice = watch("sale_price") ?? item.price;
  const qtySold = isSerialized ? 1 : (watch("quantity_sold") ?? 1);
  const paymentStatus = watch("payment_status") as PaymentStatus;
  const amountPaid = watch("amount_paid") ?? 0;
  const unitProfit = salePrice - (item.cost_price ?? 0);
  const hasProfit = item.cost_price != null && item.cost_price > 0;
  const totalAmount = salePrice * qtySold;
  const balanceOwed = Math.max(0, totalAmount - amountPaid);
  const soldAtRaw = watch("sold_at");
  const { date: saleDateStr, time: saleTimeStr } = parseSoldAtLocal(soldAtRaw);

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    if (data.payment_status === "credit") {
      const name = (data.customer_name ?? "").trim();
      const phone = (data.customer_phone ?? "").trim();
      const due = (data.due_date ?? "").trim();
      if (!name || !phone || !due) {
        setSubmitError(
          "For credit sales, fill in customer name, phone, and due date.",
        );
        return;
      }
    }
    try {
      const sale = await recordSale({
        item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        item_brand: item.brand,
        item_mode: item.mode,
        serial_number: item.serial_number,
        imei: item.imei,
        device_details: item.deviceDetails,
        sale_price: data.sale_price,
        cost_price: item.cost_price ?? 0,
        profit: (data.sale_price - (item.cost_price ?? 0)) * qtySold,
        payment_method:
          data.payment_status === "paid"
            ? data.payment_method
            : data.payment_method || undefined,
        payment_status: data.payment_status,
        amount_paid:
          data.payment_status === "credit"
            ? (data.amount_paid ?? 0)
            : totalAmount,
        balance_owed: data.payment_status === "credit" ? balanceOwed : 0,
        due_date:
          data.payment_status === "credit" && data.due_date
            ? new Date(data.due_date).toISOString()
            : undefined,
        customer_name: data.customer_name || undefined,
        customer_phone: data.customer_phone || undefined,
        quantity_sold: qtySold,
        sold_at: new Date(data.sold_at).toISOString(),
      });
      if (data.payment_status === "credit") {
        await createCreditRecord({
          sale_id: sale.id,
          customer_name: data.customer_name!,
          customer_phone: data.customer_phone!,
          item_name: item.name,
          total_amount: totalAmount,
          amount_paid: data.amount_paid ?? 0,
          due_date: new Date(data.due_date!).toISOString(),
          payments:
            data.amount_paid && data.amount_paid > 0
              ? [
                  {
                    amount: data.amount_paid,
                    date: new Date(data.sold_at).toISOString(),
                    method: data.payment_method,
                  },
                ]
              : [],
          notes: undefined,
        });
      }
      setCompletedSale(sale);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not record sale");
    }
  };

  const tradeLocked =
    tradingGate.gateApplies &&
    tradingGate.isReady &&
    tradingGate.tradingBlocked;
  const canSell =
    !tradeLocked &&
    (isSerialized ? item.status === "in_stock" : item.quantity > 0) &&
    !identifierBlock;

  const fieldClass = salesField;
  const labelClass = salesLabel;
  const readonlyClass = salesReadonlyField;

  return (
    <ModalSheetPortal>
      <div className={modalSheetBackdrop} onClick={onClose}>
        <div className={cn(modalSheetPanelMd, 'border-shell-line bg-shell-surface')} onClick={(e) => e.stopPropagation()}>
          <div className={modalSheetHandle}>
            <div className="h-1 w-10 rounded-full bg-shell-line" />
          </div>

          <div className={salesModalHeader}>
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-violet-300" />
              <h2 className="font-display text-base font-bold text-shell-ink">
                Record Sale
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-shell-muted transition hover:bg-shell-surface-2 hover:text-shell-ink"
            >
              <X size={18} />
            </button>
          </div>

          <div className={salesModalBody}>
            {tradeLocked && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-100">
                {tradingGate.message}
              </p>
            )}
            {identifierBlock && (
              <p
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-100"
              >
                {identifierBlock}
              </p>
            )}
            {submitError && (
              <p
                ref={submitErrorRef}
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
              >
                {submitError}
              </p>
            )}
            {/* Item snapshot */}
            <section className="rounded-2xl border border-shell-line bg-shell-surface p-4 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-shell-muted">
                Item
              </h3>
              <p className="mt-2 text-base font-semibold leading-snug text-shell-ink">
                {item.name}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`${itemPillNeutral} capitalize`}>
                  {item.category}
                </span>
                <span className={itemPillNeutral}>{item.brand}</span>
                {isSerialized ? (
                  <span className={itemPillTeal}>Serialized unit</span>
                ) : (
                  <span className={itemPillNeutral}>
                    {item.quantity} in stock
                  </span>
                )}
                {isSerialized && item.imei && (
                  <span className={itemPillMono} title="IMEI">
                    IMEI {item.imei}
                  </span>
                )}
                {isSerialized && item.serial_number && (
                  <span className={itemPillMono} title="Serial number">
                    S/N {item.serial_number}
                  </span>
                )}
              </div>
            </section>

            {/* Sale details */}
            <section className="rounded-xl border border-shell-line bg-shell-surface p-4 shadow-none space-y-4">
              <h3 className="text-xs font-semibold text-shell-muted uppercase tracking-wider">
                Sale Details
              </h3>

              <div>
                <label className={labelClass} htmlFor="sale_price">
                  Sale Price (₦) *
                  <span className="ml-2 text-shell-muted font-normal text-xs">
                    Listed: {formatCurrency(item.price)}
                  </span>
                </label>
                <Controller
                  name="sale_price"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      id="sale_price"
                      ref={field.ref}
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      className={fieldClass}
                      aria-invalid={!!errors.sale_price}
                    />
                  )}
                />
                {errors.sale_price && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.sale_price.message}
                  </p>
                )}
                {canViewProfit && hasProfit && (
                  <p
                    className={`mt-1 text-xs font-medium ${unitProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {unitProfit >= 0 ? "Profit" : "Loss"}:{" "}
                    {formatCurrency(Math.abs(unitProfit))}
                    {!isSerialized && qtySold > 1
                      ? ` × ${qtySold} = ${formatCurrency(Math.abs(unitProfit) * qtySold)}`
                      : ""}
                  </p>
                )}
              </div>

              {/* Quantity — only for non-serialized */}
              {!isSerialized && (
                <div>
                  <label className={labelClass} htmlFor="quantity_sold">
                    Quantity *
                  </label>
                  <Input
                    id="quantity_sold"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={item.quantity}
                    {...register("quantity_sold")}
                    className={fieldClass}
                  />
                  {errors.quantity_sold && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.quantity_sold.message}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className={labelClass} htmlFor="payment_status">
                  Payment Status *
                </label>
                <Controller
                  name="payment_status"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="payment_status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="payment_method">
                  Payment Method *
                </label>
                <Controller
                  name="payment_method"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? "cash"}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger id="payment_method" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {(
                          Object.entries(PAYMENT_LABELS) as [
                            PaymentMethod,
                            string,
                          ][]
                        ).map(([val, lbl]) => (
                          <SelectItem key={val} value={val}>
                            {lbl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {paymentStatus === "credit" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass} htmlFor="amount_paid">
                        Amount Paid So Far
                      </label>
                      <Controller
                        name="amount_paid"
                        control={control}
                        render={({ field }) => (
                          <CurrencyInput
                            id="amount_paid"
                            ref={field.ref}
                            value={field.value ?? 0}
                            onValueChange={field.onChange}
                            onBlur={field.onBlur}
                            className={fieldClass}
                          />
                        )}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Balance Owed</label>
                      <div className={readonlyClass}>
                        {formatCurrency(balanceOwed)}
                      </div>
                    </div>
                  </div>
                  <Controller
                    name="due_date"
                    control={control}
                    render={({ field }) => (
                      <DatePickerField
                        id="due_date"
                        label="Due date *"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </>
              )}

              <div>
                <span className={labelClass}>Date &amp; time of sale *</span>
                <p className="mb-3 text-[11px] leading-snug text-shell-muted">
                  Uses your device&apos;s local timezone. You can set date and
                  time separately.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <DatePickerField
                      id="sold_at_date"
                      label="Date"
                      value={saleDateStr}
                      onChange={(ymd) => {
                        const { time } = parseSoldAtLocal(getValues("sold_at"));
                        setValue("sold_at", `${ymd}T${time}`, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                      }}
                    />
                  </div>
                  <TimePickerField
                    id="sold_at_time"
                    label="Time"
                    value={saleTimeStr}
                    onChange={(v) => {
                      const { date } = parseSoldAtLocal(getValues("sold_at"));
                      setValue("sold_at", `${date}T${v}`, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                    triggerClassName="h-11 rounded-xl border-shell-line bg-shell-surface-2/30 shadow-sm shadow-zinc-900/[0.04]"
                  />
                </div>
                {errors.sold_at && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.sold_at.message}
                  </p>
                )}
              </div>
            </section>

            {/* Customer (optional) */}
            <section className="rounded-xl border border-shell-line bg-shell-surface p-4 shadow-none space-y-4">
              <h3 className="text-xs font-semibold text-shell-muted uppercase tracking-wider">
                Customer{" "}
                <span className="normal-case font-normal">
                  {paymentStatus === "credit"
                    ? "(required for credit)"
                    : "(optional)"}
                </span>
              </h3>
              <div>
                <label className={labelClass} htmlFor="customer_name">
                  Customer Name
                </label>
                <Input
                  id="customer_name"
                  type="text"
                  {...register("customer_name")}
                  placeholder="e.g. Emeka Obi"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="customer_phone">
                  Phone Number
                </label>
                <Input
                  id="customer_phone"
                  type="tel"
                  inputMode="tel"
                  {...register("customer_phone")}
                  placeholder="e.g. 08012345678"
                  className={fieldClass}
                />
              </div>
            </section>
          </div>

          <div className={modalSheetFooter}>
            {completedSale ? (
              <div className="space-y-2">
                <p className="mb-1 text-center text-sm font-medium text-emerald-400">
                  ✓ Sale recorded — {completedSale.receipt_number}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={onSuccess}
                    className="flex-1 rounded-xl border border-shell-line py-3 text-sm font-medium text-shell-muted transition-colors hover:bg-shell-surface-2/50"
                  >
                    Done
                  </button>
                  <button
                    onClick={() => setShowReceipt(true)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-400"
                  >
                    <ReceiptIcon size={16} /> View Receipt
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting || !canSell}
                className="w-full bg-violet-400 text-[#160a2e] rounded-xl py-3.5 font-display font-semibold text-sm hover:bg-violet-300 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Recording…
                  </>
                ) : !canSell ? (
                  identifierBlock ? (
                    "Add IMEI or serial on the item first"
                  ) : tradeLocked ? (
                    tradingGate.message
                  ) : isSerialized ? (
                    `Unit is ${item.status}`
                  ) : (
                    "Out of Stock"
                  )
                ) : (
                  <>
                    <ShoppingCart size={16} /> Confirm Sale
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {completedSale && showReceipt && (
          <Suspense fallback={null}>
            <ReceiptModal
              sale={completedSale}
              onClose={() => setShowReceipt(false)}
            />
          </Suspense>
        )}
      </div>
    </ModalSheetPortal>
  );
}
