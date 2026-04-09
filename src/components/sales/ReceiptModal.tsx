import { useRef, useState } from 'react';
import { X, Share2, Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Receipt from './Receipt';
import {
  modalSheetBackdrop,
  modalSheetBodyScroll,
  modalSheetFooter,
  modalSheetHandle,
  modalSheetHeader,
  modalSheetPanelSm,
} from '@/lib/modalSheet';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { cn } from '@/lib/utils';
import { useShopProfile } from '@/hooks/useShopProfile';
import type { SalesRecord } from '@/types';

interface ReceiptModalProps {
  sale: SalesRecord;
  onClose: () => void;
}

export default function ReceiptModal({ sale, onClose }: ReceiptModalProps) {
  const { profile } = useShopProfile();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const captureImage = async (): Promise<Blob> => {
    if (!receiptRef.current) throw new Error('Receipt not mounted');
    const canvas = await html2canvas(receiptRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    return new Promise(resolve =>
      canvas.toBlob(blob => resolve(blob!), 'image/png', 1)
    );
  };

  const handleShare = async () => {
    setIsCapturing(true);
    try {
      const blob = await captureImage();
      const file = new File([blob], `receipt-${sale.receipt_number}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Receipt ${sale.receipt_number}`,
          text: `${profile.shop_name || 'VillageStock'} — ${sale.item_name}`,
          files: [file],
        });
      } else {
        // Fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt-${sale.receipt_number}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Share failed', err);
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsCapturing(true);
    try {
      const blob = await captureImage();
      const imgUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.src = imgUrl;

      await new Promise<void>(resolve => { img.onload = () => resolve(); });

      const pdfWidth = 80; // 80mm receipt width
      const pdfHeight = (img.naturalHeight / img.naturalWidth) * pdfWidth;

      const pdf = new jsPDF({ unit: 'mm', format: [pdfWidth, pdfHeight] });
      pdf.addImage(imgUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`receipt-${sale.receipt_number}.pdf`);
      URL.revokeObjectURL(imgUrl);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <ModalSheetPortal>
    <div className={cn(modalSheetBackdrop, 'bg-black/60 dark:bg-black/70')} onClick={onClose}>
      <div className={modalSheetPanelSm} onClick={e => e.stopPropagation()}>
        <div className={modalSheetHandle}>
          <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>

        <div className={modalSheetHeader}>
          <h2 className="font-heading text-base font-bold text-zinc-900 dark:text-zinc-50">Receipt</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className={`${modalSheetBodyScroll} bg-zinc-200/90 px-2 py-4 dark:bg-zinc-950/80`}>
          <div className="overflow-hidden rounded-lg shadow-lg">
            <Receipt ref={receiptRef} sale={sale} shop={profile} />
          </div>
        </div>

        <div className={`${modalSheetFooter} flex gap-3`}>
          <button
            type="button"
            onClick={handleShare}
            disabled={isCapturing}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            {isCapturing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            Share
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isCapturing}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {isCapturing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Download PDF
          </button>
        </div>
      </div>
    </div>
    </ModalSheetPortal>
  );
}
