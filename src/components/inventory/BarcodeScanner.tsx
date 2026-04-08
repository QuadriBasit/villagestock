import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

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
        { fps: 10, qrbox: { width: 250, height: 120 } },
        (decodedText) => {
          onScan(decodedText);
          stop();
        },
        undefined
      )
      .catch(err => {
        console.error(err);
        setError('Camera access denied or not available.');
      });

    return () => { stop(); };

    function stop() {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 font-heading font-semibold text-dark">
            <Camera size={18} className="text-primary" /> Scan Barcode / QR
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-surface text-muted"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scanner viewport */}
        <div className="p-4">
          {error ? (
            <div className="text-center py-8 text-red-500 text-sm">{error}</div>
          ) : (
            <div id={containerId} className="w-full rounded-xl overflow-hidden" />
          )}
          <p className="text-xs text-muted text-center mt-3">
            Point your camera at a barcode, QR code, or IMEI label
          </p>
        </div>
      </div>
    </div>
  );
}
