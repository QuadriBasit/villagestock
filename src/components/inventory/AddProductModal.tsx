import AddProductFlow from '@/components/inventory/addProduct/AddProductFlow';

type AddProductModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function AddProductModal({ open, onClose }: AddProductModalProps) {
  return <AddProductFlow open={open} onClose={onClose} />;
}
