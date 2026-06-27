import { format, parseISO } from 'date-fns';
import type { StockSession } from '@/types';

export function sessionCode(session: StockSession): string {
  return session.id.slice(0, 8).toUpperCase();
}

export function sessionDayLabel(session: StockSession): string {
  const date = parseISO(session.date);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (session.date === today) return 'Today';
  if (session.date === yesterday) return 'Yesterday';
  return format(date, 'EEE d MMM');
}

export function sessionDiscrepancies(session: StockSession): number {
  return session.missing_item_ids?.length ?? 0;
}

export function sessionLines(session: StockSession): number {
  return session.opening_snapshot_ids.length;
}

export function sessionIsClean(session: StockSession): boolean {
  return session.status === 'closed' && sessionDiscrepancies(session) === 0;
}

export function recentDiscrepancyTotal(sessions: StockSession[], days = 90): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return sessions
    .filter(s => parseISO(s.date) >= cutoff)
    .reduce((sum, s) => sum + sessionDiscrepancies(s), 0);
}

export function lastClosedSession(sessions: StockSession[]): StockSession | null {
  return sessions.find(s => s.status !== 'open') ?? null;
}
