import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type AdminPaymentRow = {
  id: string;
  user_id: string;
  plan: string;
  amount_ngn: number;
  provider: string | null;
  provider_ref: string | null;
  status: string;
  created_at: string;
};

export function useAdminPayments(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-payments'],
    queryFn: async (): Promise<AdminPaymentRow[]> => {
      const { data, error } = await supabase
        .from('subscription_payments')
        .select('id, user_id, plan, amount_ngn, provider, provider_ref, status, created_at')
        .order('created_at', { ascending: false })
        .limit(250);
      if (error) throw error;
      return (data ?? []).map(row => ({
        id: String(row.id),
        user_id: String(row.user_id),
        plan: String(row.plan),
        amount_ngn: Number(row.amount_ngn),
        provider: row.provider != null ? String(row.provider) : null,
        provider_ref: row.provider_ref != null ? String(row.provider_ref) : null,
        status: String(row.status),
        created_at: String(row.created_at),
      }));
    },
    enabled,
    staleTime: 1000 * 45,
  });
}
