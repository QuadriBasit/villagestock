import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { BusinessPlan, BusinessPlanStatus } from '@/types';

type BusinessPatch = {
  plan?: BusinessPlan;
  plan_status?: BusinessPlanStatus;
  trial_start_date?: string;
  trial_end_date?: string;
  account_disabled?: boolean;
};

function invalidateAdminQueries(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['admin-dashboard-snapshot'] });
  void qc.invalidateQueries({ queryKey: ['admin-payments'] });
  void qc.invalidateQueries({ queryKey: ['admin-platform-activity'] });
}

export function addDaysToTrialEnd(currentEndIso: string, days: number): string {
  const now = Date.now();
  const currentEnd = new Date(currentEndIso).getTime();
  const base = Number.isFinite(currentEnd) ? Math.max(now, currentEnd) : now;
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
}

export function ymdToTrialEndIso(ymd: string): string {
  return new Date(`${ymd}T23:59:59.999Z`).toISOString();
}

export function useAdminActions() {
  const qc = useQueryClient();

  const updateBusiness = useMutation({
    mutationFn: async ({ businessId, patch }: { businessId: string; patch: BusinessPatch }) => {
      const { error } = await supabase
        .from('business_profiles')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', businessId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAdminQueries(qc),
  });

  return {
    updateBusiness,
    isPending: updateBusiness.isPending,
    extendTrial: (businessId: string, currentEndIso: string, days: number) =>
      updateBusiness.mutateAsync({
        businessId,
        patch: {
          plan: 'trial',
          plan_status: 'active',
          trial_end_date: addDaysToTrialEnd(currentEndIso, days),
        },
      }),
    setTrialEndDate: (businessId: string, ymd: string) =>
      updateBusiness.mutateAsync({
        businessId,
        patch: {
          plan: 'trial',
          plan_status: 'active',
          trial_end_date: ymdToTrialEndIso(ymd),
        },
      }),
    setPlan: (businessId: string, plan: BusinessPlan, planStatus: BusinessPlanStatus = 'active') =>
      updateBusiness.mutateAsync({
        businessId,
        patch: { plan, plan_status: planStatus },
      }),
    setPlanStatus: (businessId: string, planStatus: BusinessPlanStatus) =>
      updateBusiness.mutateAsync({
        businessId,
        patch: { plan_status: planStatus },
      }),
    toggleDisabled: (businessId: string, accountDisabled: boolean) =>
      updateBusiness.mutateAsync({
        businessId,
        patch: { account_disabled: accountDisabled },
      }),
  };
}
