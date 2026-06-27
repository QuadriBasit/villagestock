import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/Command';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { COMMAND_PAGES } from '@/config/navigation';
import { formatCurrency } from '@/lib/utils';
import type { InventoryItem } from '@/types';

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  onNewSale?: () => void;
};

export function CommandPalette({ open, onClose, onNewSale }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const items = useLiveQuery(async (): Promise<InventoryItem[]> => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return [];
    return db.inventory_items
      .where('user_id')
      .equals(shopOwnerId)
      .filter(i => !i.deleted && i.location_id === activeLocationId)
      .toArray();
  }, [shopOwnerId, activeLocationId, locationReady]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !items) return [];
    const digits = q.replace(/\D/g, '');
    return items
      .filter(i => {
        const hay = `${i.name} ${i.brand} ${i.imei ?? ''} ${i.serial_number ?? ''}`.toLowerCase();
        if (hay.includes(q)) return true;
        if (digits.length >= 4) {
          return (i.imei ?? '').includes(digits) || (i.serial_number ?? '').includes(digits);
        }
        return false;
      })
      .slice(0, 8);
  }, [items, query]);

  if (!open) return null;

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-shell-line bg-shell-surface shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search products, IMEI, pages…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            {!query.trim() ? (
              <>
                <CommandGroup heading="Actions">
                  <CommandItem
                    onSelect={() => {
                      onClose();
                      if (onNewSale) onNewSale();
                      else navigate('/till');
                    }}
                  >
                    New sale
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Jump to">
                  {COMMAND_PAGES.map(p => (
                    <CommandItem key={p.to} onSelect={() => go(p.to)}>
                      {p.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : (
              <>
                {filteredProducts.length > 0 ? (
                  <CommandGroup heading="Products">
                    {filteredProducts.map(item => (
                      <CommandItem
                        key={item.id}
                        onSelect={() => go(`/inventory?edit=${item.id}`)}
                      >
                        <span className="flex-1 truncate">{item.brand} {item.name}</span>
                        <span className="ml-2 text-xs tabular-nums text-shell-muted">
                          {formatCurrency(item.price)}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                <CommandGroup heading="Pages">
                  {COMMAND_PAGES.filter(p => p.label.toLowerCase().includes(query.toLowerCase())).map(p => (
                    <CommandItem key={p.to} onSelect={() => go(p.to)}>
                      {p.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </div>
    </div>
  );
}
