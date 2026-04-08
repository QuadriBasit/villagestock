import { forwardRef } from 'react';
import { isAppleDevice } from '@/types';
import type { AppleICloudStatus, SalesRecord, ShopProfile } from '@/types';
import { formatCurrency } from '@/lib/utils';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  pos: 'POS / Card',
};

interface ReceiptProps {
  sale: SalesRecord;
  shop: ShopProfile;
}

// forwardRef so the parent can pass a ref for html2canvas capture
const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(({ sale, shop }, ref) => {
  const saleDate = new Date(sale.sold_at);
  const dateStr = saleDate.toLocaleDateString('en-NG', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  });
  const timeStr = saleDate.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  const showAppleDetails = isAppleDevice(sale.item_brand, sale.item_category) && sale.device_details;

  return (
    <div
      ref={ref}
      id="vs-receipt"
      style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#ffffff' }}
      className="w-full max-w-[360px] mx-auto bg-white text-dark"
    >
      {/* Header band */}
      <div className="bg-primary px-6 py-5 text-white text-center">
        {shop.logo_data_url && (
          <img
            src={shop.logo_data_url}
            alt="Shop logo"
            className="w-14 h-14 rounded-xl object-cover mx-auto mb-2 border-2 border-white/30"
          />
        )}
        <h1 className="font-heading font-bold text-lg leading-tight">
          {shop.shop_name || 'VillageStock Shop'}
        </h1>
        {shop.address && (
          <p className="text-xs opacity-80 mt-0.5">{shop.address}</p>
        )}
        {shop.phone && (
          <p className="text-xs opacity-80">{shop.phone}</p>
        )}
      </div>

      {showAppleDetails && (
        <div className="px-6 py-4 space-y-2 border-b border-dashed border-gray-200">
          <p className="text-[10px] text-muted uppercase tracking-widest font-medium mb-2">Apple Details</p>
          {'battery_health' in sale.device_details! && sale.device_details.battery_health != null && (
            <Row label="Battery Health" value={`${sale.device_details.battery_health}%`} />
          )}
          {'battery_cycle_count' in sale.device_details! && sale.device_details.battery_cycle_count != null && (
            <Row label="Cycle Count" value={String(sale.device_details.battery_cycle_count)} />
          )}
          {'icloud_lock_status' in sale.device_details! && sale.device_details.icloud_lock_status && (
            <Row label="iCloud Status" value={icloudStatusLabel(sale.device_details.icloud_lock_status)} />
          )}
          {'carrier_lock' in sale.device_details! && sale.device_details.carrier_lock && (
            <Row label="Carrier Lock" value={readableValue(sale.device_details.carrier_lock)} />
          )}
          {'biometric_status' in sale.device_details! && sale.device_details.biometric_status && (
            <Row label="Face ID / Touch ID" value={readableValue(sale.device_details.biometric_status)} />
          )}
          {'storage' in sale.device_details! && sale.device_details.storage && (
            <Row label="Storage" value={sale.device_details.storage} />
          )}
          {'color' in sale.device_details! && sale.device_details.color && (
            <Row label="Color" value={sale.device_details.color} />
          )}
          {'ram' in sale.device_details! && sale.device_details.ram && (
            <Row label="RAM" value={sale.device_details.ram} />
          )}
          {'chip' in sale.device_details! && sale.device_details.chip && (
            <Row label="Chip" value={sale.device_details.chip} />
          )}
          {'screen_size' in sale.device_details! && sale.device_details.screen_size && (
            <Row label="Screen Size" value={sale.device_details.screen_size} />
          )}
          {'keyboard_status' in sale.device_details! && sale.device_details.keyboard_status && (
            <Row label="Keyboard" value={readableValue(sale.device_details.keyboard_status)} />
          )}
          {'screen_condition' in sale.device_details! && sale.device_details.screen_condition && (
            <Row label="Screen" value={readableValue(sale.device_details.screen_condition)} />
          )}
        </div>
      )}

      {/* Receipt label + number */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-dashed border-gray-200">
        <div>
          <p className="text-[10px] text-muted uppercase tracking-widest font-medium">{sale.payment_status === 'credit' ? 'Credit Sale' : 'Sales Receipt'}</p>
          <p className="font-heading font-bold text-dark text-sm mt-0.5">{sale.receipt_number}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">{dateStr}</p>
          <p className="text-xs text-muted">{timeStr}</p>
        </div>
      </div>

      {/* Item details */}
      <div className="px-6 py-4 space-y-2 border-b border-dashed border-gray-200">
        <p className="text-[10px] text-muted uppercase tracking-widest font-medium mb-2">
          {sale.sale_type === 'swap' ? 'Swap Details' : 'Item Sold'}
        </p>

        {sale.sale_type === 'swap' ? (
          <>
            <Row
              label="Trade-in"
              value={`${`${sale.trade_in_item_brand ?? ''} ${sale.trade_in_item_name ?? ''}`.trim()}`}
              bold
            />
            <Row
              label="Purchased"
              value={`${sale.item_brand} ${sale.item_name}`}
            />
            <Row label="Amount Paid" value={formatCurrency(sale.amount_paid ?? sale.balance_paid ?? sale.sale_price)} bold />
          </>
        ) : (
          <>
            <Row label="Item" value={sale.item_name} bold />
            <Row label="Brand" value={sale.item_brand} />
            <Row label="Category" value={<span className="capitalize">{sale.item_category}</span>} />
            {sale.serial_number && <Row label="Serial No." value={sale.serial_number} mono />}
            {sale.imei && <Row label="IMEI" value={sale.imei} mono />}
            {sale.quantity_sold > 1 && <Row label="Qty" value={String(sale.quantity_sold)} />}
          </>
        )}
      </div>

      {/* Payment details */}
      <div className="px-6 py-4 space-y-2 border-b border-dashed border-gray-200">
        <p className="text-[10px] text-muted uppercase tracking-widest font-medium mb-2">Payment</p>

        <Row label="Payment Status" value={sale.payment_status === 'credit' ? 'Credit' : 'Paid'} />
        {sale.payment_method && <Row label="Payment" value={PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method} />}
        {sale.payment_status === 'credit' && (
          <>
            <Row label="Amount Paid" value={formatCurrency(sale.amount_paid ?? 0)} />
            <Row label="Balance Owed" value={formatCurrency(sale.balance_owed ?? 0)} />
            {sale.due_date && <Row label="Due Date" value={new Date(sale.due_date).toLocaleDateString('en-NG')} />}
          </>
        )}
        {sale.customer_name && <Row label="Customer" value={sale.customer_name} />}
        {sale.customer_phone && <Row label="Phone" value={sale.customer_phone} />}
      </div>

      {/* Amount */}
      <div className="px-6 py-4 border-b border-dashed border-gray-200 space-y-2">
        <p className="text-[10px] text-muted uppercase tracking-widest font-medium mb-2">Amount</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-dark">{sale.payment_status === 'credit' ? 'Amount Paid' : 'Amount'}</span>
          <span className="font-heading font-bold text-xl text-primary">
            {formatCurrency(sale.payment_status === 'credit' ? (sale.amount_paid ?? 0) : sale.sale_price)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-5 text-center space-y-1">
        <p className="text-sm font-heading font-semibold text-dark">Thank you for your purchase!</p>
        <p className="text-xs text-muted">Goods sold are not returnable.</p>
        <p className="text-[10px] text-muted mt-3 opacity-50">Powered by VillageStock</p>
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';
export default Receipt;

// ─── Utility row ─────────────────────────────────────────────────────────────
function Row({
  label,
  value,
  bold,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-muted shrink-0">{label}</span>
      <span
        className={`text-xs text-right ${bold ? 'font-semibold text-dark' : 'text-dark'} ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function readableValue(value: string) {
  return value
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function icloudStatusLabel(status: AppleICloudStatus) {
  switch (status) {
    case 'clean': return 'Clean';
    case 'ibm': return 'IBM';
    case 'idm': return 'IDM';
    case 'icm': return 'ICM';
    case 'icloud_locked': return 'iCloud Locked';
    case 'find_my_on': return 'Find My On';
    case 'find_my_off': return 'Find My Off';
  }
}
