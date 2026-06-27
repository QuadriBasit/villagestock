import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useIsAdminUser } from '@/hooks/useIsAdminUser';
import { Shield, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { AppLoadingScreen } from '@/components/ui/AppLoadingScreen';
import { adminCard, adminField } from '@/pages/admin/adminUi';
import { cn } from '@/lib/utils';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type FormData = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuthStore();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdminUser(user?.id);
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  if (!authLoading && !adminLoading && user && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const onSubmit = async (data: FormData) => {
    setFormError('');
    try {
      const { data: authData, error: signErr } = await supabase.auth.signInWithPassword({
        email: data.email.trim(),
        password: data.password,
      });
      if (signErr) throw signErr;
      const uid = authData.user?.id;
      if (!uid) throw new Error('No user returned');

      const { data: row, error: adminErr } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', uid)
        .maybeSingle();

      if (adminErr) throw adminErr;
      if (!row) {
        await supabase.auth.signOut();
        useAuthStore.getState().signOut();
        setFormError('This account is not authorized for admin access.');
        return;
      }

      navigate('/admin', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      setFormError(msg);
    }
  };

  if (authLoading) {
    return <AppLoadingScreen label="Loading admin…" />;
  }

  return (
    <div className="app-shell dark flex min-h-svh flex-col items-center justify-center bg-shell-bg px-4 font-body text-shell-ink">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/25">
        <Shield size={30} />
      </div>
      <h1 className="font-display text-xl font-bold text-shell-ink">Admin sign in</h1>
      <p className="mb-8 mt-1 max-w-sm text-center text-sm text-shell-muted">
        VillageStock operations dashboard. Retailer phone sign-in does not grant access here.
      </p>

      <div className={cn(adminCard, 'w-full max-w-sm shadow-lg shadow-black/20')}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-shell-muted" htmlFor="admin-email">
              Email
            </label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className={adminField}
              placeholder="admin@yourcompany.com"
            />
            {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-shell-muted" htmlFor="admin-password">
              Password
            </label>
            <PasswordInput
              id="admin-password"
              autoComplete="current-password"
              {...register('password')}
              className={adminField}
            />
            {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
          </div>

          {formError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-400 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            Sign in
          </button>
        </form>
      </div>
      <p className="mt-8 max-w-md text-center text-xs text-shell-muted">
        Grant access in Supabase by inserting your auth user id into{' '}
        <code className="font-mono text-violet-300/90">admin_users</code>.
      </p>
    </div>
  );
}
