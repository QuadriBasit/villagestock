/**
 * Shared layout for bottom-sheet modals on mobile and centered dialogs on desktop (sm+).
 */

export const modalSheetBackdrop =
  'fixed inset-0 z-50 flex items-end justify-center overflow-y-auto sm:items-center sm:overflow-y-auto sm:p-6 bg-black/50 dark:bg-black/60 backdrop-blur-sm';

/** `min-h-0` lets the panel shrink inside the flex backdrop so `max-h` + body scroll work (avoids top/bottom clipping on desktop). */
const panelBase =
  'flex min-h-0 w-full max-h-[min(92dvh,calc(100dvh-1.5rem))] flex-col overflow-hidden border border-zinc-200/90 bg-white shadow-2xl ring-1 ring-black/[0.04] dark:border-zinc-700 dark:bg-zinc-900 dark:ring-white/[0.06] rounded-t-[1.25rem] sm:max-h-[min(85dvh,calc(100dvh-3rem),920px)] sm:rounded-2xl sm:shrink-0';

/** Receipt / narrow */
export const modalSheetPanelSm = `${panelBase} max-w-sm sm:max-w-md`;

/** Default forms */
export const modalSheetPanelMd = `${panelBase} max-w-lg`;

/** Swap / wide forms */
export const modalSheetPanelLg = `${panelBase} max-w-2xl`;

/** Drag handle — mobile only */
export const modalSheetHandle = 'flex shrink-0 justify-center pt-3 pb-1 sm:hidden';

export const modalSheetHeader =
  'flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-700';

export const modalSheetBodyScroll = 'min-h-0 flex-1 overflow-y-auto px-5 py-4';

export const modalSheetFooter =
  'shrink-0 border-t border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950/90';
