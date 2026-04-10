import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { prepareLocalDataForSignOut } from '@/lib/sync';

export async function signOutApp(): Promise<void> {
  await prepareLocalDataForSignOut();
  await supabase.auth.signOut();
  useAuthStore.getState().signOut();
}
