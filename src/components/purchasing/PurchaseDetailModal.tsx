import { Box, Phone } from 'lucide-react';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { ModalSheetClose } from '@/components/ui/ModalSheetClose';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import {
  purchaseItemSummary,
  purchaseOrderLabel,
  purchaseOwed,
  purchaseStatusLabel,
} from '@/lib/purchasing';
import { modalSheetBodyScroll, modalSheetPanelMd } from '@/lib/modalSheet';
import type { ContactRecord, PurchaseRecord } from '@/types';

type PurchaseDetailModalProps = {
  purchase: PurchaseRecord | null;
  supplier?: ContactRecord;
  onClose: () => void;
  onPaySupplier?: (supplier: ContactRecord) => void;
};

export default function PurchaseDetailModal({
  purchase,
  supplier,
  onClose,
  onPaySupplier,
}: PurchaseDetailModalProps) {
  if (!purchase) return null;

  const owed = purchaseOwed(purchase);
  const status = purchaseStatusLabel(purchase);
  const dateLabel = formatDate(purchase.purchased_at);

  return (
    <ModalSheetPortal>
      <ModalSheetFrame onClose={onClose} panelClassName={modalSheetPanelMd} backdropClassName="bg-black/70">
<div className="flex shrink-0 items-start justify-between gap-3 border-b border-shell-line px-5 py-4">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold text-shell-ink">
                Purchase {purchaseOrderLabel(purchase)}
              </h2>
              <p className="text-xs text-shell-muted">
                {purchase.supplier_name} · {dateLabel}
              </p>
            </div>
            <ModalSheetClose onClick={onClose} />
          </div>

          <div className={cn(modalSheetBodyScroll, 'px-5 py-4')}>
            <div className="mb-4 space-y-2">
              {purchase.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-lg border border-shell-line bg-shell-surface-2/35 p-3"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-shell-line bg-shell-surface text-brand-300">
                    <Box size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-shell-ink">{item.name}</p>
                    <p className="text-xs text-shell-muted">
                      {item.qty} × {formatCurrency(item.unit_cost)}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-shell-ink">
                    {formatCurrency(item.qty * item.unit_cost)}
                  </span>
                </div>
              ))}
            </div>

            <div className="divide-y divide-shell-line rounded-lg border border-shell-line">
              <SummaryRow label="Items" value={purchaseItemSummary(purchase)} />
              <SummaryRow label="Total" value={formatCurrency(purchase.total)} strong />
              <SummaryRow label="Paid" value={formatCurrency(purchase.paid)} tone="emerald" />
              {owed > 0 ? <SummaryRow label="Outstanding" value={formatCurrency(owed)} tone="amber" strong /> : null}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Badge
                className={
                  status === 'Paid'
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                    : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                }
              >
                {status}
              </Badge>
            </div>

            <div className="mt-4 flex gap-2">
              <a
                href={supplier?.phone ? `tel:${supplier.phone}` : undefined}
                className={cn('flex-1', !supplier?.phone && 'pointer-events-none opacity-50')}
              >
                <Button
                  variant="outline"
                  className="w-full border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                >
                  <Phone size={16} /> Call supplier
                </Button>
              </a>
              {owed > 0 && supplier && onPaySupplier ? (
                <Button
                  className="flex-1 bg-brand-400 text-[#04231d] hover:bg-brand-300"
                  onClick={() => {
                    onClose();
                    onPaySupplier(supplier);
                  }}
                >
                  Pay supplier
                </Button>
              ) : null}
            </div>
          </div>
        
      </ModalSheetFrame>
    </ModalSheetPortal>
  );
}

function SummaryRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'emerald' | 'amber';
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
      <span className="text-shell-muted">{label}</span>
      <span
        className={cn(
          'text-right text-shell-ink',
          strong && 'font-semibold',
          tone === 'emerald' && 'font-mono text-emerald-300',
          tone === 'amber' && 'font-mono font-semibold text-amber-300',
          !tone && strong && 'font-mono tabular-nums'
        )}
      >
        {value}
      </span>
    </div>
  );
}
