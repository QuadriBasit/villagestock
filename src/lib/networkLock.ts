import type { AppleCarrierLock, AppleMobileDeviceDetails } from '@/types';

export type NetworkUnlockStatus =
  | 'factory_unlocked'
  | 'worldwide_unlocked'
  | 'chip_locked'
  | 'carrier_locked';

export type SimConfiguration =
  | 'physical_sim_only'
  | 'esim_only'
  | 'physical_plus_esim'
  | 'dual_physical_sim'
  | 'inbuilt_chip';

export type EsimActivationStatus = 'esim_unlocked' | 'esim_locked_wifi_only';

export type NetworkState = {
  status: NetworkUnlockStatus | '';
  simConfig: SimConfiguration | '';
  esimStatus: EsimActivationStatus | '';
};

export const NETWORK_STATUS_OPTIONS: {
  value: NetworkUnlockStatus;
  label: string;
  hint: string;
}[] = [
  {
    value: 'factory_unlocked',
    label: 'Factory unlocked',
    hint: 'Generally unlocked — works with most carriers',
  },
  {
    value: 'worldwide_unlocked',
    label: 'Worldwide unlocked',
    hint: 'International / worldwide version',
  },
  {
    value: 'chip_locked',
    label: 'Chip locked',
    hint: 'Needs R-SIM or unlock chip',
  },
  {
    value: 'carrier_locked',
    label: 'Carrier locked',
    hint: 'Locked to a network operator',
  },
];

export const SIM_CONFIG_OPTIONS: {
  value: SimConfiguration;
  label: string;
  hint?: string;
}[] = [
  { value: 'physical_sim_only', label: 'Physical SIM only' },
  { value: 'esim_only', label: 'eSIM only' },
  { value: 'physical_plus_esim', label: 'Physical SIM + eSIM' },
  {
    value: 'dual_physical_sim',
    label: 'Dual physical SIM',
    hint: 'Dubai / China / business models',
  },
  {
    value: 'inbuilt_chip',
    label: 'Inbuilt chip',
    hint: 'Built-in unlock chip',
  },
];

export const ESIM_STATUS_OPTIONS: {
  value: EsimActivationStatus;
  label: string;
  hint: string;
}[] = [
  { value: 'esim_unlocked', label: 'eSIM unlocked', hint: 'Can register eSIM' },
  {
    value: 'esim_locked_wifi_only',
    label: 'eSIM locked',
    hint: 'WiFi only — no cellular eSIM',
  },
];

export function blankNetworkState(): NetworkState {
  return { status: '', simConfig: '', esimStatus: '' };
}

export function simConfigNeedsEsimStatus(sim: SimConfiguration | ''): boolean {
  return sim === 'esim_only';
}

export function networkStatusNeedsSimConfig(status: NetworkUnlockStatus | ''): boolean {
  return status === 'chip_locked' || status === 'carrier_locked';
}

const NETWORK_STATUS_LABELS: Record<NetworkUnlockStatus, string> = {
  factory_unlocked: 'Factory unlocked',
  worldwide_unlocked: 'Worldwide unlocked',
  chip_locked: 'Chip locked',
  carrier_locked: 'Carrier locked',
};

const SIM_CONFIG_LABELS: Record<SimConfiguration, string> = {
  physical_sim_only: 'Physical SIM only',
  esim_only: 'eSIM only',
  physical_plus_esim: 'Physical SIM + eSIM',
  dual_physical_sim: 'Dual physical SIM',
  inbuilt_chip: 'Inbuilt chip',
};

const ESIM_STATUS_LABELS: Record<EsimActivationStatus, string> = {
  esim_unlocked: 'eSIM unlocked',
  esim_locked_wifi_only: 'eSIM locked (WiFi only)',
};

/** Map legacy `carrier_lock` values into the newer network fields. */
export function networkStateFromDeviceDetails(
  dd?: Pick<
    AppleMobileDeviceDetails,
    'network_status' | 'sim_configuration' | 'esim_status' | 'carrier_lock'
  >,
): NetworkState {
  if (!dd) return blankNetworkState();
  if (dd.network_status) {
    return {
      status: dd.network_status,
      simConfig: dd.sim_configuration ?? '',
      esimStatus: dd.esim_status ?? '',
    };
  }
  if (!dd.carrier_lock) return blankNetworkState();
  return networkStateFromLegacyCarrierLock(dd.carrier_lock);
}

export function networkStateFromLegacyCarrierLock(lock: AppleCarrierLock): NetworkState {
  switch (lock) {
    case 'factory_unlocked':
      return { status: 'factory_unlocked', simConfig: '', esimStatus: '' };
    case 'network_locked':
      return { status: 'carrier_locked', simConfig: '', esimStatus: '' };
    case 'esim_only':
      return { status: 'chip_locked', simConfig: 'esim_only', esimStatus: '' };
    case 'dual_sim':
      return { status: 'factory_unlocked', simConfig: 'dual_physical_sim', esimStatus: '' };
  }
}

export function mobileNetworkDeviceDetails(
  network: NetworkState,
): Pick<
  AppleMobileDeviceDetails,
  'network_status' | 'sim_configuration' | 'esim_status' | 'carrier_lock'
> {
  if (!network.status) return {};
  const details: Pick<
    AppleMobileDeviceDetails,
    'network_status' | 'sim_configuration' | 'esim_status' | 'carrier_lock'
  > = {
    network_status: network.status,
  };
  if (network.simConfig) details.sim_configuration = network.simConfig;
  if (network.esimStatus && simConfigNeedsEsimStatus(network.simConfig)) {
    details.esim_status = network.esimStatus;
  }
  details.carrier_lock = legacyCarrierLockFromNetwork(network);
  return details;
}

/** Keep legacy field in sync for older clients / receipts. */
function legacyCarrierLockFromNetwork(network: NetworkState): AppleCarrierLock | undefined {
  if (network.simConfig === 'esim_only') return 'esim_only';
  if (network.simConfig === 'dual_physical_sim') return 'dual_sim';
  if (network.status === 'carrier_locked') return 'network_locked';
  if (network.status === 'factory_unlocked' || network.status === 'worldwide_unlocked') {
    return 'factory_unlocked';
  }
  if (network.status === 'chip_locked') return 'network_locked';
  return undefined;
}

export function formatNetworkDescription(
  dd?: Pick<
    AppleMobileDeviceDetails,
    'network_status' | 'sim_configuration' | 'esim_status' | 'carrier_lock'
  >,
): string | undefined {
  const network = networkStateFromDeviceDetails(dd);
  if (!network.status) return undefined;
  const parts = [NETWORK_STATUS_LABELS[network.status]];
  if (network.simConfig) parts.push(SIM_CONFIG_LABELS[network.simConfig]);
  if (network.esimStatus && simConfigNeedsEsimStatus(network.simConfig)) {
    parts.push(ESIM_STATUS_LABELS[network.esimStatus]);
  }
  return parts.join(' · ');
}

export function formatNetworkSummary(network: NetworkState): string | undefined {
  return formatNetworkDescription(mobileNetworkDeviceDetails(network));
}

export function networkStateIsComplete(network: NetworkState): boolean {
  if (!network.status) return false;
  if (networkStatusNeedsSimConfig(network.status) && !network.simConfig) return false;
  if (simConfigNeedsEsimStatus(network.simConfig) && !network.esimStatus) return false;
  return true;
}

export function networkStatusLabel(status: NetworkUnlockStatus): string {
  return NETWORK_STATUS_LABELS[status];
}

export function simConfigLabel(sim: SimConfiguration): string {
  return SIM_CONFIG_LABELS[sim];
}

export function esimStatusLabel(status: EsimActivationStatus): string {
  return ESIM_STATUS_LABELS[status];
}
