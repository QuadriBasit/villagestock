import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useShopProfile } from '@/hooks/useShopProfile';
import { useBusinessProfile } from '@/hooks/useBusinessProfile';
import { useAuthStore } from '@/store/auth';
import PlanPickerGrid from '@/components/billing/PlanPickerGrid';
import type { BusinessPlan } from '@/types';
import { supabase } from '@/lib/supabase';
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
} from 'lucide-react';
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
  const { mode, setMode } = useTheme();
  const { profile, isLoading, saveProfile } = useShopProfile();
  const { profile: businessProfile, isLoading: isBizLoading } = useBusinessProfile();
  const { user, signOut } = useAuthStore();
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    signOut();
  };

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
