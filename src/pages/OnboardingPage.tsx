import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { useBusinessProfile } from '@/hooks/useBusinessProfile';
import { Package, Loader2, Store, User, MapPin, Mail, Phone, ArrowRight, Sparkles, Lock } from 'lucide-react';
import FeatureTour from '@/components/onboarding/FeatureTour';

const step2Schema = z
  .object({
    shop_name: z.string().min(1, 'Shop name is required'),
    owner_name: z.string().min(1, 'Owner name is required'),
    address: z.string().min(1, 'Shop address is required'),
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    password_confirm: z.string().min(1, 'Confirm your password'),
  })
  .refine(d => d.password === d.password_confirm, { message: 'Passwords do not match', path: ['password_confirm'] });
type Step2Data = z.infer<typeof step2Schema>;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuthStore();
  const { profile, isReady, saveDraft, startTrialAndCompleteOnboarding } = useBusinessProfile();
  const [step, setStep] = useState<2 | 3>(2);
  const [submitError, setSubmitError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [legacyPhone, setLegacyPhone] = useState('');

  const verifiedPhone = user?.phone ?? '';
  const needsManualPhone = !verifiedPhone && !(profile?.phone);
  const phoneDisplay = verifiedPhone || profile?.phone || '';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Step2Data>({
    resolver: zodResolver(step2Schema) as never,
    defaultValues: {
      shop_name: '',
      owner_name: '',
      address: '',
      email: '',
      password: '',
      password_confirm: '',
    },
  });

  useEffect(() => {
    if (!isReady || !profile) return;
    if (profile.onboarding_complete) return;
    reset({
      shop_name: profile.shop_name,
      owner_name: profile.owner_name,
      address: profile.address,
      email: profile.email ?? '',
      password: '',
      password_confirm: '',
    });
  }, [isReady, profile, reset]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface text-primary">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface text-primary">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (profile?.onboarding_complete) {
    return <Navigate to="/dashboard" replace />;
  }

  const fieldClass =
    'w-full border border-border rounded-lg bg-white px-3 py-2.5 text-sm text-dark placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition dark:bg-zinc-900/90 dark:border-zinc-600 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-primary dark:focus:ring-primary/35';

  const onStep2 = async (data: Step2Data) => {
    setSubmitError('');
    const rawPhone = legacyPhone.trim();
    const phone = rawPhone || user.phone || profile?.phone || '';
    try {
      const { error: authErr } = await supabase.auth.updateUser({
        email: data.email.trim(),
        password: data.password,
      });
      if (authErr) {
        setSubmitError(
          authErr.message.includes('confirmation')
            ? 'Confirm your email from the link we sent, then continue. You can turn off email confirmations in Supabase Auth settings for development.'
            : authErr.message
        );
        return;
      }
      await saveDraft({
        shop_name: data.shop_name,
        owner_name: data.owner_name,
        address: data.address,
        email: data.email.trim(),
        phone,
        onboarding_complete: false,
      });
      setStep(3);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Could not save profile');
    }
  };

  const onFinish = async () => {
    setSubmitError('');
    setFinishing(true);
    try {
      await startTrialAndCompleteOnboarding();
      navigate('/dashboard', { replace: true });
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="min-h-svh bg-surface flex flex-col items-center px-4 py-10 md:py-14 pb-[max(2.5rem,env(safe-area-inset-bottom))] relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(0,102,221,0.1),transparent),radial-gradient(ellipse_50%_40%_at_0%_100%,rgba(249,115,22,0.06),transparent)]"
        aria-hidden
      />
      <div className="relative w-full max-w-lg">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg shadow-primary/20 ring-4 ring-primary/10">
            <Package size={28} className="text-white" />
          </div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">
            Step {step === 2 ? '2' : '3'} of 3
          </p>
          <h1 className="mt-1 text-center text-xl font-heading font-bold text-dark dark:text-zinc-100">
            {step === 2 ? 'Tell us about your shop' : 'You are all set'}
          </h1>
          {step === 2 && (
            <p className="mx-auto mt-2 max-w-sm text-center text-xs text-muted dark:text-zinc-400">
              This step saves your shop details and attaches this email/password to your{' '}
              <strong className="dark:text-zinc-300">login</strong> (Supabase Auth). That login is what sign-in and password
              reset use — not the shop table by itself. Optional shop phone below is for receipts.
            </p>
          )}
        </div>

        {step === 2 ? (
          <div className="space-y-4 rounded-2xl border border-transparent bg-white p-6 shadow-md dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:shadow-black/20">
            <div>
                <label className="mb-1 block text-sm font-medium text-dark dark:text-zinc-200" htmlFor="phone-ro">
                <Phone size={13} className="inline mr-1 text-muted" />
                {needsManualPhone ? 'Shop phone (optional)' : 'Phone (from account)'}
              </label>
              {needsManualPhone ? (
                <input
                  id="phone-ro"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Shop contact number (optional)"
                  value={legacyPhone}
                  onChange={e => setLegacyPhone(e.target.value)}
                  className={fieldClass}
                />
              ) : (
                <input
                  id="phone-ro"
                  readOnly
                  value={phoneDisplay}
                  className={`${fieldClass} cursor-not-allowed bg-surface text-muted dark:bg-zinc-800/80 dark:text-zinc-400`}
                />
              )}
            </div>

            <form onSubmit={handleSubmit(onStep2)} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-dark dark:text-zinc-200" htmlFor="shop_name">
                  <Store size={13} className="inline mr-1 text-muted" />
                  Shop name *
                </label>
                <input id="shop_name" {...register('shop_name')} placeholder="e.g. Basit Electronics" className={fieldClass} />
                {errors.shop_name && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.shop_name.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark dark:text-zinc-200" htmlFor="owner_name">
                  <User size={13} className="inline mr-1 text-muted" />
                  Owner name *
                </label>
                <input id="owner_name" {...register('owner_name')} placeholder="Your full name" className={fieldClass} />
                {errors.owner_name && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.owner_name.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark dark:text-zinc-200" htmlFor="address">
                  <MapPin size={13} className="inline mr-1 text-muted" />
                  Shop address *
                </label>
                <input
                  id="address"
                  {...register('address')}
                  placeholder="e.g. Shop 14, Computer Village, Ikeja"
                  className={fieldClass}
                />
                {errors.address && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.address.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark dark:text-zinc-200" htmlFor="email">
                  <Mail size={13} className="inline mr-1 text-muted" />
                  Login email *
                </label>
                <input id="email" type="email" autoComplete="email" {...register('email')} placeholder="you@example.com" className={fieldClass} />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark dark:text-zinc-200" htmlFor="password">
                  <Lock size={13} className="inline mr-1 text-muted" />
                  Password * (min 8 characters)
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  {...register('password')}
                  className={fieldClass}
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.password.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark dark:text-zinc-200" htmlFor="password_confirm">
                  <Lock size={13} className="inline mr-1 text-muted" />
                  Confirm password *
                </label>
                <input
                  id="password_confirm"
                  type="password"
                  autoComplete="new-password"
                  {...register('password_confirm')}
                  className={fieldClass}
                />
                {errors.password_confirm && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.password_confirm.message}</p>
                )}
              </div>

              {submitError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-white rounded-xl py-3 font-heading font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                Continue
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-center dark:border-amber-700/45 dark:from-amber-950/70 dark:to-orange-950/50">
              <Sparkles className="mx-auto mb-2 text-amber-600 dark:text-amber-400" size={28} />
              <h2 className="font-heading text-lg font-bold text-dark dark:text-amber-50">Start your 14-day free trial</h2>
              <p className="mt-2 text-sm text-muted dark:text-zinc-400">
                When you continue, your trial begins with full access to inventory, sales, credits, repairs, and reports — no
                usage caps for 14 days.
              </p>
            </div>

            <div className="rounded-2xl border border-transparent bg-white p-5 shadow-md dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:shadow-black/20">
              <h3 className="mb-3 font-heading text-sm font-semibold text-dark dark:text-zinc-100">Quick tour</h3>
              <FeatureTour />
            </div>

            {submitError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
                {submitError}
              </div>
            )}

            <button
              type="button"
              onClick={onFinish}
              disabled={finishing}
              className="w-full bg-primary text-white rounded-xl py-3 font-heading font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {finishing ? <Loader2 size={16} className="animate-spin" /> : null}
              Start trial & go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
