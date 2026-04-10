import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';

interface BarcodeScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'vs-barcode-reader';
  const [error, setError] = useState('');

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const boxW = Math.min(280, Math.floor(viewfinderWidth * 0.85));
            const boxH = Math.min(220, Math.floor(viewfinderHeight * 0.55));
            return { width: boxW, height: boxH };
          },
        },
        decodedText => {
          onScan(decodedText);
          stop();
        },
        undefined
      )
      .catch(err => {
        console.error(err);
        setError('Camera access denied or not available.');
      });

    return () => {
      stop();
    };

    function stop() {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ModalSheetPortal>
      <div
        className="fixed inset-0 z-[200] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Scan barcode or QR code"
      >
        <div className="my-auto w-full max-w-sm shrink-0 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <div className="flex items-center gap-2 font-heading text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <Camera size={18} className="text-primary" aria-hidden />
              Scan Barcode / QR
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              aria-label="Close scanner"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4">
            {error ? (
              <div className="py-8 text-center text-sm text-red-600 dark:text-red-400">{error}</div>
            ) : (
              <div
                id={containerId}
                className="flex min-h-[12.5rem] w-full items-center justify-center overflow-hidden rounded-xl bg-black [&_canvas]:max-w-full [&_video]:max-h-[min(50vh,20rem)] [&_video]:w-full [&_video]:object-cover"
              />
            )}
            <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
              Point your camera at a barcode, QR code, or IMEI label
            </p>
          </div>
        </div>
      </div>
    </ModalSheetPortal>
  );
}
