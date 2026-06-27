import { useEffect } from 'react';
import { useShopProfile } from '@/hooks/useShopProfile';
import { applyShellAccent, DEFAULT_SHELL_ACCENT } from '@/lib/shellAccent';

/** Keeps `.app-shell { --accent }` in sync with saved receipt / brand colors. */
export function ShellAccentSync() {
  const { profile } = useShopProfile();
  const accent =
    profile.receipt_theme?.header_color?.trim() ||
    profile.receipt_theme?.accent_color?.trim() ||
    DEFAULT_SHELL_ACCENT;

  useEffect(() => {
    applyShellAccent(accent);
  }, [accent]);

  return null;
}
