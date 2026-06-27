import { cn } from '@/lib/utils';
import {
  modalSheetBodyScroll,
  modalSheetHeader,
} from '@/lib/modalSheet';
import {
  settingsBtnPrimary,
  settingsField,
  settingsInset,
  settingsLabel,
} from '@/components/settings/settingsUi';

export const salesField = settingsField;
export const salesLabel = settingsLabel;
export const salesBtnPrimary = settingsBtnPrimary;
export const salesSection = cn(settingsInset, 'rounded-xl p-4');
export const salesReadonlyField = cn(
  settingsField,
  'cursor-not-allowed bg-shell-surface/60 text-shell-muted',
);
export const salesModalHeader = cn(modalSheetHeader, 'border-shell-line');
export const salesModalBody = cn(modalSheetBodyScroll, 'space-y-5 bg-shell-surface-2/20');
export const salesModalHandle = 'h-1 w-10 rounded-full bg-shell-line';
export const salesCloseBtn =
  'rounded-full p-1.5 text-shell-muted transition hover:bg-shell-surface-2 hover:text-shell-ink';
