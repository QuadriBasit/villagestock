import { create } from 'zustand';
import type { InventoryFilters } from '@/types';

interface InventoryState {
  filters: InventoryFilters;
  setFilters: (filters: Partial<InventoryFilters>) => void;
  resetFilters: () => void;
}

const defaultFilters: InventoryFilters = {
  search: '',
  category: 'all',
  lowStockOnly: false,
  showSold: false,
  sortBy: 'updated_at',
  sortDir: 'desc',
};

export const useInventoryStore = create<InventoryState>()((set) => ({
  filters: defaultFilters,
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
  resetFilters: () => set({ filters: defaultFilters }),
}));
