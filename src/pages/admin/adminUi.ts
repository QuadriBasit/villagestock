import { cn } from '@/lib/utils';

export const adminCard =
  'rounded-xl border border-shell-line bg-shell-surface p-5 shadow-none md:p-6';

export const adminStatCard = adminCard;

export const adminRefreshBtn =
  'inline-flex items-center gap-2 rounded-xl border border-shell-line bg-shell-surface px-4 py-2.5 text-sm font-semibold text-shell-ink transition-colors hover:bg-shell-surface-2 disabled:opacity-50';

export const adminField = cn(
  'shell-inset-field w-full rounded-xl border border-shell-line bg-shell-surface-2/40 px-3 py-2.5 text-sm text-shell-ink placeholder:text-shell-muted outline-none transition focus:border-violet-400/45 focus:ring-2 focus:ring-violet-400/12',
);

export const adminTableWrap =
  'overflow-hidden overflow-x-auto rounded-xl border border-shell-line bg-shell-surface shadow-none';

export const adminTableHead =
  'border-b border-shell-line bg-shell-surface-2/50 text-[11px] font-bold uppercase tracking-wider text-shell-muted';

export const adminTableRow = 'border-b border-shell-line last:border-0 hover:bg-shell-surface-2/35 cursor-pointer';

export const adminModalOverlay = 'fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center';

export const adminModalPanel =
  'max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-shell-line bg-shell-surface shadow-none';
