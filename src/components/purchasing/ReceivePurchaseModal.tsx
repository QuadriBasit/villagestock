import { useState } from 'react';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { ModalSheetClose } from '@/components/ui/ModalSheetClose';
import { Button } from '@/components/ui/Button';
import { PurchaseLineFields } from '@/components/purchasing/PurchaseLineFields';
import { purchaseLineStockError, purchaseOrderLabel, resizeUnitIds } from '@/lib/purchasing';
import { cn } from '@/lib/utils';
import { modalSheetBodyScroll, modalSheetPanelMd } from '@/lib/modalSheet';
import type { PurchaseLine, PurchaseRecord } from '@/types';

type ReceivePurchaseModalProps = {
  purchase: PurchaseRecord;
  onClose: () => void;
  onReceive: (items: PurchaseLine[]) => Promise<void>;
};

export default function ReceivePurchaseModal({ purchase, onClose, onReceive }: ReceivePurchaseModalProps) {
  const [lines, setLines] = useState<PurchaseLine[]>(() =>
    purchase.items.map(line => ({
      ...line,
      category: line.category ?? 'accessories',
      sell_price: line.sell_price ?? 0,
      unit_ids: resizeUnitIds(line.unit_ids, line.qty),
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stockError = lines.map(purchaseLineStockError).find(Boolean) ?? null;

  const save = async () => {
    if (stockError) return;
    setSaving(true);
    setError(null);
    try {
      await onReceive(lines);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add these to inventory');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheetPortal>
      <ModalSheetFrame onClose={onClose} panelClassName={cn(modalSheetPanelMd, 'max-w-xl')} backdropClassName="bg-black/70">
        <div className="flex items-center justify-between border-b border-shell-line px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-shell-ink">Receive into stock</h2>
            <p className="text-xs text-shell-muted">
              Purchase {purchaseOrderLabel(purchase)} · phones need an IMEI before they can be sold
            </p>
          </div>
          <ModalSheetClose onClick={onClose} />
        </div>
        <div className={cn(modalSheetBodyScroll, 'space-y-4 px-5 py-4')}>
          <PurchaseLineFields lines={lines} onChange={setLines} stockFields allowAdd={false} />
          {error || stockError ? (
            <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error || stockError}
            </p>
          ) : null}
          <Button
            className="w-full bg-brand-400 text-[#04231d] hover:bg-brand-300"
            disabled={!!stockError || saving}
            onClick={() => void save()}
          >
            {saving ? 'Adding…' : 'Add to inventory'}
          </Button>
        </div>
      </ModalSheetFrame>
    </ModalSheetPortal>
  );
}
