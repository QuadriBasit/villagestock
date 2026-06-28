import { useRef } from "react";
import { Download, Printer, X } from "lucide-react";
import { ModalSheetPortal } from "@/components/ui/ModalSheetPortal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  modalSheetBackdrop,
  modalSheetBodyScroll,
  modalSheetHandle,
} from "@/lib/modalSheet";
import { useShopProfile } from "@/hooks/useShopProfile";
import type { SalesRecord } from "@/types";
import {
  formatIdentifierDisplay,
  getWarrantyMonths,
  identifierLabel,
  saleIdentifier,
  saleWarrantyStatus,
} from "@/lib/warranty";

type WarrantySlipModalProps = {
  sale: SalesRecord | null;
  onClose: () => void;
};

export default function WarrantySlipModal({
  sale,
  onClose,
}: WarrantySlipModalProps) {
  const { profile } = useShopProfile();
  const slipRef = useRef<HTMLDivElement>(null);

  if (!sale) return null;

  const months = getWarrantyMonths(sale);
  const warranty = saleWarrantyStatus(sale);
  const idKind = identifierLabel(sale);
  const idCode = saleIdentifier(sale);
  const purchaseDate = new Date(sale.sold_at).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const handlePrint = () => {
    if (!slipRef.current) return;
    const html = slipRef.current.outerHTML;
    const win = window.open("", "_blank", "width=720,height=900");
    if (!win) return;
    win.document
      .write(`<!DOCTYPE html><html><head><title>Warranty ${sale.receipt_number}</title>
 <style>body{margin:0;padding:24px;font-family:system-ui,sans-serif;background:#f4f4f5}@media print{body{padding:0;background:#fff}}</style>
 </head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleDownload = async () => {
    if (!slipRef.current) return;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(slipRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
    });
    const link = document.createElement("a");
    link.download = `warranty-${sale.receipt_number}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <ModalSheetPortal>
      <div className={cn(modalSheetBackdrop, "bg-black/70")} onClick={onClose}>
        <div
          className="flex min-h-0 w-full max-h-[min(92dvh,calc(100dvh-1.5rem))] max-w-xl flex-col overflow-hidden rounded-t-[1.25rem] border border-shell-line bg-shell-surface shadow-[var(--shadow-shell-elevated)] sm:max-h-[min(85dvh,calc(100dvh-3rem))] sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={modalSheetHandle}>
            <div className="h-1 w-10 rounded-full bg-shell-line" />
          </div>

          <div className="flex shrink-0 items-center justify-between border-b border-shell-line px-5 py-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-shell-ink">
                Warranty slip
              </h2>
              <p className="text-xs text-shell-muted">
                {sale.receipt_number} · {months} month{months === 1 ? "" : "s"}{" "}
                cover
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

          <div
            className={cn(
              modalSheetBodyScroll,
              "bg-shell-surface-2/30 px-4 py-4",
            )}
          >
            <div
              ref={slipRef}
              className="mx-auto max-w-md rounded-xl border border-shell-line bg-shell-surface-2/30 p-6 text-shell-ink shadow-lg"
            >
              <div className="border-b border-shell-line pb-4 text-center">
                <p className="text-lg font-bold">
                  {profile.shop_name || "Village Stock"}
                </p>
                <p className="mt-1 text-xs text-shell-muted">
                  Warranty certificate
                </p>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <SlipRow label="Device" value={sale.item_name} />
                <SlipRow
                  label="Customer"
                  value={sale.customer_name || "Walk-in"}
                />
                <SlipRow label="Purchase date" value={purchaseDate} />
                <SlipRow label="Receipt no." value={sale.receipt_number} mono />
                {idKind && idCode ? (
                  <SlipRow
                    label={idKind}
                    value={formatIdentifierDisplay(idCode, idKind)}
                    mono
                  />
                ) : null}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-shell-surface-2/30 p-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-shell-muted">
                    Cover
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold">
                    {months} mo
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-shell-muted">
                    Valid until
                  </p>
                  <p className="mt-1 font-display text-lg font-bold">
                    {months ? warranty.label : "—"}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-[11px] leading-relaxed text-shell-muted">
                This warranty covers manufacturing defects under normal use.
                Accidental damage, liquid damage, and unauthorised repairs are
                excluded. Present this slip with the device for service.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 gap-2 border-t border-shell-line px-5 py-4">
            <Button
              variant="outline"
              className="flex-1 border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
              onClick={handlePrint}
            >
              <Printer size={16} />
              Print
            </Button>
            <Button
              className="flex-1 bg-violet-400 text-[#160a2e] hover:bg-violet-300"
              onClick={() => void handleDownload()}
            >
              <Download size={16} />
              Download
            </Button>
          </div>
        </div>
      </div>
    </ModalSheetPortal>
  );
}

function SlipRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-zinc-100 pb-2 last:border-0">
      <span className="text-shell-muted">{label}</span>
      <span
        className={cn(
          "text-right font-medium text-shell-ink",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </span>
    </div>
  );
}
