import { Package } from 'lucide-react';
import PlanPickerGrid from '@/components/billing/PlanPickerGrid';

type Props = {
  variant?: 'trial_ended' | 'account_suspended';
};

export default function TrialExpiredOverlay({ variant = 'trial_ended' }: Props) {
  const suspended = variant === 'account_suspended';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-shell-bg">
      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-8 pb-12">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-violet-400/15 text-violet-300 shadow-none ring-1 ring-violet-400/25">
            <Package size={28} />
          </div>
          <h1 className="font-display text-xl font-bold text-shell-ink">
            {suspended ? 'This account is disabled' : 'Your trial has ended'}
          </h1>
          <p className="mt-2 max-w-md text-sm text-shell-muted">
            {suspended
              ? 'Your shop account has been suspended. If you believe this is a mistake, contact VillageStock support.'
              : 'Choose a plan to continue using VillageStock. Payments go live soon — thanks for being an early shop.'}
          </p>
        </div>
        {!suspended ? <PlanPickerGrid /> : null}
      </div>
    </div>
  );
}
