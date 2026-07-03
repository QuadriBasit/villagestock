import { X, Receipt, Shield, RotateCcw, Wallet, Share2 } from "lucide-react";
import { ModalSheetPortal } from "@/components/ui/ModalSheetPortal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CategoryThumb } from "@/components/inventory/CategoryThumb";
import { cn, formatCurrency } from "@/lib/utils";
import {
  modalSheetBackdrop,
  modalSheetBodyScroll,
  modalSheetHandle,
} from "@/lib/modalSheet";
import type { PaymentMethod, SalesRecord } from "@/types";
import {
  formatIdentifierDisplay,
  formatWarrantyCover,
  getSaleWarrantyCover,
  identifierLabel,
  saleIdentifier,
  saleWarrantyStatus,
} from "@/lib/warranty";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Transfer",
  pos: "POS",
};

type SaleDetailModalProps = {
  sale: SalesRecord | null;
  canViewProfit: boolean;
  onClose: () => void;
  onReceipt: (sale: SalesRecord) => void;
  onWarranty: (sale: SalesRecord) => void;
  onReturn: (sale: SalesRecord) => void;
  onRecordPayment?: (sale: SalesRecord) => void;
};

export default function SaleDetailModal({
  sale,
  canViewProfit,
  onClose,
  onReceipt,
  onWarranty,
  onReturn,
  onRecordPayment,
}: SaleDetailModalProps) {
  if (!sale) return null;

  const total = sale.sale_price * sale.quantity_sold;
  const owing =
    sale.payment_status === "credit" && (sale.balance_owed ?? 0) > 0;
  const paid = sale.amount_paid ?? total - (sale.balance_owed ?? 0);
  const warranty = saleWarrantyStatus(sale);
  const cover = getSaleWarrantyCover(sale);
  const idKind = identifierLabel(sale);
  const idCode = saleIdentifier(sale);
  const soldDate = new Date(sale.sold_at).toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <ModalSheetPortal>
      <div className={cn(modalSheetBackdrop, "bg-black/70")} onClick={onClose}>
        <div
          className="flex min-h-0 w-full max-h-[min(92dvh,calc(100dvh-1.5rem))] max-w-lg flex-col overflow-hidden rounded-t-[1.25rem] border border-shell-line bg-shell-surface shadow-[var(--shadow-shell-elevated)] sm:max-h-[min(85dvh,calc(100dvh-3rem))] sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={modalSheetHandle}>
            <div className="h-1 w-10 rounded-full bg-shell-line" />
          </div>

          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-shell-line px-5 py-4">
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-semibold text-shell-ink">
                {sale.receipt_number}
              </h2>
              <p className="mt-0.5 text-xs text-shell-muted">{soldDate}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shell-inset-field rounded-lg p-1.5 text-shell-muted hover:bg-shell-surface-2 hover:text-shell-ink"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className={cn(modalSheetBodyScroll, "px-5 py-4")}>
            <div className="flex items-center gap-3 rounded-lg border border-shell-line bg-shell-surface-2/35 p-3">
              <CategoryThumb category={sale.item_category} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-shell-ink">
                  {sale.item_name}
                </p>
                <p className="text-xs text-shell-muted">
                  {sale.quantity_sold > 1 ? `${sale.quantity_sold}× ` : ""}
                  {formatCurrency(sale.sale_price)}
                  {sale.item_brand ? ` · ${sale.item_brand}` : ""}
                </p>
                {idKind && idCode ? (
                  <p className="mt-1 font-mono text-[11px] text-shell-muted">
                    {idKind}: {formatIdentifierDisplay(idCode, idKind)}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-shell-ink">
                {formatCurrency(total)}
              </span>
            </div>

            {owing ? (
              <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-shell-muted">
                    Paid {formatCurrency(paid)} of {formatCurrency(total)}
                  </span>
                  <span className="font-semibold text-amber-200">
                    {formatCurrency(sale.balance_owed ?? 0)} outstanding
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-shell-surface-2">
                  <div
                    className="h-full rounded-full bg-emerald-400/80"
                    style={{ width: `${Math.min(100, (paid / total) * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-4 divide-y divide-shell-line rounded-lg border border-shell-line">
              <DetailRow
                label="Customer"
                value={sale.customer_name || "Walk-in"}
              />
              <DetailRow
                label="Payment"
                value={
                  owing
                    ? "Credit"
                    : sale.payment_method
                      ? PAYMENT_LABELS[sale.payment_method]
                      : "—"
                }
              />
              <DetailRow
                label="Warranty"
                value={
                  cover.value
                    ? `${formatWarrantyCover(cover)} · ${
                        warranty.active
                          ? `${warranty.leftDays}d left`
                          : "expired"
                      }`
                    : "None"
                }
              />
              {canViewProfit ? (
                <DetailRow
                  label="Profit"
                  value={formatCurrency(sale.profit)}
                  mono
                />
              ) : null}
              <DetailRow
                label="Total"
                value={formatCurrency(total)}
                mono
                strong
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-10 border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                onClick={() => onReceipt(sale)}
              >
                <Receipt size={16} />
                Receipt
              </Button>
              <Button
                variant="outline"
                className="h-10 border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                onClick={() => onWarranty(sale)}
                disabled={!cover.value}
              >
                <Shield size={16} />
                Warranty slip
              </Button>
              <Button
                variant="outline"
                className="h-10 border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                onClick={() => onReturn(sale)}
                disabled={!!sale.returned}
              >
                <RotateCcw size={16} />
                Return / RMA
              </Button>
              {owing ? (
                <Button
                  className="h-10 bg-violet-400 text-[#160a2e] hover:bg-violet-300"
                  onClick={() => onRecordPayment?.(sale)}
                >
                  <Wallet size={16} />
                  Record payment
                </Button>
              ) : (
                <Button
                  className="h-10 bg-violet-400 text-[#160a2e] hover:bg-violet-300"
                  onClick={() => onReceipt(sale)}
                >
                  <Share2 size={16} />
                  Send receipt
                </Button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge
                variant={owing ? "outline" : "success"}
                className={
                  owing ? "border-amber-500/30 text-amber-200" : undefined
                }
              >
                {sale.returned ? "Returned" : owing ? "Owing" : "Paid"}
              </Badge>
              {cover.value > 0 ? (
                <Badge
                  className={
                    warranty.active
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                      : "border-red-500/25 bg-red-500/10 text-red-300"
                  }
                >
                  {warranty.active ? "In warranty" : "Warranty expired"}
                </Badge>
              ) : null}
              {sale.sale_type === "swap" ? (
                <Badge className="border-violet-400/25 bg-violet-400/10 text-violet-200">
                  Swap
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </ModalSheetPortal>
  );
}

function DetailRow({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <span className="text-[13px] text-shell-muted">{label}</span>
      <span
        className={cn(
          "text-[13px] text-shell-ink",
          mono && "font-mono tabular-nums",
          strong ? "text-base font-semibold" : "font-medium",
        )}
      >
        {value}
      </span>
    </div>
  );
}
