/** Normalise Nigerian mobile input to E.164 (+234...). */
export function normalizeNgPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('234')) return `+${digits}`;
  if (digits.startsWith('0') && digits.length >= 10) return `+234${digits.slice(1)}`;
  if (digits.length > 0) return `+${digits}`;
  return '';
}

export function isLikelyNgMobile(e164: string): boolean {
  return /^\+234[789]\d{9}$/.test(e164.replace(/\s/g, ''));
}
