import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  isAppleLaptopDevice,
  isAppleMobileDevice,
  appleMobileShowsBatteryIBM,
  type AppleLaptopDeviceDetails,
  type AppleMobileDeviceDetails,
  type InventoryItem,
} from '@/types';
import { Badge } from '@/components/ui/Badge';
import { conditionLabel, getInspectionFlags } from '@/lib/inventoryDisplay';

function DetailRow({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-[13px] text-shell-muted">{label}</span>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-[13px] font-medium tabular-nums',
          warn ? 'text-amber-300' : 'text-shell-ink'
        )}
      >
        {warn ? <AlertTriangle size={13} className="shrink-0" /> : null}
        {value}
      </span>
    </div>
  );
}

export function ItemInspectionPanel({ item }: { item: InventoryItem }) {
  const flags = getInspectionFlags(item);
  const mobile =
    isAppleMobileDevice(item.brand, item.category) && item.deviceDetails
      ? (item.deviceDetails as AppleMobileDeviceDetails)
      : undefined;
  const laptop =
    isAppleLaptopDevice(item.brand, item.category) && item.deviceDetails
      ? (item.deviceDetails as AppleLaptopDeviceDetails)
      : undefined;

  if (!mobile && !laptop && !item.condition) return null;

  const idm = mobile?.important_display_message || mobile?.mdm_idm;
  const ibm = mobile ? appleMobileShowsBatteryIBM(mobile) : false;
  const icm = mobile?.mdm_icm;

  const alerts = [
    idm && { code: 'IDM', part: 'Screen', title: 'Important Display Message' },
    ibm && { code: 'IBM', part: 'Battery', title: 'Important Battery Message' },
    icm && { code: 'ICM', part: 'Camera', title: 'Important Camera Message' },
  ].filter(Boolean) as { code: string; part: string; title: string }[];

  const rows = buildInspectionRows(mobile, laptop, item.condition);

  return (
    <div className="border-t border-shell-line pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-[13px] font-semibold text-shell-ink">Inspection</h3>
        <div className="flex flex-wrap gap-1.5">
          {flags.map(flag => (
            <Badge
              key={flag}
              className="border-amber-500/25 bg-amber-500/10 text-[11px] text-amber-200"
            >
              {flag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="divide-y divide-shell-line/70">
        {rows.map(row => (
          <DetailRow key={row.label} label={row.label} value={row.value} warn={row.warn} />
        ))}
      </div>

      {(item.status === 'defective' || item.status === 'with_engineer') && (
        <div className="mt-3 flex gap-2.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-300" />
          <p className="text-xs leading-relaxed text-shell-ink">
            Needs work before sale — currently{' '}
            {item.status === 'with_engineer' ? 'out for repair' : 'marked defective'}.
          </p>
        </div>
      )}

      {alerts.map(a => (
        <div
          key={a.code}
          className="mt-3 flex gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5"
        >
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-300" />
          <p className="text-xs leading-relaxed text-shell-ink">
            {a.part} replaced — device may show the <strong>{a.title}</strong> ({a.code}). Disclose
            at point of sale.
          </p>
        </div>
      ))}
    </div>
  );
}

function buildInspectionRows(
  mobile: AppleMobileDeviceDetails | undefined,
  laptop: AppleLaptopDeviceDetails | undefined,
  condition?: InventoryItem['condition']
): { label: string; value: string; warn?: boolean }[] {
  if (laptop) {
    const batt = laptop.battery_health;
    return [
      {
        label: 'Screen',
        value: laptop.screen_condition?.replace(/_/g, ' ') ?? '—',
        warn: laptop.screen_condition === 'cracked' || laptop.screen_condition === 'replaced',
      },
      {
        label: 'Battery health',
        value: batt != null ? `${batt}%` : '—',
        warn: batt != null && batt < 80,
      },
      {
        label: 'Keyboard',
        value: laptop.keyboard_status?.replace(/_/g, ' ') ?? '—',
        warn: laptop.keyboard_status === 'faulty_keys',
      },
      { label: 'Condition', value: conditionLabel(condition), warn: condition !== 'working' },
    ];
  }

  if (mobile) {
    const batt = mobile.battery_health;
    const idm = mobile.important_display_message || mobile.mdm_idm;
    const ibm = appleMobileShowsBatteryIBM(mobile);
    return [
      {
        label: 'Display',
        value: idm ? 'Changed · IDM' : 'Original',
        warn: !!idm,
      },
      {
        label: 'Battery',
        value: `${batt != null ? `${batt}%` : '—'}${ibm ? ' · IBM' : ''}`,
        warn: ibm || (batt != null && batt < 80),
      },
      {
        label: 'Biometrics',
        value: mobile.biometric_status === 'not_working' ? 'Faulty' : 'Working',
        warn: mobile.biometric_status === 'not_working',
      },
      { label: 'Condition', value: conditionLabel(condition), warn: condition !== 'working' },
    ];
  }

  if (condition) {
    return [{ label: 'Condition', value: conditionLabel(condition), warn: condition !== 'working' }];
  }

  return [];
}
