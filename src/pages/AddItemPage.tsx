import { Navigate } from 'react-router-dom';

/** Legacy route — add product now opens as a modal on the inventory page. */
export default function AddItemPage() {
  return <Navigate to="/inventory?add=1" replace />;
}
