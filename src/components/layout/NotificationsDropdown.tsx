import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Box,
  ChevronRight,
  Loader2,
  MapPin,
  RefreshCw,
  Truck,
  Wallet,
  WifiOff,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppNotifications } from '@/hooks/useAppNotifications';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import {
  notificationIconToneClass,
  type AppNotification,
  type AppNotificationKind,
} from '@/lib/appNotifications';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { cn } from '@/lib/utils';
import { shellIconBtn } from '@/components/settings/settingsUi';

const KIND_ICON: Record<AppNotificationKind, LucideIcon> = {
  credit_overdue: AlertTriangle,
  stock_out: Box,
  stock_low: Box,
  stock_last_unit: Box,
  stock_low_more: Box,
  repair_pickup: MapPin,
  supplier_debt: Truck,
  cash_drawer: Wallet,
};

function ShellIconButton({
  children,
  className,
  badge,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { badge?: React.ReactNode }) {
  return (
    <button type="button" className={cn(shellIconBtn, className)} {...props}>
      {children}
      {badge}
    </button>
  );
}

export function NotificationsDropdown() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { preview, total, isLoading } = useAppNotifications(8);
  const { isOnline, pendingCount } = useSyncStatus();

  const hasSystemNotice = !isOnline || pendingCount > 0;
  const badgeCount = total + (hasSystemNotice ? 1 : 0);
  const showBadge = badgeCount > 0;

  const openItem = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ShellIconButton
          aria-label="Notifications"
          badge={
            showBadge ? (
              <span className="shell-accent-bg absolute -right-1 -top-1 grid min-h-[17px] min-w-[17px] place-items-center rounded-full ring-2 ring-shell-bg px-1 font-mono text-[10.5px] font-bold">
                {badgeCount > 9 ? '9+' : badgeCount}
              </span>
            ) : undefined
          }
        >
          <Bell size={19} />
        </ShellIconButton>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(100vw-1.5rem,24rem)] overflow-hidden border-shell-line bg-shell-surface p-0 text-shell-ink shadow-[var(--shadow-shell-elevated)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-shell-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <p className="font-display text-sm font-semibold text-shell-ink">Notifications</p>
            {badgeCount > 0 ? (
              <span className="shell-accent-bg grid min-h-[18px] min-w-[18px] place-items-center rounded-full px-1 font-mono text-[10px] font-bold">
                {badgeCount > 9 ? '9+' : badgeCount}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid size-7 place-items-center rounded-lg text-shell-muted transition-colors hover:bg-shell-surface-2 hover:text-shell-ink"
            aria-label="Close notifications"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[min(28rem,62vh)] overflow-y-auto">
          {!isOnline ? (
            <SystemNotice
              icon={WifiOff}
              tone="amber"
              title="You're offline"
              detail="Changes save locally and sync when you're back online."
              onClick={() => openItem('/settings')}
            />
          ) : null}

          {pendingCount > 0 ? (
            <SystemNotice
              icon={RefreshCw}
              tone="violet"
              title={`${pendingCount} change${pendingCount !== 1 ? 's' : ''} waiting to sync`}
              detail="Keep the app open until sync completes."
            />
          ) : null}

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-shell-muted">
              <Loader2 size={16} className="animate-spin" />
              Loading…
            </div>
          ) : preview.length === 0 && !hasSystemNotice ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-shell-ink">All caught up</p>
              <p className="mt-0.5 text-xs text-shell-muted">Nothing needs your attention.</p>
            </div>
          ) : preview.length === 0 ? null : (
            <ul className="divide-y divide-shell-line">
              {preview.map(item => (
                <NotificationRow key={item.id} item={item} onClick={() => openItem(item.href)} />
              ))}
            </ul>
          )}
        </div>

        {total > preview.length ? (
          <div className="border-t border-shell-line p-2">
            <button
              type="button"
              onClick={() => openItem('/alerts')}
              className="flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-xs font-semibold shell-accent-text-soft transition-colors hover:bg-shell-surface-2"
            >
              View all alerts
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function NotificationRow({ item, onClick }: { item: AppNotification; onClick: () => void }) {
  const Icon = KIND_ICON[item.kind];

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-shell-surface-2/50"
      >
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-[10px]',
            notificationIconToneClass(item.tone),
          )}
        >
          <Icon size={16} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-snug text-shell-ink">{item.title}</p>
          <p className="mt-0.5 truncate text-[11px] text-shell-muted">{item.detail}</p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-shell-muted/70" aria-hidden />
      </button>
    </li>
  );
}

function SystemNotice({
  icon: Icon,
  tone,
  title,
  detail,
  onClick,
}: {
  icon: LucideIcon;
  tone: 'amber' | 'violet';
  title: string;
  detail: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-[10px]',
          tone === 'amber' ? 'bg-amber-500/15 text-amber-300' : 'shell-accent-icon',
        )}
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-shell-ink">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-shell-muted">{detail}</p>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full gap-3 border-b border-shell-line px-4 py-3 text-left transition-colors hover:bg-shell-surface-2/40"
      >
        {body}
      </button>
    );
  }

  return <div className="flex gap-3 border-b border-shell-line px-4 py-3">{body}</div>;
}
