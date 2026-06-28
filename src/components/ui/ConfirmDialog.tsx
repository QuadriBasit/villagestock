import { Trash2, X } from 'lucide-react';
import { modalSheetBackdrop } from '@/lib/modalSheet';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

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
    <ModalSheetPortal>
      <div className={cn(modalSheetBackdrop, 'bg-black/60')} onClick={onCancel}>
        <div
          className="w-full max-w-sm overflow-hidden rounded-t-[1.25rem] border border-shell-line bg-shell-surface shadow-[var(--shadow-shell-elevated)] sm:rounded-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex flex-col items-center px-6 pb-4 pt-6 text-center">
            <div
              className={cn(
                'mb-3 flex size-14 items-center justify-center rounded-full',
                destructive ? 'bg-red-500/15' : 'bg-violet-400/15',
              )}
            >
              {destructive ? (
                <Trash2 size={24} className="text-red-400" />
              ) : (
                <X size={24} className="text-violet-300" />
              )}
            </div>
            <h3 className="font-display text-lg font-semibold text-shell-ink">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-shell-muted">{message}</p>
          </div>

          <div className="grid grid-cols-2 border-t border-shell-line">
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              className="h-auto rounded-none border-r border-shell-line py-3.5 text-sm font-medium text-shell-muted hover:bg-shell-surface-2 hover:text-shell-ink"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onConfirm}
              className={cn(
                'h-auto rounded-none py-3.5 text-sm font-semibold',
                destructive
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-violet-300 hover:bg-violet-400/10',
              )}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </ModalSheetPortal>
  );
}
