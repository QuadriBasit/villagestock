import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { modalSheetBackdrop } from '@/lib/modalSheet';
import { ModalSheetContext, useSheetDragDismiss } from '@/hooks/useSheetDragDismiss';

type ModalSheetFrameProps = {
  onClose: () => void;
  panelClassName?: string;
  backdropClassName?: string;
  /** Show the mobile drag pill at the top (default true). */
  showHandle?: boolean;
  children: ReactNode;
};

function ModalSheetDragHandle({
  onPointerDown,
}: {
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      data-sheet-drag-handle
      className="flex shrink-0 touch-none cursor-grab justify-center pt-3 pb-1 active:cursor-grabbing sm:hidden"
      onPointerDown={onPointerDown}
      aria-hidden
    >
      <div className="h-1 w-10 rounded-full bg-shell-line" />
    </div>
  );
}

/** Backdrop + draggable bottom sheet panel (mobile drag-to-dismiss). */
export function ModalSheetFrame({
  onClose,
  panelClassName,
  backdropClassName,
  showHandle = true,
  children,
}: ModalSheetFrameProps) {
  const drag = useSheetDragDismiss(onClose);

  return (
    <ModalSheetContext.Provider value={{ requestClose: drag.requestClose }}>
      <div
        className={cn(
          modalSheetBackdrop,
          backdropClassName,
          drag.isClosing && 'modal-sheet-backdrop--closing',
        )}
        style={drag.backdropStyle}
        onClick={drag.requestClose}
      >
        <div
          ref={drag.panelRef}
          role="dialog"
          aria-modal="true"
          className={cn(
            panelClassName,
            drag.isDragging && 'modal-sheet-panel--dragging',
            drag.isClosing && 'modal-sheet-panel--closing',
          )}
          style={drag.panelStyle}
          onClick={event => event.stopPropagation()}
          onPointerDown={drag.onPanelPointerDown}
          onPointerMove={drag.onPointerMove}
          onPointerUp={drag.onPointerUp}
          onPointerCancel={drag.onPointerCancel}
        >
          {showHandle ? <ModalSheetDragHandle onPointerDown={drag.onHandlePointerDown} /> : null}
          {children}
        </div>
      </div>
    </ModalSheetContext.Provider>
  );
}

export { ModalSheetDragHandle };
