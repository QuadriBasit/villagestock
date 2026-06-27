import { useState, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { Check, Loader2, Lock, Package, WifiOff, Zap } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useBusinessProfileQuery } from '@/hooks/useBusinessProfileQuery';
import { useShopAccess } from '@/context/ShopAccessContext';
import { authCallbackUrl } from '@/lib/authSiteUrl';
import { AuroraBackground } from '@/components/landing/AuroraBackground';
import '@/components/landing/landing.css';
import '@/components/auth/auth-page.css';

type Panel = 'signin' | 'signup' | 'forgot';

const FIELD = 'vs-auth-field';

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
    const { data: sub } = supabase.auth.onAuthStateChange(event => {
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

  if (authLoading) return <AuthSpinner />;

  if (user && !recoveryMode) {
    if (shopStatus === 'loading' || shopStatus === 'idle') return <AuthSpinner />;
    if (q.status === 'pending') return <AuthSpinner />;
    if (q.profile?.onboarding_complete) return <Navigate to="/dashboard" replace />;
    return <Navigate to="/onboarding" replace />;
  }

  const signInWithGoogle = async () => {
    setError('');
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: authCallbackUrl(),
          queryParams: { prompt: 'select_account' },
        },
      });
      if (err) throw err;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
      setBusy(false);
    }
  };

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
      setError(formatSignInErrorHint(err instanceof Error ? err.message : 'Sign in failed'));
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
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password: signupPassword,
        options: { emailRedirectTo: authCallbackUrl() },
      });
      if (err) throw err;
      if (data.session) return;
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
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: authCallbackUrl(),
      });
      if (err) throw err;
      setResetSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send reset email');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vs-auth-page">
      <AuroraBackground />

      <div className="vs-auth-shell">
        <aside className="vs-auth-brand">
          <Link to="/" className="vs-auth-logo">
            <span className="vs-auth-logo-mark">
              <Package size={20} strokeWidth={2.2} />
            </span>
            village<span>stock</span>
          </Link>

          <h1 className="vs-auth-headline">
            Run your shop
            <br />
            <em>from one place.</em>
          </h1>

          <p className="vs-auth-lead">
            Inventory, sales, repairs, and credits — built for gadget retailers in Computer Village and
            beyond. Works offline, syncs when you&apos;re back online.
          </p>

          <ul className="vs-auth-features">
            <li>
              <Check size={16} strokeWidth={2.5} />
              IMEI-tracked phones &amp; serialized stock
            </li>
            <li>
              <WifiOff size={16} strokeWidth={2.2} />
              Full offline mode — no signal needed
            </li>
            <li>
              <Zap size={16} strokeWidth={2.2} />
              Quick till, repairs bench &amp; daily cash-up
            </li>
          </ul>

          <p className="vs-auth-trust">
            <strong>14-day free trial</strong> · no card required · cancel anytime
          </p>
        </aside>

        <main className="vs-auth-card">
          <div className="vs-auth-mobile-brand">
            <Link to="/" className="vs-auth-logo">
              <span className="vs-auth-logo-mark">
                <Package size={18} strokeWidth={2.2} />
              </span>
              village<span>stock</span>
            </Link>
            <p className="vs-auth-panel-sub" style={{ marginBottom: 0 }}>
              Sign in to your shop dashboard
            </p>
          </div>

          {recoveryMode && !user && (
            <div className="flex flex-col items-center py-10 text-sm" style={{ color: 'var(--auth-muted)' }}>
              <Loader2 className="mb-3 animate-spin" size={28} style={{ color: 'var(--auth-accent)' }} />
              {passwordSetupKind === 'invite' ? 'Opening invitation link…' : 'Opening reset link…'}
            </div>
          )}

          {recoveryMode && user && (
            <>
              <h2 className="vs-auth-panel-title">
                <Lock size={18} style={{ color: 'var(--auth-accent)' }} />
                {passwordSetupKind === 'invite' ? 'Choose your password' : 'Set a new password'}
              </h2>
              <p className="vs-auth-panel-sub">
                {passwordSetupKind === 'invite'
                  ? 'Your invite link is valid — pick a password for next time you sign in.'
                  : 'Your reset link worked — choose a new password for this account.'}
              </p>
              <div className="space-y-3">
                <PasswordInput
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className={FIELD}
                  placeholder="New password"
                />
                <PasswordInput
                  autoComplete="new-password"
                  value={newPassword2}
                  onChange={e => setNewPassword2(e.target.value)}
                  className={FIELD}
                  placeholder="Confirm password"
                />
              </div>
              {error ? <AuthError>{error}</AuthError> : null}
              <button
                type="button"
                onClick={() => void completePasswordRecovery()}
                disabled={busy}
                className="vs-auth-btn-primary mt-4"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                Save password &amp; continue
              </button>
            </>
          )}

          {!recoveryMode && !user && panel !== 'forgot' && (
            <>
              <AuthTabs
                panel={panel}
                onSignIn={() => {
                  setPanel('signin');
                  setError('');
                }}
                onSignUp={() => {
                  setPanel('signup');
                  setError('');
                  setSignupMessage('idle');
                }}
              />

              <GoogleButton busy={busy} onClick={() => void signInWithGoogle()} />
              <p className="vs-auth-hint">
                {panel === 'signup'
                  ? 'New shops are created on first Google sign-in.'
                  : 'Fastest way in — uses your Google account.'}
              </p>

              <AuthDivider label={panel === 'signup' ? 'Or sign up with email' : 'Or use email'} />

              {panel === 'signin' ? (
                <>
                  <div className="space-y-3">
                    <AuthField label="Email" id="email-login">
                      <Input
                        id="email-login"
                        type="email"
                        autoComplete="email"
                        value={emailLogin}
                        onChange={e => setEmailLogin(e.target.value)}
                        className={FIELD}
                        placeholder="you@shop.com"
                      />
                    </AuthField>
                    <AuthField label="Password" id="password-login">
                      <PasswordInput
                        id="password-login"
                        autoComplete="current-password"
                        value={passwordLogin}
                        onChange={e => setPasswordLogin(e.target.value)}
                        className={FIELD}
                      />
                    </AuthField>
                    <button
                      type="button"
                      className="vs-auth-btn-ghost"
                      onClick={() => {
                        setPanel('forgot');
                        setResetEmail(emailLogin);
                        setResetSent(false);
                        setError('');
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  {error ? <AuthError>{error}</AuthError> : null}
                  <button
                    type="button"
                    onClick={() => void signInWithEmail()}
                    disabled={busy}
                    className="vs-auth-btn-primary mt-5"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                    Sign in
                  </button>
                </>
              ) : signupMessage === 'sent' ? (
                <div className="space-y-3">
                  <div className="vs-auth-success">
                    <p className="font-semibold">Check your email</p>
                    <p className="mt-1">
                      We sent a confirmation link to <strong>{signupEmail.trim().toLowerCase()}</strong>.
                      Open it, then sign in here.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="vs-auth-btn-ghost w-full text-center"
                    onClick={() => {
                      setPanel('signin');
                      setSignupMessage('idle');
                      setEmailLogin(signupEmail.trim().toLowerCase());
                      setSignupEmail('');
                      setSignupPassword('');
                      setSignupPassword2('');
                    }}
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <AuthField label="Email" id="signup-email">
                      <Input
                        id="signup-email"
                        type="email"
                        autoComplete="email"
                        value={signupEmail}
                        onChange={e => setSignupEmail(e.target.value)}
                        className={FIELD}
                        placeholder="you@shop.com"
                      />
                    </AuthField>
                    <AuthField label="Password" id="signup-password">
                      <PasswordInput
                        id="signup-password"
                        autoComplete="new-password"
                        value={signupPassword}
                        onChange={e => setSignupPassword(e.target.value)}
                        className={FIELD}
                        placeholder="At least 8 characters"
                      />
                    </AuthField>
                    <AuthField label="Confirm password" id="signup-password-2">
                      <PasswordInput
                        id="signup-password-2"
                        autoComplete="new-password"
                        value={signupPassword2}
                        onChange={e => setSignupPassword2(e.target.value)}
                        className={FIELD}
                      />
                    </AuthField>
                  </div>
                  {error ? <AuthError>{error}</AuthError> : null}
                  <button
                    type="button"
                    onClick={() => void signUpWithEmail()}
                    disabled={busy}
                    className="vs-auth-btn-primary mt-4"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                    Create account
                  </button>
                </>
              )}
            </>
          )}

          {!recoveryMode && !user && panel === 'forgot' && (
            <>
              <button
                type="button"
                className="vs-auth-btn-ghost vs-auth-back"
                onClick={() => {
                  setPanel('signin');
                  setError('');
                  setResetSent(false);
                }}
              >
                ← Back to sign in
              </button>
              <h2 className="vs-auth-panel-title">
                <Lock size={18} style={{ color: 'var(--auth-accent)' }} />
                Reset password
              </h2>
              <p className="vs-auth-panel-sub">
                We&apos;ll email a reset link if an account exists for that address. No account yet?{' '}
                <button
                  type="button"
                  className="vs-auth-btn-ghost"
                  onClick={() => {
                    setSignupEmail(resetEmail.trim().toLowerCase());
                    setPanel('signup');
                    setError('');
                  }}
                >
                  Create one
                </button>{' '}
                instead.
              </p>

              {resetSent ? (
                <div className="space-y-3">
                  <div className="vs-auth-success">
                    <p className="font-semibold">Check your inbox</p>
                    <p className="mt-1">
                      If <strong>{resetEmail.trim().toLowerCase()}</strong> has an account, a reset link
                      is on its way (check spam too).
                    </p>
                  </div>
                  <button
                    type="button"
                    className="vs-auth-btn-primary"
                    onClick={() => {
                      setSignupEmail(resetEmail.trim().toLowerCase());
                      setPanel('signup');
                      setResetSent(false);
                      setSignupMessage('idle');
                      setError('');
                    }}
                  >
                    Create account with this email
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    type="email"
                    autoComplete="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    className={FIELD}
                    placeholder="you@shop.com"
                  />
                  {error ? <AuthError>{error}</AuthError> : null}
                  <button
                    type="button"
                    onClick={() => void sendResetLink()}
                    disabled={busy}
                    className="vs-auth-btn-primary mt-4"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                    Send reset link
                  </button>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function AuthSpinner() {
  return (
    <div className="vs-auth-loading">
      <Loader2 className="animate-spin" size={28} />
    </div>
  );
}

function AuthTabs({
  panel,
  onSignIn,
  onSignUp,
}: {
  panel: Panel;
  onSignIn: () => void;
  onSignUp: () => void;
}) {
  return (
    <div className="vs-auth-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={panel === 'signin'}
        className={`vs-auth-tab${panel === 'signin' ? ' is-active' : ''}`}
        onClick={onSignIn}
      >
        Sign in
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={panel === 'signup'}
        className={`vs-auth-tab${panel === 'signup' ? ' is-active' : ''}`}
        onClick={onSignUp}
      >
        Create account
      </button>
    </div>
  );
}

function GoogleButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className="vs-auth-btn-google">
      {busy ? <Loader2 className="size-5 shrink-0 animate-spin" /> : <GoogleLogo className="size-5 shrink-0" />}
      Continue with Google
    </button>
  );
}

function AuthDivider({ label }: { label: string }) {
  return <div className="vs-auth-divider">{label}</div>;
}

function AuthField({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div>
      <label className="vs-auth-label" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

function AuthError({ children }: { children: ReactNode }) {
  return <div className="vs-auth-error">{children}</div>;
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function isValidEmailLoose(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function formatSignInErrorHint(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid credentials') ||
    lower.includes('email not confirmed')
  ) {
    return `${message} If you never created an account with this email, use Create account first.`;
  }
  return message;
}
