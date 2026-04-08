import { Package } from 'lucide-react';
import PlanPickerGrid from '@/components/billing/PlanPickerGrid';

type Props = {
  variant?: 'trial_ended' | 'account_suspended';
};

export default function TrialExpiredOverlay({ variant = 'trial_ended' }: Props) {
  const suspended = variant === 'account_suspended';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-surface">
      <div className="flex-1 overflow-y-auto px-4 py-8 pb-12 max-w-3xl mx-auto w-full">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg">
            <Package size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-heading font-bold text-dark">
            {suspended ? 'This account is disabled' : 'Your trial has ended.'}
          </h1>
          <p className="text-sm text-muted mt-2 max-w-md">
            {suspended
              ? 'Your shop account has been suspended. If you believe this is a mistake, contact VillageStock support.'
              : 'Choose a plan to continue using VillageStock. Payments go live soon — thanks for being an early shop.'}
          </p>
        </div>
        {!suspended && <PlanPickerGrid />}
      </div>
    </div>
  );
}
