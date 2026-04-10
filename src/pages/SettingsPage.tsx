import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useShopProfile } from '@/hooks/useShopProfile';
import { useBusinessProfile } from '@/hooks/useBusinessProfile';
import { useAuthStore } from '@/store/auth';
import PlanPickerGrid from '@/components/billing/PlanPickerGrid';
import type { BusinessPlan } from '@/types';
import { signOutApp } from '@/lib/signOutApp';
import {
  Store,
  Phone,
  MapPin,
  Camera,
  Loader2,
  CheckCircle,
  LogOut,
  FileBarChart2,
  ChevronRight,
  CreditCard,
  Sun,
  Moon,
  Laptop,
  Users,
} from 'lucide-react';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useTheme, type ThemeMode } from '@/components/theme/ThemeProvider';
import { useState, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ShopProfile } from '@/types';

const schema = z.object({
  shop_name: z.string().min(1, 'Shop name is required'),
  address: z.string().optional().transform(v => v ?? ''),
  phone: z.string().optional().transform(v => v ?? ''),
});
type FormData = z.infer<typeof schema>;

function formatPlanLabel(plan: BusinessPlan): string {
  const map: Record<BusinessPlan, string> = {
    trial: 'Trial',
    starter: 'Starter',
    pro: 'Pro',
    business: 'Business',
  };
  return map[plan];
}

function formatPlanStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const panelClass =
  'rounded-2xl border border-zinc-200/80 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/75';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { role, canManageBusinessSettings } = useShopAccess();
  const team = useTeamMembers();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [memberRole, setMemberRole] = useState<'manager' | 'staff'>('staff');
  const [addExistingEmail, setAddExistingEmail] = useState('');
  const [addExistingUserId, setAddExistingUserId] = useState('');
  const [addExistingDisplayName, setAddExistingDisplayName] = useState('');
  const [addExistingRole, setAddExistingRole] = useState<'manager' | 'staff'>('staff');
  const [teamSubmitting, setTeamSubmitting] = useState(false);
  const [teamMessage, setTeamMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const { mode, setMode } = useTheme();
  const { profile, isLoading, saveProfile } = useShopProfile();
  const { profile: businessProfile, isLoading: isBizLoading } = useBusinessProfile();
  const { user } = useAuthStore();
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    values: {
      shop_name: profile.shop_name,
      address: profile.address,
      phone: profile.phone,
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setLogoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: FormData) => {
    const updated: ShopProfile = {
      shop_name: data.shop_name,
      address: data.address,
      phone: data.phone,
      logo_data_url: logoUrl ?? profile.logo_data_url,
    };
    await saveProfile(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSignOut = () => void signOutApp();

  const fieldClass =
    'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-100';
  const labelClass = 'mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200';

  if (isLoading || isBizLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const trialEndReal =
    businessProfile?.trial_end_date &&
    !businessProfile.trial_end_date.startsWith('1970-01-01');
  const trialEndLabel = trialEndReal
    ? new Date(businessProfile!.trial_end_date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const currentLogo = logoUrl ?? profile.logo_data_url;

  const themeChoices: { id: ThemeMode; label: string; icon: ReactNode }[] = [
    { id: 'light', label: 'Light', icon: <Sun size={16} /> },
    { id: 'dark', label: 'Dark', icon: <Moon size={16} /> },
    { id: 'system', label: 'System', icon: <Laptop size={16} /> },
  ];

  const ownerName = businessProfile?.owner_name?.trim();
  const accountPrimary = ownerName || user?.phone || user?.email || '—';
  const accountShowEmail = Boolean(user?.email && accountPrimary !== user.email);
  const accountShowPhone = Boolean(user?.phone && accountPrimary !== user.phone);

  return (
    <div className="app-page space-y-4 py-4 md:space-y-4 md:py-6">
      <section className={`${panelClass} space-y-3`}>
        <h3 className="font-heading text-sm font-semibold text-zinc-900 dark:text-zinc-100">Appearance</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Uses the header toggle for a quick switch; set default here.</p>
        <div className="grid grid-cols-3 gap-2">
          {themeChoices.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold transition-colors ${
                mode === id
                  ? 'border-primary bg-primary/10 text-primary dark:bg-primary/15 dark:text-blue-300'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-300'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Shop Profile */}
      <section className={`${panelClass} space-y-3`}>
        <div className="mb-0.5 flex items-center gap-2">
          <Store size={18} className="text-primary" />
          <h3 className="font-heading font-semibold text-zinc-900 dark:text-zinc-100">Shop Profile</h3>
        </div>
        <p className="-mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          This information appears on every receipt you generate.
        </p>

        {/* Logo picker */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 transition-colors hover:border-primary dark:border-zinc-600 dark:bg-zinc-950/50"
          >
            {currentLogo ? (
              <img src={currentLogo} alt="Shop logo" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <Camera size={22} className="text-zinc-400" />
            )}
          </button>
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Shop Logo</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Tap to upload (optional)</p>
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="text-xs text-primary mt-1 hover:underline"
            >
              {currentLogo ? 'Change logo' : 'Upload logo'}
            </button>
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="shop_name">
              <Store size={13} className="mr-1 inline text-zinc-400" />
              Shop Name *
            </label>
            <input
              id="shop_name"
              {...register('shop_name')}
              placeholder="e.g. Basit Electronics"
              className={fieldClass}
            />
            {errors.shop_name && (
              <p className="text-red-500 text-xs mt-1">{errors.shop_name.message}</p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="address">
              <MapPin size={13} className="mr-1 inline text-zinc-400" />
              Shop Address
            </label>
            <input
              id="address"
              {...register('address')}
              placeholder="e.g. Shop 14, Computer Village, Ikeja"
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="phone">
              <Phone size={13} className="mr-1 inline text-zinc-400" />
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              {...register('phone')}
              placeholder="e.g. 08012345678"
              className={fieldClass}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-white rounded-xl py-3 font-heading font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : saved ? (
              <><CheckCircle size={16} /> Saved!</>
            ) : (
              'Save Shop Profile'
            )}
          </button>
        </form>
      </section>

      <section className={`${panelClass} space-y-3`}>
        <div className="flex items-center gap-2">
          <Users size={18} className="text-primary" />
          <h3 className="font-heading font-semibold text-zinc-900 dark:text-zinc-100">Team &amp; roles</h3>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Your role:{' '}
          <span className="font-semibold capitalize text-zinc-900 dark:text-zinc-100">{role}</span>
        </p>
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          <strong className="text-zinc-700 dark:text-zinc-300">Staff</strong> can sell and manage stock but not profit,
          credits, reports, or billing. <strong className="text-zinc-700 dark:text-zinc-300">Managers</strong> have
          wider access, including inviting staff. Only the <strong className="text-zinc-700 dark:text-zinc-300">owner</strong>{' '}
          can remove people from the shop.
        </p>

        {canManageBusinessSettings ? (
          <>
            {team.error ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                Team list: {team.error}. If you just added this feature, run the latest SQL migration for{' '}
                <code className="text-[10px]">business_members</code> RLS (manager can view team) in Supabase.
              </p>
            ) : null}

            <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-950/40">
              <div>
                <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">Email invite (recommended)</p>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  We email them a secure link to <strong className="text-zinc-600 dark:text-zinc-300">choose a password</strong>
                  . After they sign in with that email, they are attached to <strong className="text-zinc-600 dark:text-zinc-300">this shop</strong> automatically — they do not go through owner onboarding.
                </p>
              </div>
              <div>
                <label className={labelClass} htmlFor="invite-email">
                  Their email
                </label>
                <input
                  id="invite-email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="name@example.com"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="invite-display">
                  Name on receipts (optional)
                </label>
                <input
                  id="invite-display"
                  type="text"
                  value={inviteDisplayName}
                  onChange={e => setInviteDisplayName(e.target.value)}
                  placeholder="e.g. Ada — front desk"
                  className={fieldClass}
                  autoComplete="off"
                />
              </div>
              <div>
                <p className={`${labelClass} mb-2`}>Role</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'staff' as const, title: 'Staff', hint: 'Sales & stock' },
                      { id: 'manager' as const, title: 'Manager', hint: 'Staff + reports & invites' },
                    ]
                  ).map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMemberRole(opt.id)}
                      className={`rounded-xl border px-3 py-2.5 text-left text-xs transition-colors ${
                        memberRole === opt.id
                          ? 'border-primary bg-primary/10 text-primary dark:bg-primary/15 dark:text-blue-300'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950/50 dark:text-zinc-200 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <span className="block font-semibold">{opt.title}</span>
                      <span className="mt-0.5 block text-[10px] text-zinc-500 dark:text-zinc-400">{opt.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              {teamMessage ? (
                <p
                  className={`text-xs ${teamMessage.type === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {teamMessage.text}
                </p>
              ) : null}
              <button
                type="button"
                disabled={teamSubmitting || !inviteEmail.trim()}
                onClick={async () => {
                  setTeamMessage(null);
                  setTeamSubmitting(true);
                  try {
                    await team.inviteStaff({
                      email: inviteEmail.trim(),
                      role: memberRole,
                      displayName: inviteDisplayName,
                    });
                    setInviteEmail('');
                    setInviteDisplayName('');
                    setTeamMessage({
                      type: 'ok',
                      text: 'Invitation sent. They should open the email, set a password, then sign in here.',
                    });
                  } catch (e) {
                    setTeamMessage({ type: 'err', text: e instanceof Error ? e.message : 'Could not send invite' });
                  } finally {
                    setTeamSubmitting(false);
                  }
                }}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {teamSubmitting ? 'Sending…' : 'Send invitation email'}
              </button>

              <details className="rounded-lg border border-zinc-200 bg-white/60 dark:border-zinc-700 dark:bg-zinc-950/30">
                <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                  They already have a VillageStock account?
                </summary>
                <div className="space-y-2 border-t border-zinc-200 px-3 py-3 dark:border-zinc-700">
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-500">
                    Add them by the email they use to sign in, or paste their Auth user UUID if they have no email on file.
                  </p>
                  <input
                    type="email"
                    value={addExistingEmail}
                    onChange={e => setAddExistingEmail(e.target.value)}
                    placeholder="Their login email"
                    className={fieldClass}
                    autoComplete="off"
                  />
                  <input
                    type="text"
                    value={addExistingUserId}
                    onChange={e => setAddExistingUserId(e.target.value)}
                    placeholder="Or user UUID (advanced)"
                    className={fieldClass}
                    autoComplete="off"
                  />
                  <input
                    type="text"
                    value={addExistingDisplayName}
                    onChange={e => setAddExistingDisplayName(e.target.value)}
                    placeholder="Name on receipts (optional)"
                    className={fieldClass}
                    autoComplete="off"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {(['staff', 'manager'] as const).map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setAddExistingRole(r)}
                        className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium capitalize ${
                          addExistingRole === r
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-zinc-200 bg-white dark:border-zinc-600 dark:bg-zinc-900'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={teamSubmitting || (!addExistingEmail.trim() && !addExistingUserId.trim())}
                    onClick={async () => {
                      setTeamMessage(null);
                      setTeamSubmitting(true);
                      try {
                        await team.addMember({
                          memberEmail: addExistingEmail.trim() || undefined,
                          memberUserId: addExistingUserId.trim() || undefined,
                          role: addExistingRole,
                          displayName: addExistingDisplayName,
                        });
                        setAddExistingEmail('');
                        setAddExistingUserId('');
                        setAddExistingDisplayName('');
                        setTeamMessage({ type: 'ok', text: 'Teammate added to this shop.' });
                      } catch (e) {
                        setTeamMessage({ type: 'err', text: e instanceof Error ? e.message : 'Failed to add' });
                      } finally {
                        setTeamSubmitting(false);
                      }
                    }}
                    className="w-full rounded-lg border border-zinc-300 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Add existing account to shop
                  </button>
                </div>
              </details>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">People</p>
              {team.loading ? (
                <p className="text-xs text-zinc-500">Loading…</p>
              ) : team.members.length === 0 ? (
                <p className="text-xs text-zinc-500">No rows returned. Check RLS or run migrations.</p>
              ) : (
                <ul className="space-y-2">
                  {team.members.map(m => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900/60"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {m.display_name?.trim() || (m.role === 'owner' ? 'Owner' : 'Team member')}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                              m.role === 'owner'
                                ? 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200'
                                : m.role === 'manager'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200'
                                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                            }`}
                          >
                            {m.role}
                          </span>
                        </div>
                      </div>
                      {role === 'owner' && m.role !== 'owner' ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm('Remove this person from the shop?')) return;
                            setTeamMessage(null);
                            try {
                              await team.removeMember(m);
                              setTeamMessage({ type: 'ok', text: 'Member removed.' });
                            } catch (e) {
                              setTeamMessage({
                                type: 'err',
                                text: e instanceof Error ? e.message : 'Could not remove',
                              });
                            }
                          }}
                          className="shrink-0 rounded-lg border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          Remove
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Team management is available to owners and managers.</p>
        )}
      </section>

      <section className={`${panelClass} space-y-3`}>
        <div className="flex items-center gap-2">
          <CreditCard size={18} className="text-primary" />
          <h3 className="font-heading font-semibold text-zinc-900 dark:text-zinc-100">Subscription</h3>
        </div>
        {businessProfile ? (
          <div className="space-y-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-950/40">
            <p>
              <span className="text-zinc-500 dark:text-zinc-400">Current plan:</span>{' '}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatPlanLabel(businessProfile.plan)}</span>
            </p>
            <p>
              <span className="text-zinc-500 dark:text-zinc-400">Status:</span>{' '}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatPlanStatus(businessProfile.plan_status)}</span>
            </p>
            {businessProfile.plan === 'trial' && trialEndLabel ? (
              <p>
                <span className="text-zinc-500 dark:text-zinc-400">Trial ends:</span>{' '}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{trialEndLabel}</span>
              </p>
            ) : null}
          </div>
        ) : null}
        <div>
          <p className="mb-2 text-xs font-medium text-zinc-900 dark:text-zinc-100">Compare plans</p>
          <PlanPickerGrid variant="compact" />
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Payments are not live yet. When Paystack is connected, you will subscribe from here. Until then, enjoy full access
          during your trial.
        </p>
      </section>

      <section className={`${panelClass} space-y-3`}>
        <div className="flex items-center gap-2">
          <FileBarChart2 size={18} className="text-primary" />
          <h3 className="font-heading font-semibold text-zinc-900 dark:text-zinc-100">Reporting</h3>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Review daily, weekly, and custom performance reports and export them as PDF.
        </p>
        <button
          onClick={() => navigate('/reports')}
          className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          <span>Open Reports</span>
          <ChevronRight size={16} className="text-zinc-400" />
        </button>
      </section>

      {/* Account info */}
      <section className={`${panelClass} space-y-3`}>
        <h3 className="font-heading font-semibold text-zinc-900 dark:text-zinc-100">Account</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{accountPrimary}</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{ownerName ? 'Owner' : 'Account'}</p>
            {accountShowEmail ? (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{user?.email}</p>
            ) : null}
            {accountShowPhone ? (
              <p
                className={`text-xs text-zinc-500 dark:text-zinc-400 ${accountShowEmail ? 'mt-0.5' : 'mt-1'}`}
              >
                {user?.phone}
              </p>
            ) : null}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </section>

      {/* App info */}
      <div className="pb-2 text-center text-xs text-zinc-500 dark:text-zinc-500">
        <p>VillageStock · Built for Computer Village retailers</p>
      </div>
    </div>
  );
}
