const STORAGE_KEY = 'villagestock_staff_invite';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TTL_MS = 14 * 864e5;

export function isStaffInviteToken(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function persistStaffInviteToken(token: string): void {
  const trimmed = token.trim();
  if (!isStaffInviteToken(trimmed) || typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: trimmed, exp: Date.now() + TTL_MS }));
}

export function readStaffInviteToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { token?: unknown; exp?: unknown };
    const token = typeof parsed.token === 'string' ? parsed.token.trim() : '';
    const exp = typeof parsed.exp === 'number' ? parsed.exp : 0;
    if (!isStaffInviteToken(token) || exp < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return token;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearStaffInviteToken(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function staffInviteJoinUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/auth?invite=${encodeURIComponent(token)}`;
}
