import { useRef, useState } from 'react';
import { X, Share2, Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Receipt from './Receipt';
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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface w-full max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[95vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-heading font-bold text-dark text-base">Receipt</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-border text-muted">
            <X size={18} />
          </button>
        </div>

        {/* Receipt preview — scrollable */}
        <div className="overflow-y-auto flex-1 py-4 px-2 bg-gray-100">
          <div className="shadow-lg rounded-lg overflow-hidden">
            <Receipt ref={receiptRef} sale={sale} shop={profile} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-5 py-4 border-t border-border bg-white flex gap-3">
          <button
            onClick={handleShare}
            disabled={isCapturing}
            className="flex-1 flex items-center justify-center gap-2 border border-border bg-white text-dark rounded-xl py-3 text-sm font-medium hover:bg-surface transition-colors disabled:opacity-60"
          >
            {isCapturing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            Share
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={isCapturing}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-white rounded-xl py-3 text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {isCapturing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
