import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ScanLine, X } from "lucide-react";
import { ModalSheetPortal } from "@/components/ui/ModalSheetPortal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CategoryThumb } from "@/components/inventory/CategoryThumb";
import { cn, formatCurrency } from "@/lib/utils";
import {
  modalSheetBackdrop,
  modalSheetBodyScroll,
  modalSheetHandle,
} from "@/lib/modalSheet";
import type { SalesRecord } from "@/types";
import {
  formatIdentifierDisplay,
  getWarrantyMonths,
  identifierLabel,
  lookupSaleByIdentifier,
  normalizeIdentifier,
  saleIdentifier,
  saleWarrantyStatus,
} from "@/lib/warranty";

type WarrantyLookupModalProps = {
  open: boolean;
  sales: SalesRecord[];
  onClose: () => void;
  onReceipt: (sale: SalesRecord) => void;
  onWarranty: (sale: SalesRecord) => void;
  onReturn: (sale: SalesRecord) => void;
};

export default function WarrantyLookupModal({
  open,
  sales,
  onClose,
  onReceipt,
  onWarranty,
  onReturn,
}: WarrantyLookupModalProps) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  const norm = normalizeIdentifier(q);
  const match = useMemo(() => lookupSaleByIdentifier(sales, q), [sales, q]);

  const examples = useMemo(() => {
    return sales
      .map((s) => saleIdentifier(s))
      .filter((c): c is string => !!c && c.length >= 8)
      .slice(0, 3);
  }, [sales]);

  if (!open) return null;

  const warranty = match ? saleWarrantyStatus(match) : null;
  const months = match ? getWarrantyMonths(match) : 0;
  const idKind = match ? identifierLabel(match) : null;
  const idCode = match ? saleIdentifier(match) : undefined;
  const codeLabel = norm.length === 15 ? "IMEI" : "code";
  const purchased = match
    ? new Date(match.sold_at).toLocaleDateString("en-NG", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

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
            <div>
              <h2 className="font-display text-lg font-semibold text-shell-ink">
                IMEI / warranty lookup
              </h2>
              <p className="mt-0.5 text-xs text-shell-muted">
                Scan or type an IMEI or serial
              </p>
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

          <div className={cn(modalSheetBodyScroll, "space-y-4 px-5 py-4")}>
            <div className="flex items-center gap-2.5 rounded-lg border border-shell-line bg-shell-surface-2/30 px-3 py-2 transition-colors focus-within:bg-shell-surface-2/40">
              <ScanLine size={16} className="shrink-0 text-shell-muted" />
              <Input
                autoFocus
                type="text"
                inputMode="numeric"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="356841 092233 471"
                className="shell-inset-field min-w-0 flex-1 border-0 bg-transparent font-mono text-sm tracking-wide text-shell-ink shadow-none outline-none placeholder:text-shell-muted focus-visible:ring-0"
              />
            </div>

            {!norm && examples.length > 0 ? (
              <p className="text-xs text-shell-muted">
                Try:{" "}
                {examples.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setQ(code)}
                    className="shell-inset-field mr-2 font-mono text-xs text-violet-300 hover:text-violet-200"
                  >
                    {formatIdentifierDisplay(
                      code,
                      code.length >= 15 ? "IMEI" : "Serial",
                    )}
                  </button>
                ))}
              </p>
            ) : null}

            {norm.length >= 4 && !match ? (
              <div className="flex gap-3 rounded-lg border border-red-500/25 bg-red-500/10 p-3.5">
                <AlertTriangle
                  size={18}
                  className="mt-0.5 shrink-0 text-red-300"
                />
                <p className="text-sm leading-relaxed text-shell-ink">
                  <strong>No record of this {codeLabel}.</strong> It wasn&apos;t
                  sold here. Before buying it in, check it isn&apos;t lost or
                  blacklisted, and confirm the seller&apos;s ID.
                </p>
              </div>
            ) : null}

            {match && warranty ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-shell-line bg-shell-surface-2/35 p-3">
                  <CategoryThumb category={match.item_category} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-shell-ink">
                      {match.item_name}
                    </p>
                    {idKind && idCode ? (
                      <p className="font-mono text-[11px] text-shell-muted">
                        {idKind}: {formatIdentifierDisplay(idCode, idKind)}
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    className={
                      warranty.active
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                        : "border-red-500/25 bg-red-500/10 text-red-300"
                    }
                  >
                    {warranty.active ? "In warranty" : "Expired"}
                  </Badge>
                </div>

                <div className="divide-y divide-shell-line rounded-lg border border-shell-line">
                  <LookupRow
                    label="Sold to"
                    value={match.customer_name || "Walk-in"}
                  />
                  <LookupRow label="Purchased" value={purchased} />
                  <LookupRow
                    label="Receipt"
                    value={match.receipt_number}
                    mono
                  />
                  <LookupRow
                    label="Warranty"
                    value={
                      months
                        ? `${months} month${months === 1 ? "" : "s"}`
                        : "None"
                    }
                  />
                  <LookupRow
                    label={warranty.active ? "Cover ends" : "Expired"}
                    value={
                      months
                        ? `${warranty.label}${warranty.active ? ` · ${warranty.leftDays}d left` : ""}`
                        : "—"
                    }
                    mono
                    strong
                  />
                  <LookupRow
                    label="Sale total"
                    value={formatCurrency(
                      match.sale_price * match.quantity_sold,
                    )}
                    mono
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button
                    variant="outline"
                    className="h-10 border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                    onClick={() => {
                      onReceipt(match);
                      onClose();
                    }}
                  >
                    Receipt
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                    disabled={!months}
                    onClick={() => {
                      onWarranty(match);
                      onClose();
                    }}
                  >
                    Warranty
                  </Button>
                  <Button
                    className="h-10 bg-violet-400 text-[#160a2e] hover:bg-violet-300"
                    onClick={() => {
                      onReturn(match);
                      onClose();
                    }}
                    disabled={!!match.returned}
                  >
                    Return / RMA
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </ModalSheetPortal>
  );
}

function LookupRow({
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
          strong ? "font-semibold" : "font-medium",
        )}
      >
        {value}
      </span>
    </div>
  );
}
