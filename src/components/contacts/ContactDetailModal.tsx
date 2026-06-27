import { Phone, ShoppingBag, ShoppingCart, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { Button } from '@/components/ui/Button';
import { cn, formatCurrency } from '@/lib/utils';
import { modalSheetBackdrop, modalSheetBodyScroll, modalSheetHandle } from '@/lib/modalSheet';
import type { ContactRecord } from '@/types';

type ContactDetailModalProps = {
  contact: ContactRecord | null;
  onClose: () => void;
};

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
      <span className="shrink-0 text-shell-muted">{label}</span>
      <span className={cn('text-right text-shell-ink', mono && 'font-mono tabular-nums')}>{value}</span>
    </div>
  );
}

export default function ContactDetailModal({ contact, onClose }: ContactDetailModalProps) {
  const navigate = useNavigate();
  if (!contact) return null;

  const isSupplier = contact.type === 'supplier';
  const subtitle = [
    isSupplier ? 'Supplier' : 'Customer',
    contact.location_text,
  ]
    .filter(Boolean)
    .join(' · ');

  const action = () => {
    onClose();
    navigate(isSupplier ? '/purchasing' : '/till');
  };

  return (
    <ModalSheetPortal>
      <div className={cn(modalSheetBackdrop, 'bg-black/70')} onClick={onClose}>
        <div
          className="flex min-h-0 w-full max-h-[min(92dvh,calc(100dvh-1.5rem))] max-w-lg flex-col overflow-hidden rounded-t-[1.25rem] border border-shell-line bg-shell-surface shadow-2xl sm:max-h-[min(85dvh,calc(100dvh-3rem))] sm:rounded-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className={modalSheetHandle}>
            <div className="h-1 w-10 rounded-full bg-shell-line" />
          </div>

          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-shell-line px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-400/15 font-display text-base font-bold text-violet-300">
                {contact.name.trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-semibold text-shell-ink">{contact.name}</h2>
                {subtitle ? <p className="text-xs text-shell-muted">{subtitle}</p> : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shell-inset-field rounded-lg p-1.5 text-shell-muted hover:bg-shell-surface-2 hover:text-shell-ink"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className={cn(modalSheetBodyScroll, 'px-5 py-4')}>
            <div className="divide-y divide-shell-line rounded-lg border border-shell-line">
              {contact.phone ? <DetailRow label="Phone" value={contact.phone} mono /> : null}
              {contact.note ? <DetailRow label="Note" value={contact.note} /> : null}
              <DetailRow label="Lifetime deals" value={String(contact.deal_count)} mono />
              {isSupplier ? (
                <DetailRow
                  label="Balance"
                  value={contact.balance_owed > 0 ? `${formatCurrency(contact.balance_owed)} owed` : 'Settled'}
                  mono
                />
              ) : contact.balance_owed > 0 ? (
                <DetailRow label="Outstanding" value={formatCurrency(contact.balance_owed)} mono />
              ) : null}
            </div>

            <div className="mt-4 flex gap-2">
              <a
                href={contact.phone ? `tel:${contact.phone}` : undefined}
                className={cn('flex-1', !contact.phone && 'pointer-events-none opacity-50')}
              >
                <Button
                  variant="outline"
                  className="w-full border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                >
                  <Phone size={16} /> Call
                </Button>
              </a>
              <Button
                className="flex-1 bg-violet-400 text-[#160a2e] hover:bg-violet-300"
                onClick={action}
              >
                {isSupplier ? (
                  <>
                    <ShoppingBag size={16} /> New order
                  </>
                ) : (
                  <>
                    <ShoppingCart size={16} /> New sale
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ModalSheetPortal>
  );
}
