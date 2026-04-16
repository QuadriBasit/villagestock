import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import {
  appleMobileShowsServicedBattery,
  isAppleDevice,
  isAppleMobileDevice,
  type AppleICloudStatus,
  type AppleMobileDeviceDetails,
  type Category,
  type SalesRecord,
  type ShopProfile,
} from '@/types';
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
  overrides?: ReceiptOverrides;
}

export interface ReceiptOverrides {
  item_name?: string;
  item_brand?: string;
  customer_name?: string;
  customer_phone?: string;
  sale_price?: number;
  amount_paid?: number;
  balance_owed?: number;
  trade_in_item_name?: string;
  trade_in_item_brand?: string;
  header_color?: string;
  accent_color?: string;
  text_color?: string;
  paper_color?: string;
}

// forwardRef so the parent can pass a ref for html2canvas capture
const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(({ sale, shop, overrides }, ref) => {
  const saleDate = new Date(sale.sold_at);
  const dateStr = saleDate.toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = saleDate.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  const showAppleDetails = isAppleDevice(sale.item_brand, sale.item_category) && sale.device_details;
  const itemName = overrides?.item_name !== undefined ? overrides.item_name : sale.item_name;
  const itemBrand = overrides?.item_brand !== undefined ? overrides.item_brand : sale.item_brand;
  const customerName = overrides?.customer_name !== undefined ? overrides.customer_name : sale.customer_name;
  const customerPhone = overrides?.customer_phone !== undefined ? overrides.customer_phone : sale.customer_phone;
  const salePrice = overrides?.sale_price ?? sale.sale_price;
  const amountPaid =
    overrides?.amount_paid ??
    sale.amount_paid ??
    sale.balance_paid ??
    sale.sale_price;
  const balanceOwed = overrides?.balance_owed ?? sale.balance_owed ?? 0;
  const tradeInItemName =
    overrides?.trade_in_item_name !== undefined ? overrides.trade_in_item_name : sale.trade_in_item_name;
  const tradeInItemBrand =
    overrides?.trade_in_item_brand !== undefined ? overrides.trade_in_item_brand : sale.trade_in_item_brand;
  const headerColor = overrides?.header_color || shop.receipt_theme?.header_color || RC.primary;
  const accentColor = overrides?.accent_color || shop.receipt_theme?.accent_color || RC.primary;
  const textColor = overrides?.text_color || shop.receipt_theme?.text_color || RC.dark;
  const paperColor = overrides?.paper_color || shop.receipt_theme?.paper_color || RC.white;
  const mutedColor = textColor === RC.dark ? RC.muted : withAlpha(textColor, 0.68);
  const borderColor = textColor === RC.dark ? RC.border : withAlpha(textColor, 0.18);
  const lightOnHeader = withAlpha(RC.white, 0.8);

  const sectionDivider: CSSProperties = {
    borderBottom: `1px dashed ${borderColor}`,
    paddingLeft: 24,
    paddingRight: 24,
  };

  return (
    <div
      ref={ref}
      id="vs-receipt"
      style={{
        fontFamily: "'Inter', ui-sans-serif, sans-serif",
        backgroundColor: paperColor,
        color: textColor,
        width: '100%',
        maxWidth: 360,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      {/* Header band */}
      <div
        style={{
          backgroundColor: headerColor,
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
          <p style={{ fontSize: 12, color: lightOnHeader, marginTop: 4, marginBottom: 0 }}>{shop.address}</p>
        )}
        {shop.phone && (
          <p style={{ fontSize: 12, color: lightOnHeader, marginTop: 2, marginBottom: 0 }}>{shop.phone}</p>
        )}
      </div>

      {showAppleDetails && (
        <div style={{ ...sectionDivider, paddingTop: 16, paddingBottom: 16 }}>
          <p
            style={{
              fontSize: 10,
              color: mutedColor,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            Apple Details
          </p>
          {'battery_health' in sale.device_details! && sale.device_details.battery_health != null && (
            <Row label="Battery Health" value={`${sale.device_details.battery_health}%`} textColor={textColor} mutedColor={mutedColor} />
          )}
          {'battery_cycle_count' in sale.device_details! && sale.device_details.battery_cycle_count != null && (
            <Row label="Cycle Count" value={String(sale.device_details.battery_cycle_count)} textColor={textColor} mutedColor={mutedColor} />
          )}
          {'icloud_lock_status' in sale.device_details! && sale.device_details.icloud_lock_status && (
            <Row label="iCloud Status" value={icloudStatusLabel(sale.device_details.icloud_lock_status)} textColor={textColor} mutedColor={mutedColor} />
          )}
          {'important_battery_message' in sale.device_details! && sale.device_details.important_battery_message && (
            <Row label="Battery disclosure" value="Important Battery Message / Unknown Part" bold textColor={textColor} mutedColor={mutedColor} />
          )}
          {'important_display_message' in sale.device_details! && sale.device_details.important_display_message && (
            <Row label="Display disclosure" value="Important Display Message / Unknown Part" bold textColor={textColor} mutedColor={mutedColor} />
          )}
          {isAppleMobileDevice(sale.item_brand, sale.item_category as Category) &&
            sale.device_details &&
            appleMobileShowsServicedBattery(sale.device_details as AppleMobileDeviceDetails) && (
              <Row
                label="Battery service"
                value={
                  typeof (sale.device_details as AppleMobileDeviceDetails).battery_health === 'number' &&
                  (sale.device_details as AppleMobileDeviceDetails).battery_health! < 80
                    ? 'Battery health under 80% (auto: serviced / low-health disclosure)'
                    : 'Serviced battery (recorded flag)'
                }
                textColor={textColor}
                mutedColor={mutedColor}
              />
            )}
          {'mdm_ibm' in sale.device_details! && sale.device_details.mdm_ibm && (
            <Row label="MDM" value="IBM (bypass) flagged" textColor={textColor} mutedColor={mutedColor} />
          )}
          {'mdm_idm' in sale.device_details! && sale.device_details.mdm_idm && (
            <Row label="MDM" value="IDM flagged" textColor={textColor} mutedColor={mutedColor} />
          )}
          {'mdm_icm' in sale.device_details! && sale.device_details.mdm_icm && (
            <Row label="MDM" value="ICM (managed) flagged" textColor={textColor} mutedColor={mutedColor} />
          )}
          {'carrier_lock' in sale.device_details! && sale.device_details.carrier_lock && (
            <Row label="Carrier Lock" value={readableValue(sale.device_details.carrier_lock)} textColor={textColor} mutedColor={mutedColor} />
          )}
          {'biometric_status' in sale.device_details! && sale.device_details.biometric_status && (
            <Row label="Face ID / Touch ID" value={readableValue(sale.device_details.biometric_status)} textColor={textColor} mutedColor={mutedColor} />
          )}
          {'storage' in sale.device_details! && sale.device_details.storage && (
            <Row label="Storage" value={sale.device_details.storage} textColor={textColor} mutedColor={mutedColor} />
          )}
          {'color' in sale.device_details! && sale.device_details.color && (
            <Row label="Color" value={sale.device_details.color} textColor={textColor} mutedColor={mutedColor} />
          )}
          {'ram' in sale.device_details! && sale.device_details.ram && (
            <Row label="RAM" value={sale.device_details.ram} textColor={textColor} mutedColor={mutedColor} />
          )}
          {'chip' in sale.device_details! && sale.device_details.chip && (
            <Row label="Chip" value={sale.device_details.chip} textColor={textColor} mutedColor={mutedColor} />
          )}
          {'screen_size' in sale.device_details! && sale.device_details.screen_size && (
            <Row label="Screen Size" value={sale.device_details.screen_size} textColor={textColor} mutedColor={mutedColor} />
          )}
          {'keyboard_status' in sale.device_details! && sale.device_details.keyboard_status && (
            <Row label="Keyboard" value={readableValue(sale.device_details.keyboard_status)} textColor={textColor} mutedColor={mutedColor} />
          )}
          {'screen_condition' in sale.device_details! && sale.device_details.screen_condition && (
            <Row label="Screen" value={readableValue(sale.device_details.screen_condition)} textColor={textColor} mutedColor={mutedColor} />
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
              color: mutedColor,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 500,
              margin: 0,
            }}
          >
            {sale.payment_status === 'credit' ? 'Credit Sale' : 'Sales Receipt'}
          </p>
          <p style={{ fontWeight: 700, fontSize: 14, marginTop: 4, marginBottom: 0, color: textColor }}>
            {sale.receipt_number}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 12, color: mutedColor, margin: 0 }}>{dateStr}</p>
          <p style={{ fontSize: 12, color: mutedColor, margin: 0 }}>{timeStr}</p>
        </div>
      </div>

      {/* Item details */}
      <div style={{ ...sectionDivider, paddingTop: 16, paddingBottom: 16 }}>
        <p
          style={{
            fontSize: 10,
            color: mutedColor,
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
              value={`${`${tradeInItemBrand ?? ''} ${tradeInItemName ?? ''}`.trim()}`}
              bold
              textColor={textColor}
              mutedColor={mutedColor}
            />
            <Row label="Purchased" value={`${itemBrand} ${itemName}`} textColor={textColor} mutedColor={mutedColor} />
            <Row
              label="Amount Paid"
              value={formatCurrency(amountPaid)}
              bold
              textColor={textColor}
              mutedColor={mutedColor}
            />
          </>
        ) : (
          <>
            <Row label="Item" value={itemName} bold textColor={textColor} mutedColor={mutedColor} />
            <Row label="Brand" value={itemBrand} textColor={textColor} mutedColor={mutedColor} />
            <Row
              label="Category"
              value={<span style={{ textTransform: 'capitalize' }}>{sale.item_category}</span>}
              textColor={textColor}
              mutedColor={mutedColor}
            />
            {sale.serial_number && <Row label="Serial No." value={sale.serial_number} mono textColor={textColor} mutedColor={mutedColor} />}
            {sale.imei && <Row label="IMEI" value={sale.imei} mono textColor={textColor} mutedColor={mutedColor} />}
            {sale.quantity_sold > 1 && <Row label="Qty" value={String(sale.quantity_sold)} textColor={textColor} mutedColor={mutedColor} />}
          </>
        )}
      </div>

      {/* Payment details */}
      <div style={{ ...sectionDivider, paddingTop: 16, paddingBottom: 16 }}>
        <p
          style={{
            fontSize: 10,
            color: mutedColor,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 500,
            marginBottom: 8,
          }}
        >
          Payment
        </p>

        <Row label="Payment Status" value={sale.payment_status === 'credit' ? 'Credit' : 'Paid'} textColor={textColor} mutedColor={mutedColor} />
        {sale.payment_method && (
          <Row label="Payment" value={PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method} textColor={textColor} mutedColor={mutedColor} />
        )}
        {sale.payment_status === 'credit' && (
          <>
            <Row label="Amount Paid" value={formatCurrency(amountPaid)} textColor={textColor} mutedColor={mutedColor} />
            <Row label="Balance Owed" value={formatCurrency(balanceOwed)} textColor={textColor} mutedColor={mutedColor} />
            {sale.due_date && (
              <Row label="Due Date" value={new Date(sale.due_date).toLocaleDateString('en-NG')} textColor={textColor} mutedColor={mutedColor} />
            )}
          </>
        )}
        {customerName && <Row label="Customer" value={customerName} textColor={textColor} mutedColor={mutedColor} />}
        {customerPhone && <Row label="Phone" value={customerPhone} textColor={textColor} mutedColor={mutedColor} />}
      </div>

      {/* Amount */}
      <div style={{ ...sectionDivider, paddingTop: 16, paddingBottom: 16 }}>
        <p
          style={{
            fontSize: 10,
            color: mutedColor,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 500,
            marginBottom: 8,
          }}
        >
          Amount
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, color: textColor }}>
            {sale.payment_status === 'credit' ? 'Amount Paid' : 'Amount'}
          </span>
          <span style={{ fontWeight: 700, fontSize: '1.25rem', color: accentColor }}>
            {formatCurrency(sale.payment_status === 'credit' ? amountPaid : salePrice)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '20px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: textColor, margin: 0 }}>Thank you for your purchase!</p>
        <p style={{ fontSize: 12, color: mutedColor, marginTop: 4, marginBottom: 0 }}>Goods sold are not returnable.</p>
        <p style={{ fontSize: 10, color: mutedColor, marginTop: 12, marginBottom: 0, opacity: 0.5 }}>
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
  textColor,
  mutedColor,
}: {
  label: string;
  value: ReactNode;
  bold?: boolean;
  mono?: boolean;
  textColor: string;
  mutedColor: string;
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
        <span style={{ fontSize: 12, color: mutedColor, flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          textAlign: 'right',
          color: textColor,
          fontWeight: bold ? 600 : 400,
          fontFamily: mono ? 'ui-monospace, monospace' : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function withAlpha(hex: string, alpha: number) {
  if (!hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return hex;
  const normalized =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
      return 'IBM (bypass MDM — often with battery / Unknown Part warnings)';
    case 'idm':
      return 'IDM (iCloud disabled MDM — often with display / Unknown Part warnings)';
    case 'icm':
      return 'ICM (iCloud managed / enterprise)';
    case 'icloud_locked':
      return 'iCloud Locked';
    case 'find_my_on':
      return 'Find My On';
    case 'find_my_off':
      return 'Find My Off';
  }
}
