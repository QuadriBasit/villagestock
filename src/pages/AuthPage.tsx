import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { Package, Loader2, Smartphone, Mail, Lock } from 'lucide-react';
import { normalizeNgPhone, isLikelyNgMobile } from '@/lib/phone';
import { useBusinessProfileQuery } from '@/hooks/useBusinessProfileQuery';

type Panel = 'email' | 'phone' | 'forgot';

export default function AuthPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const q = useBusinessProfileQuery(user?.id);

  const [panel, setPanel] = useState<Panel>('email');
  const [emailLogin, setEmailLogin] = useState('');
  const [passwordLogin, setPasswordLogin] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setRecoveryMode(true);
    }
    const { data: sub } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const completePasswordRecovery = async () => {
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== newPassword2) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword });
      if (err) throw err;
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setRecoveryMode(false);
      setNewPassword('');
      setNewPassword2('');
      setPanel('email');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface text-primary">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (user && !recoveryMode) {
    if (q.status === 'pending') {
      return (
        <div className="flex h-screen items-center justify-center bg-surface text-primary">
          <Loader2 className="animate-spin" size={28} />
        </div>
      );
    }
    if (q.profile?.onboarding_complete) {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/onboarding" replace />;
  }

  const e164 = normalizeNgPhone(phoneInput);

  const signInWithEmail = async () => {
    setError('');
    const email = emailLogin.trim().toLowerCase();
    if (!email || !isValidEmailLoose(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (passwordLogin.length < 6) {
      setError('Enter your password.');
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password: passwordLogin });
      if (err) throw err;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  const sendResetLink = async () => {
    setError('');
    const email = resetEmail.trim().toLowerCase();
    if (!email || !isValidEmailLoose(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (err) throw err;
      setResetSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send reset email');
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async () => {
    setError('');
    if (!isLikelyNgMobile(e164)) {
      setError('Enter a valid Nigerian mobile number (e.g. 0803… or +234…).');
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        phone: e164,
        options: { channel: 'sms' },
      });
      if (err) throw err;
      setOtpSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send code. Check Supabase Phone provider setup.');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setError('');
    if (otp.trim().length < 4) {
      setError('Enter the code from SMS.');
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.verifyOtp({
        phone: e164,
        token: otp.trim(),
        type: 'sms',
      });
      if (err) throw err;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition';

  return (
    <div className="min-h-svh flex flex-col items-center justify-center bg-surface px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6 md:py-12 relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-15%,rgba(0,102,221,0.11),transparent),radial-gradient(ellipse_55%_45%_at_100%_90%,rgba(0,168,150,0.07),transparent)]"
        aria-hidden
      />
      <div className="relative w-full max-w-md flex flex-col items-center">
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/20 ring-4 ring-primary/10">
          <Package size={32} className="text-white" />
        </div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-dark tracking-tight">VillageStock</h1>
        <p className="text-muted text-sm mt-2 max-w-xs leading-relaxed">Electronics inventory for Computer Village — fast on mobile, ready offline.</p>
      </div>

      <div className="w-full max-w-sm bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl shadow-slate-900/5 border border-border/70 p-6 md:p-8">
        {recoveryMode && !user && (
          <div className="flex flex-col items-center py-8 text-muted text-sm">
            <Loader2 className="animate-spin mb-3 text-primary" size={28} />
            Opening reset link…
          </div>
        )}

        {recoveryMode && user && (
          <>
            <h2 className="font-heading font-semibold text-lg text-dark mb-1 flex items-center gap-2">
              <Lock size={18} className="text-primary" />
              Choose a new password
            </h2>
            <p className="text-xs text-muted mb-4">Your reset link was valid — set a password you will use with your email.</p>
            <div className="space-y-3">
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="New password"
              />
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword2}
                onChange={e => setNewPassword2(e.target.value)}
                className={inputClass}
                placeholder="Confirm password"
              />
            </div>
            {error && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">{error}</div>
            )}
            <button
              type="button"
              onClick={completePasswordRecovery}
              disabled={busy}
              className="mt-4 w-full bg-primary text-white rounded-lg py-2.5 font-medium text-sm hover:bg-primary-dark disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              Save password &amp; sign in
            </button>
          </>
        )}

        {!recoveryMode && !user && panel === 'email' && (
          <>
            <div className="flex rounded-lg bg-surface p-0.5 mb-5">
              <button
                type="button"
                className="flex-1 rounded-md py-2 text-sm font-medium bg-white shadow-sm text-dark"
              >
                Email sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setPanel('phone');
                  setError('');
                }}
                className="flex-1 rounded-md py-2 text-sm font-medium text-muted hover:text-dark transition"
              >
                New shop / SMS
              </button>
            </div>

            <h2 className="font-heading font-semibold text-lg text-dark mb-1 flex items-center gap-2">
              <Mail size={18} className="text-primary" />
              Sign in
            </h2>
            <p className="text-xs text-muted mb-4">
              Use the email and password you set during shop setup. No SMS cost for everyday login.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-dark mb-1" htmlFor="email-login">
                  Email
                </label>
                <input
                  id="email-login"
                  type="email"
                  autoComplete="email"
                  value={emailLogin}
                  onChange={e => setEmailLogin(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-1" htmlFor="password-login">
                  Password
                </label>
                <input
                  id="password-login"
                  type="password"
                  autoComplete="current-password"
                  value={passwordLogin}
                  onChange={e => setPasswordLogin(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setPanel('forgot');
                  setResetEmail(emailLogin);
                  setResetSent(false);
                  setError('');
                }}
                className="text-xs text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">{error}</div>
            )}

            <button
              type="button"
              onClick={signInWithEmail}
              disabled={busy}
              className="mt-5 w-full bg-primary text-white rounded-lg py-2.5 font-medium text-sm hover:bg-primary-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              Sign in
            </button>
          </>
        )}

        {!recoveryMode && panel === 'forgot' && (
          <>
            <button
              type="button"
              onClick={() => {
                setPanel('email');
                setError('');
                setResetSent(false);
              }}
              className="text-xs text-primary hover:underline mb-4"
            >
              ← Back to sign in
            </button>
            <h2 className="font-heading font-semibold text-lg text-dark mb-1 flex items-center gap-2">
              <Lock size={18} className="text-primary" />
              Reset password
            </h2>
            <p className="text-xs text-muted mb-4">
              We will email you a link to set a new password. Use the same email as your shop account.
            </p>
            {resetSent ? (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                Check your inbox for the reset link, then return here to sign in.
              </div>
            ) : (
              <>
                <input
                  type="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                />
                {error && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">{error}</div>
                )}
                <button
                  type="button"
                  onClick={sendResetLink}
                  disabled={busy}
                  className="mt-4 w-full bg-primary text-white rounded-lg py-2.5 font-medium text-sm hover:bg-primary-dark disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {busy && <Loader2 size={16} className="animate-spin" />}
                  Send reset link
                </button>
              </>
            )}
          </>
        )}

        {!recoveryMode && panel === 'phone' && (
          <>
            <div className="flex rounded-lg bg-surface p-0.5 mb-5">
              <button
                type="button"
                onClick={() => {
                  setPanel('email');
                  setError('');
                  setOtpSent(false);
                  setOtp('');
                }}
                className="flex-1 rounded-md py-2 text-sm font-medium text-muted hover:text-dark transition"
              >
                Email sign in
              </button>
              <button
                type="button"
                className="flex-1 rounded-md py-2 text-sm font-medium bg-white shadow-sm text-dark"
              >
                New shop / SMS
              </button>
            </div>

            <h2 className="font-heading font-semibold text-lg text-dark mb-1 flex items-center gap-2">
              <Smartphone size={18} className="text-primary" />
              {otpSent ? 'Enter verification code' : 'Verify your phone'}
            </h2>
            <p className="text-xs text-muted mb-5">
              {otpSent
                ? `We sent an SMS to ${e164}. Enter the code below.`
                : 'For new shops or when you cannot use email. Each SMS may incur a small cost — after setup, sign in with email instead.'}
            </p>

            {!otpSent ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark mb-1" htmlFor="phone">
                    Mobile number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="0803 123 4567"
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark mb-1" htmlFor="otp">
                    6-digit code
                  </label>
                  <input
                    id="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="••••••"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    className={`${inputClass} tracking-widest`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtp('');
                    setError('');
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Use a different number
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">{error}</div>
            )}

            <button
              type="button"
              onClick={otpSent ? verifyOtp : sendOtp}
              disabled={busy}
              className="mt-5 w-full bg-primary text-white rounded-lg py-2.5 font-medium text-sm hover:bg-primary-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {otpSent ? 'Verify & continue' : 'Send code'}
            </button>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

function isValidEmailLoose(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
