import AddProductFlow from '@/components/inventory/addProduct/AddProductFlow';

type EditProductModalProps = {
  open: boolean;
  itemId: string;
  onClose: () => void;
};

export default function EditProductModal({ open, itemId, onClose }: EditProductModalProps) {
  return <AddProductFlow open={open} onClose={onClose} itemId={itemId} />;
}
