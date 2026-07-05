import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

export function AdminPageLoader() {
  return (
    <div className="flex justify-center py-24 text-shell-muted">
      <RefreshCw className="animate-spin" size={28} />
    </div>
  );
}

export function AdminPageError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  );
}

export function AdminMetricTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-shell-line bg-shell-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-shell-muted">{label}</p>
        {icon ? <span className="text-shell-muted opacity-80">{icon}</span> : null}
      </div>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums text-shell-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-shell-muted">{hint}</p> : null}
    </div>
  );
}
