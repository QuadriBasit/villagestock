/**
 * Shared layout for bottom-sheet modals on mobile and centered dialogs on desktop (sm+).
 * Panel uses `.modal-sheet-panel` for slide-up / zoom enter animation (see index.css).
 */

export const modalSheetBackdrop =
  'modal-sheet-backdrop fixed inset-0 z-50 flex flex-col justify-end overflow-hidden sm:items-center sm:justify-center sm:p-6 bg-black/50 dark:bg-black/60 backdrop-blur-sm';

/** `min-h-0` lets the panel shrink inside the flex backdrop so `max-h` + body scroll work. */
const panelBase =
  'modal-sheet-panel relative flex min-h-0 w-full max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-0.5rem))] flex-col overflow-hidden border border-shell-line bg-shell-surface shadow-[var(--shadow-shell-elevated)] rounded-t-[1.25rem] sm:max-h-[min(85dvh,calc(100dvh-3rem),920px)] sm:shrink-0 sm:rounded-2xl';

/** Receipt / narrow */
export const modalSheetPanelSm = `${panelBase} max-w-sm sm:max-w-md`;

/** Default forms */
export const modalSheetPanelMd = `${panelBase} max-w-lg`;

/** Wide forms (swap, add product) */
export const modalSheetPanelLg = `${panelBase} max-w-2xl`;

/** Drag handle — mobile only */
export const modalSheetHandle = 'flex shrink-0 justify-center pt-3 pb-1 sm:hidden';

export const modalSheetHeader =
  'flex shrink-0 items-center justify-between gap-3 border-b border-shell-line px-5 py-3 dark:border-zinc-700';

export const modalSheetBodyScroll =
  'modal-sheet-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]';

export const modalSheetFooter =
  'shrink-0 border-t border-shell-line bg-shell-surface px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]';
