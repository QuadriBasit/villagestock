import AddProductFlow from '@/components/inventory/addProduct/AddProductFlow';
import type { ContactRecord, PaymentMethod, PurchaseArrival, PurchaseLine, PurchaseRecord, PurchaseTerms } from '@/types';

type RecordPurchaseModalProps = {
  open: boolean;
  suppliers: ContactRecord[];
  presetSupplierId?: string;
  /** False when the role can record a bill but cannot add products. */
  canStock?: boolean;
  onClose: () => void;
  onSave: (input: {
    supplier_contact_id: string;
    supplier_name: string;
    items: PurchaseLine[];
    total: number;
    paid: number;
    payment_method: PaymentMethod;
    terms: PurchaseTerms;
    purchased_at: string;
    arrival: PurchaseArrival;
    alreadyStocked?: boolean;
  }) => Promise<PurchaseRecord>;
};

export default function RecordPurchaseModal({
  open,
  suppliers,
  presetSupplierId,
  canStock = true,
  onClose,
  onSave,
}: RecordPurchaseModalProps) {
  return (
    <AddProductFlow
      open={open}
      onClose={onClose}
      purchase={{ suppliers, presetSupplierId, canStock, onSave }}
    />
  );
}
