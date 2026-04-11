import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { AlertTriangle, XCircle, Package, ChevronRight, Pencil } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { AlertsSkeletonList } from '@/components/ui/Skeleton';
import type { InventoryItem } from '@/types';

const CRITICAL_FLOOR = 3;

export default function AlertsPage() {
  const { user } = useAuthStore();
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();
  const navigate = useNavigate();

  const alerts = useLiveQuery(async () => {
    if (!user || !shopOwnerId || !locationReady || !activeLocationId) return null;
    const items = await db.inventory_items
      .where('user_id')
      .equals(shopOwnerId)
      .filter(i => !i.deleted && i.location_id === activeLocationId)
      .toArray();

    // ── Non-serialized qty alerts ─────────────────────────────────────────────
    const nonSerialized = items.filter(i => i.mode === 'non_serialized');
    const outOfStock = nonSerialized.filter(i => i.quantity === 0);
    const lowStock = nonSerialized.filter(
      i => i.quantity > 0 && i.quantity <= Math.max(i.low_stock_threshold, CRITICAL_FLOOR)
    );

    // ── Serialized: "last unit" warnings ──────────────────────────────────────
    // Group in_stock serialized items by model (brand + name)
    const serializedInStock = items.filter(i => i.mode === 'serialized' && i.status === 'in_stock');
    const modelMap = new Map<string, InventoryItem[]>();
    for (const item of serializedInStock) {
      const key = `${item.brand}||${item.name}`;
      if (!modelMap.has(key)) modelMap.set(key, []);
      modelMap.get(key)!.push(item);
    }
    // Models with exactly 1 unit remaining — use that unit as the representative item
    const lastUnits = [...modelMap.values()]
      .filter(units => units.length === 1)
      .map(units => units[0]);

    return { lowStock, outOfStock, lastUnits };
  }, [user?.id, shopOwnerId, activeLocationId, locationReady]);

  if (alerts === undefined) return <AlertsSkeletonList />;

  const { lowStock = [], outOfStock = [], lastUnits = [] } = alerts ?? {};
  const total = lowStock.length + outOfStock.length + lastUnits.length;

  return (
    <div className="app-page py-5 md:py-8 space-y-5">
      {total === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/45 flex items-center justify-center mb-3">
            <Package size={28} className="text-green-500 dark:text-green-400" />
          </div>
          <h2 className="font-heading font-semibold text-dark dark:text-zinc-100 text-lg">All good!</h2>
          <p className="text-muted text-sm mt-1">No stock alerts at the moment</p>
        </div>
      ) : (
        <>
          <p className="text-muted text-sm">
            {total} alert{total !== 1 ? 's' : ''} need{total === 1 ? 's' : ''} your attention
          </p>

          {/* Out of stock (non-serialized) */}
          {outOfStock.length > 0 && (
            <AlertSection
              title="Out of Stock"
              count={outOfStock.length}
              icon={<XCircle size={16} className="text-red-500" />}
              items={outOfStock}
              variant="error"
              onEdit={id => navigate(`/inventory/${id}/edit`)}
            />
          )}

          {/* Last unit — serialized */}
          {lastUnits.length > 0 && (
            <AlertSection
              title="Last Unit"
              count={lastUnits.length}
              icon={<AlertTriangle size={16} className="text-orange-500" />}
              items={lastUnits}
              variant="last_unit"
              onEdit={id => navigate(`/inventory/${id}/edit`)}
            />
          )}

          {/* Low stock (non-serialized) */}
          {lowStock.length > 0 && (
            <AlertSection
              title="Low Stock"
              count={lowStock.length}
              icon={<AlertTriangle size={16} className="text-accent" />}
              items={lowStock}
              variant="warning"
              onEdit={id => navigate(`/inventory/${id}/edit`)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type AlertVariant = 'error' | 'warning' | 'last_unit';

interface AlertSectionProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  items: InventoryItem[];
  variant: AlertVariant;
  onEdit: (id: string) => void;
}

function AlertSection({ title, count, icon, items, variant, onEdit }: AlertSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="font-heading font-semibold text-dark dark:text-zinc-100 text-sm">
          {title} ({count})
        </h3>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <AlertCard key={item.id} item={item} variant={variant} onEdit={() => onEdit(item.id)} />
        ))}
      </div>
    </div>
  );
}

interface AlertCardProps {
  item: InventoryItem;
  variant: AlertVariant;
  onEdit: () => void;
}

function AlertCard({ item, variant, onEdit }: AlertCardProps) {
  const isSerialized = item.mode === 'serialized';

  const borderColor =
    variant === 'error' ? 'border-l-red-500' :
    variant === 'last_unit' ? 'border-l-orange-500' :
    item.quantity < CRITICAL_FLOOR ? 'border-l-orange-500' : 'border-l-accent';

  const iconBg =
    variant === 'error' ? 'bg-red-50 dark:bg-red-950/45' : 'bg-orange-50 dark:bg-orange-950/40';

  const badge = (() => {
    if (variant === 'last_unit') {
      return {
        text: 'Last unit in stock!',
        className: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
      };
    }
    if (variant === 'error') {
      return { text: 'Out of stock', className: 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400' };
    }
    const isCritical = item.quantity < CRITICAL_FLOOR;
    return {
      text: isCritical ? `Only ${item.quantity} left!` : `${item.quantity} left (min: ${item.low_stock_threshold})`,
      className: isCritical
        ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300'
        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/45 dark:text-yellow-300',
    };
  })();

  return (
    <div
      className={cn(
        'ui-card flex items-center gap-3 rounded-xl px-4 py-3 border-l-4',
        borderColor,
      )}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-slate-100 dark:border-zinc-700/80 ${iconBg}`}>
        {variant === 'error'
          ? <XCircle size={20} className="text-red-500" />
          : <AlertTriangle size={20} className="text-orange-500" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-medium text-dark dark:text-zinc-100 text-sm truncate">{item.name}</div>
        <div className="text-xs text-muted dark:text-zinc-400 capitalize">
          {item.brand} · {item.category}
          {isSerialized && item.serial_number ? ` · S/N ${item.serial_number}` : ''}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-sm font-semibold text-primary">{formatCurrency(item.price)}</span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.className}`}>
            {badge.text}
          </span>
        </div>
      </div>

      <button
        onClick={onEdit}
        className="flex items-center gap-1 text-primary dark:text-primary-light text-xs font-medium shrink-0 hover:underline"
      >
        <Pencil size={12} /> Edit
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
