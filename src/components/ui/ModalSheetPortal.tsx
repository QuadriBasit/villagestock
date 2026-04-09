import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders sheet/dialog overlays on `document.body`.
 * Required because `.route-enter` (and other ancestors) use `transform`, which makes
 * `position: fixed` backdrops cover only that ancestor — not the viewport — so modals look "cut off".
 */
export function ModalSheetPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
