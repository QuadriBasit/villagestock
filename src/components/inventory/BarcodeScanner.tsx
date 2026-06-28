import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';

interface BarcodeScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const stopPromiseRef = useRef<Promise<void> | null>(null);
  const [isContainerReady, setIsContainerReady] = useState(false);
  const [error, setError] = useState('');
  const containerId = `vs-barcode-reader-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!isContainerReady) return;

    let cancelled = false;

    const disposeScanner = async (scanner: Html5Qrcode | null) => {
      if (!scanner) return;

      if (scanner.isScanning) {
        await scanner.stop().catch(() => {});
      }

      try {
        scanner.clear();
      } catch {
        // html5-qrcode throws if the view was never fully initialized.
      }
    };

    const stopScanner = async () => {
      if (stopPromiseRef.current) {
        await stopPromiseRef.current;
        return;
      }

      const currentScanner = scannerRef.current;
      scannerRef.current = null;
      stopPromiseRef.current = disposeScanner(currentScanner).finally(() => {
        stopPromiseRef.current = null;
      });
      await stopPromiseRef.current;
    };

    const tuneCamera = async (activeScanner: Html5Qrcode) => {
      try {
        const capabilities = activeScanner.getRunningTrackCapabilities() as MediaTrackCapabilities & {
          focusMode?: string[];
          zoom?: { min?: number; max?: number };
        };
        const advanced: Record<string, unknown> = {};

        if (Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
          advanced.focusMode = 'continuous';
        }

        if (capabilities.zoom && typeof capabilities.zoom === 'object') {
          const minZoom = capabilities.zoom.min ?? 1;
          const maxZoom = capabilities.zoom.max ?? minZoom;
          advanced.zoom = Math.min(Math.max(1.5, minZoom), maxZoom);
        }

        if (Object.keys(advanced).length > 0) {
          await activeScanner.applyVideoConstraints({
            advanced: [advanced as MediaTrackConstraintSet],
          });
        }
      } catch {
        // Camera controls vary widely across Android devices. Ignore unsupported capabilities.
      }
    };

    const bootScanner = async () => {
      await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));

      if (cancelled || !document.getElementById(containerId)) return;

      try {
        const scanConfig = {
          fps: 14,
          aspectRatio: 4 / 3,
          disableFlip: true,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.9);
            return {
              width: Math.max(220, Math.min(360, size)),
              height: Math.max(180, Math.min(260, Math.floor(size * 0.72))),
            };
          },
        };

        const onDecode = async (decodedText: string) => {
          onScanRef.current(decodedText);
          await stopScanner();
        };

        const startAttempts: Array<string | MediaTrackConstraints> = [
          {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          { facingMode: 'environment' },
          { width: { ideal: 1280 }, height: { ideal: 720 } },
          { facingMode: 'user' },
        ];

        const createScanner = () =>
          new Html5Qrcode(containerId, {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
            ],
            useBarCodeDetectorIfSupported: true,
            verbose: false,
          });

        let activeScanner: Html5Qrcode | null = null;
        let lastError: unknown = null;

        for (const cameraConfig of startAttempts) {
          const scannerAttempt = createScanner();
          try {
            await scannerAttempt.start(cameraConfig, scanConfig, onDecode, undefined);
            activeScanner = scannerAttempt;
            break;
          } catch (attemptError) {
            lastError = attemptError;
            await disposeScanner(scannerAttempt);
          }
        }

        if (!activeScanner) {
          try {
            const cameras = await Html5Qrcode.getCameras();
            for (const camera of cameras) {
              const scannerAttempt = createScanner();
              try {
                await scannerAttempt.start(camera.id, scanConfig, onDecode, undefined);
                activeScanner = scannerAttempt;
                break;
              } catch (attemptError) {
                lastError = attemptError;
                await disposeScanner(scannerAttempt);
              }
            }
          } catch (cameraError) {
            lastError = cameraError;
          }
        }

        if (!activeScanner) {
          throw lastError ?? new Error('No usable camera was found.');
        }

        scannerRef.current = activeScanner;

        if (!cancelled) {
          setError('');
          await tuneCamera(activeScanner);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          const message =
            err instanceof Error && err.message
              ? err.message
              : 'Unable to access the camera on this device.';
          setError(`Unable to start camera scanner. ${message}`);
          await stopScanner();
        }
      }
    };

    void bootScanner();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [containerId, isContainerReady]);

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
        <div className="my-auto w-full max-w-sm shrink-0 overflow-hidden rounded-xl border border-shell-line bg-shell-surface shadow-[var(--shadow-shell-elevated)]">
          <div className="flex items-center justify-between border-b border-shell-line px-4 py-3">
            <div className="flex items-center gap-2 font-display text-sm font-semibold text-shell-ink">
              <Camera size={18} className="text-violet-300" aria-hidden />
              Scan barcode / QR
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-shell-muted transition-colors hover:bg-shell-surface-2 hover:text-shell-ink"
              aria-label="Close scanner"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4">
            {error ? (
              <div className="py-8 text-center text-sm text-red-400">{error}</div>
            ) : (
              <div
                id={containerId}
                ref={node => {
                  const nextValue = Boolean(node);
                  setIsContainerReady(currentValue =>
                    currentValue === nextValue ? currentValue : nextValue
                  );
                }}
                className="flex min-h-[12.5rem] w-full items-center justify-center overflow-hidden rounded-xl bg-black [&_canvas]:max-w-full [&_video]:max-h-[min(50vh,20rem)] [&_video]:w-full [&_video]:object-cover"
              />
            )}
            <p className="mt-3 text-center text-xs text-shell-muted">
              Point your camera at the label, hold steady, and move a little closer for blurry codes
            </p>
          </div>
        </div>
      </div>
    </ModalSheetPortal>
  );
}
