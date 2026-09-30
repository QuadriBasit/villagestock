import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { suggestedNamesForCategoryAndBrand } from '@/lib/devicePresets';
import { useShopAccess } from '@/context/ShopAccessContext';
import type { Category } from '@/types';

const STORAGE_KEY = 'villagestock.modelNames';

type RememberedModel = { category: Category; brand: string; name: string };

function isRemembered(value: unknown): value is RememberedModel {
  if (!value || typeof value !== 'object') return false;
  const row = value as RememberedModel;
  return typeof row.category === 'string' && typeof row.brand === 'string' && typeof row.name === 'string';
}

export function readRememberedModels(): RememberedModel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isRemembered) : [];
  } catch {
    return [];
  }
}

export function rememberModelName(category: Category, brand: string, name: string) {
  const trimmed = name.trim();
  const brandName = brand.trim();
  if (!trimmed) return;
  const rows = readRememberedModels();
  const key = `${category}|${brandName.toLowerCase()}|${trimmed.toLowerCase()}`;
  const exists = rows.some(
    row => `${row.category}|${row.brand.trim().toLowerCase()}|${row.name.trim().toLowerCase()}` === key,
  );
  if (exists) return;
  rows.push({ category, brand: brandName, name: trimmed });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(-400)));
}

function categoriesFor(category: Category): Category[] {
  if (category === 'phones' || category === 'tablets') return ['phones', 'tablets'];
  return [category];
}

export function mergeModelSuggestions(
  category: Category,
  brand: string,
  inventoryNames: RememberedModel[],
): string[] {
  const categories = new Set(categoriesFor(category));
  const brandKey = brand.trim().toLowerCase();
  const matches = (row: RememberedModel) =>
    categories.has(row.category) && (!brandKey || row.brand.trim().toLowerCase() === brandKey);
  const extras = [...inventoryNames.filter(matches), ...readRememberedModels().filter(matches)].map(row => row.name);
  const presets = suggestedNamesForCategoryAndBrand(category, brand);
  const seen = new Set<string>();
  const names: string[] = [];
  for (const name of [...extras, ...presets]) {
    const trimmed = name.trim();
    const key = trimmed.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    names.push(trimmed);
  }
  return names;
}

export function useInventoryModelNames() {
  const { shopOwnerId } = useShopAccess();
  const inventoryNames = useLiveQuery(async () => {
    if (!shopOwnerId) return [];
    const rows = await db.inventory_items.where('user_id').equals(shopOwnerId).toArray();
    return rows
      .filter(item => !item.deleted && item.name.trim())
      .map(item => ({ category: item.category, brand: item.brand, name: item.name.trim() }));
  }, [shopOwnerId]);
  return inventoryNames ?? [];
}

export function useModelNameSuggestions(category: Category, brand: string) {
  const inventoryNames = useInventoryModelNames();
  return useMemo(
    () => mergeModelSuggestions(category, brand, inventoryNames),
    [category, brand, inventoryNames],
  );
}
