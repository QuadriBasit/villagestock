import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useIsAdminUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['is-admin', userId],
    queryFn: async (): Promise<boolean> => {
      if (!userId) return false;
      const { data, error } = await supabase.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}
