import { useState, useEffect, useLayoutEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { Package, Loader2, Mail, Lock } from 'lucide-react';
import { useBusinessProfileQuery } from '@/hooks/useBusinessProfileQuery';
import { useShopAccess } from '@/context/ShopAccessContext';
import { authCallbackUrl } from '@/lib/authSiteUrl';

type Panel = 'signin' | 'signup' | 'forgot';

export default function AuthPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const { status: shopStatus, shopOwnerId } = useShopAccess();
  const q = useBusinessProfileQuery(shopStatus === 'ready' ? shopOwnerId ?? undefined : undefined);

  const [panel, setPanel] = useState<Panel>('signin');
  const [emailLogin, setEmailLogin] = useState('');
  const [passwordLogin, setPasswordLogin] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPassword2, setSignupPassword2] = useState('');
  const [signupMessage, setSignupMessage] = useState<'idle' | 'sent'>('idle');
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  /** Invite links use `type=invite` in the hash; recovery uses `type=recovery`. Read in layout effect before root auth `getSession` consumes the hash. */
  const [passwordSetupKind, setPasswordSetupKind] = useState<'invite' | 'reset' | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw) return;
    const type = new URLSearchParams(raw).get('type');
    if (type === 'invite') {
      setRecoveryMode(true);
      setPasswordSetupKind('invite');
    } else if (type === 'recovery') {
      setRecoveryMode(true);
      setPasswordSetupKind('reset');
    }
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
        setPasswordSetupKind('reset');
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
      setPasswordSetupKind(null);
      setNewPassword('');
      setNewPassword2('');
      setPanel('signin');
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
    if (shopStatus === 'loading' || shopStatus === 'idle') {
      return (
        <div className="flex h-screen items-center justify-center bg-surface text-primary">
          <Loader2 className="animate-spin" size={28} />
        </div>
      );
    }
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
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      setError(formatSignInErrorHint(msg));
    } finally {
      setBusy(false);
    }
  };

  const signUpWithEmail = async () => {
    setError('');
    setSignupMessage('idle');
    const email = signupEmail.trim().toLowerCase();
    if (!email || !isValidEmailLoose(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (signupPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (signupPassword !== signupPassword2) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const redirectTo = authCallbackUrl();
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password: signupPassword,
        options: { emailRedirectTo: redirectTo },
      });
      if (err) throw err;
      if (data.session) {
        /* Email confirmation disabled — already signed in */
        return;
      }
      setSignupMessage('sent');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create account');
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
      const redirectTo = authCallbackUrl();
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (err) throw err;
      setResetSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send reset email');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full border border-border rounded-lg bg-white px-3 py-2.5 text-sm text-dark placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition dark:bg-zinc-900/90 dark:border-zinc-600 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-primary dark:focus:ring-primary/35';

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
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-dark tracking-tight dark:text-zinc-100">VillageStock</h1>
          <p className="text-muted text-sm mt-2 max-w-xs leading-relaxed">Electronics inventory for Computer Village — fast on mobile, ready offline.</p>
        </div>

        <div className="w-full max-w-sm bg-white/95 text-dark backdrop-blur-sm rounded-2xl shadow-xl shadow-slate-900/5 border border-border/70 p-6 md:p-8 dark:bg-zinc-900/95 dark:text-zinc-100 dark:border-zinc-700/80 dark:shadow-black/25 dark:[&_h2]:text-zinc-100 dark:[&_label]:text-zinc-200 dark:[&_strong]:text-zinc-200">
          {recoveryMode && !user && (
            <div className="flex flex-col items-center py-8 text-muted text-sm">
              <Loader2 className="animate-spin mb-3 text-primary" size={28} />
              {passwordSetupKind === 'invite' ? 'Opening invitation link…' : 'Opening reset link…'}
            </div>
          )}

          {recoveryMode && user && (
            <>
              <h2 className="font-heading font-semibold text-lg text-dark mb-1 flex items-center gap-2">
                <Lock size={18} className="text-primary" />
                {passwordSetupKind === 'invite' ? 'Choose your password' : 'Choose a new password'}
              </h2>
              <p className="text-xs text-muted mb-4">
                {passwordSetupKind === 'invite'
                  ? 'Your invite link is valid — set a password you will use to sign in next time (this account has no password until you do).'
                  : 'Your reset link was valid — set a password you will use with your email.'}
              </p>
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
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
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

          {!recoveryMode && !user && panel === 'signin' && (
            <>
              <div className="flex rounded-lg bg-surface p-0.5 mb-5 dark:bg-zinc-800/80">
                <button
                  type="button"
                  className="flex-1 rounded-md py-2 text-sm font-medium bg-white text-dark shadow-sm dark:bg-zinc-700 dark:text-zinc-100 dark:shadow-none dark:ring-1 dark:ring-zinc-600"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPanel('signup');
                    setError('');
                    setSignupMessage('idle');
                  }}
                  className="flex-1 rounded-md py-2 text-sm font-medium text-muted transition hover:text-dark dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Create account
                </button>
              </div>

              <h2 className="font-heading font-semibold text-lg text-dark mb-1 flex items-center gap-2">
                <Mail size={18} className="text-primary" />
                Sign in
              </h2>
              <p className="text-xs text-muted mb-4">
                Use the email and password you used at <strong>Create account</strong>. Password reset only works after an
                account exists for that email (it is separate from shop data in the database).
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
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
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

          {!recoveryMode && !user && panel === 'signup' && (
            <>
              <div className="flex rounded-lg bg-surface p-0.5 mb-5 dark:bg-zinc-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setPanel('signin');
                    setError('');
                  }}
                  className="flex-1 rounded-md py-2 text-sm font-medium text-muted transition hover:text-dark dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-md py-2 text-sm font-medium bg-white text-dark shadow-sm dark:bg-zinc-700 dark:text-zinc-100 dark:shadow-none dark:ring-1 dark:ring-zinc-600"
                >
                  Create account
                </button>
              </div>

              <h2 className="font-heading font-semibold text-lg text-dark mb-1 flex items-center gap-2">
                <Mail size={18} className="text-primary" />
                Create your account
              </h2>
              <p className="text-xs text-muted mb-4">
                This creates your <strong>login</strong> in Supabase Auth (needed for sign-in and password reset). After you
                confirm the email, sign in here and complete shop setup.
              </p>

              {signupMessage === 'sent' ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-900 dark:border-emerald-800/55 dark:bg-emerald-950/45 dark:text-emerald-100">
                    <p className="font-medium">Check your email</p>
                    <p className="mt-1 text-green-800 dark:text-emerald-200/95">
                      Open the confirmation link we sent to <strong>{signupEmail.trim().toLowerCase()}</strong>, then return
                      here and sign in.
                    </p>
                    <p className="mt-2 text-xs text-green-800/90 dark:text-emerald-300/85">
                      No email? Check spam, and confirm Supabase can send mail (Auth → SMTP). Links must match your site URL
                      in Supabase → URL Configuration.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPanel('signin');
                      setSignupMessage('idle');
                      setEmailLogin(signupEmail.trim().toLowerCase());
                      setSignupEmail('');
                      setSignupPassword('');
                      setSignupPassword2('');
                    }}
                    className="w-full text-sm text-primary hover:underline"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-dark mb-1" htmlFor="signup-email">
                        Email
                      </label>
                      <input
                        id="signup-email"
                        type="email"
                        autoComplete="email"
                        value={signupEmail}
                        onChange={e => setSignupEmail(e.target.value)}
                        className={inputClass}
                        placeholder="you@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dark mb-1" htmlFor="signup-password">
                        Password
                      </label>
                      <input
                        id="signup-password"
                        type="password"
                        autoComplete="new-password"
                        value={signupPassword}
                        onChange={e => setSignupPassword(e.target.value)}
                        className={inputClass}
                        placeholder="At least 8 characters"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dark mb-1" htmlFor="signup-password-2">
                        Confirm password
                      </label>
                      <input
                        id="signup-password-2"
                        type="password"
                        autoComplete="new-password"
                        value={signupPassword2}
                        onChange={e => setSignupPassword2(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  {error && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
                  )}
                  <button
                    type="button"
                    onClick={signUpWithEmail}
                    disabled={busy}
                    className="mt-4 w-full bg-primary text-white rounded-lg py-2.5 font-medium text-sm hover:bg-primary-dark disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {busy && <Loader2 size={16} className="animate-spin" />}
                    Create account
                  </button>
                </>
              )}
            </>
          )}

          {!recoveryMode && panel === 'forgot' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setPanel('signin');
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
              <p className="text-xs text-muted mb-3">
                We email a link only if there is already a <strong>login account</strong> for that address (Supabase
                Authentication). Shop profiles in your app database do not count — you must have used{' '}
                <strong>Create account</strong> (or had an admin create the user) first.
              </p>
              {resetSent ? (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-900 dark:border-emerald-800/55 dark:bg-emerald-950/45 dark:text-emerald-100">
                  <p className="font-medium">If that login exists, we sent a link</p>
                  <p className="mt-1 text-green-800 dark:text-emerald-200/95">
                    Check <strong>{resetEmail.trim().toLowerCase()}</strong> (and spam). The link expires after a short time.
                  </p>
                  <p className="mt-2 text-xs text-green-800/90 dark:text-emerald-300/85">
                    <strong>No email after a few minutes?</strong> Usually there is no Auth user for that address yet. Use{' '}
                    <strong>Create account</strong> with the same email instead of reset.
                  </p>
                  <p className="mt-2 text-xs text-green-800/90 dark:text-emerald-300/85">
                    Project checks: Supabase → Authentication → URL Configuration (redirects) and SMTP so mail can send.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSignupEmail(resetEmail.trim().toLowerCase());
                      setPanel('signup');
                      setResetSent(false);
                      setSignupMessage('idle');
                      setError('');
                    }}
                    className="mt-3 w-full rounded-lg border border-green-300 bg-white px-3 py-2 text-sm font-medium text-green-900 transition hover:bg-green-100/80 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100 dark:hover:bg-emerald-900/65"
                  >
                    Create account with this email
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/50 dark:text-amber-100">
                    New to VillageStock?{' '}
                    <button
                      type="button"
                      className="font-semibold text-primary underline-offset-2 hover:underline"
                      onClick={() => {
                        setSignupEmail(resetEmail.trim().toLowerCase());
                        setPanel('signup');
                        setError('');
                      }}
                    >
                      Create account
                    </button>{' '}
                    first — then you can use forgot password later if needed.
                  </div>
                  <input
                    type="email"
                    autoComplete="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    className={inputClass}
                    placeholder="you@example.com"
                  />
                  {error && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
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
        </div>
      </div>
    </div>
  );
}

function isValidEmailLoose(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** Adds operator-friendly hint when credentials fail (often no Auth user yet). */
function formatSignInErrorHint(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid credentials') ||
    lower.includes('email not confirmed')
  ) {
    return `${message} If you never used Create account with this email, sign up first — shop profile data alone does not create a login.`;
  }
  return message;
}
