import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Loader2, MessageCircle, Receipt, Shield, RotateCcw, Wallet, Share2 } from "lucide-react";
import { toast } from "sonner";
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { ModalSheetClose } from "@/components/ui/ModalSheetClose";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { DateTimeField, toLocalDatetimeValue } from "@/components/ui/DateTimeField";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Label } from "@/components/ui/Label";
import { CategoryThumb } from "@/components/inventory/CategoryThumb";
import { useSalesActions } from "@/hooks/useSalesActions";
import { useShopAccess } from "@/context/ShopAccessContext";
import { useShopProfile } from "@/hooks/useShopProfile";
import { buildReceiptText, openWhatsApp } from "@/lib/whatsapp";
import { db } from "@/lib/db";
import { cn, formatCurrency } from "@/lib/utils";
import { modalSheetBodyScroll, modalSheetPanelMd } from '@/lib/modalSheet';
import { salesField } from "@/components/sales/salesModalUi";
import { expectedSaleCashAmount } from "@/lib/salePriceCorrection";
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

const PAYMENT_OPTIONS = (Object.entries(PAYMENT_LABELS) as [PaymentMethod, string][]).map(
  ([value, label]) => ({ value, label }),
);

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
  const { updateSaleSoldAt, updateSalePaymentMethod, updateSalePrice } = useSalesActions();
  const { hasPermission } = useShopAccess();
  const { profile } = useShopProfile();
  const liveSale = useLiveQuery(() => (sale ? db.sales_records.get(sale.id) : undefined), [sale?.id]) ?? sale;
  const [soldAt, setSoldAt] = useState(
    liveSale ? toLocalDatetimeValue(new Date(liveSale.sold_at)) : toLocalDatetimeValue(new Date()),
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    liveSale?.payment_method ?? "bank_transfer",
  );
  const [salePrice, setSalePrice] = useState(liveSale?.sale_price ?? 0);
  const [savingDate, setSavingDate] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingPrice, setSavingPrice] = useState(false);

  useEffect(() => {
    if (liveSale) {
      setSoldAt(toLocalDatetimeValue(new Date(liveSale.sold_at)));
      setPaymentMethod(liveSale.payment_method ?? "bank_transfer");
      setSalePrice(liveSale.sale_price);
    }
  }, [liveSale?.id, liveSale?.sold_at, liveSale?.payment_method, liveSale?.sale_price]);

  if (!sale || !liveSale) return null;

  const canEditDeal =
    liveSale.sale_type === "swap"
      ? hasPermission("edit_swaps")
      : hasPermission("edit_sales");
  const canReturn = hasPermission("process_returns");

  const total = liveSale.sale_price * liveSale.quantity_sold;
  const owing =
    liveSale.payment_status === "credit" && (liveSale.balance_owed ?? 0) > 0;
  const paid = liveSale.amount_paid ?? total - (liveSale.balance_owed ?? 0);
  const warranty = saleWarrantyStatus(liveSale);
  const cover = getSaleWarrantyCover(liveSale);
  const idKind = identifierLabel(liveSale);
  const idCode = saleIdentifier(liveSale);
  const soldDate = new Date(liveSale.sold_at).toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const saveSoldAt = async () => {
    setSavingDate(true);
    try {
      await updateSaleSoldAt(liveSale.id, new Date(soldAt).toISOString());
      toast.success("Sale date updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update sale date");
    } finally {
      setSavingDate(false);
    }
  };

  const savePaymentMethod = async () => {
    setSavingPayment(true);
    try {
      await updateSalePaymentMethod(liveSale.id, paymentMethod);
      toast.success("Payment method updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update payment method");
    } finally {
      setSavingPayment(false);
    }
  };

  const saveSalePrice = async () => {
    setSavingPrice(true);
    try {
      await updateSalePrice(liveSale.id, salePrice);
      toast.success("Sale price updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update sale price");
    } finally {
      setSavingPrice(false);
    }
  };

  const sendWhatsAppReceipt = () => {
    openWhatsApp(liveSale.customer_phone, buildReceiptText(liveSale, profile));
    toast.success(
      liveSale.customer_phone
        ? "Opening WhatsApp…"
        : "Opening WhatsApp — pick a chat to send the receipt",
    );
  };

  return (
    <ModalSheetPortal>
      <ModalSheetFrame onClose={onClose} panelClassName={modalSheetPanelMd} backdropClassName="bg-black/70">
<div className="flex shrink-0 items-start justify-between gap-3 border-b border-shell-line px-5 py-4">
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-semibold text-shell-ink">
                {liveSale.receipt_number}
              </h2>
              <p className="mt-0.5 text-xs text-shell-muted">{soldDate}</p>
            </div>
            <ModalSheetClose onClick={onClose} />
          </div>

          <div className={cn(modalSheetBodyScroll, "px-5 py-4")}>
            <div className="flex items-center gap-3 rounded-lg border border-shell-line bg-shell-surface-2/35 p-3">
              <CategoryThumb category={liveSale.item_category} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-shell-ink">
                  {liveSale.item_name}
                </p>
                <p className="text-xs text-shell-muted">
                  {liveSale.quantity_sold > 1 ? `${liveSale.quantity_sold}× ` : ""}
                  {formatCurrency(liveSale.sale_price)}
                  {liveSale.item_brand ? ` · ${liveSale.item_brand}` : ""}
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
                    {formatCurrency(liveSale.balance_owed ?? 0)} outstanding
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
                value={liveSale.customer_name || "Walk-in"}
              />
              <DetailRow
                label="Payment"
                value={
                  owing
                    ? "Credit"
                    : liveSale.payment_method
                      ? PAYMENT_LABELS[liveSale.payment_method]
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
                  value={formatCurrency(liveSale.profit)}
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

            {canEditDeal ? (
              <div className="mt-4 space-y-3 rounded-lg border border-shell-line bg-shell-surface-2/20 p-3.5">
                {!liveSale.returned ? (
                  <div>
                    <Label htmlFor="sale_price_correction" className="mb-1 block text-sm font-medium text-shell-muted">
                      Sale price
                    </Label>
                    <p className="mb-3 text-[11px] leading-snug text-shell-muted">
                      Correct if the amount received doesn’t match what was recorded.
                    </p>
                    <CurrencyInput
                      id="sale_price_correction"
                      value={salePrice}
                      onValueChange={v => setSalePrice(v ?? 0)}
                      className={salesField}
                    />
                    <p className="mt-1.5 text-[11px] text-shell-muted">
                      {liveSale.quantity_sold > 1
                        ? `New total ${formatCurrency(salePrice * liveSale.quantity_sold)}`
                        : liveSale.sale_type === "swap"
                          ? `Cash difference ${formatCurrency(
                              expectedSaleCashAmount({ ...liveSale, sale_price: salePrice }),
                            )}`
                          : `Recorded as ${formatCurrency(salePrice)}`}
                      {canViewProfit
                        ? ` · Profit ${formatCurrency((salePrice - liveSale.cost_price) * liveSale.quantity_sold)}`
                        : ""}
                    </p>
                    <Button
                      variant="outline"
                      className="mt-3 w-full border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                      onClick={() => void saveSalePrice()}
                      disabled={
                        savingPrice ||
                        salePrice <= 0 ||
                        salePrice === liveSale.sale_price
                      }
                    >
                      {savingPrice ? <Loader2 size={16} className="animate-spin" /> : null}
                      Save sale price
                    </Button>
                  </div>
                ) : null}
                {!owing ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-shell-muted">Payment method</p>
                    <SegmentedTabs
                      options={PAYMENT_OPTIONS}
                      value={paymentMethod}
                      onChange={setPaymentMethod}
                    />
                    <Button
                      variant="outline"
                      className="mt-3 w-full border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                      onClick={() => void savePaymentMethod()}
                      disabled={
                        savingPayment ||
                        paymentMethod === (liveSale.payment_method ?? "bank_transfer")
                      }
                    >
                      {savingPayment ? <Loader2 size={16} className="animate-spin" /> : null}
                      Save payment method
                    </Button>
                  </div>
                ) : null}
                <DateTimeField
                  id="sale_sold_at"
                  label="Date & time of sale"
                  hint="Backdate if this sale was recorded late."
                  value={soldAt}
                  onChange={setSoldAt}
                />
                <Button
                  variant="outline"
                  className="w-full border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                  onClick={() => void saveSoldAt()}
                  disabled={savingDate}
                >
                  {savingDate ? <Loader2 size={16} className="animate-spin" /> : null}
                  Save sale date
                </Button>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-10 border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                onClick={() => onReceipt(liveSale)}
              >
                <Receipt size={16} />
                Receipt
              </Button>
              <Button
                variant="outline"
                className="h-10 border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                onClick={() => onWarranty(liveSale)}
                disabled={!cover.value}
              >
                <Shield size={16} />
                Warranty slip
              </Button>
              {canReturn ? (
                <Button
                  variant="outline"
                  className="h-10 border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                  onClick={() => onReturn(liveSale)}
                  disabled={!!liveSale.returned}
                >
                  <RotateCcw size={16} />
                  Return / RMA
                </Button>
              ) : null}
              {owing ? (
                <Button
                  className="h-10 bg-brand-400 text-[#04231d] hover:bg-brand-300"
                  onClick={() => onRecordPayment?.(liveSale)}
                >
                  <Wallet size={16} />
                  Record payment
                </Button>
              ) : (
                <Button
                  className="h-10 bg-brand-400 text-[#04231d] hover:bg-brand-300"
                  onClick={() => onReceipt(liveSale)}
                >
                  <Share2 size={16} />
                  Send receipt
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              className="mt-2 h-10 w-full border-[#25d366]/40 bg-[#25d366]/10 text-[#25d366] hover:bg-[#25d366]/20"
              onClick={sendWhatsAppReceipt}
            >
              <MessageCircle size={16} />
              WhatsApp receipt
            </Button>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge
                variant={owing ? "outline" : "success"}
                className={
                  owing ? "border-amber-500/30 text-amber-200" : undefined
                }
              >
                {liveSale.returned ? "Returned" : owing ? "Owing" : "Paid"}
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
              {liveSale.sale_type === "swap" ? (
                <Badge className="border-brand-400/25 bg-brand-400/10 text-brand-200">
                  Swap
                </Badge>
              ) : null}
            </div>
          </div>
        
      </ModalSheetFrame>
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
