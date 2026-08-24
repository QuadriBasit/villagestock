import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Loader2, RotateCcw, Search } from "lucide-react";
import { useReturnActions } from "@/hooks/useReturnActions";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useAuthStore } from "@/store/auth";
import { modalSheetFooter, modalSheetPanelMd } from '@/lib/modalSheet';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { ModalSheetClose } from '@/components/ui/ModalSheetClose';
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
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
import type {
  SalesRecord,
  ReturnReason,
  ReturnType,
  InventoryItem,
} from "@/types";

const schema = z.object({
  reason: z.enum(["defective", "changed_mind", "wrong_item", "other"]),
  return_type: z.enum(["refund", "exchange"]),
  notes: z.string().optional(),
  refund_amount: z.coerce.number().min(0),
  returned_at: z.string().min(1),
  exchange_item_id: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const REASON_LABELS: Record<ReturnReason, string> = {
  defective: "Defective / Faulty",
  changed_mind: "Changed Mind",
  wrong_item: "Wrong Item",
  other: "Other",
};

const RETURN_TYPE_LABELS: Record<ReturnType, string> = {
  refund: "Refund",
  exchange: "Exchange",
};

interface ReturnFormProps {
  sale: SalesRecord;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReturnForm({
  sale,
  onClose,
  onSuccess,
}: ReturnFormProps) {
  const { processReturn } = useReturnActions();
  const { user } = useAuthStore();
  const [exchangeSearch, setExchangeSearch] = useState("");
  const [selectedExchangeItem, setSelectedExchangeItem] =
    useState<InventoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inventoryItems = useLiveQuery(async () => {
    if (!user) return [];
    return db.inventory_items
      .where("user_id")
      .equals(user.id)
      .filter((i) => !i.deleted && i.quantity > 0)
      .toArray();
  }, [user?.id]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      reason: "defective",
      return_type: "refund",
      refund_amount: sale.sale_price,
      returned_at: toLocalDatetimeValue(new Date()),
    },
  });

  const returnType = watch("return_type");

  const filteredItems = (inventoryItems ?? []).filter((item) => {
    if (!exchangeSearch.trim()) return true;
    const q = exchangeSearch.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.brand.toLowerCase().includes(q) ||
      item.serial_number?.toLowerCase().includes(q) ||
      item.imei?.toLowerCase().includes(q)
    );
  });

  const onSubmit = async (data: FormData) => {
    setError(null);
    if (data.return_type === "exchange" && !selectedExchangeItem) {
      setError("Please select the exchange item.");
      return;
    }
    try {
      await processReturn({
        sale_id: sale.id,
        item_id: sale.item_id,
        reason: data.reason,
        return_type: data.return_type,
        notes: data.notes || undefined,
        refund_amount: data.refund_amount,
        returned_at: new Date(data.returned_at).toISOString(),
        exchange_item_id: selectedExchangeItem?.id,
        exchange_item_name: selectedExchangeItem?.name,
      });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to process return.");
    }
  };

  const fieldClass = salesField;
  const labelClass = salesLabel;
  const readonlyClass = salesReadonlyField;
  const cardSection = salesSection;

  return (
    <ModalSheetPortal>
      <ModalSheetFrame onClose={onClose} panelClassName={cn(
            modalSheetPanelMd,
            "border-shell-line bg-shell-surface",
          )}>
<div className={salesModalHeader}>
            <div className="flex items-center gap-2">
              <RotateCcw size={18} className="text-brand-300" />
              <h2 className="font-display text-base font-bold text-shell-ink">
                Process Return
              </h2>
            </div>
            <ModalSheetClose />
          </div>

          <div className={salesModalBody}>
            <section className={`${cardSection} space-y-2`}>
              <h3 className="text-xs font-semibold text-shell-muted uppercase tracking-wider">
                Original Sale
              </h3>
              <div className={readonlyClass}>{sale.item_name}</div>
              <div className="flex gap-2 text-xs text-shell-muted">
                <span className="bg-shell-surface-2/40 border border-shell-line rounded-full px-2 py-0.5">
                  {sale.receipt_number}
                </span>
                <span className="bg-shell-surface-2/40 border border-shell-line rounded-full px-2 py-0.5">
                  {formatCurrency(sale.sale_price)}
                </span>
                {sale.serial_number && (
                  <span className="bg-shell-surface-2/40 border border-shell-line rounded-full px-2 py-0.5 font-mono">
                    S/N: {sale.serial_number}
                  </span>
                )}
              </div>
            </section>

            {/* Return details */}
            <section className={`${cardSection} space-y-4`}>
              <h3 className="text-xs font-semibold text-shell-muted uppercase tracking-wider">
                Return Details
              </h3>

              <div>
                <label className={labelClass} htmlFor="reason">
                  Reason *
                </label>
                <Controller
                  name="reason"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="reason" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {(
                          Object.entries(REASON_LABELS) as [
                            ReturnReason,
                            string,
                          ][]
                        ).map(([val, label]) => (
                          <SelectItem key={val} value={val}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="return_type">
                  Return Type *
                </label>
                <Controller
                  name="return_type"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        setSelectedExchangeItem(null);
                        setExchangeSearch("");
                      }}
                    >
                      <SelectTrigger id="return_type" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {(
                          Object.entries(RETURN_TYPE_LABELS) as [
                            ReturnType,
                            string,
                          ][]
                        ).map(([val, label]) => (
                          <SelectItem key={val} value={val}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {returnType === "refund" && (
                <div>
                  <label className={labelClass} htmlFor="refund_amount">
                    Refund Amount (₦) *
                  </label>
                  <Controller
                    name="refund_amount"
                    control={control}
                    render={({ field }) => (
                      <CurrencyInput
                        id="refund_amount"
                        ref={field.ref}
                        value={field.value ?? 0}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        className={fieldClass}
                        aria-invalid={!!errors.refund_amount}
                      />
                    )}
                  />
                  {errors.refund_amount && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.refund_amount.message}
                    </p>
                  )}
                </div>
              )}

              <Controller
                name="returned_at"
                control={control}
                render={({ field }) => (
                  <DateTimeField
                    id="returned_at"
                    label="Date & Time *"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              <div>
                <label className={labelClass} htmlFor="notes">
                  Notes (optional)
                </label>
                <Textarea
                  id="notes"
                  {...register("notes")}
                  rows={2}
                  placeholder="Any additional notes…"
                  className={`${fieldClass} resize-none`}
                />
              </div>
            </section>

            {/* Exchange item picker */}
            {returnType === "exchange" && (
              <section className={`${cardSection} space-y-3`}>
                <h3 className="text-xs font-semibold text-shell-muted uppercase tracking-wider">
                  Exchange Item
                </h3>

                {selectedExchangeItem ? (
                  <div className="flex items-center justify-between rounded-xl border border-teal/30 bg-teal/5 px-3 py-2.5 dark:border-teal/40 dark:bg-teal/10">
                    <div>
                      <p className="text-sm font-medium text-shell-ink">
                        {selectedExchangeItem.name}
                      </p>
                      <p className="text-xs text-shell-muted">
                        {selectedExchangeItem.brand} ·{" "}
                        {formatCurrency(selectedExchangeItem.price)} ·{" "}
                        {selectedExchangeItem.quantity} in stock
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedExchangeItem(null)}
                      className="rounded-full p-1 text-shell-muted hover:bg-shell-surface-2"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-shell-muted"
                      />
                      <Input
                        type="text"
                        placeholder="Search by name, brand, IMEI…"
                        value={exchangeSearch}
                        onChange={(e) => setExchangeSearch(e.target.value)}
                        className={`${fieldClass} pl-8`}
                      />
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {filteredItems.length === 0 ? (
                        <p className="text-sm text-shell-muted text-center py-3">
                          No items found
                        </p>
                      ) : (
                        filteredItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedExchangeItem(item)}
                            className="w-full rounded-xl border border-shell-line px-3 py-2 text-left transition-colors hover:bg-shell-surface-2/50"
                          >
                            <p className="text-sm font-medium text-shell-ink">
                              {item.name}
                            </p>
                            <p className="text-xs text-shell-muted">
                              {item.brand} · {formatCurrency(item.price)} ·{" "}
                              {item.quantity} in stock
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
                {error &&
                  returnType === "exchange" &&
                  !selectedExchangeItem && (
                    <p className="text-red-500 text-xs">{error}</p>
                  )}
              </section>
            )}
          </div>

          <div className={modalSheetFooter}>
            {error && (returnType !== "exchange" || selectedExchangeItem) && (
              <p className="text-red-500 text-xs mb-2">{error}</p>
            )}
            <button
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className="w-full bg-brand-400 text-[#04231d] rounded-xl py-3.5 font-display font-semibold text-sm hover:bg-brand-300 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <RotateCcw size={16} /> Confirm Return
                </>
              )}
            </button>
          </div>
        
      </ModalSheetFrame>
    </ModalSheetPortal>
  );
}
