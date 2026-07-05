import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

let openModalCount = 0;
let previousBodyOverflow = '';

function lockBodyScroll() {
  if (openModalCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  openModalCount += 1;
}

function unlockBodyScroll() {
  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
  }
}

/**
 * Renders sheet/dialog overlays on `document.body`.
 * Required because `.route-enter` (and other ancestors) use `transform`, which makes
 * `position: fixed` backdrops cover only that ancestor — not the viewport — so modals look "cut off".
 */
export function ModalSheetPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [mounted]);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
