import type { CreditRecord, SalesRecord, ShopProfile } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

const NG_MSISDN = /^234\d{10}$/;
const NG_LOCAL = /^0\d{10}$/;

/**
 * Normalizes a free-form phone string to an MSISDN suitable for wa.me links.
 * Handles Nigerian local formats (0803…), +234 and bare 234 prefixes.
 * Returns null when no valid number can be derived.
 */
export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hadPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (NG_LOCAL.test(digits)) return `234${digits.slice(1)}`;
  if (NG_MSISDN.test(digits)) return digits;
  if (hadPlus && digits.length >= 8 && digits.length <= 15) return digits;
  return null;
}

/** Opens a WhatsApp chat with a pre-filled message; without a phone it opens chat picker. */
export function openWhatsApp(phone: string | null | undefined, message: string): void {
  const msisdn = normalizePhone(phone);
  const base = msisdn ? `https://wa.me/${msisdn}` : 'https://wa.me/';
  window.open(`${base}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
}

function daysOverdue(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / 86400000);
}

export function buildCreditReminderText(
  credit: CreditRecord,
  shop: ShopProfile,
): string {
  const shopName = shop.shop_name || 'Village Stock';
  const overdue = daysOverdue(credit.due_date);

  let out = `Hello ${credit.customer_name || 'customer'}! 😊\n\n`;
  out += `This is a friendly reminder from *${shopName}* about your credit purchase:\n\n`;
  out += `🛒 Item: ${credit.item_name}\n`;
  out += `💰 Total: ${formatCurrency(credit.total_amount)}\n`;
  if (credit.amount_paid > 0) out += `✅ Paid so far: ${formatCurrency(credit.amount_paid)}\n`;
  out += `📌 *Balance: ${formatCurrency(credit.balance_owed)}*\n`;
  if (overdue > 0) {
    out += `⏰ This was due ${formatDate(credit.due_date)} (${overdue} day${overdue !== 1 ? 's' : ''} overdue)\n`;
  } else {
    out += `📅 Due date: ${formatDate(credit.due_date)}\n`;
  }
  out += `\nKindly settle when you can. Thank you for your patronage! 🙏`;
  if (shop.phone) out += `\n\n— ${shopName} 📞 ${shop.phone}`;
  return out;
}

const PAYMENT_METHOD_TEXT: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Transfer',
  pos: 'POS',
};

export function buildReceiptText(sale: SalesRecord, shop: ShopProfile): string {
  const shopName = shop.shop_name || 'Village Stock';
  const total = sale.sale_price * sale.quantity_sold;
  const soldAt = new Date(sale.sold_at).toLocaleString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let out = `*${shopName.toUpperCase()}* 🧾\n`;
  out += `Receipt: ${sale.receipt_number}\n${soldAt}\n`;
  out += '———————————\n';
  out += `• ${sale.item_name}${sale.item_brand ? ` (${sale.item_brand})` : ''}\n`;
  if (sale.quantity_sold > 1) out += `  ${sale.quantity_sold} × ${formatCurrency(sale.sale_price)}\n`;
  out += `\n💰 *Total: ${formatCurrency(total)}*\n`;
  if (sale.payment_status === 'credit') {
    out += `✅ Paid: ${formatCurrency(sale.amount_paid ?? 0)}\n`;
    out += `📌 Balance: ${formatCurrency(sale.balance_owed ?? 0)}\n`;
  } else if (sale.payment_method) {
    out += `Payment: ${PAYMENT_METHOD_TEXT[sale.payment_method] ?? sale.payment_method}\n`;
  }
  if (sale.sale_type === 'swap' && sale.trade_in_item_name) {
    out += `🔁 Trade-in: ${sale.trade_in_item_name}${sale.trade_in_item_brand ? ` (${sale.trade_in_item_brand})` : ''}\n`;
  }
  out += '———————————\n';
  out += `Thank you for your patronage! 🙏`;
  if (shop.phone) out += `\n📞 ${shop.phone}`;
  if (shop.address) out += `\n📍 ${shop.address}`;
  return out;
}
