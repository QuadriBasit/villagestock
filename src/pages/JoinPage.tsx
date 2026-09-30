import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Loader2, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useBusinessProfileQuery } from '@/hooks/useBusinessProfileQuery';
import { authCallbackUrl } from '@/lib/authSiteUrl';
import { signOutApp } from '@/lib/signOutApp';
import {
  captureStaffInviteFromLocation,
  isStaffInviteToken,
  readStaffInviteToken,
  staffInviteTokenFromSearch,
} from '@/lib/staffInviteToken';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import { AuroraBackground } from '@/components/landing/AuroraBackground';
import '@/components/landing/landing.css';
import '@/components/auth/auth-page.css';

type Peek = {
  shop_name: string;
  invited_email: string;
  display_name: string;
  is_open: boolean;
};

export default function JoinPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const { status: shopStatus, shopOwnerId, isOwner } = useShopAccess();
  const q = useBusinessProfileQuery(shopStatus === 'ready' ? shopOwnerId ?? undefined : undefined);

  const token = captureStaffInviteFromLocation();
  const [peek, setPeek] = useState<Peek | null>(null);
  const [peekStatus, setPeekStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [firstTime, setFirstTime] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token || !isStaffInviteToken(token)) {
      setPeekStatus('missing');
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error: peekErr } = await supabase.rpc('peek_staff_invite', { p_token: token });
      if (cancelled) return;
      if (peekErr) {
        setPeekStatus('missing');
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row !== 'object') {
        setPeekStatus('missing');
        return;
      }
      const invited = String((row as Peek).invited_email ?? '').trim();
      const open = (row as Peek).is_open === true;
      if (!invited || !open) {
        setPeekStatus('missing');
        return;
      }
      setPeek({
        shop_name: String((row as Peek).shop_name || 'a VillageStock shop'),
        invited_email: invited,
        display_name: String((row as Peek).display_name || invited),
        is_open: true,
      });
      setEmail(invited);
      setPeekStatus('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const joinedExistingShop = Boolean(user && shopOwnerId && (shopOwnerId !== user.id || !isOwner));

  if (authLoading || (user && (shopStatus === 'loading' || shopStatus === 'idle'))) {
    return <JoinSpinner />;
  }
  if (joinedExistingShop) return <Navigate to="/dashboard" replace />;
  if (user && q.status === 'pending') return <JoinSpinner />;
  if (user && q.status === 'ready' && q.profile?.onboarding_complete && !staffInviteTokenFromSearch()) {
    return <Navigate to="/dashboard" replace />;
  }

  const signedInEmail = user?.email?.trim().toLowerCase() ?? '';
  const invitedEmail = peek?.invited_email.trim().toLowerCase() ?? '';
  const emailMismatch = Boolean(user && invitedEmail && signedInEmail && signedInEmail !== invitedEmail);

  const signInWithGoogle = async () => {
    setError('');
    setBusy(true);
    try {
      const stored = readStaffInviteToken();
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: stored ? `${authCallbackUrl()}?invite=${encodeURIComponent(stored)}` : authCallbackUrl(),
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
    const value = email.trim().toLowerCase();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Enter a valid email address.');
      return;
    }
    if (invitedEmail && value !== invitedEmail) {
      setError(`This invite is for ${peek?.invited_email}. Use that address.`);
      return;
    }
    if (password.length < 6) {
      setError('Enter your password.');
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: value, password });
      if (err) throw err;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  const createLogin = async () => {
    setError('');
    const value = email.trim().toLowerCase();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Enter a valid email address.');
      return;
    }
    if (invitedEmail && value !== invitedEmail) {
      setError(`This invite is for ${peek?.invited_email}. Use that address.`);
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== password2) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const stored = readStaffInviteToken();
      const { data, error: err } = await supabase.auth.signUp({
        email: value,
        password,
        options: {
          emailRedirectTo: stored
            ? `${authCallbackUrl()}?invite=${encodeURIComponent(stored)}`
            : authCallbackUrl(),
        },
      });
      if (err) throw err;
      if (!data.session) {
        setError('Check your email to confirm this login, then return here to join the shop.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create login');
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
            Join this shop.
            <br />
            <em>Do not start a new one.</em>
          </h1>
          <p className="vs-auth-lead">
            You were invited as a teammate. Sign in with the invited email and you will be added to
            the existing shop.
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
          </div>

          {peekStatus === 'loading' ? <JoinSpinner /> : null}

          {peekStatus === 'missing' ? (
            <div className="vs-auth-error">
              <p className="font-semibold">This invite link is not valid</p>
              <p className="mt-1">Ask the shop owner to send a new invitation. Old links stop working after they resend.</p>
              <Button type="button" className="vs-auth-btn-primary mt-4 w-full" asChild>
                <Link to="/auth">Go to sign in</Link>
              </Button>
            </div>
          ) : null}

          {peekStatus === 'ready' && peek ? (
            <>
              <div className="vs-auth-success" style={{ marginBottom: 16 }}>
                <p className="font-semibold">Join {peek.shop_name}</p>
                <p className="mt-1">
                  This invite is for <strong>{peek.invited_email}</strong>
                  {peek.display_name && peek.display_name !== peek.invited_email
                    ? ` (${peek.display_name})`
                    : ''}
                  . You are joining this shop — you are not registering a business.
                </p>
              </div>

              {emailMismatch ? (
                <>
                  <div className="vs-auth-error">
                    This invite is for <strong>{peek.invited_email}</strong>. You are signed in as{' '}
                    <strong>{user?.email}</strong>. Sign out and use the invited address.
                  </div>
                  <Button
                    type="button"
                    className="vs-auth-btn-primary mt-4 w-full"
                    disabled={busy}
                    onClick={() => void signOutApp()}
                  >
                    Sign out and try again
                  </Button>
                </>
              ) : null}

              {!user && !emailMismatch ? (
                <>
                  <Button
                    type="button"
                    className="vs-auth-btn-google w-full"
                    disabled={busy}
                    onClick={() => void signInWithGoogle()}
                  >
                    {busy ? <Loader2 className="size-5 shrink-0 animate-spin" /> : <GoogleLogo />}
                    Continue with Google
                  </Button>
                  <p className="vs-auth-hint">Use the Google account for {peek.invited_email}.</p>
                  <div className="vs-auth-divider">Or email</div>
                  <div className="space-y-3">
                    <Input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="vs-auth-field"
                      placeholder={peek.invited_email}
                    />
                    <PasswordInput
                      autoComplete={firstTime ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="vs-auth-field"
                      placeholder={firstTime ? 'At least 8 characters' : 'Password'}
                    />
                    {firstTime ? (
                      <PasswordInput
                        autoComplete="new-password"
                        value={password2}
                        onChange={e => setPassword2(e.target.value)}
                        className="vs-auth-field"
                        placeholder="Confirm password"
                      />
                    ) : null}
                  </div>
                  {error ? <div className="vs-auth-error mt-3">{error}</div> : null}
                  <Button
                    type="button"
                    className="vs-auth-btn-primary mt-4 w-full"
                    disabled={busy}
                    onClick={() => void (firstTime ? createLogin() : signInWithEmail())}
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                    {firstTime ? 'Set up login & join shop' : 'Join this shop'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="vs-auth-btn-ghost mt-2 w-full"
                    onClick={() => {
                      setFirstTime(v => !v);
                      setError('');
                    }}
                  >
                    {firstTime ? 'I already have a login' : 'First time here? Set a password'}
                  </Button>
                </>
              ) : null}

              {user && !emailMismatch && shopStatus !== 'ready' ? (
                <div className="flex flex-col items-center py-8 text-sm" style={{ color: 'var(--auth-muted)' }}>
                  <Loader2 className="mb-3 animate-spin" size={28} style={{ color: 'var(--auth-accent)' }} />
                  Joining {peek.shop_name}…
                </div>
              ) : null}

              {user && !emailMismatch && shopStatus === 'ready' && !joinedExistingShop ? (
                <>
                  <div className="vs-auth-error">
                    Could not add you to {peek.shop_name}. Ask the owner to send a new invite, then
                    open the latest mail.
                  </div>
                  <Button
                    type="button"
                    className="vs-auth-btn-primary mt-4 w-full"
                    onClick={() => void signOutApp()}
                  >
                    Sign out
                  </Button>
                </>
              ) : null}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function JoinSpinner() {
  return (
    <div className="vs-auth-loading">
      <Loader2 className="animate-spin" size={28} />
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg className="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
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
