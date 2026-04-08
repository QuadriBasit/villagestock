import { trialBannerState } from '@/lib/trial';
import type { BusinessProfile } from '@/types';

type Props = {
  profile: BusinessProfile | null | undefined;
};

export default function TrialBanner({ profile }: Props) {
  const { visible, daysRemaining, urgent } = trialBannerState(profile ?? undefined);
  if (!visible) return null;

  return (
    <div
      role="status"
      className={`w-full border-b px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] ${
        urgent
          ? 'border-red-200/50 bg-red-50 text-red-900 dark:border-red-500/25 dark:bg-red-950/80 dark:text-red-100'
          : 'border-amber-200/50 bg-amber-50 text-amber-950 dark:border-amber-500/20 dark:bg-amber-950/75 dark:text-amber-50'
      }`}
    >
      Trial: {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
    </div>
  );
}
