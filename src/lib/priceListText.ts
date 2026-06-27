import type { AppleMobileDeviceDetails, Category, InventoryItem } from '@/types';
import { conditionLabel, itemSpecLine } from '@/lib/inventoryDisplay';
import { formatCurrency } from '@/lib/utils';

const CATEGORY_LABELS: Record<Category, string> = {
  phones: 'Phones',
  laptops: 'Laptops',
  tablets: 'Tablets',
  accessories: 'Accessories',
  parts: 'Parts',
};

const CATEGORY_EMOJI: Record<string, string> = {
  phones: '📱',
  laptops: '💻',
  tablets: '📱',
  accessories: '🎧',
  parts: '📦',
};

const LIST_CATEGORIES: Category[] = ['phones', 'laptops', 'tablets', 'accessories'];

function condEmoji(condition?: string): string {
  if (condition === 'working') return '✅';
  return '♻️';
}

export function buildPriceListText(
  items: InventoryItem[],
  shop: { shop_name: string; address: string; phone: string },
  note: string
): string {
  const byCat = new Map<Category, InventoryItem[]>();
  for (const item of items) {
    if (!byCat.has(item.category)) byCat.set(item.category, []);
    byCat.get(item.category)!.push(item);
  }

  let out = `*${(shop.shop_name || 'Village Stock').toUpperCase()}* 📱\n`;
  if (shop.address) out += `${shop.address}\n`;
  if (shop.phone) out += `📞 ${shop.phone}\n`;
  out += '———————————\n';

  for (const cat of LIST_CATEGORIES) {
    const rows = byCat.get(cat);
    if (!rows?.length) continue;
    out += `\n*${CATEGORY_LABELS[cat].toUpperCase()}* ${CATEGORY_EMOJI[cat] ?? '📦'}\n`;
    for (const item of rows) {
      const spec = itemSpecLine(item);
      const specBit = spec ? ` (${spec.split(' · ')[0]})` : '';
      out += `• ${item.name}${specBit} — *${formatCurrency(item.price)}* ${condEmoji(item.condition)}\n`;
    }
  }

  out += `———————————\n${note || 'Prices may move with the rate. DM to order 📩'}`;
  return out;
}

export function buildProductCardText(
  item: InventoryItem,
  shop: { shop_name: string; address: string; phone: string }
): string {
  const mobile = item.deviceDetails as AppleMobileDeviceDetails | undefined;
  let out = `*${item.brand} ${item.name}*\n${itemSpecLine(item)}\n`;
  out += `Condition: ${conditionLabel(item.condition)} ${condEmoji(item.condition)}\n`;

  const notes: string[] = [];
  if (mobile?.battery_health != null) notes.push(`Battery ${mobile.battery_health}%`);
  if (mobile?.important_display_message || mobile?.mdm_idm) notes.push('Screen changed (IDM)');
  if (notes.length) out += `${notes.join(' · ')}\n`;

  out += `\n💰 *${formatCurrency(item.price)}*\n\n📍 ${shop.shop_name || 'Village Stock'}\n`;
  if (shop.address) out += `${shop.address}\n`;
  if (shop.phone) out += `📞 ${shop.phone}`;
  return out;
}

export { CATEGORY_LABELS, LIST_CATEGORIES };
