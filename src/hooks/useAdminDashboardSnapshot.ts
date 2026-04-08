import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { parseAdminSnapshot, type AdminDashboardSnapshot } from '@/types/admin';

export function useAdminDashboardSnapshot(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-dashboard-snapshot'],
    queryFn: async (): Promise<AdminDashboardSnapshot | null> => {
      const { data, error } = await supabase.rpc('admin_dashboard_snapshot');
      if (error) throw error;
      return parseAdminSnapshot(data);
    },
    enabled,
    staleTime: 1000 * 30,
  });
}
