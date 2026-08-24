import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useShopProfile } from '@/hooks/useShopProfile';
import { useBusinessProfile } from '@/hooks/useBusinessProfile';
import { useAuthStore } from '@/store/auth';
// import PlanPickerGrid from '@/components/billing/PlanPickerGrid';
// import type { BusinessPlan } from '@/types';
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
  Shield,
  // CreditCard,
  Sun,
  Moon,
  Laptop,
  Users,
  Layers,
} from 'lucide-react';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { createShopLocation } from '@/lib/sync';
import { useTheme, type ThemeMode } from '@/components/theme/ThemeProvider';
import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { ShopProfile, ReceiptTheme, Category, WarrantyPolicy, WarrantyDuration } from '@/types';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { ColorPickerField } from '@/components/ui/ColorPickerField';
import { DEFAULT_RECEIPT_THEME } from '@/hooks/useShopProfile';
import { extractDominantColor } from '@/lib/colorUtils';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  settingsPanel,
  settingsField,
  settingsLabel,
  settingsInset,
  settingsBtnPrimary,
  settingsBtnOutline,
  settingsBtnDanger,
  settingsRoleChip,
} from '@/components/settings/settingsUi';
import { applyShellAccent } from '@/lib/shellAccent';
import {
  DEFAULT_WARRANTY_POLICY,
  mergeWarrantyPolicy,
  WARRANTY_CATEGORY_LABELS,
  WARRANTY_STOCK_CONDITIONS,
  WARRANTY_STOCK_CONDITION_LABELS,
} from '@/lib/warranty';
import { cn } from '@/lib/utils';

const WARRANTY_CATEGORIES = Object.keys(WARRANTY_CATEGORY_LABELS) as Category[];

const schema = z.object({
  shop_name: z.string().min(1, 'Shop name is required'),
  address: z.string().optional().transform(v => v ?? ''),
  phone: z.string().optional().transform(v => v ?? ''),
});
type FormData = z.infer<typeof schema>;

// function formatPlanLabel(plan: BusinessPlan): string {
//   const map: Record<BusinessPlan, string> = {
//     trial: 'Trial',
//     starter: 'Starter',
//     pro: 'Pro',
//     business: 'Business',
//   };
//   return map[plan];
// }
//
// function formatPlanStatus(status: string): string {
//   return status.charAt(0).toUpperCase() + status.slice(1);
// }

const panelClass = settingsPanel;

export default function SettingsPage() {
  const navigate = useNavigate();
  const {
    role,
    canManageBusinessSettings,
    canInviteTeamMembers,
    shopOwnerId,
    actorAllowedLocationIds,
  } = useShopAccess();
  const { locations } = useShopLocation();
  const team = useTeamMembers();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [memberRole, setMemberRole] = useState<'manager' | 'staff'>('staff');
  const [addExistingEmail, setAddExistingEmail] = useState('');
  const [addExistingUserId, setAddExistingUserId] = useState('');
  const [addExistingDisplayName, setAddExistingDisplayName] = useState('');
  const [addExistingRole, setAddExistingRole] = useState<'manager' | 'staff'>('staff');
  const [teamSubmitting, setTeamSubmitting] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [branchSubmitting, setBranchSubmitting] = useState(false);
  const [branchMessage, setBranchMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [inviteAllBranches, setInviteAllBranches] = useState(true);
  const [inviteBranchIds, setInviteBranchIds] = useState<string[]>([]);
  const [addExistingAllBranches, setAddExistingAllBranches] = useState(true);
  const [addExistingBranchIds, setAddExistingBranchIds] = useState<string[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberAllBranches, setEditMemberAllBranches] = useState(true);
  const [editMemberBranchIds, setEditMemberBranchIds] = useState<string[]>([]);
  const { mode, setMode } = useTheme();
  const { profile, isLoading, saveProfile } = useShopProfile();
  const { profile: businessProfile, isLoading: isBizLoading } = useBusinessProfile();
  const { user } = useAuthStore();
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | undefined>(undefined);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saved, setSaved] = useState(false);
  const [themeSaved, setThemeSaved] = useState(false);
  const [warrantyPolicy, setWarrantyPolicy] = useState<WarrantyPolicy>(
    mergeWarrantyPolicy(profile.warranty_policy),
  );
  const [warrantySaved, setWarrantySaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [receiptTheme, setReceiptTheme] = useState<ReceiptTheme>(
    profile.receipt_theme ?? DEFAULT_RECEIPT_THEME
  );
  const effectiveReceiptTheme = profile.receipt_theme ?? DEFAULT_RECEIPT_THEME;

  useEffect(() => {
    setWarrantyPolicy(mergeWarrantyPolicy(profile.warranty_policy));
  }, [profile.warranty_policy]);

  useEffect(() => {
    setReceiptTheme(effectiveReceiptTheme);
  }, [
    effectiveReceiptTheme.header_color,
    effectiveReceiptTheme.accent_color,
    effectiveReceiptTheme.text_color,
    effectiveReceiptTheme.paper_color,
  ]);

  useEffect(() => {
    applyShellAccent(receiptTheme.header_color || receiptTheme.accent_color);
  }, [receiptTheme.header_color, receiptTheme.accent_color]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    };
  }, [logoPreviewUrl]);

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

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));

    const dominantColor = await extractDominantColor(file);
    if (dominantColor) {
      setReceiptTheme(current => ({
        ...current,
        header_color: dominantColor,
        accent_color: dominantColor,
      }));
      toast.success('Receipt theme auto-updated to match logo colors!');
    }
  };

  const onSubmit = async (data: FormData) => {
    const updated: ShopProfile = {
      shop_name: data.shop_name,
      address: data.address,
      phone: data.phone,
      logo_data_url: profile.logo_data_url,
      logo_path: profile.logo_path,
      receipt_theme: receiptTheme,
      warranty_policy: warrantyPolicy,
    };
    await saveProfile(updated, { logoFile });
    setLogoFile(null);
    setLogoPreviewUrl(undefined);
    setSaved(true);
    toast.success('Shop profile saved');
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSignOut = () => void signOutApp();

  const fieldClass = settingsField;
  const labelClass = settingsLabel;

  if (isLoading || isBizLoading) {
    return (
      <div className="app-page flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-brand-400" />
      </div>
    );
  }

  // Subscription / trial-end UI hidden — keep trial_end_date in DB for later.
  // const trialEndReal =
  //   businessProfile?.trial_end_date &&
  //   !businessProfile.trial_end_date.startsWith('1970-01-01');
  // const trialEndLabel = trialEndReal
  //   ? new Date(businessProfile!.trial_end_date).toLocaleDateString(undefined, {
  //       year: 'numeric',
  //       month: 'short',
  //       day: 'numeric',
  //     })
  //   : null;

  const currentLogo = logoPreviewUrl ?? profile.logo_data_url;

  const themeChoices: { id: ThemeMode; label: string; icon: ReactNode }[] = [
    { id: 'light', label: 'Light', icon: <Sun size={16} /> },
    { id: 'dark', label: 'Dark', icon: <Moon size={16} /> },
    { id: 'system', label: 'System', icon: <Laptop size={16} /> },
  ];

  const ownerName = businessProfile?.owner_name?.trim();
  const accountPrimary = ownerName || user?.phone || user?.email || '—';
  const accountShowEmail = Boolean(user?.email && accountPrimary !== user.email);
  const accountShowPhone = Boolean(user?.phone && accountPrimary !== user.phone);

  const inviterRestricted = !!(actorAllowedLocationIds && actorAllowedLocationIds.length > 0);

  function inviteAllowedLocationPayload(): string[] | null {
    if (locations.length <= 1) return null;
    if (inviterRestricted) {
      return inviteBranchIds.length ? inviteBranchIds : null;
    }
    if (inviteAllBranches) return null;
    return inviteBranchIds.length ? inviteBranchIds : null;
  }

  function addExistingAllowedLocationPayload(): string[] | null {
    if (locations.length <= 1) return null;
    if (inviterRestricted) {
      return addExistingBranchIds.length ? addExistingBranchIds : null;
    }
    if (addExistingAllBranches) return null;
    return addExistingBranchIds.length ? addExistingBranchIds : null;
  }

  return (
    <div className="app-page space-y-5 py-4 md:py-6">
      <PageHeader
        title="Settings"
        subtitle="Shop profile, team and how Village Stock runs day to day"
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
      <section className={`${panelClass} space-y-3 lg:col-span-2 xl:col-span-full`}>
        <h3 className="font-display text-sm font-semibold text-shell-ink">Appearance</h3>
        <p className="text-xs text-shell-muted">Uses the header toggle for a quick switch; set default here.</p>
        <div className="grid max-w-md grid-cols-3 gap-2">
          {themeChoices.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold transition-colors',
                mode === id
                  ? 'shell-accent-subtle shell-accent-subtle-border shell-accent-text-soft'
                  : 'border-shell-line bg-shell-surface-2/40 text-shell-muted hover:text-shell-ink',
              )}
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
          <Store size={18} className="text-brand-300" />
          <h3 className="font-display font-semibold text-shell-ink">Shop Profile</h3>
        </div>
        <p className="-mt-1 text-xs text-shell-muted">
          This information appears on every receipt you generate.
        </p>

        {/* Logo picker */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-shell-line bg-shell-surface-2/40 transition-colors hover:border-brand-400/45"
          >
            {currentLogo ? (
              <img src={currentLogo} alt="Shop logo" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <Camera size={22} className="text-shell-muted" />
            )}
          </button>
          <div>
            <p className="text-sm font-medium text-shell-ink">Shop Logo</p>
            <p className="mt-0.5 text-xs text-shell-muted">Tap to upload (optional)</p>
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="text-xs text-brand-300 mt-1 hover:underline"
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
              <Store size={13} className="mr-1 inline text-shell-muted" />
              Shop Name *
            </label>
            <Input
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
              <MapPin size={13} className="mr-1 inline text-shell-muted" />
              Shop Address
            </label>
            <Input
              id="address"
              {...register('address')}
              placeholder="e.g. Shop 14, Computer Village, Ikeja"
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="phone">
              <Phone size={13} className="mr-1 inline text-shell-muted" />
              Phone Number
            </label>
            <Input
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
            className={cn(settingsBtnPrimary, 'w-full py-3')}
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
        <div className="mb-0.5 flex items-center gap-2">
          <Layers size={18} className="text-brand-300" />
          <h3 className="font-display font-semibold text-shell-ink">Receipt Design</h3>
        </div>
        <p className="-mt-1 text-xs text-shell-muted">
          Set one receipt style for the whole shop. Every receipt preview, print, and export will use this design.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <ColorPickerField
            label="Header color"
            value={receiptTheme.header_color}
            onChange={value => setReceiptTheme(current => ({ ...current, header_color: value }))}
          />
          <ColorPickerField
            label="Amount color"
            value={receiptTheme.accent_color}
            onChange={value => setReceiptTheme(current => ({ ...current, accent_color: value }))}
          />
          <ColorPickerField
            label="Text color"
            value={receiptTheme.text_color}
            onChange={value => setReceiptTheme(current => ({ ...current, text_color: value }))}
          />
          <ColorPickerField
            label="Paper color"
            value={receiptTheme.paper_color}
            onChange={value => setReceiptTheme(current => ({ ...current, paper_color: value }))}
          />
        </div>

        <div className={cn(settingsInset, 'rounded-2xl p-4')}>
          <div
            className="overflow-hidden rounded-xl border"
            style={{
              borderColor: `${receiptTheme.text_color}22`,
              backgroundColor: receiptTheme.paper_color,
              color: receiptTheme.text_color,
            }}
          >
            <div className="px-4 py-3 text-white" style={{ backgroundColor: receiptTheme.header_color }}>
              <div className="text-sm font-semibold">{profile.shop_name || 'VillageStock Shop'}</div>
              <div className="text-xs opacity-80">Receipt preview</div>
            </div>
            <div className="space-y-2 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span style={{ color: `${receiptTheme.text_color}AA` }}>Item</span>
                <span>iPhone 14 Pro</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: `${receiptTheme.text_color}AA` }}>Customer</span>
                <span>Walk-in customer</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span>Amount</span>
                <span style={{ color: receiptTheme.accent_color }}>₦350,000</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              await saveProfile({
                ...profile,
                logo_data_url: profile.logo_data_url,
                logo_path: profile.logo_path,
                receipt_theme: receiptTheme,
              });
              setThemeSaved(true);
              toast.success('Receipt design saved');
              setTimeout(() => setThemeSaved(false), 2500);
            }}
            className={settingsBtnPrimary}
          >
            Save receipt design
          </button>
          <button
            type="button"
            onClick={() => setReceiptTheme(DEFAULT_RECEIPT_THEME)}
            className={settingsBtnOutline}
          >
            Reset colors
          </button>
          {themeSaved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-3 py-2 text-xs font-medium text-teal-dark dark:text-teal-300">
              <CheckCircle size={14} />
              Saved
            </span>
          )}
        </div>
      </section>

      <section className={`${panelClass} space-y-3`}>
        <div className="mb-0.5 flex items-center gap-2">
          <Shield size={18} className="text-brand-300" />
          <h3 className="font-display font-semibold text-shell-ink">Warranty &amp; returns</h3>
        </div>
        <p className="-mt-1 text-xs text-shell-muted">
          Set return/warranty cover by product type and stock condition (new, used, UK used, refurb).
          Use days or months — e.g. 7 days, 14 days, 1 month. New sales pick this up automatically.
        </p>

        <div className="overflow-x-auto rounded-xl border border-shell-line">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-shell-line bg-shell-surface-2/50">
                <th className="px-3 py-2.5 font-semibold text-shell-muted">Category</th>
                {WARRANTY_STOCK_CONDITIONS.map(condition => (
                  <th key={condition} className="px-3 py-2.5 font-semibold text-shell-muted">
                    {WARRANTY_STOCK_CONDITION_LABELS[condition]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WARRANTY_CATEGORIES.map(category => (
                <tr key={category} className="border-b border-shell-line/80 last:border-b-0">
                  <td className="px-3 py-2.5 font-medium text-shell-ink">
                    {WARRANTY_CATEGORY_LABELS[category]}
                  </td>
                  {WARRANTY_STOCK_CONDITIONS.map(condition => {
                    const cover = warrantyPolicy[category][condition];
                    return (
                      <td key={condition} className="px-2 py-2">
                        <div className="flex min-w-[7.5rem] items-center gap-1.5">
                          <Input
                            type="number"
                            min={0}
                            max={36}
                            inputMode="numeric"
                            className={cn(fieldClass, 'w-14 px-2 py-2 text-center')}
                            value={cover.value}
                            onChange={e => {
                              const value = Math.max(0, Math.min(36, Number(e.target.value) || 0));
                              setWarrantyPolicy(current => ({
                                ...current,
                                [category]: {
                                  ...current[category],
                                  [condition]: { ...current[category][condition], value },
                                },
                              }));
                            }}
                          />
                          <Select
                            value={cover.unit}
                            onValueChange={(unit: WarrantyDuration['unit']) =>
                              setWarrantyPolicy(current => ({
                                ...current,
                                [category]: {
                                  ...current[category],
                                  [condition]: {
                                    ...current[category][condition],
                                    unit,
                                  },
                                },
                              }))
                            }
                          >
                            <SelectTrigger className="h-10 min-w-[4.5rem] border-shell-line bg-shell-surface-2/40 px-2 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="days">Days</SelectItem>
                              <SelectItem value="months">Months</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              await saveProfile({
                ...profile,
                receipt_theme: profile.receipt_theme ?? receiptTheme,
                warranty_policy: warrantyPolicy,
              });
              setWarrantySaved(true);
              toast.success('Warranty policy saved');
              setTimeout(() => setWarrantySaved(false), 2500);
            }}
            className={settingsBtnPrimary}
          >
            Save warranty policy
          </button>
          <button
            type="button"
            onClick={() => setWarrantyPolicy(DEFAULT_WARRANTY_POLICY)}
            className={settingsBtnOutline}
          >
            Reset to defaults
          </button>
          {warrantySaved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-3 py-2 text-xs font-medium text-teal-dark dark:text-teal-300">
              <CheckCircle size={14} />
              Saved
            </span>
          )}
        </div>
      </section>

      <section className={`${panelClass} space-y-3`}>
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-brand-300" />
          <h3 className="font-display font-semibold text-shell-ink">Branches</h3>
        </div>
        <p className="text-xs text-shell-muted">
          Inventory, sales, and stock sessions are scoped to the branch you select in the header. Each branch has its own stock.
        </p>
        <div className="space-y-2">
          <p className="text-xs font-medium text-shell-ink">Your locations</p>
          {locations.length === 0 ? (
            <p className="text-xs text-shell-muted">No branches loaded yet. Sync online once, or add a branch below.</p>
          ) : (
            <ul className="space-y-1.5">
              {locations.map(loc => (
                <li
                  key={loc.id}
                  className="rounded-lg border border-shell-line bg-shell-surface-2/40 px-3 py-2 text-xs font-medium text-shell-ink"
                >
                  {loc.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        {canManageBusinessSettings && shopOwnerId ? (
          <div className="space-y-2 rounded-xl border border-shell-line bg-shell-surface-2/40 px-3 py-3">
            <p className="text-xs font-medium text-shell-ink">Add a branch</p>
            <label className={labelClass} htmlFor="new-branch-name">
              Branch name
            </label>
            <Input
              id="new-branch-name"
              type="text"
              value={newBranchName}
              onChange={e => setNewBranchName(e.target.value)}
              placeholder="e.g. Ikeja counter"
              className={fieldClass}
              autoComplete="off"
            />
            {branchMessage ? (
              <p
                className={`text-xs ${branchMessage.type === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
              >
                {branchMessage.text}
              </p>
            ) : null}
            <button
              type="button"
              disabled={branchSubmitting || !newBranchName.trim()}
              onClick={async () => {
                setBranchMessage(null);
                setBranchSubmitting(true);
                try {
                  await createShopLocation(shopOwnerId, newBranchName);
                  setNewBranchName('');
                  setBranchMessage({ type: 'ok', text: 'Branch added. Select it from the header when you are ready.' });
                  toast.success('Branch added — pick it in the header when you are ready.');
                } catch (e) {
                  const msg = e instanceof Error ? e.message : 'Could not add branch';
                  setBranchMessage({ type: 'err', text: msg });
                  toast.error(msg);
                } finally {
                  setBranchSubmitting(false);
                }
              }}
              className={cn(settingsBtnPrimary, 'w-full py-2.5')}
            >
              {branchSubmitting ? 'Saving…' : 'Add branch'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-shell-muted">
            Only the owner or a manager with access to all branches can add or rename branches.
          </p>
        )}
      </section>

      <section className={`${panelClass} space-y-3`}>
        <div className="flex items-center gap-2">
          <Users size={18} className="text-brand-300" />
          <h3 className="font-display font-semibold text-shell-ink">Team &amp; roles</h3>
        </div>
        <p className="text-sm text-shell-muted">
          Your role:{' '}
          <span className="font-semibold capitalize text-shell-ink">{role}</span>
        </p>
        <p className="text-xs leading-relaxed text-shell-muted">
          <strong className="text-shell-muted">Staff</strong> can sell and manage stock but not profit,
          credits, reports, or billing. <strong className="text-shell-muted">Managers</strong> have
          wider access. You can limit each person to specific branches or give them the whole shop. Only the{' '}
          <strong className="text-shell-muted">Owner</strong> can remove people.{' '}
          <strong className="text-shell-muted">Owner</strong> or a{' '}
          <strong className="text-shell-muted">manager with all branches</strong> can edit branch access
          after someone joins.
        </p>

        {canInviteTeamMembers ? (
          <>
            {team.error ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                Team list: {team.error}. If you just added this feature, run the latest SQL migration for{' '}
                <code className="text-[10px]">business_members</code> RLS (manager can view team) in Supabase.
              </p>
            ) : null}

            <div className="space-y-3 rounded-xl border border-shell-line bg-shell-surface-2/40 px-3 py-3">
              <div>
                <p className="text-xs font-medium text-shell-ink">Email invite (recommended)</p>
                <p className="mt-1 text-[11px] leading-relaxed text-shell-muted">
                  We email them a secure link to <strong className="text-shell-muted">choose a password</strong>
                  . After they sign in with that email, they are attached to <strong className="text-shell-muted">this shop</strong> automatically — they do not go through owner onboarding.
                </p>
              </div>
              <div>
                <label className={labelClass} htmlFor="invite-email">
                  Their email
                </label>
                <Input
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
                  Name on receipts *
                </label>
                <Input
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
                      className={settingsRoleChip(memberRole === opt.id)}
                    >
                      <span className="block font-semibold">{opt.title}</span>
                      <span className="mt-0.5 block text-[10px] text-shell-muted">{opt.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              {locations.length > 1 ? (
                <div className="space-y-2 rounded-lg border border-shell-line bg-shell-surface-2/30 px-3 py-2">
                  <p className={`${labelClass} mb-0`}>Branch access</p>
                  {inviterRestricted ? (
                    <p className="text-[11px] text-shell-muted">
                      Pick one or more branches they may use (you are limited to your own branches).
                    </p>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-shell-ink">
                      <Checkbox
                        checked={inviteAllBranches}
                        onCheckedChange={c => {
                          const on = c === true;
                          setInviteAllBranches(on);
                          if (on) setInviteBranchIds([]);
                        }}
                      />
                      All branches (whole shop)
                    </label>
                  )}
                  {(inviterRestricted || !inviteAllBranches) && (
                    <div className="flex flex-col gap-1.5 pl-1">
                      {locations.map(loc => (
                        <label
                          key={loc.id}
                          className="flex cursor-pointer items-center gap-2 text-xs text-shell-muted"
                        >
                          <Checkbox
                            checked={inviteBranchIds.includes(loc.id)}
                            onCheckedChange={c => {
                              const on = c === true;
                              setInviteBranchIds(prev =>
                                on ? [...prev, loc.id] : prev.filter(x => x !== loc.id)
                              );
                            }}
                          />
                          {loc.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
              <button
                type="button"
                disabled={
                  teamSubmitting ||
                  !inviteEmail.trim() ||
                  !inviteDisplayName.trim() ||
                  (locations.length > 1 &&
                    inviterRestricted &&
                    inviteBranchIds.length === 0) ||
                  (locations.length > 1 &&
                    !inviterRestricted &&
                    !inviteAllBranches &&
                    inviteBranchIds.length === 0)
                }
                onClick={async () => {
                  setTeamSubmitting(true);
                  try {
                    await team.inviteStaff({
                      email: inviteEmail.trim(),
                      role: memberRole,
                      displayName: inviteDisplayName,
                      allowedLocationIds: inviteAllowedLocationPayload(),
                    });
                    setInviteEmail('');
                    setInviteDisplayName('');
                    setInviteAllBranches(true);
                    setInviteBranchIds([]);
                    toast.success('Invitation sent — they should open the email and set a password.');
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Could not send invite');
                  } finally {
                    setTeamSubmitting(false);
                  }
                }}
                className={cn(settingsBtnPrimary, 'w-full py-2.5')}
              >
                {teamSubmitting ? 'Sending…' : 'Send invitation email'}
              </button>

              <details className="rounded-lg border border-shell-line bg-shell-surface-2/30">
                <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-medium text-shell-muted">
                  They already have a VillageStock account?
                </summary>
                <div className="space-y-2 border-t border-shell-line px-3 py-3">
                  <p className="text-[10px] text-shell-muted">
                    Add them by the email they use to sign in, or paste their Auth user UUID if they have no email on file.
                  </p>
                  <Input
                    type="email"
                    value={addExistingEmail}
                    onChange={e => setAddExistingEmail(e.target.value)}
                    placeholder="Their login email"
                    className={fieldClass}
                    autoComplete="off"
                  />
                  <Input
                    type="text"
                    value={addExistingUserId}
                    onChange={e => setAddExistingUserId(e.target.value)}
                    placeholder="Or user UUID (advanced)"
                    className={fieldClass}
                    autoComplete="off"
                  />
                  <label className={labelClass} htmlFor="add-existing-display">
                    Name on receipts *
                  </label>
                  <Input
                    id="add-existing-display"
                    type="text"
                    value={addExistingDisplayName}
                    onChange={e => setAddExistingDisplayName(e.target.value)}
                    placeholder="e.g. Ada — front desk"
                    className={fieldClass}
                    autoComplete="off"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {(['staff', 'manager'] as const).map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setAddExistingRole(r)}
                        className={cn(settingsRoleChip(addExistingRole === r), 'rounded-lg px-2 py-1.5 text-[11px] font-medium capitalize')}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  {locations.length > 1 ? (
                    <div className="space-y-2 rounded-lg border border-shell-line bg-shell-surface-2/40 px-2 py-2">
                      <p className="text-[11px] font-medium text-shell-ink">Branch access</p>
                      {inviterRestricted ? (
                        <p className="text-[10px] text-shell-muted">Select at least one branch.</p>
                      ) : (
                        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-shell-ink">
                          <Checkbox
                            checked={addExistingAllBranches}
                            onCheckedChange={c => {
                              const on = c === true;
                              setAddExistingAllBranches(on);
                              if (on) setAddExistingBranchIds([]);
                            }}
                          />
                          All branches
                        </label>
                      )}
                      {(inviterRestricted || !addExistingAllBranches) && (
                        <div className="flex flex-col gap-1">
                          {locations.map(loc => (
                            <label
                              key={loc.id}
                              className="flex cursor-pointer items-center gap-2 text-[11px] text-shell-muted"
                            >
                              <Checkbox
                                checked={addExistingBranchIds.includes(loc.id)}
                                onCheckedChange={c => {
                                  const on = c === true;
                                  setAddExistingBranchIds(prev =>
                                    on ? [...prev, loc.id] : prev.filter(x => x !== loc.id)
                                  );
                                }}
                              />
                              {loc.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    disabled={
                      teamSubmitting ||
                      (!addExistingEmail.trim() && !addExistingUserId.trim()) ||
                      !addExistingDisplayName.trim() ||
                      (locations.length > 1 &&
                        inviterRestricted &&
                        addExistingBranchIds.length === 0) ||
                      (locations.length > 1 &&
                        !inviterRestricted &&
                        !addExistingAllBranches &&
                        addExistingBranchIds.length === 0)
                    }
                    onClick={async () => {
                      setTeamSubmitting(true);
                      try {
                        await team.addMember({
                          memberEmail: addExistingEmail.trim() || undefined,
                          memberUserId: addExistingUserId.trim() || undefined,
                          role: addExistingRole,
                          displayName: addExistingDisplayName,
                          allowedLocationIds: addExistingAllowedLocationPayload(),
                        });
                        setAddExistingEmail('');
                        setAddExistingUserId('');
                        setAddExistingDisplayName('');
                        setAddExistingAllBranches(true);
                        setAddExistingBranchIds([]);
                        toast.success('Teammate added to this shop.');
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Failed to add');
                      } finally {
                        setTeamSubmitting(false);
                      }
                    }}
                    className={cn(settingsBtnOutline, 'w-full py-2 text-xs font-semibold')}
                  >
                    Add existing account to shop
                  </button>
                </div>
              </details>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-shell-ink">People</p>
              {team.loading ? (
                <p className="text-xs text-shell-muted">Loading…</p>
              ) : team.members.length === 0 ? (
                <p className="text-xs text-shell-muted">No rows returned. Check RLS or run migrations.</p>
              ) : (
                <ul className="space-y-2">
                  {team.members.map(m => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-shell-line bg-shell-surface-2/30 px-3 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-shell-ink">
                            {m.display_name?.trim() || (m.role === 'owner' ? 'Owner' : 'Team member')}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                              m.role === 'owner'
                                ? 'bg-brand-400/15 text-brand-200'
                                : m.role === 'manager'
                                  ? 'bg-blue-400/15 text-blue-200'
                                  : 'bg-shell-surface-2 text-shell-muted'
                            }`}
                          >
                            {m.role}
                          </span>
                        </div>
                        {locations.length > 1 && m.role !== 'owner' ? (
                          <p className="mt-1 text-[10px] text-shell-muted">
                            Branches:{' '}
                            {!m.allowed_location_ids?.length ? (
                              <span className="font-medium text-shell-muted">All branches</span>
                            ) : (
                              <span className="font-medium text-shell-muted">
                                {m.allowed_location_ids
                                  .map(lid => locations.find(l => l.id === lid)?.name ?? 'Unknown branch')
                                  .join(', ')}
                              </span>
                            )}
                          </p>
                        ) : null}
                        {canManageBusinessSettings && m.role !== 'owner' && locations.length > 1 ? (
                          <div className="mt-2 w-full border-t border-shell-line pt-2">
                            {editingMemberId === m.id ? (
                              <div className="space-y-2">
                                <label className="flex cursor-pointer items-center gap-2 text-[11px] text-shell-ink">
                                  <Checkbox
                                    checked={editMemberAllBranches}
                                    onCheckedChange={c => {
                                      const on = c === true;
                                      setEditMemberAllBranches(on);
                                      if (on) setEditMemberBranchIds([]);
                                    }}
                                  />
                                  All branches
                                </label>
                                {!editMemberAllBranches && (
                                  <div className="flex flex-col gap-1 pl-1">
                                    {locations.map(loc => (
                                      <label
                                        key={loc.id}
                                        className="flex cursor-pointer items-center gap-2 text-[11px] text-shell-muted"
                                      >
                                        <Checkbox
                                          checked={editMemberBranchIds.includes(loc.id)}
                                          onCheckedChange={c => {
                                            const on = c === true;
                                            setEditMemberBranchIds(prev =>
                                              on ? [...prev, loc.id] : prev.filter(x => x !== loc.id)
                                            );
                                          }}
                                        />
                                        {loc.name}
                                      </label>
                                    ))}
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={!editMemberAllBranches && editMemberBranchIds.length === 0}
                                    className={cn(settingsBtnPrimary, 'rounded-lg px-2 py-1 text-[11px]')}
                                    onClick={async () => {
                                      if (!editMemberAllBranches && editMemberBranchIds.length === 0) return;
                                      try {
                                        await team.updateMemberBranchAccess(
                                          m,
                                          editMemberAllBranches ? null : editMemberBranchIds
                                        );
                                        setEditingMemberId(null);
                                        toast.success('Branch access updated.');
                                      } catch (e) {
                                        toast.error(e instanceof Error ? e.message : 'Update failed');
                                      }
                                    }}
                                  >
                                    Save branches
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-lg border border-shell-line px-2 py-1 text-[11px] text-shell-muted"
                                    onClick={() => setEditingMemberId(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="text-[11px] font-medium text-brand-300 hover:underline"
                                onClick={() => {
                                  const ids = m.allowed_location_ids ?? [];
                                  setEditingMemberId(m.id);
                                  setEditMemberAllBranches(!ids.length);
                                  setEditMemberBranchIds(ids.length ? [...ids] : []);
                                }}
                              >
                                Edit branch access
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>
                      {role === 'owner' && m.role !== 'owner' ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm('Remove this person from the shop?')) return;
                            try {
                              await team.removeMember(m);
                              toast.success('Member removed.');
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : 'Could not remove');
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
          <p className="text-xs text-shell-muted">
            Inviting teammates is available to owners and managers.
          </p>
        )}
      </section>

      {/* Subscription / plan picker hidden — restore when billing returns.
      <section className={`${panelClass} space-y-3`}>
        <div className="flex items-center gap-2">
          <CreditCard size={18} className="text-brand-300" />
          <h3 className="font-display font-semibold text-shell-ink">Subscription</h3>
        </div>
        {businessProfile ? (
          <div className="space-y-1 rounded-xl border border-shell-line bg-shell-surface-2/40 px-3 py-3 text-sm">
            <p>
              <span className="text-shell-muted">Current plan:</span>{' '}
              <span className="font-semibold text-shell-ink">{formatPlanLabel(businessProfile.plan)}</span>
            </p>
            <p>
              <span className="text-shell-muted">Status:</span>{' '}
              <span className="font-medium text-shell-ink">{formatPlanStatus(businessProfile.plan_status)}</span>
            </p>
            {businessProfile.plan === 'trial' && trialEndLabel ? (
              <p>
                <span className="text-shell-muted">Trial ends:</span>{' '}
                <span className="font-medium text-shell-ink">{trialEndLabel}</span>
              </p>
            ) : null}
          </div>
        ) : null}
        <div>
          <p className="mb-2 text-xs font-medium text-shell-ink">Compare plans</p>
          <PlanPickerGrid variant="compact" />
        </div>
        <p className="text-[11px] leading-relaxed text-shell-muted">
          Payments are not live yet. When Paystack is connected, you will subscribe from here. Until then, enjoy full access
          during your trial.
        </p>
      </section>
      */}

      <section className={`${panelClass} space-y-3`}>
        <div className="flex items-center gap-2">
          <FileBarChart2 size={18} className="text-brand-300" />
          <h3 className="font-display font-semibold text-shell-ink">Reporting</h3>
        </div>
        <p className="text-sm text-shell-muted">
          Review daily, weekly, and custom performance reports and export them as PDF.
        </p>
        <button
          onClick={() => navigate('/reports')}
          className={cn(settingsBtnOutline, 'w-full justify-between px-4 py-3 text-sm font-medium text-shell-ink hover:bg-shell-surface-2/60')}
        >
          <span>Open Reports</span>
          <ChevronRight size={16} className="text-shell-muted" />
        </button>
      </section>

      {/* Account info */}
      <section className={`${panelClass} space-y-3`}>
        <h3 className="font-display font-semibold text-shell-ink">Account</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-shell-ink">{accountPrimary}</p>
            <p className="mt-0.5 text-xs text-shell-muted">{ownerName ? 'Owner' : 'Account'}</p>
            {accountShowEmail ? (
              <p className="mt-1 text-xs text-shell-muted">{user?.email}</p>
            ) : null}
            {accountShowPhone ? (
              <p
                className={`text-xs text-shell-muted ${accountShowEmail ? 'mt-0.5' : 'mt-1'}`}
              >
                {user?.phone}
              </p>
            ) : null}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className={settingsBtnDanger}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </section>

      </div>

      {/* App info */}
      <div className="pb-2 text-center text-xs text-shell-muted">
        <p>VillageStock · Built for Computer Village retailers</p>
      </div>
    </div>
  );
}
