import { useEffect } from 'react';
import { useShopProfile } from '@/hooks/useShopProfile';
import { applyShellAccent, DEFAULT_SHELL_ACCENT } from '@/lib/shellAccent';

/** Legacy default receipt colors from before the teal rebrand — treat them as unset. */
const LEGACY_ACCENTS = new Set(['#6c5ce7', '#a78bfa', '#7c3aed']);

function normalizeAccent(color?: string): string {
  const c = color?.trim().toLowerCase();
  return c && !LEGACY_ACCENTS.has(c) ? c : DEFAULT_SHELL_ACCENT;
}

/** Keeps `.app-shell { --accent }` in sync with saved receipt / brand colors. */
export function ShellAccentSync() {
  const { profile } = useShopProfile();
  const accent = normalizeAccent(
    profile.receipt_theme?.header_color || profile.receipt_theme?.accent_color
  );

  useEffect(() => {
    applyShellAccent(accent);
  }, [accent]);

  return null;
}
