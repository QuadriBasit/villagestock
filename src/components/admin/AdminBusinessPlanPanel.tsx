import { useState } from 'react';
import { CalendarPlus, Loader2, ShieldOff } from 'lucide-react';
import type { AdminBusinessRow } from '@/types/admin';
import type { BusinessPlan, BusinessPlanStatus } from '@/types';
import { useAdminActions } from '@/hooks/useAdminActions';
import { cn, formatDate } from '@/lib/utils';
import {
  ADMIN_PLAN_OPTIONS,
  ADMIN_PLAN_STATUS_OPTIONS,
  EXTEND_TRIAL_PRESETS,
  formatTrialWindow,
  trialDaysRemaining,
} from '@/lib/adminPlanHelpers';
import { AdminPlanBadge } from '@/components/admin/AdminPlanBadge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { adminField } from '@/pages/admin/adminUi';

type Props = {
  business: AdminBusinessRow;
  compact?: boolean;
};

export function AdminBusinessPlanPanel({ business, compact }: Props) {
  const { extendTrial, setPlan, setPlanStatus, setTrialEndDate, toggleDisabled, isPending } =
    useAdminActions();
  const [plan, setPlanLocal] = useState<BusinessPlan>(business.plan as BusinessPlan);
  const [planStatus, setPlanStatusLocal] = useState<BusinessPlanStatus>(
    business.plan_status as BusinessPlanStatus,
  );
  const [customEndDate, setCustomEndDate] = useState(business.trial_end_date?.slice(0, 10) ?? '');
  const [disabled, setDisabled] = useState(business.account_disabled);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const daysLeft = trialDaysRemaining(business.trial_end_date);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setMessage(null);
    try {
      await fn();
      setMessage({ type: 'ok', text: label });
    } catch (e) {
      setMessage({
        type: 'err',
        text: e instanceof Error ? e.message : 'Update failed.',
      });
    }
  };

  return (
    <div className={cn('space-y-4', compact ? '' : 'rounded-xl border border-shell-line bg-shell-surface-2/25 p-4')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-shell-muted">Subscription & access</p>
        <AdminPlanBadge plan={business.plan} status={business.plan_status} />
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <InfoChip label="Trial window" value={formatTrialWindow(business.trial_start_date, business.trial_end_date)} />
        {business.plan === 'trial' && daysLeft != null ? (
          <InfoChip
            label="Days left"
            value={daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'Expired'}
            warn={daysLeft <= 7}
          />
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-shell-muted">Extend trial</p>
        <div className="flex flex-wrap gap-2">
          {EXTEND_TRIAL_PRESETS.map(days => (
            <Button
              key={days}
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                void run(`Trial extended by ${days} days.`, () =>
                  extendTrial(business.id, business.trial_end_date, days),
                )
              }
            >
              <CalendarPlus size={14} />
              +{days}d
            </Button>
          ))}
        </div>
        <DatePickerField
          label="Set trial end date"
          value={customEndDate}
          onChange={setCustomEndDate}
          disabled={isPending}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending || !customEndDate}
          onClick={() =>
            void run('Trial end date updated.', () => setTrialEndDate(business.id, customEndDate))
          }
        >
          Apply end date
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-shell-muted">Plan</Label>
          <Select value={plan} onValueChange={v => setPlanLocal(v as BusinessPlan)} disabled={isPending}>
            <SelectTrigger className={cn(adminField, 'shadow-none')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADMIN_PLAN_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-shell-muted">Status</Label>
          <Select
            value={planStatus}
            onValueChange={v => setPlanStatusLocal(v as BusinessPlanStatus)}
            disabled={isPending}
          >
            <SelectTrigger className={cn(adminField, 'shadow-none')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADMIN_PLAN_STATUS_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        type="button"
        disabled={isPending}
        onClick={() =>
          void run('Plan updated.', async () => {
            if (plan !== business.plan) await setPlan(business.id, plan, planStatus);
            else if (planStatus !== business.plan_status) await setPlanStatus(business.id, planStatus);
          })
        }
      >
        {isPending ? <Loader2 className="animate-spin" size={16} /> : null}
        Save plan & status
      </Button>

      <div className="flex items-center gap-3 rounded-xl border border-shell-line bg-shell-surface/60 px-3 py-2.5">
        <Checkbox
          id={`disabled-${business.id}`}
          checked={disabled}
          disabled={isPending}
          onCheckedChange={checked => setDisabled(checked === true)}
        />
        <Label htmlFor={`disabled-${business.id}`} className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
          <ShieldOff size={16} className="text-shell-muted" />
          Disable shop account
        </Label>
        <Button
          type="button"
          size="sm"
          variant={disabled ? 'destructive' : 'outline'}
          disabled={isPending || disabled === business.account_disabled}
          onClick={() =>
            void run(disabled ? 'Account disabled.' : 'Account re-enabled.', () =>
              toggleDisabled(business.id, disabled),
            )
          }
        >
          Apply
        </Button>
      </div>

      {message ? (
        <p
          className={cn(
            'rounded-lg px-3 py-2 text-xs font-medium',
            message.type === 'ok' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-red-500/15 text-red-200',
          )}
        >
          {message.text}
        </p>
      ) : null}

      <p className="text-[11px] text-shell-muted">
        Last profile update {business.updated_at ? formatDate(business.updated_at) : '—'}
      </p>
    </div>
  );
}

function InfoChip({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-shell-line/80 bg-shell-surface/50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-shell-muted">{label}</p>
      <p className={cn('mt-0.5 text-sm font-medium', warn ? 'text-amber-300' : 'text-shell-ink')}>{value}</p>
    </div>
  );
}
