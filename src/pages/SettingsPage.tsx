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
  UserCircle,
  Receipt,
} from 'lucide-react';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useShopRoles } from '@/hooks/useShopRoles';
import { ShopRolesPanel } from '@/components/settings/ShopRolesPanel';
import { createShopLocation } from '@/lib/sync';
import { useTheme, type ThemeMode } from '@/components/theme/ThemeProvider';
import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { ShopProfile, ReceiptTheme, Category, WarrantyPolicy, WarrantyDuration } from '@/types';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { ColorPickerField } from '@/components/ui/ColorPickerField';
import { DEFAULT_RECEIPT_THEME } from '@/hooks/useShopProfile';
import { extractDominantColor } from '@/lib/colorUtils';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { AnimatedAccordion } from '@/components/ui/AnimatedAccordion';
import {
  settingsPanel,
  settingsField,
  settingsLabel,
  settingsInset,
  settingsBtnPrimary,
  settingsBtnOutline,
  settingsBtnDanger,
  settingsRoleChip,
  SettingsCard,
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

const SETTINGS_TABS = ['shop', 'receipts', 'branches', 'team', 'account'] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];
type TeamSection = 'people' | 'roles';

const TAB_META: Record<SettingsTab, { label: string; icon: ReactNode }> = {
  shop: { label: 'Shop', icon: <Store size={15} /> },
  receipts: { label: 'Receipts', icon: <Receipt size={15} /> },
  branches: { label: 'Branches', icon: <MapPin size={15} /> },
  team: { label: 'Team', icon: <Users size={15} /> },
  account: { label: 'Account', icon: <UserCircle size={15} /> },
};

function isSettingsTab(value: string | null): value is SettingsTab {
  return SETTINGS_TABS.includes(value as SettingsTab);
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    roleName,
    canManageBusinessSettings,
    canInviteTeamMembers,
    canManageRoles,
    shopOwnerId,
    actorAllowedLocationIds,
    isOwner,
  } = useShopAccess();
  const { locations } = useShopLocation();
  const team = useTeamMembers();
  const shopRoles = useShopRoles();
  const defaultAssignableRoleId =
    shopRoles.roles.find(r => r.slug === 'staff')?.id ?? shopRoles.roles[0]?.id ?? '';
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [memberRoleId, setMemberRoleId] = useState('');
  const [addExistingEmail, setAddExistingEmail] = useState('');
  const [addExistingUserId, setAddExistingUserId] = useState('');
  const [addExistingDisplayName, setAddExistingDisplayName] = useState('');
  const [addExistingRoleId, setAddExistingRoleId] = useState('');
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
  const [editingMemberRoleId, setEditingMemberRoleId] = useState<string | null>(null);
  const [editMemberRoleId, setEditMemberRoleId] = useState('');
  const [teamSection, setTeamSection] = useState<TeamSection>('people');
  const [existingAccountOpen, setExistingAccountOpen] = useState(false);
  const { mode, setMode } = useTheme();
  const { profile, isLoading, saveProfile } = useShopProfile();
  const { profile: businessProfile, isLoading: isBizLoading } = useBusinessProfile();

  useEffect(() => {
    if (!memberRoleId && defaultAssignableRoleId) setMemberRoleId(defaultAssignableRoleId);
    if (!addExistingRoleId && defaultAssignableRoleId) setAddExistingRoleId(defaultAssignableRoleId);
  }, [defaultAssignableRoleId, memberRoleId, addExistingRoleId]);

  useEffect(() => {
    if (!canInviteTeamMembers && canManageRoles) setTeamSection('roles');
    else if (canInviteTeamMembers) setTeamSection('people');
  }, [canInviteTeamMembers, canManageRoles]);

  const roleLabelForMember = (member: (typeof team.members)[number]) => {
    if (member.role === 'owner') return 'Owner';
    const matched = shopRoles.roles.find(role => role.id === member.role_id);
    return matched?.name ?? member.role;
  };
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

  const tabParam = searchParams.get('tab');
  const activeTab: SettingsTab = isSettingsTab(tabParam) ? tabParam : 'shop';

  const setActiveTab = (value: string) => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (value === 'shop') next.delete('tab');
        else next.set('tab', value);
        return next;
      },
      { replace: true },
    );
  };

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <div className="overflow-x-auto pb-1 md:overflow-visible">
          <TabsList className="inline-flex h-auto w-max min-w-full gap-1 p-1 md:grid md:w-full md:grid-cols-5">
            {SETTINGS_TABS.map(tab => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="inline-flex min-w-0 items-center justify-center gap-1.5 px-3 py-2 text-xs sm:min-w-22 sm:text-sm"
              >
                {TAB_META[tab].icon}
                {TAB_META[tab].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="shop" className="mt-0 space-y-4">
      <SettingsCard
        icon={Store}
        title="Shop profile"
        subtitle="Name, logo and contact details — shown on every receipt."
      >
        <div className="space-y-4">
        <div>
          <p className={labelClass}>Default theme</p>
          <p className="mb-2 text-[11px] text-shell-muted">Quick switch stays in the header — pick your default here.</p>
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
        </div>

        {/* Logo picker */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-shell-line bg-shell-surface-2/40 transition-colors hover:border-brand-400/45"
          >
            {currentLogo ? (
              <img src={currentLogo} alt="Shop logo" className="h-full w-full rounded-xl object-cover" />
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
              className="mt-1 text-xs text-brand-300 hover:underline"
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
      </SettingsCard>
        </TabsContent>

        <TabsContent value="receipts" className="mt-0 space-y-4">
      <SettingsCard
        icon={Layers}
        title="Receipt design"
        subtitle="One style for every receipt preview, print, and export."
      >
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
      </SettingsCard>

      <SettingsCard
        icon={Shield}
        title="Warranty & returns"
        subtitle="Cover by product type and stock condition. New sales pick this up automatically."
      >
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
      </SettingsCard>
        </TabsContent>

        <TabsContent value="branches" className="mt-0 space-y-4">
      <SettingsCard
        icon={MapPin}
        title="Branches"
        subtitle="Each branch has its own stock. Switch branches from the header."
      >
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
      </SettingsCard>
        </TabsContent>

        <TabsContent value="team" className="mt-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-shell-line bg-shell-surface-2/30 px-4 py-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-shell-muted">Your access</p>
          <p className="mt-0.5 text-sm font-semibold text-shell-ink">{roleName}</p>
        </div>
        <p className="max-w-sm text-[11px] leading-relaxed text-shell-muted">
          Only the owner can remove people or change roles. Branch access can be limited per person.
        </p>
      </div>

      {canManageRoles && canInviteTeamMembers ? (
        <SegmentedTabs
          options={[
            { value: 'people', label: 'People' },
            { value: 'roles', label: 'Roles' },
          ]}
          value={teamSection}
          onChange={setTeamSection}
        />
      ) : null}

      {teamSection === 'roles' && canManageRoles ? (
        <section className={panelClass}>
          <ShopRolesPanel fieldClass={fieldClass} labelClass={labelClass} />
        </section>
      ) : null}

      {teamSection === 'people' && canInviteTeamMembers ? (
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
                  {shopRoles.roles.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMemberRoleId(opt.id)}
                      className={settingsRoleChip(memberRoleId === opt.id)}
                    >
                      <span className="block font-semibold">{opt.name}</span>
                      {opt.description ? (
                        <span className="mt-0.5 block text-[10px] text-shell-muted">{opt.description}</span>
                      ) : null}
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
                      roleId: memberRoleId || defaultAssignableRoleId,
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

              <AnimatedAccordion
                nested
                open={existingAccountOpen}
                onToggle={() => setExistingAccountOpen(current => !current)}
                title="They already have a VillageStock account?"
                subtitle="Add by login email or user UUID"
              >
                <div className="space-y-2">
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
                    {shopRoles.roles.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAddExistingRoleId(opt.id)}
                        className={cn(settingsRoleChip(addExistingRoleId === opt.id), 'rounded-lg px-2 py-1.5 text-[11px] font-medium')}
                      >
                        {opt.name}
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
                          roleId: addExistingRoleId || defaultAssignableRoleId,
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
              </AnimatedAccordion>
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
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              m.role === 'owner'
                                ? 'bg-brand-400/15 text-brand-200'
                                : 'bg-shell-surface-2 text-shell-muted'
                            }`}
                          >
                            {roleLabelForMember(m)}
                          </span>
                        </div>
                        {isOwner && m.role !== 'owner' ? (
                          <div className="mt-2 w-full border-t border-shell-line pt-2">
                            {editingMemberRoleId === m.id ? (
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-2">
                                  {shopRoles.roles.map(opt => (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => setEditMemberRoleId(opt.id)}
                                      className={cn(
                                        settingsRoleChip(editMemberRoleId === opt.id),
                                        'rounded-lg px-2 py-1 text-[10px]',
                                      )}
                                    >
                                      {opt.name}
                                    </button>
                                  ))}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={!editMemberRoleId}
                                    className={cn(settingsBtnPrimary, 'rounded-lg px-2 py-1 text-[11px]')}
                                    onClick={async () => {
                                      try {
                                        await team.updateMemberRole(m, editMemberRoleId);
                                        setEditingMemberRoleId(null);
                                        toast.success('Role updated.');
                                      } catch (e) {
                                        toast.error(e instanceof Error ? e.message : 'Update failed');
                                      }
                                    }}
                                  >
                                    Save role
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-lg border border-shell-line px-2 py-1 text-[11px] text-shell-muted"
                                    onClick={() => setEditingMemberRoleId(null)}
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
                                  setEditingMemberRoleId(m.id);
                                  setEditMemberRoleId(m.role_id ?? defaultAssignableRoleId);
                                }}
                              >
                                Change role
                              </button>
                            )}
                          </div>
                        ) : null}
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
                      {isOwner && m.role !== 'owner' ? (
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
        ) : null}

      {!canInviteTeamMembers && !canManageRoles ? (
        <p className="text-xs text-shell-muted">
          Team management is available to owners and managers.
        </p>
      ) : null}
        </TabsContent>

        <TabsContent value="account" className="mt-0 space-y-4">
      <SettingsCard
        icon={FileBarChart2}
        title="Reporting"
        subtitle="Daily, weekly, and custom performance reports with PDF export."
      >
        <button
          onClick={() => navigate('/reports')}
          className={cn(settingsBtnOutline, 'w-full justify-between px-4 py-3 text-sm font-medium text-shell-ink hover:bg-shell-surface-2/60')}
        >
          <span>Open Reports</span>
          <ChevronRight size={16} className="text-shell-muted" />
        </button>
      </SettingsCard>

      <SettingsCard icon={UserCircle} title="Account" subtitle="Your sign-in details for this shop.">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-shell-ink">{accountPrimary}</p>
            <p className="mt-0.5 text-xs text-shell-muted">{ownerName ? 'Owner' : 'Account'}</p>
            {accountShowEmail ? (
              <p className="mt-1 text-xs text-shell-muted">{user?.email}</p>
            ) : null}
            {accountShowPhone ? (
              <p className={`text-xs text-shell-muted ${accountShowEmail ? 'mt-0.5' : 'mt-1'}`}>
                {user?.phone}
              </p>
            ) : null}
          </div>
          <button onClick={handleSignOut} className={settingsBtnDanger}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </SettingsCard>
        </TabsContent>
      </Tabs>

      {/* App info */}
      <div className="pb-2 text-center text-xs text-shell-muted">
        <p>VillageStock · Built for Computer Village retailers</p>
      </div>
    </div>
  );
}
