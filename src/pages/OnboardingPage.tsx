import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { useBusinessProfile } from '@/hooks/useBusinessProfile';
import { Package, Loader2, Store, User, MapPin, Mail, Phone, ArrowRight, Sparkles } from 'lucide-react';
import FeatureTour from '@/components/onboarding/FeatureTour';
import { Input } from '@/components/ui/Input';
import { settingsBtnPrimary, settingsField, settingsInset, settingsLabel } from '@/components/settings/settingsUi';
import { cn } from '@/lib/utils';

const step2Schema = z.object({
  shop_name: z.string().min(1, 'Shop name is required'),
  owner_name: z.string().min(1, 'Owner name is required'),
  address: z.string().min(1, 'Shop address is required'),
  /** Only used when the account has no email yet (e.g. phone signup). */
  email: z.string().optional(),
});
type Step2Data = z.infer<typeof step2Schema>;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuthStore();
  const { profile, isReady, saveDraft, startTrialAndCompleteOnboarding } = useBusinessProfile();
  const [step, setStep] = useState<2 | 3>(2);
  const [submitError, setSubmitError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [legacyPhone, setLegacyPhone] = useState('');

  const sessionEmail = user?.email?.trim() ?? '';
  /** Phone-only signups need an email once; everyone else already set email at signup. */
  const needsEmailField = !sessionEmail;

  const verifiedPhone = user?.phone ?? '';
  const needsManualPhone = !verifiedPhone && !profile?.phone;
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
    },
  });

  useEffect(() => {
    if (!isReady || !profile) return;
    if (profile.onboarding_complete) return;
    reset({
      shop_name: profile.shop_name,
      owner_name: profile.owner_name,
      address: profile.address,
      email: needsEmailField ? (profile.email ?? '') : '',
    });
  }, [isReady, profile, reset, needsEmailField]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-shell-bg">
        <Loader2 className="size-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-shell-bg">
        <Loader2 className="size-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (profile?.onboarding_complete) {
    return <Navigate to="/dashboard" replace />;
  }

  const onStep2 = async (data: Step2Data) => {
    setSubmitError('');
    const rawPhone = legacyPhone.trim();
    const phone = rawPhone || user.phone || profile?.phone || '';
    const emailFromForm = (data.email ?? '').trim();
    const emailToUse = sessionEmail || emailFromForm;

    if (!emailToUse) {
      setSubmitError('Add an email address so you can sign in and recover your account.');
      return;
    }
    if (needsEmailField) {
      const parsed = z.string().email('Enter a valid email').safeParse(emailToUse);
      if (!parsed.success) {
        setSubmitError(parsed.error.issues[0]?.message ?? 'Enter a valid email');
        return;
      }
    }

    try {
      if (emailToUse !== sessionEmail) {
        const { error: authErr } = await supabase.auth.updateUser({
          email: emailToUse,
        });
        if (authErr) {
          setSubmitError(
            authErr.message.includes('confirmation')
              ? 'Confirm your email from the link we sent, then continue. You can turn off email confirmations in Supabase Auth settings for development.'
              : authErr.message,
          );
          return;
        }
      }

      await saveDraft({
        shop_name: data.shop_name,
        owner_name: data.owner_name,
        address: data.address,
        email: emailToUse,
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
    <div className="relative flex min-h-svh flex-col items-center overflow-hidden bg-shell-bg px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] md:py-14">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(0,179,152,0.18),transparent),radial-gradient(ellipse_50%_40%_at_0%_100%,rgba(52,211,153,0.08),transparent)]"
        aria-hidden
      />
      <div className="relative w-full max-w-lg">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-brand-400 text-[#04231d] shadow-lg shadow-brand-400/20 ring-4 ring-brand-400/15">
            <Package size={28} strokeWidth={2.2} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-shell-muted">
            Step {step === 2 ? '2' : '3'} of 3
          </p>
          <h1 className="mt-1 font-display text-xl font-bold text-shell-ink">
            {step === 2 ? 'Tell us about your shop' : 'You are all set'}
          </h1>
          {step === 2 ? (
            <p className="mx-auto mt-2 max-w-sm text-center text-xs leading-relaxed text-shell-muted">
              This step saves your shop details. You already chose your password when you signed up — we do not ask for
              it again here.{' '}
              {needsEmailField
                ? 'Add an email below if you signed up with phone only.'
                : 'Your login email is the one you signed up with (shown below).'}{' '}
              Optional shop phone is for receipts.
            </p>
          ) : null}
        </div>

        {step === 2 ? (
          <div className={cn(settingsInset, 'space-y-4 rounded-2xl p-6')}>
            <div>
              <label className={settingsLabel} htmlFor="phone-ro">
                <Phone size={13} className="mr-1 inline text-shell-muted" />
                {needsManualPhone ? 'Shop phone (optional)' : 'Phone (from account)'}
              </label>
              {needsManualPhone ? (
                <Input
                  id="phone-ro"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Shop contact number (optional)"
                  value={legacyPhone}
                  onChange={e => setLegacyPhone(e.target.value)}
                  className={settingsField}
                />
              ) : (
                <Input
                  id="phone-ro"
                  readOnly
                  value={phoneDisplay}
                  className={cn(settingsField, 'cursor-not-allowed bg-shell-surface/60 text-shell-muted')}
                />
              )}
            </div>

            <form onSubmit={handleSubmit(onStep2)} className="space-y-4">
              <div>
                <label className={settingsLabel} htmlFor="shop_name">
                  <Store size={13} className="mr-1 inline text-shell-muted" />
                  Shop name *
                </label>
                <Input
                  id="shop_name"
                  {...register('shop_name')}
                  placeholder="e.g. Basit Electronics"
                  className={settingsField}
                />
                {errors.shop_name ? (
                  <p className="mt-1 text-xs text-red-400">{errors.shop_name.message}</p>
                ) : null}
              </div>
              <div>
                <label className={settingsLabel} htmlFor="owner_name">
                  <User size={13} className="mr-1 inline text-shell-muted" />
                  Owner name *
                </label>
                <Input id="owner_name" {...register('owner_name')} placeholder="Your full name" className={settingsField} />
                {errors.owner_name ? (
                  <p className="mt-1 text-xs text-red-400">{errors.owner_name.message}</p>
                ) : null}
              </div>
              <div>
                <label className={settingsLabel} htmlFor="address">
                  <MapPin size={13} className="mr-1 inline text-shell-muted" />
                  Shop address *
                </label>
                <Input
                  id="address"
                  {...register('address')}
                  placeholder="e.g. Shop 14, Computer Village, Ikeja"
                  className={settingsField}
                />
                {errors.address ? (
                  <p className="mt-1 text-xs text-red-400">{errors.address.message}</p>
                ) : null}
              </div>
              {needsEmailField ? (
                <div>
                  <label className={settingsLabel} htmlFor="email">
                    <Mail size={13} className="mr-1 inline text-shell-muted" />
                    Email for login &amp; recovery *
                  </label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...register('email')}
                    placeholder="you@example.com"
                    className={settingsField}
                  />
                  {errors.email ? <p className="mt-1 text-xs text-red-400">{errors.email.message}</p> : null}
                </div>
              ) : (
                <div className={cn(settingsInset, 'rounded-xl px-3 py-2.5 text-sm')}>
                  <p className="mb-0.5 text-xs font-semibold text-shell-muted">
                    <Mail size={12} className="mr-1 inline" />
                    Login email
                  </p>
                  <p className="font-medium text-shell-ink">{sessionEmail}</p>
                  <p className="mt-1 text-[11px] text-shell-muted">
                    Saved with your shop profile. To change it, use account settings or your Supabase auth flow later.
                  </p>
                </div>
              )}
              {submitError ? (
                <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {submitError}
                </div>
              ) : null}

              <button type="submit" disabled={isSubmitting} className={cn(settingsBtnPrimary, 'w-full py-3')}>
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                Continue
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 to-orange-500/10 p-5 text-center">
              <Sparkles className="mx-auto mb-2 text-amber-300" size={28} />
              <h2 className="font-display text-lg font-bold text-shell-ink">Start your 14-day free trial</h2>
              <p className="mt-2 text-sm leading-relaxed text-shell-muted">
                When you continue, your trial begins with full access to inventory, sales, credits, repairs, and
                reports — no usage caps for 14 days.
              </p>
            </div>

            <div className={cn(settingsInset, 'rounded-2xl p-5')}>
              <h3 className="mb-3 font-display text-sm font-semibold text-shell-ink">Quick tour</h3>
              <FeatureTour />
            </div>

            {submitError ? (
              <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {submitError}
              </div>
            ) : null}

            <button type="button" onClick={onFinish} disabled={finishing} className={cn(settingsBtnPrimary, 'w-full py-3')}>
              {finishing ? <Loader2 size={16} className="animate-spin" /> : null}
              Start trial & go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
