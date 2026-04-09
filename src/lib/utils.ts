import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const ngnFormatter = new Intl.NumberFormat('en-NG', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return `₦${ngnFormatter.format(amount)}`;
}

/** Strip non-digits from user input; empty → null. */
export function parseMoneyDigits(raw: string): number | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
