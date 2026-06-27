import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Copy, MessageCircle, Search } from 'lucide-react';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { useShopProfile } from '@/hooks/useShopProfile';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Card, CardContent } from '@/components/ui/Card';
import { CategoryThumb } from '@/components/inventory/CategoryThumb';
import { WhatsAppPreview } from '@/components/share/WhatsAppPreview';
import {
  buildPriceListText,
  buildProductCardText,
  CATEGORY_LABELS,
} from '@/lib/priceListText';
import { conditionLabel, getInspectionFlags, itemSpecLine } from '@/lib/inventoryDisplay';
import { cn, formatCurrency } from '@/lib/utils';
import type { Category, InventoryItem } from '@/types';

type StudioMode = 'list' | 'card';
type CategoryFilter = Category | 'all';

const CATEGORY_TABS: CategoryFilter[] = ['all', 'phones', 'laptops', 'accessories'];

function isInStock(item: InventoryItem): boolean {
  if (item.mode === 'serialized') return item.status === 'in_stock';
  return item.quantity > 0;
}

export default function PriceListPage() {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();
  const { profile } = useShopProfile();

  const inStock = useLiveQuery(async () => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return [];
    const rows = await db.inventory_items
      .where('user_id')
      .equals(shopOwnerId)
      .filter(i => !i.deleted && i.location_id === activeLocationId)
      .toArray();
    return rows.filter(isInStock).sort((a, b) => a.name.localeCompare(b.name));
  }, [shopOwnerId, activeLocationId, locationReady]);

  const [mode, setMode] = useState<StudioMode>('list');
  const [catFilter, setCatFilter] = useState<CategoryFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [note, setNote] = useState('');
  const [cardItemId, setCardItemId] = useState<string | null>(null);
  const [cardQ, setCardQ] = useState('');
  const [copied, setCopied] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!inStock?.length || seeded) return;
    setSelected(new Set(inStock.map(i => i.id)));
    setCardItemId(inStock[0]?.id ?? null);
    setSeeded(true);
  }, [inStock, seeded]);

  const filtered = useMemo(() => {
    const rows = inStock ?? [];
    if (catFilter === 'all') return rows;
    return rows.filter(i => i.category === catFilter);
  }, [inStock, catFilter]);

  const listItems = useMemo(() => {
    const rows = inStock ?? [];
    return rows.filter(i => selected.has(i.id));
  }, [inStock, selected]);

  const cardItem =
    (inStock ?? []).find(i => i.id === (cardItemId ?? (inStock ?? [])[0]?.id)) ?? (inStock ?? [])[0];

  const cardResults = useMemo(() => {
    const q = cardQ.trim().toLowerCase();
    const rows = inStock ?? [];
    if (!q) return rows.slice(0, 8);
    return rows
      .filter(i => `${i.name} ${i.brand} ${itemSpecLine(i)}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [inStock, cardQ]);

  const text =
    mode === 'list'
      ? buildPriceListText(listItems, profile, note)
      : cardItem
        ? buildProductCardText(cardItem, profile)
        : '';

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyText = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const shareWhatsApp = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text).catch(() => undefined);
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (inStock === undefined) {
    return <div className="app-page py-8 text-sm text-shell-muted">Loading stock…</div>;
  }

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <PageHeader
        title="Share & price list"
        subtitle="Turn live stock into a WhatsApp post in two taps"
      >
        <div className="flex overflow-hidden rounded-lg border border-shell-line bg-shell-surface p-0.5">
          {(
            [
              ['list', 'Price list'],
              ['card', 'Product card'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm',
                mode === key
                  ? 'bg-shell-surface-2 text-shell-ink'
                  : 'text-shell-muted hover:text-shell-ink'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <div className="space-y-4">
          {mode === 'list' ? (
            <>
              <Card className="border-shell-line bg-shell-surface p-0 shadow-none">
                <CardContent className="p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-semibold text-shell-ink">Pick what to list</h3>
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <button
                        type="button"
                        className="text-violet-300 hover:text-violet-200"
                        onClick={() => setSelected(new Set(filtered.map(i => i.id)))}
                      >
                        All
                      </button>
                      <span className="text-shell-line">·</span>
                      <button
                        type="button"
                        className="text-shell-muted hover:text-shell-ink"
                        onClick={() => setSelected(new Set())}
                      >
                        None
                      </button>
                    </div>
                  </div>

                  <div className="mb-3 flex gap-0 overflow-x-auto border-b border-shell-line">
                    {CATEGORY_TABS.map(c => {
                      const active = catFilter === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCatFilter(c)}
                          className={cn(
                            'relative shrink-0 px-3 py-2 text-xs font-medium capitalize',
                            active
                              ? 'text-shell-ink after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-shell-ink/70'
                              : 'text-shell-muted hover:text-shell-ink'
                          )}
                        >
                          {c === 'all' ? 'All' : CATEGORY_LABELS[c]}
                        </button>
                      );
                    })}
                  </div>

                  <div className="max-h-80 space-y-0.5 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <p className="py-8 text-center text-sm text-shell-muted">Nothing in stock here.</p>
                    ) : (
                      filtered.map(item => {
                        const on = selected.has(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggle(item.id)}
                            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-shell-surface-2/50"
                          >
                            <span
                              className={cn(
                                'grid size-5 shrink-0 place-items-center rounded-md border',
                                on
                                  ? 'border-violet-400 bg-violet-400 text-[#160a2e]'
                                  : 'border-shell-line bg-transparent'
                              )}
                            >
                              {on ? <Check size={12} strokeWidth={3} /> : null}
                            </span>
                            <CategoryThumb category={item.category} size="sm" className="!h-8 !w-8" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium text-shell-ink">{item.name}</p>
                              <p className="text-[11px] text-shell-muted">{conditionLabel(item.condition)}</p>
                            </div>
                            <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-shell-ink">
                              {formatCurrency(item.price)}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-shell-line bg-shell-surface shadow-none">
                <CardContent className="space-y-3 p-4">
                  <h3 className="font-display text-sm font-semibold text-shell-ink">Options</h3>
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-shell-muted">
                      Closing line
                    </span>
                    <Textarea
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      rows={2}
                      placeholder="Prices may move with the rate. DM to order 📩"
                      className="shell-inset-field min-h-0 w-full resize-none rounded-lg border border-shell-line bg-shell-surface-2/40 px-3 py-2 text-sm text-shell-ink outline-none placeholder:text-shell-muted focus:border-shell-muted/60"
                    />
                  </label>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-shell-line bg-shell-surface p-0 shadow-none">
              <CardContent className="space-y-3 p-4">
                <h3 className="font-display text-sm font-semibold text-shell-ink">Pick a product</h3>
                <div className="flex items-center gap-2.5 rounded-lg border border-shell-line bg-shell-surface-2/30 px-3 py-2">
                  <Search size={15} className="shrink-0 text-shell-muted" />
                  <Input
                    type="text"
                    value={cardQ}
                    onChange={e => setCardQ(e.target.value)}
                    placeholder="Search a product to share…"
                    className="shell-inset-field min-w-0 flex-1 border-0 bg-transparent text-sm text-shell-ink shadow-none outline-none placeholder:text-shell-muted focus-visible:ring-0"
                  />
                </div>
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {cardResults.map(item => {
                    const on = item.id === cardItem?.id;
                    const flags = getInspectionFlags(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCardItemId(item.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                          on
                            ? 'border-violet-400/50 bg-violet-400/8'
                            : 'border-shell-line bg-shell-surface-2/30 hover:bg-shell-surface-2/50'
                        )}
                      >
                        <CategoryThumb category={item.category} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-shell-ink">{item.name}</p>
                          <p className="text-xs text-shell-muted">
                            {conditionLabel(item.condition)} · {formatCurrency(item.price)}
                            {flags.includes('IDM') ? ' · IDM' : ''}
                          </p>
                        </div>
                        {on ? <Check size={16} className="shrink-0 text-violet-300" /> : null}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-3 xl:sticky xl:top-20">
          {mode === 'list' ? (
            <WhatsAppPreview shopName={profile.shop_name} text={text} />
          ) : cardItem ? (
            <ProductCardPreview item={cardItem} shop={profile} />
          ) : (
            <Card className="border-shell-line bg-shell-surface p-8 text-center text-sm text-shell-muted shadow-none">
              No in-stock products to share.
            </Card>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
              disabled={!text}
              onClick={() => void copyText()}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy text'}
            </Button>
            <Button
              className="bg-[#25d366] text-[#0b141a] hover:bg-[#20bd5a]"
              disabled={!text}
              onClick={() => void shareWhatsApp()}
            >
              <MessageCircle size={16} />
              WhatsApp
            </Button>
          </div>

          <p className="text-[11.5px] leading-relaxed text-shell-muted">
            {mode === 'list'
              ? `${listItems.length} item${listItems.length === 1 ? '' : 's'} · paste into your WhatsApp status or a broadcast.`
              : 'Copy and send with the product photo attached.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProductCardPreview({
  item,
  shop,
}: {
  item: InventoryItem;
  shop: { shop_name: string; address: string; phone: string };
}) {
  const flags = getInspectionFlags(item);
  const initial = (shop.shop_name.trim()[0] || 'V').toUpperCase();

  return (
    <Card className="overflow-hidden border-shell-line bg-shell-surface p-0 shadow-none">
      <div className="flex items-center gap-3 border-b border-shell-line bg-gradient-to-br from-violet-400/20 to-shell-surface px-4 py-4">
        <span className="grid size-9 place-items-center rounded-lg bg-violet-400 font-display text-sm font-bold text-[#160a2e]">
          {initial}
        </span>
        <div>
          <p className="font-display text-sm font-semibold text-shell-ink">{shop.shop_name || 'Village Stock'}</p>
          {shop.address ? <p className="text-[11px] text-shell-muted">{shop.address}</p> : null}
        </div>
      </div>
      <CardContent className="space-y-3 p-4">
        <div className="grid h-[140px] place-items-center rounded-xl border border-shell-line bg-shell-surface-2/50 font-mono text-xs text-shell-muted">
          product photo
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-shell-line bg-shell-surface-2 px-2 py-0.5 text-[11px] text-shell-ink">
            {conditionLabel(item.condition)}
          </span>
          {flags.map(flag => (
            <span
              key={flag}
              className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200"
            >
              {flag}
            </span>
          ))}
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold text-shell-ink">{item.name}</h3>
          <p className="mt-0.5 text-sm text-shell-muted">{itemSpecLine(item)}</p>
        </div>
        <p className="font-mono text-3xl font-bold text-violet-300">{formatCurrency(item.price)}</p>
        {shop.phone ? (
          <p className="border-t border-shell-line pt-3 text-xs text-shell-muted">📞 {shop.phone}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
