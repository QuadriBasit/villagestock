/**
 * Origin used in auth email links (password reset, signup confirmation).
 * Set `VITE_PUBLIC_SITE_URL` in production to your canonical URL — it must match
 * Supabase Auth → URL Configuration (Site URL / Redirect allow list).
 */
export function getAuthSiteOrigin(): string {
  const raw = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined;
  if (raw && /^https?:\/\//i.test(raw.trim())) {
    try {
      return new URL(raw.trim()).origin;
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

export function authCallbackUrl(): string {
  const base = getAuthSiteOrigin();
  return base ? `${base.replace(/\/$/, '')}/auth` : '/auth';
}
