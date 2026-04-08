import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useIsAdminUser } from '@/hooks/useIsAdminUser';
import { Shield, Loader2 } from 'lucide-react';

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 px-4">
      <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center mb-6 shadow-lg">
        <Shield size={30} className="text-slate-900" />
      </div>
      <h1 className="text-xl font-heading font-bold text-white mb-1">Admin sign in</h1>
      <p className="text-slate-400 text-sm mb-8 text-center max-w-sm">
        VillageStock operations dashboard. Retailer phone sign-in does not grant access here.
      </p>

      <div className="w-full max-w-sm bg-slate-800/80 border border-white/10 rounded-2xl p-6 shadow-xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1" htmlFor="admin-email">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              placeholder="admin@yourcompany.com"
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1" htmlFor="admin-password">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>

          {formError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{formError}</div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-amber-500 text-slate-900 font-semibold py-2.5 text-sm hover:bg-amber-400 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            Sign in
          </button>
        </form>
      </div>
      <p className="text-slate-500 text-xs mt-8 text-center max-w-md">
        Grant access in Supabase by inserting your auth user id into <code className="text-slate-400">admin_users</code>.
      </p>
    </div>
  );
}
