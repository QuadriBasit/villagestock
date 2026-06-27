import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useInventoryItem } from '@/hooks/useInventory';
import { supportsWizardEdit } from '@/components/inventory/addProduct/parseItem';
import EditItemLegacyPage from './EditItemLegacyPage';

/** Wizard-supported items edit in a modal on the detail page; parts use the classic form. */
export default function EditItemPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { item, isLoading } = useInventoryItem(id);
  const legacy = searchParams.get('legacy') === '1';

  if (isLoading) {
    return (
      <div className="app-page flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (legacy || (item && !supportsWizardEdit(item.category))) {
    return <EditItemLegacyPage />;
  }

  return <Navigate to={`/inventory/${id}?edit=1`} replace />;
}
