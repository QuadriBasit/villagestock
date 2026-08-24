import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  Share2,
  Download,
  Loader2,
  MessageCircle,
  RefreshCw,
  PencilLine,
  RotateCcw,
} from "lucide-react";
import Receipt, { type ReceiptOverrides } from "./Receipt";
import { modalSheetBodyScroll, modalSheetFooter, modalSheetHeader, modalSheetPanelSm } from '@/lib/modalSheet';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { ModalSheetClose } from '@/components/ui/ModalSheetClose';
import { useShopProfile } from "@/hooks/useShopProfile";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ColorPickerField } from "@/components/ui/ColorPickerField";
import { parseMoneyDigits } from "@/lib/utils";
import { buildReceiptText, openWhatsApp } from "@/lib/whatsapp";
import type { SalesRecord } from "@/types";
import { DEFAULT_RECEIPT_THEME } from "@/hooks/useShopProfile";

interface ReceiptModalProps {
  sale: SalesRecord;
  onClose: () => void;
}

type CaptureReady = { blob: Blob; dataUrl: string; pdfHeightMm: number };
type CaptureState =
  | { status: "loading" }
  | ({ status: "ready" } & CaptureReady)
  | { status: "error"; message: string };

type ReceiptDraft = {
  item_name: string;
  item_brand: string;
  customer_name: string;
  customer_phone: string;
  sale_price: string;
  amount_paid: string;
  balance_owed: string;
  trade_in_item_name: string;
  trade_in_item_brand: string;
  header_color: string;
  accent_color: string;
  text_color: string;
  paper_color: string;
};

function createReceiptDraft(
  sale: SalesRecord,
  theme = DEFAULT_RECEIPT_THEME,
): ReceiptDraft {
  return {
    item_name: sale.item_name ?? "",
    item_brand: sale.item_brand ?? "",
    customer_name: sale.customer_name ?? "",
    customer_phone: sale.customer_phone ?? "",
    sale_price: String(sale.sale_price ?? ""),
    amount_paid: String(
      sale.amount_paid ?? sale.balance_paid ?? sale.sale_price ?? "",
    ),
    balance_owed: String(sale.balance_owed ?? ""),
    trade_in_item_name: sale.trade_in_item_name ?? "",
    trade_in_item_brand: sale.trade_in_item_brand ?? "",
    header_color: theme.header_color,
    accent_color: theme.accent_color,
    text_color: theme.text_color,
    paper_color: theme.paper_color,
  };
}

export default function ReceiptModal({ sale, onClose }: ReceiptModalProps) {
  const { profile } = useShopProfile();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [capture, setCapture] = useState<CaptureState>({ status: "loading" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ReceiptDraft>(() =>
    createReceiptDraft(sale, profile.receipt_theme ?? DEFAULT_RECEIPT_THEME),
  );

  useEffect(() => {
    setDraft(
      createReceiptDraft(sale, profile.receipt_theme ?? DEFAULT_RECEIPT_THEME),
    );
    setIsEditing(false);
  }, [sale, profile.receipt_theme]);

  const receiptOverrides = useMemo<ReceiptOverrides>(
    () => ({
      item_name: draft.item_name,
      item_brand: draft.item_brand,
      customer_name: draft.customer_name,
      customer_phone: draft.customer_phone,
      sale_price: parseMoneyDigits(draft.sale_price) ?? 0,
      amount_paid: parseMoneyDigits(draft.amount_paid) ?? 0,
      balance_owed: parseMoneyDigits(draft.balance_owed) ?? 0,
      trade_in_item_name: draft.trade_in_item_name,
      trade_in_item_brand: draft.trade_in_item_brand,
      header_color: draft.header_color,
      accent_color: draft.accent_color,
      text_color: draft.text_color,
      paper_color: draft.paper_color,
    }),
    [draft],
  );

  const loadCaptureLibs = async () => {
    const html2canvasModule = await import("html2canvas");
    return html2canvasModule.default;
  };

  const loadPdfLib = async () => {
    const jsPdfModule = await import("jspdf");
    return jsPdfModule.default;
  };

  const runCapture = useCallback(async (): Promise<CaptureReady> => {
    if (!receiptRef.current) throw new Error("Receipt not mounted");
    const html2canvas = await loadCaptureLibs();
    const canvas = await html2canvas(receiptRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Could not render receipt image")),
        "image/png",
        1,
      );
    });
    const dataUrl = canvas.toDataURL("image/png");
    const pdfWidthMm = 80;
    const pdfHeightMm = (canvas.height / canvas.width) * pdfWidthMm;
    return { blob, dataUrl, pdfHeightMm };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCapture({ status: "loading" });
    setActionError(null);

    const run = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 150));
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      try {
        const { blob, dataUrl, pdfHeightMm } = await runCapture();
        if (cancelled) return;
        setCapture({
          status: "ready",
          blob,
          dataUrl,
          pdfHeightMm,
        });
      } catch (e) {
        if (cancelled) return;
        setCapture({
          status: "error",
          message: e instanceof Error ? e.message : "Could not capture receipt",
        });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [sale.receipt_number, receiptOverrides, runCapture]);

  /** Must run synchronously in the click handler (after prefetch) so the browser allows download. */
  const triggerPngDownload = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${sale.receipt_number}.png`;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    setActionError(null);
    if (capture.status !== "ready") return;
    const { blob } = capture;

    try {
      const file = new File([blob], `receipt-${sale.receipt_number}.png`, {
        type: "image/png",
      });
      let canShareFiles = false;
      try {
        canShareFiles = navigator.canShare?.({ files: [file] }) === true;
      } catch {
        canShareFiles = false;
      }

      if (canShareFiles) {
        const sharePromise = navigator.share?.({
          title: `Receipt ${sale.receipt_number}`,
          text: `${profile.shop_name || "VillageStock"} — ${sale.item_name}`,
          files: [file],
        });
        if (sharePromise) {
          void sharePromise.catch((err) => {
            if (err instanceof Error && err.name === "AbortError") return;
            try {
              triggerPngDownload(blob);
            } catch {
              setActionError(
                err instanceof Error ? err.message : "Share failed",
              );
            }
          });
        }
        return;
      }

      triggerPngDownload(blob);
    } catch (err) {
      try {
        triggerPngDownload(blob);
      } catch {
        setActionError(err instanceof Error ? err.message : "Share failed");
      }
    }
  };

  /** jsPDF path stays synchronous in the click handler — avoids losing user activation after async work. */
  const handleDownloadPDF = async () => {
    setActionError(null);
    if (capture.status !== "ready") return;
    try {
      const jsPDF = await loadPdfLib();
      const { dataUrl, pdfHeightMm } = capture;
      const pdfWidthMm = 80;
      const pdf = new jsPDF({ unit: "mm", format: [pdfWidthMm, pdfHeightMm] });
      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidthMm, pdfHeightMm);
      pdf.save(`receipt-${sale.receipt_number}.pdf`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not create PDF");
    }
  };

  /**
   * Share the receipt PNG through WhatsApp when the Web Share API supports
   * files (mobile), otherwise fall back to a wa.me deep link with the text
   * version of the receipt.
   */
  const handleWhatsApp = () => {
    setActionError(null);
    if (capture.status !== "ready") return;
    const { blob } = capture;

    try {
      const file = new File([blob], `receipt-${sale.receipt_number}.png`, {
        type: "image/png",
      });
      let canShareFiles = false;
      try {
        canShareFiles = navigator.canShare?.({ files: [file] }) === true;
      } catch {
        canShareFiles = false;
      }
      if (canShareFiles && navigator.share) {
        void navigator
          .share({
            title: `Receipt ${sale.receipt_number}`,
            text: `${profile.shop_name || "VillageStock"} — ${sale.item_name}`,
            files: [file],
          })
          .catch((err) => {
            if (err instanceof Error && err.name === "AbortError") return;
            openWhatsApp(sale.customer_phone, buildReceiptText(sale, profile));
          });
        return;
      }
      openWhatsApp(sale.customer_phone, buildReceiptText(sale, profile));
    } catch {
      openWhatsApp(sale.customer_phone, buildReceiptText(sale, profile));
    }
  };

  const handleRetryCapture = () => {
    setCapture({ status: "loading" });
    setActionError(null);
    void (async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      try {
        const { blob, dataUrl, pdfHeightMm } = await runCapture();
        setCapture({
          status: "ready",
          blob,
          dataUrl,
          pdfHeightMm,
        });
      } catch (e) {
        setCapture({
          status: "error",
          message: e instanceof Error ? e.message : "Could not capture receipt",
        });
      }
    })();
  };

  const ready = capture.status === "ready";
  const busy = capture.status === "loading";

  return (
    <ModalSheetPortal>
      <ModalSheetFrame onClose={onClose} panelClassName={modalSheetPanelSm} backdropClassName="bg-black/60 dark:bg-black/70">
<div className={modalSheetHeader}>
            <h2 className="font-display text-base font-bold text-shell-ink">
              Receipt
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsEditing((current) => !current)}
                className="rounded-full p-1.5 text-shell-muted transition hover:bg-shell-surface-2 hover:text-shell-ink"
                aria-label="Edit receipt copy"
              >
                <PencilLine size={18} />
              </button>
              <ModalSheetClose className="rounded-full" />
            </div>
          </div>

          <div
            className={`${modalSheetBodyScroll} bg-shell-surface-2/30 px-2 py-4`}
          >
            {isEditing && (
              <div className="mb-3 rounded-2xl border border-shell-line bg-shell-surface-2/30 p-3 ">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-shell-ink">
                      Edit Printable Copy
                    </p>
                    <p className="text-xs text-shell-muted">
                      This changes the exported receipt only, not the saved
                      sale.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDraft(
                        createReceiptDraft(
                          sale,
                          profile.receipt_theme ?? DEFAULT_RECEIPT_THEME,
                        ),
                      )
                    }
                    className="shrink-0"
                  >
                    <RotateCcw size={14} />
                    Reset
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Item name">
                    <Input
                      value={draft.item_name}
                      onChange={(e) =>
                        setDraft((current) => ({
                          ...current,
                          item_name: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Brand">
                    <Input
                      value={draft.item_brand}
                      onChange={(e) =>
                        setDraft((current) => ({
                          ...current,
                          item_brand: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Customer name">
                    <Input
                      value={draft.customer_name}
                      onChange={(e) =>
                        setDraft((current) => ({
                          ...current,
                          customer_name: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Customer phone">
                    <Input
                      value={draft.customer_phone}
                      onChange={(e) =>
                        setDraft((current) => ({
                          ...current,
                          customer_phone: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  {sale.sale_type === "swap" && (
                    <>
                      <Field label="Trade-in item">
                        <Input
                          value={draft.trade_in_item_name}
                          onChange={(e) =>
                            setDraft((current) => ({
                              ...current,
                              trade_in_item_name: e.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Trade-in brand">
                        <Input
                          value={draft.trade_in_item_brand}
                          onChange={(e) =>
                            setDraft((current) => ({
                              ...current,
                              trade_in_item_brand: e.target.value,
                            }))
                          }
                        />
                      </Field>
                    </>
                  )}
                  <Field
                    label={
                      sale.payment_status === "credit"
                        ? "Receipt amount paid"
                        : sale.sale_type === "swap"
                          ? "Receipt amount paid"
                          : "Receipt amount"
                    }
                  >
                    <Input
                      inputMode="numeric"
                      value={draft.amount_paid}
                      onChange={(e) =>
                        setDraft((current) => ({
                          ...current,
                          amount_paid: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  {sale.payment_status === "credit" ? (
                    <Field label="Balance owed">
                      <Input
                        inputMode="numeric"
                        value={draft.balance_owed}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            balance_owed: e.target.value,
                          }))
                        }
                      />
                    </Field>
                  ) : (
                    <Field label="Sale amount">
                      <Input
                        inputMode="numeric"
                        value={draft.sale_price}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            sale_price: e.target.value,
                          }))
                        }
                      />
                    </Field>
                  )}
                  <ColorField
                    label="Header color"
                    value={draft.header_color}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        header_color: value,
                      }))
                    }
                  />
                  <ColorField
                    label="Amount color"
                    value={draft.accent_color}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        accent_color: value,
                      }))
                    }
                  />
                  <ColorField
                    label="Text color"
                    value={draft.text_color}
                    onChange={(value) =>
                      setDraft((current) => ({ ...current, text_color: value }))
                    }
                  />
                  <ColorField
                    label="Paper color"
                    value={draft.paper_color}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        paper_color: value,
                      }))
                    }
                  />
                </div>
              </div>
            )}
            {capture.status === "error" && (
              <p className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200">
                {capture.message}
              </p>
            )}
            {actionError && (
              <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300">
                {actionError}
              </p>
            )}
            <div className="overflow-hidden rounded-lg shadow-lg">
              <Receipt
                ref={receiptRef}
                sale={sale}
                shop={profile}
                overrides={receiptOverrides}
              />
            </div>
            {busy && (
              <p className="mt-3 text-center text-xs text-shell-muted">
                Preparing receipt for sharing…
              </p>
            )}
          </div>

          <div
            className={`${modalSheetFooter} flex flex-col gap-2 sm:flex-row sm:gap-3`}
          >
            {capture.status === "error" ? (
              <button
                type="button"
                onClick={handleRetryCapture}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-shell-line bg-shell-surface-2/30 py-3 text-sm font-medium text-shell-ink"
              >
                <RefreshCw size={16} />
                Retry capture
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  disabled={!ready}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25d366] py-3 text-sm font-semibold text-[#0b141a] transition-colors hover:bg-[#20bd5a] disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <MessageCircle size={16} />
                  )}
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={!ready}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-shell-line bg-shell-surface-2/30 py-3 text-sm font-medium text-shell-ink transition-colors hover:bg-shell-surface-2/50 disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Share2 size={16} />
                  )}
                  Share
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={!ready}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-400 disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  Download PDF
                </button>
              </>
            )}
          </div>
        
      </ModalSheetFrame>
    </ModalSheetPortal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-shell-muted ">{label}</span>
      {children}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return <ColorPickerField label={label} value={value} onChange={onChange} />;
}
