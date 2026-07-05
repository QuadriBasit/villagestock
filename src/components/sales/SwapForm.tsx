import { useState, lazy, Suspense, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRightLeft,
  Loader2,
  Receipt as ReceiptIcon,
} from "lucide-react";
import { useSwapActions } from "@/hooks/useSwapActions";
import { useTradingGateState } from "@/hooks/useStockSessions";
import { modalSheetFooter, modalSheetPanelLg } from '@/lib/modalSheet';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { ModalSheetClose } from '@/components/ui/ModalSheetClose';
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Input } from "@/components/ui/Input";
import { DatePickerField } from "@/components/ui/DatePickerField";
import {
  DateTimeField,
  toLocalDatetimeValue,
} from "@/components/ui/DateTimeField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { formatCurrency, cn } from "@/lib/utils";
import {
  salesField,
  salesLabel,
  salesReadonlyField,
  salesSection,
  salesModalHeader,
  salesModalBody,
} from "./salesModalUi";
import { saleBlockedMissingIdentifiers } from "@/lib/serializedIdentifiers";
import type {
  DeviceCondition,
  InventoryItem,
  PaymentMethod,
  PaymentStatus,
  SalesRecord,
} from "@/types";

const ReceiptModal = lazy(() => import("./ReceiptModal"));

const schema = z.object({
  incoming_brand: z.string().min(1, "Brand is required"),
  incoming_model: z.string().min(1, "Model is required"),
  incoming_imei: z.string().optional(),
  incoming_serial_number: z.string().optional(),
  condition: z.enum(["working", "minor_faults", "major_faults", "not_working"]),
  trade_in_value: z.coerce.number().min(0, "Trade-in value must be 0 or more"),
  sale_price: z.coerce.number().positive("Sale price must be greater than 0"),
  payment_status: z.enum(["paid", "credit"]),
  payment_method: z.enum(["cash", "bank_transfer", "pos"]).optional(),
  amount_paid: z.coerce.number().min(0).optional(),
  due_date: z.string().optional(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  date: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Transfer",
  pos: "POS",
};

const CONDITION_LABELS: Record<DeviceCondition, string> = {
  working: "Working",
  minor_faults: "Minor Faults",
  major_faults: "Major Faults",
  not_working: "Not Working",
};

export default function SwapForm({
  item,
  onClose,
  onSuccess,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { processSwap } = useSwapActions();
  const tradingGate = useTradingGateState();
  const [completedSale, setCompletedSale] = useState<SalesRecord | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      condition: "working",
      trade_in_value: 0,
      sale_price: item.price,
      payment_status: "paid",
      payment_method: "cash",
      amount_paid: 0,
      date: toLocalDatetimeValue(new Date()),
    },
  });

  const salePrice = watch("sale_price") ?? item.price;
  const tradeInValue = watch("trade_in_value") ?? 0;
  const paymentStatus = watch("payment_status") as PaymentStatus;
  const amountPaid = watch("amount_paid") ?? 0;
  const balance = salePrice - tradeInValue;
  const balanceOwed = Math.max(0, balance - amountPaid);

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    try {
      const sale = await processSwap({
        outgoingItem: item,
        incoming: {
          brand: data.incoming_brand,
          model: data.incoming_model,
          imei: data.incoming_imei || undefined,
          serial_number: data.incoming_serial_number || undefined,
          condition: data.condition,
          trade_in_value: data.trade_in_value,
        },
        sale_price: data.sale_price,
        payment_method:
          data.payment_status === "paid"
            ? data.payment_method
            : data.payment_method || undefined,
        payment_status: data.payment_status,
        amount_paid:
          data.payment_status === "credit"
            ? (data.amount_paid ?? 0)
            : Math.max(0, balance),
        due_date:
          data.payment_status === "credit" && data.due_date
            ? new Date(data.due_date).toISOString()
            : undefined,
        customer_name: data.customer_name || undefined,
        customer_phone: data.customer_phone || undefined,
        date: new Date(data.date).toISOString(),
      });
      setCompletedSale(sale);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Swap failed");
    }
  };

  const tradeLocked =
    tradingGate.gateApplies &&
    tradingGate.isReady &&
    tradingGate.tradingBlocked;
  const outgoingIdBlock = useMemo(
    () => saleBlockedMissingIdentifiers(item),
    [item],
  );
  const canSwap =
    item.status === "in_stock" && !tradeLocked && !outgoingIdBlock;

  const fieldClass = salesField;
  const labelClass = salesLabel;
  const readonlyClass = salesReadonlyField;
  const cardSection = salesSection;

  return (
    <ModalSheetPortal>
      <ModalSheetFrame onClose={onClose} panelClassName={cn(modalSheetPanelLg, 'border-shell-line bg-shell-surface')}>
<div className={salesModalHeader}>
            <div className="flex items-center gap-2">
              <ArrowRightLeft size={18} className="text-violet-300" />
              <h2 className="font-display text-base font-bold text-shell-ink">
                Device Swap / Trade-In
              </h2>
            </div>
            <ModalSheetClose />
          </div>

          <div className={salesModalBody}>
            {tradeLocked && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-100">
                {tradingGate.message}
              </p>
            )}
            {outgoingIdBlock && (
              <p
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-100"
              >
                {outgoingIdBlock}
              </p>
            )}
            {submitError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {submitError}
              </p>
            )}
            <section className={`${cardSection} space-y-4`}>
              <h3 className="text-xs font-semibold text-shell-muted uppercase tracking-wider">
                Incoming Device
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="incoming_brand">
                    Brand *
                  </label>
                  <Input
                    id="incoming_brand"
                    {...register("incoming_brand")}
                    className={fieldClass}
                    placeholder="Samsung"
                  />
                  {errors.incoming_brand && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.incoming_brand.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass} htmlFor="incoming_model">
                    Model *
                  </label>
                  <Input
                    id="incoming_model"
                    {...register("incoming_model")}
                    className={fieldClass}
                    placeholder="Galaxy S21"
                  />
                  {errors.incoming_model && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.incoming_model.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="incoming_imei">
                    IMEI
                  </label>
                  <Input
                    id="incoming_imei"
                    {...register("incoming_imei")}
                    className={fieldClass}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label
                    className={labelClass}
                    htmlFor="incoming_serial_number"
                  >
                    Serial Number
                  </label>
                  <Input
                    id="incoming_serial_number"
                    {...register("incoming_serial_number")}
                    className={fieldClass}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="condition">
                    Condition *
                  </label>
                  <Controller
                    name="condition"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="condition" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {(
                            Object.entries(CONDITION_LABELS) as [
                              DeviceCondition,
                              string,
                            ][]
                          ).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="trade_in_value">
                    Trade-In Value (₦) *
                  </label>
                  <Controller
                    name="trade_in_value"
                    control={control}
                    render={({ field }) => (
                      <CurrencyInput
                        id="trade_in_value"
                        ref={field.ref}
                        value={field.value ?? 0}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        className={fieldClass}
                        aria-invalid={!!errors.trade_in_value}
                      />
                    )}
                  />
                  {errors.trade_in_value && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.trade_in_value.message}
                    </p>
                  )}
                </div>
              </div>

              <p className="rounded-lg border border-shell-line bg-shell-surface-2/40/80 px-3 py-2 text-xs text-shell-muted /50 dark:text-shell-muted">
                Incoming device category will match the selected outgoing item
                category:{" "}
                <span className="font-medium capitalize">{item.category}</span>.
              </p>
            </section>

            <section className={`${cardSection} space-y-4`}>
              <h3 className="text-xs font-semibold text-shell-muted uppercase tracking-wider">
                Outgoing Device
              </h3>
              <div className={readonlyClass}>
                {item.brand} {item.name}
              </div>
              <div className="flex gap-2 flex-wrap text-xs text-shell-muted">
                <span className="bg-shell-surface-2/40 border border-shell-line rounded-full px-2 py-0.5 capitalize">
                  {item.category}
                </span>
                {item.serial_number && (
                  <span className="bg-shell-surface-2/40 border border-shell-line rounded-full px-2 py-0.5 font-mono">
                    S/N: {item.serial_number}
                  </span>
                )}
                {item.imei && (
                  <span className="bg-shell-surface-2/40 border border-shell-line rounded-full px-2 py-0.5 font-mono">
                    IMEI: {item.imei}
                  </span>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="sale_price">
                  Sale Price (₦) *
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
              </div>
            </section>

            <section className={`${cardSection} space-y-4`}>
              <h3 className="text-xs font-semibold text-shell-muted uppercase tracking-wider">
                Settlement
              </h3>

              <div className="rounded-xl border border-shell-line bg-shell-surface-2/40/90 px-4 py-3 /60">
                {balance >= 0 ? (
                  <>
                    <div className="text-xs text-shell-muted">Balance to pay</div>
                    <div className="font-display text-2xl font-bold text-violet-300">
                      {formatCurrency(balance)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-shell-muted">Credit to customer</div>
                    <div className="font-display text-2xl font-bold text-violet-300">
                      {formatCurrency(Math.abs(balance))}
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="payment_status">
                    Payment Status *
                  </label>
                  <Controller
                    name="payment_status"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
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
                          ).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
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

              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <DateTimeField
                    id="date"
                    label="Date & Time *"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="customer_name">
                    Customer Name
                  </label>
                  <Input
                    id="customer_name"
                    {...register("customer_name")}
                    className={fieldClass}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="customer_phone">
                    Customer Phone
                  </label>
                  <Input
                    id="customer_phone"
                    {...register("customer_phone")}
                    className={fieldClass}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </section>
          </div>

          <div className={modalSheetFooter}>
            {completedSale ? (
              <div className="space-y-2">
                <p className="mb-1 text-center text-sm font-medium text-emerald-400">
                  ✓ Swap recorded — {completedSale.receipt_number}
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
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting || !canSwap}
                className="w-full bg-violet-400 text-[#160a2e] rounded-xl py-3.5 font-display font-semibold text-sm hover:bg-violet-300 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Processing…
                  </>
                ) : !canSwap ? (
                  outgoingIdBlock ? (
                    "Add IMEI or serial on outgoing item first"
                  ) : tradeLocked ? (
                    tradingGate.message
                  ) : (
                    `Status: ${item.status ?? "unknown"}`
                  )
                ) : (
                  <>
                    <ArrowRightLeft size={16} /> Confirm Swap
                  </>
                )}
              </button>
            )}
          </div>
        
      </ModalSheetFrame>

      {completedSale && showReceipt && (
        <Suspense fallback={null}>
          <ReceiptModal
            sale={completedSale}
            onClose={() => setShowReceipt(false)}
          />
        </Suspense>
      )}
    </ModalSheetPortal>
  );
}
