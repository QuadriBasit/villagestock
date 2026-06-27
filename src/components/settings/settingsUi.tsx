import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const settingsPanel =
  'rounded-xl border border-shell-line bg-shell-surface p-4 md:p-5 shadow-none';

export const settingsField =
  'shell-inset-field w-full rounded-xl border border-shell-line bg-shell-surface-2/40 px-3 py-2.5 text-sm text-shell-ink placeholder:text-shell-muted outline-none transition focus:border-violet-400/45 focus:ring-2 focus:ring-violet-400/12';

export const settingsLabel = 'mb-1.5 block text-xs font-semibold text-shell-muted';

export const settingsInset =
  'rounded-xl border border-shell-line bg-shell-surface-2/40';

export const settingsBtnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-semibold text-[#160a2e] transition hover:bg-violet-300 disabled:opacity-50';

export const settingsBtnOutline =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-shell-line bg-transparent px-4 py-2.5 text-sm font-medium text-shell-ink transition hover:bg-shell-surface-2';

export const settingsBtnDanger =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10';

export const settingsRoleChip = (active: boolean) =>
  cn(
    'rounded-xl border px-3 py-2.5 text-left text-xs transition-colors',
    active
      ? 'border-violet-400/40 bg-violet-400/10 text-violet-200'
      : 'border-shell-line bg-shell-surface-2/30 text-shell-muted hover:bg-shell-surface-2/60 hover:text-shell-ink',
  );

export function SettingsCard({
  icon: Icon,
  title,
  subtitle,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(settingsPanel, 'flex flex-col gap-4', className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-violet-400/15 text-violet-300">
          <Icon size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-[14.5px] font-semibold text-shell-ink">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs leading-relaxed text-shell-muted">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function SettingsToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-shell-line py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-shell-ink">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-shell-muted">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full transition-colors',
          checked ? 'bg-violet-400' : 'bg-shell-line',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}
