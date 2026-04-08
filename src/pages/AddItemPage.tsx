import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventoryActions } from '@/hooks/useInventoryActions';
import ItemForm from '@/components/inventory/ItemForm';
import type { InventoryItemInput } from '@/types';

export default function AddItemPage() {
  const navigate = useNavigate();
  const { addItem } = useInventoryActions();
  // baseValues carries brand/name/price/category between "Add Another" taps
  const [baseValues, setBaseValues] = useState<Partial<InventoryItemInput> | undefined>(undefined);
  const [formKey, setFormKey] = useState(0);

  const handleSubmit = async (data: InventoryItemInput) => {
    await addItem(data);
    navigate('/inventory');
  };

  const handleAddAnother = (base: Partial<InventoryItemInput>) => {
    setBaseValues(base);
    // bump key to remount the form (clears identifier fields while keeping base)
    setFormKey(k => k + 1);
  };

  return (
    <ItemForm
      key={formKey}
      defaultValues={baseValues}
      onSubmit={handleSubmit}
      submitLabel="Add to Inventory"
      onAddAnother={handleAddAnother}
    />
  );
}
