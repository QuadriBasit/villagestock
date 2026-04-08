import { Trash2, X } from 'lucide-react';

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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex flex-col items-center pt-6 pb-4 px-6 text-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${
            destructive ? 'bg-red-100' : 'bg-primary/10'
          }`}>
            {destructive
              ? <Trash2 size={24} className="text-red-500" />
              : <X size={24} className="text-primary" />
            }
          </div>
          <h3 className="font-heading font-bold text-dark text-lg">{title}</h3>
          <p className="text-muted text-sm mt-1 leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex border-t border-border">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 text-sm font-medium text-muted hover:bg-surface transition-colors border-r border-border"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
              destructive
                ? 'text-red-500 hover:bg-red-50'
                : 'text-primary hover:bg-primary/5'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
