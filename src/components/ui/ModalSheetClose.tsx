import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useModalSheetClose } from '@/hooks/useSheetDragDismiss';
import { cn } from '@/lib/utils';

type ModalSheetCloseProps = {
  /** Fallback when used outside ModalSheetFrame. */
  onClick?: () => void;
  className?: string;
};

export function ModalSheetClose({ onClick, className }: ModalSheetCloseProps) {
  const requestClose = useModalSheetClose(onClick);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={requestClose}
      aria-label="Close"
      className={cn('size-9 shrink-0 rounded-lg text-shell-muted hover:text-shell-ink', className)}
    >
      <X size={18} />
    </Button>
  );
}
