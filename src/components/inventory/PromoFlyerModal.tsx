import { useRef, useState, useEffect, useCallback } from 'react';
import { Share2, Download, Loader2, Image as ImageIcon } from 'lucide-react';
import { modalSheetBodyScroll, modalSheetFooter, modalSheetHeader, modalSheetPanelSm } from '@/lib/modalSheet';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { ModalSheetClose } from '@/components/ui/ModalSheetClose';
import { Button } from '@/components/ui/Button';
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

  const shopName = profile.shop_name || 'Our Shop';
  const price = item.price ?? 0;
  const brandColor = profile.receipt_theme?.header_color || '#7c3aed';

  const flyerStyle = {
    background:
      theme === 'sale'
        ? `linear-gradient(135deg, ${brandColor} 0%, #160a2e 100%)`
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
        setCapture({ status: 'ready', blob, dataUrl });
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

  useEffect(() => updateCapture(), [updateCapture]);

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
      <ModalSheetFrame onClose={onClose} panelClassName={cn(modalSheetPanelSm, 'border-shell-line bg-shell-surface shadow-none')} backdropClassName="bg-black/70">
<div className={cn(modalSheetHeader, 'border-shell-line')}>
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-shell-ink">
              <ImageIcon size={18} className="text-violet-300" />
              Share promo flyer
            </h2>
            <ModalSheetClose />
          </div>

          <div className={cn(modalSheetBodyScroll, 'bg-shell-surface-2/25 px-4 py-4')}>
            {actionError ? (
              <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300">
                {actionError}
              </p>
            ) : null}

            <div className="mb-3 flex justify-center gap-2">
              {(['sale', 'minimal'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTheme(v)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    theme === v
                      ? 'border-violet-400/40 bg-violet-400/15 text-violet-200'
                      : 'border-shell-line bg-shell-surface text-shell-muted hover:text-shell-ink',
                  )}
                >
                  {v === 'sale' ? 'Flash sale' : 'Minimal'}
                </button>
              ))}
            </div>

            <div className="flex justify-center">
              <div
                ref={flyerRef}
                className="relative flex aspect-square w-full max-w-[320px] flex-col overflow-hidden shadow-xl"
                style={flyerStyle}
              >
                {theme === 'sale' ? (
                  <>
                    <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
                    <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-black/20 blur-2xl" />
                  </>
                ) : null}

                <div className="z-10 flex flex-1 flex-col items-center justify-center p-8 text-center">
                  {theme === 'sale' ? (
                    <div className="mb-4 rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-widest text-rose-600 shadow-md">
                      Flash Sale
                    </div>
                  ) : null}

                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="mb-4 h-32 w-32 rounded-2xl border-4 border-white/20 object-cover shadow-lg"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="mb-4 flex h-28 w-28 items-center justify-center rounded-2xl border-2 border-white/20 bg-black/10 shadow-inner">
                      <ImageIcon size={40} className="opacity-50" />
                    </div>
                  )}

                  <h3
                    className={cn(
                      'line-clamp-2 font-display text-2xl font-bold leading-tight',
                      theme === 'minimal' ? 'text-zinc-800' : 'text-white',
                    )}
                  >
                    {item.name}
                  </h3>
                  {item.brand ? (
                    <p
                      className={cn(
                        'mt-1 text-sm uppercase tracking-wider',
                        theme === 'minimal' ? 'text-zinc-500' : 'text-white/80',
                      )}
                    >
                      {item.brand}
                    </p>
                  ) : null}

                  <div
                    className={cn(
                      'mt-5 text-3xl font-black tracking-tight',
                      theme === 'minimal' ? 'text-violet-600' : 'text-white',
                    )}
                  >
                    ₦{price.toLocaleString()}
                  </div>
                </div>

                <div
                  className={cn(
                    'z-10 flex items-center justify-between px-6 py-4 backdrop-blur-md',
                    theme === 'minimal' ? 'border-t border-zinc-100 bg-zinc-50' : 'bg-black/20',
                  )}
                >
                  <div className="flex items-center gap-2">
                    {profile.logo_data_url ? (
                      <img src={profile.logo_data_url} alt="Logo" className="h-6 w-6 rounded-md object-cover" />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500 text-[10px] font-bold text-white">
                        VS
                      </div>
                    )}
                    <span className="text-sm font-bold tracking-tight">{shopName}</span>
                  </div>
                  {profile.phone ? (
                    <div className={cn('text-xs font-medium', theme === 'minimal' ? 'text-zinc-500' : 'text-white/80')}>
                      {profile.phone}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {busy ? (
              <p className="mt-3 text-center text-xs text-shell-muted">Preparing flyer for sharing…</p>
            ) : null}
          </div>

          <div className={cn(modalSheetFooter, 'flex flex-col gap-2 border-shell-line sm:flex-row sm:gap-3')}>
            <Button
              type="button"
              variant="outline"
              onClick={handleShare}
              disabled={!ready}
              className="flex-1 border-shell-line bg-shell-surface text-shell-ink hover:bg-shell-surface-2"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
              Share
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (capture.status === 'ready') triggerPngDownload(capture.blob);
              }}
              disabled={!ready}
              className="flex-1 bg-violet-400 text-[#160a2e] hover:bg-violet-300"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Save image
            </Button>
          </div>
        
      </ModalSheetFrame>
    </ModalSheetPortal>
  );
}
