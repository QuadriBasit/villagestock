import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';

const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 0.45;
const MAX_BACKDROP_FADE = 420;
const CLOSE_DURATION_MS = 260;

function isMobileSheet() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
}

type ModalSheetContextValue = {
  requestClose: () => void;
};

export const ModalSheetContext = createContext<ModalSheetContextValue | null>(null);

export function useModalSheetClose(fallback?: () => void) {
  const ctx = useContext(ModalSheetContext);
  return ctx?.requestClose ?? fallback ?? (() => {});
}

export function useSheetDragDismiss(onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const dragYRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const isClosingRef = useRef(false);
  const closeTimer = useRef<number | null>(null);

  const setDragOffset = useCallback((next: number) => {
    dragYRef.current = next;
    setDragY(next);
  }, []);

  const startY = useRef(0);
  const startDragY = useRef(0);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const activePointer = useRef<number | null>(null);

  const requestClose = useCallback(() => {
    if (isClosingRef.current) return;

    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
    }

    isClosingRef.current = true;
    setIsClosing(true);
    setIsDragging(false);
    activePointer.current = null;

    if (isMobileSheet()) {
      setDragOffset(typeof window !== 'undefined' ? window.innerHeight : 640);
    }

    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      onClose();
    }, CLOSE_DURATION_MS);
  }, [onClose, setDragOffset]);

  const finishDrag = useCallback(
    (clientY: number) => {
      const dt = Math.max(performance.now() - lastT.current, 1);
      const velocity = (clientY - lastY.current) / dt;
      const shouldDismiss = dragYRef.current >= DISMISS_DISTANCE || velocity >= DISMISS_VELOCITY;

      setIsDragging(false);
      activePointer.current = null;

      if (shouldDismiss) {
        requestClose();
        return;
      }

      setDragOffset(0);
    },
    [requestClose, setDragOffset],
  );

  const beginDrag = useCallback(
    (clientY: number, pointerId: number, target: EventTarget | null) => {
      if (!isMobileSheet() || isClosing) return false;
      if (target instanceof Element && target.closest('button, a, input, textarea, select, label, [role="button"]')) {
        return false;
      }

      activePointer.current = pointerId;
      startY.current = clientY;
      startDragY.current = dragYRef.current;
      lastY.current = clientY;
      lastT.current = performance.now();
      setIsDragging(true);
      return true;
    },
    [isClosing],
  );

  const onHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!beginDrag(event.clientY, event.pointerId, event.target)) return;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [beginDrag],
  );

  const onPanelPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isMobileSheet() || isClosing) return;
      if (event.target instanceof Element && event.target.closest('[data-sheet-drag-handle]')) return;

      const panel = panelRef.current;
      if (!panel) return;

      const scrollEl = panel.querySelector('.modal-sheet-body') as HTMLElement | null;
      if (scrollEl && scrollEl.scrollTop > 2) return;

      const top = panel.getBoundingClientRect().top;
      if (event.clientY - top > 88) return;

      if (!beginDrag(event.clientY, event.pointerId, event.target)) return;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [beginDrag, isClosing],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (activePointer.current !== event.pointerId || !isDragging) return;
      const delta = event.clientY - startY.current;
      setDragOffset(Math.max(0, startDragY.current + delta));
      lastY.current = event.clientY;
      lastT.current = performance.now();
    },
    [isDragging, setDragOffset],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (activePointer.current !== event.pointerId) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      finishDrag(event.clientY);
    },
    [finishDrag],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (activePointer.current !== event.pointerId) return;
      setIsDragging(false);
      activePointer.current = null;
      setDragOffset(0);
    },
    [setDragOffset],
  );

  const panelStyle: CSSProperties | undefined =
    dragY > 0 || isDragging || (isClosing && isMobileSheet())
      ? {
          transform: `translate3d(0, ${dragY}px, 0)`,
          transition:
            isDragging && !isClosing
              ? 'none'
              : 'transform 0.26s cubic-bezier(0.32, 0.72, 0, 1)',
        }
      : undefined;

  const backdropStyle: CSSProperties | undefined =
    dragY > 0 || isClosing
      ? {
          opacity: isClosing
            ? 0
            : Math.max(0.12, 1 - dragY / MAX_BACKDROP_FADE),
          transition: isDragging && !isClosing ? 'none' : 'opacity 0.26s ease',
        }
      : undefined;

  return {
    panelRef,
    panelStyle,
    backdropStyle,
    isDragging,
    isClosing,
    requestClose,
    onHandlePointerDown,
    onPanelPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
