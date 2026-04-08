import { useNavigate, useParams } from 'react-router-dom';
import { useInventoryItem } from '@/hooks/useInventory';
import { useInventoryActions } from '@/hooks/useInventoryActions';
import ItemForm from '@/components/inventory/ItemForm';
import type { InventoryItemInput } from '@/types';
import { Package } from 'lucide-react';

export default function EditItemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { item, isLoading } = useInventoryItem(id!);
  const { updateItem } = useInventoryActions();

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

  return (
    <ItemForm
      defaultValues={item}
      onSubmit={handleSubmit}
      submitLabel="Save Changes"
    />
  );
}
