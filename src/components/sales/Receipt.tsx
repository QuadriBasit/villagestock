import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import { isAppleDevice } from '@/types';
import type { AppleICloudStatus, SalesRecord, ShopProfile } from '@/types';
import { formatCurrency } from '@/lib/utils';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  pos: 'POS / Card',
};

/** Hex/rgb only — html2canvas cannot parse Tailwind v4 `oklch()` from semantic utilities. */
const RC = {
  white: '#ffffff',
  primary: '#6c5ce7',
  dark: '#0f172a',
  muted: '#6b7280',
  border: '#e5e7eb',
  white70: 'rgba(255, 255, 255, 0.8)',
} as const;

interface ReceiptProps {
  sale: SalesRecord;
  shop: ShopProfile;
}

// forwardRef so the parent can pass a ref for html2canvas capture
const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(({ sale, shop }, ref) => {
  const saleDate = new Date(sale.sold_at);
  const dateStr = saleDate.toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = saleDate.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  const showAppleDetails = isAppleDevice(sale.item_brand, sale.item_category) && sale.device_details;

  const sectionDivider: CSSProperties = {
    borderBottom: `1px dashed ${RC.border}`,
    paddingLeft: 24,
    paddingRight: 24,
  };

  return (
    <div
      ref={ref}
      id="vs-receipt"
      style={{
        fontFamily: "'Inter', ui-sans-serif, sans-serif",
        backgroundColor: RC.white,
        color: RC.dark,
        width: '100%',
        maxWidth: 360,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      {/* Header band */}
      <div
        style={{
          backgroundColor: RC.primary,
          color: RC.white,
          padding: '20px 24px',
          textAlign: 'center',
        }}
      >
        {shop.logo_data_url && (
          <img
            src={shop.logo_data_url}
            alt=""
            width={56}
            height={56}
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              objectFit: 'cover',
              marginLeft: 'auto',
              marginRight: 'auto',
              marginBottom: 8,
              border: '2px solid rgba(255, 255, 255, 0.3)',
              display: 'block',
            }}
          />
        )}
        <h1 style={{ fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.25, margin: 0 }}>
          {shop.shop_name || 'VillageStock Shop'}
        </h1>
        {shop.address && (
          <p style={{ fontSize: 12, color: RC.white70, marginTop: 4, marginBottom: 0 }}>{shop.address}</p>
        )}
        {shop.phone && (
          <p style={{ fontSize: 12, color: RC.white70, marginTop: 2, marginBottom: 0 }}>{shop.phone}</p>
        )}
      </div>

      {showAppleDetails && (
        <div style={{ ...sectionDivider, paddingTop: 16, paddingBottom: 16 }}>
          <p
            style={{
              fontSize: 10,
              color: RC.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            Apple Details
          </p>
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
      <div
        style={{
          ...sectionDivider,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 12,
          paddingBottom: 12,
        }}
      >
        <div>
          <p
            style={{
              fontSize: 10,
              color: RC.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 500,
              margin: 0,
            }}
          >
            {sale.payment_status === 'credit' ? 'Credit Sale' : 'Sales Receipt'}
          </p>
          <p style={{ fontWeight: 700, fontSize: 14, marginTop: 4, marginBottom: 0, color: RC.dark }}>
            {sale.receipt_number}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 12, color: RC.muted, margin: 0 }}>{dateStr}</p>
          <p style={{ fontSize: 12, color: RC.muted, margin: 0 }}>{timeStr}</p>
        </div>
      </div>

      {/* Item details */}
      <div style={{ ...sectionDivider, paddingTop: 16, paddingBottom: 16 }}>
        <p
          style={{
            fontSize: 10,
            color: RC.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 500,
            marginBottom: 8,
          }}
        >
          {sale.sale_type === 'swap' ? 'Swap Details' : 'Item Sold'}
        </p>

        {sale.sale_type === 'swap' ? (
          <>
            <Row
              label="Trade-in"
              value={`${`${sale.trade_in_item_brand ?? ''} ${sale.trade_in_item_name ?? ''}`.trim()}`}
              bold
            />
            <Row label="Purchased" value={`${sale.item_brand} ${sale.item_name}`} />
            <Row
              label="Amount Paid"
              value={formatCurrency(sale.amount_paid ?? sale.balance_paid ?? sale.sale_price)}
              bold
            />
          </>
        ) : (
          <>
            <Row label="Item" value={sale.item_name} bold />
            <Row label="Brand" value={sale.item_brand} />
            <Row
              label="Category"
              value={<span style={{ textTransform: 'capitalize' }}>{sale.item_category}</span>}
            />
            {sale.serial_number && <Row label="Serial No." value={sale.serial_number} mono />}
            {sale.imei && <Row label="IMEI" value={sale.imei} mono />}
            {sale.quantity_sold > 1 && <Row label="Qty" value={String(sale.quantity_sold)} />}
          </>
        )}
      </div>

      {/* Payment details */}
      <div style={{ ...sectionDivider, paddingTop: 16, paddingBottom: 16 }}>
        <p
          style={{
            fontSize: 10,
            color: RC.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 500,
            marginBottom: 8,
          }}
        >
          Payment
        </p>

        <Row label="Payment Status" value={sale.payment_status === 'credit' ? 'Credit' : 'Paid'} />
        {sale.payment_method && (
          <Row label="Payment" value={PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method} />
        )}
        {sale.payment_status === 'credit' && (
          <>
            <Row label="Amount Paid" value={formatCurrency(sale.amount_paid ?? 0)} />
            <Row label="Balance Owed" value={formatCurrency(sale.balance_owed ?? 0)} />
            {sale.due_date && (
              <Row label="Due Date" value={new Date(sale.due_date).toLocaleDateString('en-NG')} />
            )}
          </>
        )}
        {sale.customer_name && <Row label="Customer" value={sale.customer_name} />}
        {sale.customer_phone && <Row label="Phone" value={sale.customer_phone} />}
      </div>

      {/* Amount */}
      <div style={{ ...sectionDivider, paddingTop: 16, paddingBottom: 16 }}>
        <p
          style={{
            fontSize: 10,
            color: RC.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 500,
            marginBottom: 8,
          }}
        >
          Amount
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, color: RC.dark }}>
            {sale.payment_status === 'credit' ? 'Amount Paid' : 'Amount'}
          </span>
          <span style={{ fontWeight: 700, fontSize: '1.25rem', color: RC.primary }}>
            {formatCurrency(sale.payment_status === 'credit' ? (sale.amount_paid ?? 0) : sale.sale_price)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '20px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: RC.dark, margin: 0 }}>Thank you for your purchase!</p>
        <p style={{ fontSize: 12, color: RC.muted, marginTop: 4, marginBottom: 0 }}>Goods sold are not returnable.</p>
        <p style={{ fontSize: 10, color: RC.muted, marginTop: 12, marginBottom: 0, opacity: 0.5 }}>
          Powered by VillageStock
        </p>
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';
export default Receipt;

function Row({
  label,
  value,
  bold,
  mono,
}: {
  label: string;
  value: ReactNode;
  bold?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 6,
      }}
    >
      <span style={{ fontSize: 12, color: RC.muted, flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          textAlign: 'right',
          color: RC.dark,
          fontWeight: bold ? 600 : 400,
          fontFamily: mono ? 'ui-monospace, monospace' : undefined,
        }}
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
    case 'clean':
      return 'Clean';
    case 'ibm':
      return 'IBM';
    case 'idm':
      return 'IDM';
    case 'icm':
      return 'ICM';
    case 'icloud_locked':
      return 'iCloud Locked';
    case 'find_my_on':
      return 'Find My On';
    case 'find_my_off':
      return 'Find My Off';
  }
}
