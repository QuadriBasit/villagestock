import { useState, lazy, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInventoryItem } from '@/hooks/useInventory';
import { useInventoryActions } from '@/hooks/useInventoryActions';
import { useShopLocation } from '@/context/ShopLocationContext';
import ItemForm from '@/components/inventory/ItemForm';
import type { InventoryItemInput } from '@/types';
import { Package, ArrowRightLeft, Share2 } from 'lucide-react';
import PromoFlyerModal from '@/components/inventory/PromoFlyerModal';
import { settingsBtnOutline } from '@/components/settings/settingsUi';
import { cn } from '@/lib/utils';

const TransferStockModal = lazy(() => import('@/components/inventory/TransferStockModal'));

/** Full-page editor for parts and other categories outside the product wizard. */
export default function EditItemLegacyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { item, isLoading } = useInventoryItem(id!);
  const { updateItem } = useInventoryActions();
  const { locations } = useShopLocation();
  const [flyerOpen, setFlyerOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const handleSubmit = async (data: InventoryItemInput) => {
    await updateItem(id!, data);
    navigate('/inventory');
  };

  if (isLoading) {
    return (
      <div className="app-page flex justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-4 border-violet-400 border-t-transparent" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="app-page flex flex-col items-center px-4 py-20 text-center">
        <Package size={48} className="mb-3 text-shell-muted" />
        <p className="font-medium text-shell-ink">Item not found</p>
        <button onClick={() => navigate('/inventory')} className="mt-4 text-sm text-violet-400">
          Back to Inventory
        </button>
      </div>
    );
  }

  const canTransfer = locations.length > 1 && item.location_id;

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <div className="rounded-xl border border-shell-line bg-shell-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-shell-ink">
              <Share2 size={16} className="text-violet-300" />
              Promo Flyer
            </h3>
            <p className="mt-1 text-xs text-shell-muted">
              Generate a shareable image for WhatsApp or Instagram.
            </p>
          </div>
          <button type="button" onClick={() => setFlyerOpen(true)} className={cn(settingsBtnOutline, 'shrink-0 px-3 py-2 text-xs')}>
            Create flyer
          </button>
        </div>
      </div>

      <ItemForm defaultValues={item} onSubmit={handleSubmit} submitLabel="Save Changes" />

      {canTransfer ? (
        <div className="rounded-xl border border-shell-line bg-shell-surface p-4">
          <div className="mb-2 flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-violet-300" />
            <h3 className="font-display text-sm font-semibold text-shell-ink">Move to another branch</h3>
          </div>
          <p className="mb-3 text-xs text-shell-muted">
            Transfer this line to another counter. Serialized units move one at a time; accessories move the full quantity on this row.
          </p>
          <button type="button" onClick={() => setTransferOpen(true)} className={cn(settingsBtnOutline, 'text-sm')}>
            <ArrowRightLeft size={16} />
            Transfer stock
          </button>
        </div>
      ) : null}

      {transferOpen ? (
        <Suspense fallback={null}>
          <TransferStockModal
            open
            presetItem={item}
            onClose={() => setTransferOpen(false)}
            onSuccess={() => setTransferOpen(false)}
          />
        </Suspense>
      ) : null}

      {flyerOpen ? <PromoFlyerModal item={item as never} onClose={() => setFlyerOpen(false)} /> : null}
    </div>
  );
}
