import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInventoryItem } from '@/hooks/useInventory';
import { useInventoryActions } from '@/hooks/useInventoryActions';
import { useShopLocation } from '@/context/ShopLocationContext';
import ItemForm from '@/components/inventory/ItemForm';
import type { InventoryItemInput } from '@/types';
import { Package, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function EditItemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { item, isLoading } = useInventoryItem(id!);
  const { updateItem, transferItemToBranch } = useInventoryActions();
  const { locations } = useShopLocation();
  const [transferTarget, setTransferTarget] = useState('');
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferMsg, setTransferMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSubmit = async (data: InventoryItemInput) => {
    await updateItem(id!, data);
    navigate('/inventory');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center py-20 text-center px-4">
        <Package size={48} className="text-border mb-3" />
        <p className="font-medium text-dark">Item not found</p>
        <button onClick={() => navigate('/inventory')} className="mt-4 text-primary text-sm">
          Back to Inventory
        </button>
      </div>
    );
  }

  const transferOptions = locations.filter(l => l.id !== item.location_id);

  return (
    <div className="space-y-4">
      <ItemForm
        defaultValues={item}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
      />

      {transferOptions.length > 0 && item.location_id ? (
        <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/75">
          <div className="mb-2 flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-primary" />
            <h3 className="font-heading text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Move to another branch
            </h3>
          </div>
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            The whole line moves to the branch you pick (all units for this SKU or this serialized unit). This is how
            stock is transferred between counters.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={transferTarget}
              onChange={e => setTransferTarget(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-100 sm:max-w-xs"
              aria-label="Destination branch"
            >
              <option value="">Choose branch…</option>
              {transferOptions.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={transferBusy || !transferTarget}
              onClick={async () => {
                setTransferMsg(null);
                setTransferBusy(true);
                try {
                  await transferItemToBranch(item.id, transferTarget);
                  setTransferMsg({ ok: true, text: 'Moved. Inventory list will reflect the new branch.' });
                  setTransferTarget('');
                  toast.success('Stock moved to the other branch.');
                } catch (e) {
                  const msg = e instanceof Error ? e.message : 'Could not move item';
                  setTransferMsg({ ok: false, text: msg });
                  toast.error(msg);
                } finally {
                  setTransferBusy(false);
                }
              }}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {transferBusy ? 'Moving…' : 'Move stock'}
            </button>
          </div>
          {transferMsg ? (
            <p
              className={`mt-2 text-xs ${transferMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
            >
              {transferMsg.text}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
