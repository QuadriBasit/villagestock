/** Casual first line of a greeting: first word of owner name, else email local-part, else "there". */
export function getGreetingFirstName(opts: { ownerName?: string | null; email?: string | null }): string {
  const owner = opts.ownerName?.trim();
  if (owner) {
    const first = owner.split(/\s+/)[0];
    if (first) return first;
  }
  const email = opts.email?.trim();
  if (email?.includes('@')) {
    const local = email.split('@')[0]?.trim();
    if (local) return local;
  }
  return 'there';
}

/** Initial for avatar badges: owner name → email → phone digit. */
export function getAccountInitial(opts: {
  ownerName?: string | null;
  email?: string | null;
  phone?: string | null;
}): string {
  const owner = opts.ownerName?.trim();
  if (owner) return owner.charAt(0).toUpperCase();
  const email = opts.email?.trim();
  if (email) return email.charAt(0).toUpperCase();
  const digits = opts.phone?.replace(/\D/g, '') ?? '';
  if (digits) return digits.slice(-1).toUpperCase();
  return 'U';
}
