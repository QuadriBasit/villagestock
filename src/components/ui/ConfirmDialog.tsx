import { Trash2, X } from 'lucide-react';
import { modalSheetBackdrop } from '@/lib/modalSheet';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className={modalSheetBackdrop} onClick={onCancel}>
      <div
        className="w-full max-w-sm overflow-hidden rounded-t-[1.25rem] border border-zinc-200/90 bg-white shadow-2xl ring-1 ring-black/[0.04] dark:border-zinc-700 dark:bg-zinc-900 dark:ring-white/[0.06] sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center px-6 pb-4 pt-6 text-center">
          <div
            className={`mb-3 flex h-14 w-14 items-center justify-center rounded-full ${
              destructive ? 'bg-red-100 dark:bg-red-950/60' : 'bg-primary/10 dark:bg-primary/20'
            }`}
          >
            {destructive ? (
              <Trash2 size={24} className="text-red-500 dark:text-red-400" />
            ) : (
              <X size={24} className="text-primary" />
            )}
          </div>
          <h3 className="font-heading text-lg font-bold text-zinc-900 dark:text-zinc-50">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{message}</p>
        </div>

        <div className="flex border-t border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border-r border-zinc-200 py-3.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
              destructive
                ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
                : 'text-primary hover:bg-primary/5 dark:hover:bg-primary/10'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
