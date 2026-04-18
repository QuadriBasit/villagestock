import { useRef, useState, useEffect, useCallback } from 'react';
import { X, Share2, Download, Loader2, Image as ImageIcon } from 'lucide-react';
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
import type { InventoryItem } from '@/types';

interface PromoFlyerModalProps {
  item: InventoryItem;
  onClose: () => void;
}

type CaptureReady = { blob: Blob; dataUrl: string };
type CaptureState =
  | { status: 'loading' }
  | { status: 'ready' } & CaptureReady
  | { status: 'error'; message: string };

type ThemeVariant = 'sale' | 'minimal';

export default function PromoFlyerModal({ item, onClose }: PromoFlyerModalProps) {
  const { profile } = useShopProfile();
  const flyerRef = useRef<HTMLDivElement>(null);
  const [capture, setCapture] = useState<CaptureState>({ status: 'loading' });
  const [actionError, setActionError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeVariant>('sale');

  const shopName = profile?.shop_name || 'Our Shop';
  const price = item.price ?? 0;
  const brandColor = profile.receipt_theme?.header_color || '#3b82f6';
  
  // A gradient background using the brand color
  const flyerStyle = {
    background: theme === 'sale' 
      ? `linear-gradient(135deg, ${brandColor} 0%, #1e293b 100%)`
      : '#ffffff',
    color: theme === 'sale' ? '#ffffff' : '#0f172a',
  };

  const loadCaptureLibs = async () => {
    const html2canvasModule = await import('html2canvas');
    return html2canvasModule.default;
  };

  const runCapture = useCallback(async (): Promise<CaptureReady> => {
    if (!flyerRef.current) throw new Error('Flyer not mounted');
    const html2canvas = await loadCaptureLibs();
    
    // We render it at 2x scale for crispness
    const canvas = await html2canvas(flyerRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: theme === 'sale' ? brandColor : '#ffffff',
      logging: false,
    });
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not render flyer image'))), 'image/png', 1);
    });
    const dataUrl = canvas.toDataURL('image/png');
    return { blob, dataUrl };
  }, [theme, brandColor]);

  const updateCapture = useCallback(() => {
    let cancelled = false;
    setCapture({ status: 'loading' });
    setActionError(null);

    const run = async () => {
      await new Promise(resolve => window.setTimeout(resolve, 150));
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      try {
        const { blob, dataUrl } = await runCapture();
        if (cancelled) return;
        setCapture({
          status: 'ready',
          blob,
          dataUrl,
        });
      } catch (e) {
        if (cancelled) return;
        setCapture({
          status: 'error',
          message: e instanceof Error ? e.message : 'Could not capture flyer',
        });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [runCapture]);

  useEffect(() => {
    return updateCapture();
  }, [updateCapture]);

  const triggerPngDownload = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `promo-${item.id.slice(0, 8)}.png`;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    setActionError(null);
    if (capture.status !== 'ready') return;
    const { blob } = capture;

    try {
      const file = new File([blob], `promo-${item.id.slice(0, 8)}.png`, { type: 'image/png' });
      let canShareFiles = false;
      try {
        canShareFiles = navigator.canShare?.({ files: [file] }) === true;
      } catch {
        canShareFiles = false;
      }

      if (canShareFiles) {
        const sharePromise = navigator.share?.({
          title: `Promo - ${item.name}`,
          text: `Available at ${shopName}: ${item.name} for ₦${price.toLocaleString()}!`,
          files: [file],
        });
        if (sharePromise) {
          void sharePromise.catch(err => {
            if (err instanceof Error && err.name === 'AbortError') return;
            try {
              triggerPngDownload(blob);
            } catch {
              setActionError(err instanceof Error ? err.message : 'Share failed');
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
        setActionError(err instanceof Error ? err.message : 'Share failed');
      }
    }
  };

  const ready = capture.status === 'ready';
  const busy = capture.status === 'loading';

  return (
    <ModalSheetPortal>
      <div className={cn(modalSheetBackdrop, 'bg-black/60 dark:bg-black/70')} onClick={onClose}>
        <div className={modalSheetPanelSm} onClick={e => e.stopPropagation()}>
          <div className={modalSheetHandle}>
            <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          </div>

          <div className={modalSheetHeader}>
            <h2 className="font-heading text-base font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <ImageIcon size={18} className="text-primary" />
              Share Promo Flyer
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X size={18} />
            </button>
          </div>

          <div className={`${modalSheetBodyScroll} bg-zinc-100 px-4 py-4 dark:bg-zinc-950/80`}>
            {actionError && (
              <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {actionError}
              </p>
            )}

            <div className="mb-3 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setTheme('sale')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${theme === 'sale' ? 'bg-primary border-primary text-white' : 'bg-white border-zinc-200 text-zinc-600'}`}
              >
                Flash Sale
              </button>
              <button
                type="button"
                onClick={() => setTheme('minimal')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${theme === 'minimal' ? 'bg-primary border-primary text-white' : 'bg-white border-zinc-200 text-zinc-600'}`}
              >
                Minimal
              </button>
            </div>

            <div className="flex justify-center">
              {/* Flyer Container (Square 1080x1080 equivalent layout ratio, scaled down for preview) */}
              <div 
                ref={flyerRef}
                className="w-full aspect-square max-w-[320px] relative overflow-hidden flex flex-col shadow-xl"
                style={flyerStyle}
              >
                {/* Decorative shapes for Flash Sale */}
                {theme === 'sale' && (
                  <>
                    <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-black/20 rounded-full blur-2xl" />
                  </>
                )}

                <div className="flex-1 flex flex-col items-center justify-center p-8 z-10 text-center">
                  {theme === 'sale' && (
                    <div className="bg-white text-rose-600 font-black tracking-widest uppercase text-xs px-3 py-1 rounded-full mb-4 shadow-md">
                      Flash Sale
                    </div>
                  )}
                  
                  {/* Photo Placeholder */}
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-32 h-32 object-cover rounded-2xl mb-4 border-4 border-white/20 shadow-lg" crossOrigin="anonymous" />
                  ) : (
                    <div className="w-28 h-28 bg-black/10 rounded-2xl mb-4 flex items-center justify-center border-2 border-white/20 shadow-inner">
                      <ImageIcon size={40} className="opacity-50" />
                    </div>
                  )}

                  <h3 className={`text-2xl font-bold font-heading line-clamp-2 leading-tight ${theme === 'minimal' ? 'text-zinc-800' : 'text-white'}`}>
                    {item.name}
                  </h3>
                  {item.brand && (
                    <p className={`text-sm mt-1 uppercase tracking-wider ${theme === 'minimal' ? 'text-zinc-500' : 'text-white/80'}`}>
                      {item.brand}
                    </p>
                  )}
                  
                  <div className={`mt-5 text-3xl font-black tracking-tight ${theme === 'minimal' ? 'text-primary' : 'text-white text-shadow-sm'}`}>
                    ₦{price.toLocaleString()}
                  </div>
                </div>

                <div className={`py-4 px-6 z-10 flex items-center justify-between backdrop-blur-md ${theme === 'minimal' ? 'bg-zinc-50 border-t border-zinc-100' : 'bg-black/20'}`}>
                  <div className="flex items-center gap-2">
                    {profile.logo_data_url ? (
                      <img src={profile.logo_data_url} alt="Logo" className="w-6 h-6 rounded-md object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-md bg-primary text-white flex items-center justify-center text-[10px] font-bold">VS</div>
                    )}
                    <span className="font-bold text-sm tracking-tight">{shopName}</span>
                  </div>
                  {profile.phone && (
                    <div className={`text-xs font-medium ${theme === 'minimal' ? 'text-zinc-500' : 'text-white/80'}`}>
                      {profile.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {busy && (
              <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">Preparing flyer for sharing…</p>
            )}
          </div>

          <div className={`${modalSheetFooter} flex flex-col gap-2 sm:flex-row sm:gap-3`}>
            <button
              type="button"
              onClick={handleShare}
              disabled={!ready}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
              Share
            </button>
            <button
              type="button"
              onClick={() => {
                if (capture.status === 'ready') triggerPngDownload(capture.blob);
              }}
              disabled={!ready}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Save Image
            </button>
          </div>
        </div>
      </div>
    </ModalSheetPortal>
  );
}
