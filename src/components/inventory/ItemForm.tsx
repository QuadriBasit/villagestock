import {useState, lazy, Suspense, useMemo, type ComponentProps} from 'react';
import {useShopAccess} from '@/context/ShopAccessContext';
import {useForm, Controller, type Control} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {Loader2, ScanLine, Plus, CheckCircle2} from 'lucide-react';
import {
  getCategoryMode,
  isAppleLaptopDevice,
  isAppleMobileDevice,
} from '@/types';
import {
  BRAND_SUGGESTIONS,
  suggestedNamesForCategoryAndBrand,
} from '@/lib/devicePresets';
import {
  categoryRequiresImei,
  categoryRequiresSerialNumber,
  isPlausibleImei,
  normalizeImeiDigits,
} from '@/lib/serializedIdentifiers';
import {
  ESIM_STATUS_OPTIONS,
  mobileNetworkDeviceDetails,
  NETWORK_STATUS_OPTIONS,
  networkStateFromDeviceDetails,
  SIM_CONFIG_OPTIONS,
  simConfigNeedsEsimStatus,
} from '@/lib/networkLock';
import {cn} from '@/lib/utils';
import {ComboboxField} from '@/components/ui/ComboboxField';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {Label} from '@/components/ui/Label';
import {Input} from '@/components/ui/Input';
import {Checkbox} from '@/components/ui/Checkbox';
import {Textarea} from '@/components/ui/Textarea';
import {CurrencyInput} from '@/components/ui/CurrencyInput';
import {settingsField, settingsLabel} from '@/components/settings/settingsUi';
import type {
  InventoryItemInput,
  Category,
  DeviceCondition,
  AppleICloudStatus,
  AppleBiometricStatus,
  MacKeyboardStatus,
  MacScreenCondition,
} from '@/types';

const BarcodeScanner = lazy(() => import('./BarcodeScanner'));

// ─── Schemas (two variants) ───────────────────────────────────────────────────

const baseSchema = {
  name: z.string().min(1, 'Name is required'),
  category: z.enum(['phones', 'laptops', 'tablets', 'accessories', 'parts']),
  brand: z.string().min(1, 'Brand is required'),
  price: z.coerce.number().positive('Price must be positive'),
  cost_price: z.coerce.number().nonnegative().optional(),
  description: z.string().optional(),
  barcode: z.string().optional(),
  battery_health: z.preprocess(
    v => (v === '' ? undefined : v),
    z.coerce.number().min(0).max(100).optional(),
  ),
  battery_cycle_count: z.preprocess(
    v => (v === '' ? undefined : v),
    z.coerce.number().min(0).optional(),
  ),
  icloud_lock_status: z.preprocess(
    v => (v === '' ? undefined : v),
    z
      .enum([
        'clean',
        'ibm',
        'idm',
        'icm',
        'icloud_locked',
        'find_my_on',
        'find_my_off',
      ])
      .optional(),
  ),
  carrier_lock: z.preprocess(
    v => (v === '' ? undefined : v),
    z
      .enum(['factory_unlocked', 'network_locked', 'esim_only', 'dual_sim'])
      .optional(),
  ),
  network_status: z.preprocess(
    v => (v === '' ? undefined : v),
    z
      .enum(['factory_unlocked', 'worldwide_unlocked', 'chip_locked', 'carrier_locked'])
      .optional(),
  ),
  sim_configuration: z.preprocess(
    v => (v === '' ? undefined : v),
    z
      .enum([
        'physical_sim_only',
        'esim_only',
        'physical_plus_esim',
        'dual_physical_sim',
        'inbuilt_chip',
      ])
      .optional(),
  ),
  esim_status: z.preprocess(
    v => (v === '' ? undefined : v),
    z.enum(['esim_unlocked', 'esim_locked_wifi_only']).optional(),
  ),
  biometric_status: z.preprocess(
    v => (v === '' ? undefined : v),
    z.enum(['working', 'not_working']).optional(),
  ),
  storage: z.preprocess(
    v => (v === '' ? undefined : v),
    z.enum(['64GB', '128GB', '256GB', '512GB', '1TB', '2TB']).optional(),
  ),
  color: z.string().optional(),
  ram: z.preprocess(
    v => (v === '' ? undefined : v),
    z.enum(['8GB', '16GB', '18GB', '24GB', '32GB', '36GB', '64GB']).optional(),
  ),
  chip: z.string().optional(),
  screen_size: z.preprocess(
    v => (v === '' ? undefined : v),
    z.enum(['13"', '14"', '15"', '16"']).optional(),
  ),
  keyboard_status: z.preprocess(
    v => (v === '' ? undefined : v),
    z.enum(['working', 'faulty_keys', 'replaced']).optional(),
  ),
  screen_condition: z.preprocess(
    v => (v === '' ? undefined : v),
    z.enum(['perfect', 'minor_scratches', 'cracked', 'replaced']).optional(),
  ),
  important_battery_message: z.boolean().optional(),
  important_display_message: z.boolean().optional(),
  important_camera_message: z.boolean().optional(),
  mdm_ibm: z.boolean().optional(),
  mdm_idm: z.boolean().optional(),
  mdm_icm: z.boolean().optional(),
};

const serializedSchema = z
  .object({
    ...baseSchema,
    serial_number: z.string().optional(),
    imei: z.string().optional(),
    imei2: z.string().optional(),
    condition: z.preprocess(
      value => (value === '' ? undefined : value),
      z
        .enum(['working', 'minor_faults', 'major_faults', 'not_working'])
        .optional(),
    ),
    // Not used for serialized but must be in shape
    quantity: z.coerce.number().optional(),
    low_stock_threshold: z.coerce.number().optional(),
  })
  .superRefine((data, ctx) => {
    if (getCategoryMode(data.category) !== 'serialized') return;
    if (categoryRequiresImei(data.category)) {
      const digits = normalizeImeiDigits(data.imei);
      if (!isPlausibleImei(digits)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'IMEI is required for phones and tablets (14–17 digits).',
          path: ['imei'],
        });
      }
    }
    if (categoryRequiresSerialNumber(data.category)) {
      if (!(data.serial_number ?? '').trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Serial number is required for laptops.',
          path: ['serial_number'],
        });
      }
    }
  });

type FormData = z.infer<typeof serializedSchema> & {
  quantity?: number;
  low_stock_threshold?: number;
};

const CATEGORIES: {value: Category; label: string}[] = [
  {value: 'phones', label: 'Phones'},
  {value: 'laptops', label: 'Laptops'},
  {value: 'tablets', label: 'Tablets'},
  {value: 'accessories', label: 'Accessories'},
  {value: 'parts', label: 'Parts'},
];

const CONDITION_OPTIONS: {value: DeviceCondition; label: string}[] = [
  {value: 'working', label: 'Working'},
  {value: 'minor_faults', label: 'Minor Faults'},
  {value: 'major_faults', label: 'Major Faults'},
  {value: 'not_working', label: 'Not Working'},
];

const ICLOUD_OPTIONS: {value: AppleICloudStatus; label: string}[] = [
  {value: 'clean', label: 'Clean'},
  {
    value: 'ibm',
    label: 'IBM — (often with Important Battery / Unknown Part)',
  },
  {
    value: 'idm',
    label: 'IDM — (often with Important Display / Unknown Part)',
  },
  {
    value: 'icm',
    label: 'IDM — (often with Important Camera / Unknown Part)',
  },
  {value: 'icm', label: 'ICM — iCloud managed (enterprise)'},
  {value: 'icloud_locked', label: 'iCloud Locked'},
  {value: 'find_my_on', label: 'Find My On'},
  {value: 'find_my_off', label: 'Find My Off'},
];


const NETWORK_STATUS_FORM_OPTIONS = NETWORK_STATUS_OPTIONS.map(o => ({
  value: o.value,
  label: o.label,
}));

const SIM_CONFIG_FORM_OPTIONS = SIM_CONFIG_OPTIONS.map(o => ({
  value: o.value,
  label: o.label,
}));

const ESIM_STATUS_FORM_OPTIONS = ESIM_STATUS_OPTIONS.map(o => ({
  value: o.value,
  label: o.label,
}));

const BIOMETRIC_OPTIONS: {value: AppleBiometricStatus; label: string}[] = [
  {value: 'working', label: 'Working'},
  {value: 'not_working', label: 'Not Working'},
];

const MOBILE_STORAGE_OPTIONS = [
  '64GB',
  '128GB',
  '256GB',
  '512GB',
  '1TB',
] as const;
const LAPTOP_STORAGE_OPTIONS = ['256GB', '512GB', '1TB', '2TB'] as const;
const RAM_OPTIONS = [
  '8GB',
  '16GB',
  '18GB',
  '24GB',
  '32GB',
  '36GB',
  '64GB',
] as const;
const SCREEN_SIZE_OPTIONS = ['13"', '14"', '15"', '16"'] as const;
const KEYBOARD_OPTIONS: {value: MacKeyboardStatus; label: string}[] = [
  {value: 'working', label: 'Working'},
  {value: 'faulty_keys', label: 'Faulty Keys'},
  {value: 'replaced', label: 'Replaced'},
];
const SCREEN_CONDITION_OPTIONS: {value: MacScreenCondition; label: string}[] = [
  {value: 'perfect', label: 'Perfect'},
  {value: 'minor_scratches', label: 'Minor Scratches'},
  {value: 'cracked', label: 'Cracked'},
  {value: 'replaced', label: 'Replaced'},
];

type ScanTarget = 'serial_number' | 'imei' | 'imei2' | 'barcode';

const SELECT_NONE = '__none__';

const shellFieldClass = settingsField;
const shellLabelClass = settingsLabel;
const shellSectionClass =
  'space-y-4 rounded-lg border border-shell-line bg-shell-surface/80 p-4';
const shellSectionHeadingClass =
  'font-display text-sm font-semibold uppercase tracking-wide text-shell-ink';
const shellHintClass = 'text-[11px] leading-snug text-shell-muted';
const shellHintStrongClass = 'text-shell-ink';

interface ItemFormProps {
  defaultValues?: Partial<FormData> & {
    deviceDetails?: InventoryItemInput['deviceDetails'];
  };
  onSubmit: (data: InventoryItemInput) => Promise<void>;
  submitLabel?: string;
  /** When set, shows "Add Another" button after successful save */
  onAddAnother?: (baseValues: Partial<FormData>) => void;
  /** Called after a normal save (not "Add Another") */
  onSaved?: () => void;
  variant?: 'page' | 'modal';
}

export default function ItemForm({
  defaultValues,
  onSubmit,
  submitLabel = 'Save Item',
  onAddAnother,
  onSaved,
  variant = 'page',
}: ItemFormProps) {
  const isModal = variant === 'modal';
  const {canViewProfit} = useShopAccess();
  const [scanTarget, setScanTarget] = useState<ScanTarget | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const deviceDetails = defaultValues?.deviceDetails;
  const parsedNetwork = networkStateFromDeviceDetails(
    deviceDetails &&
      typeof deviceDetails === 'object' &&
      ('network_status' in deviceDetails || 'carrier_lock' in deviceDetails)
      ? deviceDetails
      : undefined,
  );

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: {errors, isSubmitting},
  } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(serializedSchema) as any,
    defaultValues: {
      quantity: 0,
      low_stock_threshold: 5,
      category: 'phones',
      battery_health:
        deviceDetails && 'battery_health' in deviceDetails
          ? deviceDetails.battery_health
          : undefined,
      battery_cycle_count:
        deviceDetails && 'battery_cycle_count' in deviceDetails
          ? deviceDetails.battery_cycle_count
          : undefined,
      icloud_lock_status:
        deviceDetails && 'icloud_lock_status' in deviceDetails
          ? deviceDetails.icloud_lock_status
          : undefined,
      carrier_lock:
        deviceDetails && 'carrier_lock' in deviceDetails
          ? deviceDetails.carrier_lock
          : undefined,
      network_status: parsedNetwork.status || undefined,
      sim_configuration: parsedNetwork.simConfig || undefined,
      esim_status: parsedNetwork.esimStatus || undefined,
      biometric_status:
        deviceDetails && 'biometric_status' in deviceDetails
          ? deviceDetails.biometric_status
          : undefined,
      storage:
        deviceDetails && 'storage' in deviceDetails
          ? deviceDetails.storage
          : undefined,
      color:
        deviceDetails && 'color' in deviceDetails
          ? deviceDetails.color
          : undefined,
      ram:
        deviceDetails && 'ram' in deviceDetails ? deviceDetails.ram : undefined,
      chip:
        deviceDetails && 'chip' in deviceDetails
          ? deviceDetails.chip
          : undefined,
      screen_size:
        deviceDetails && 'screen_size' in deviceDetails
          ? deviceDetails.screen_size
          : undefined,
      keyboard_status:
        deviceDetails && 'keyboard_status' in deviceDetails
          ? deviceDetails.keyboard_status
          : undefined,
      screen_condition:
        deviceDetails && 'screen_condition' in deviceDetails
          ? deviceDetails.screen_condition
          : undefined,
      important_battery_message:
        deviceDetails && 'important_battery_message' in deviceDetails
          ? Boolean(deviceDetails.important_battery_message)
          : false,
      important_display_message:
        deviceDetails && 'important_display_message' in deviceDetails
          ? Boolean(deviceDetails.important_display_message)
          : false,
      important_camera_message:
        deviceDetails && 'important_camera_message' in deviceDetails
          ? Boolean(deviceDetails.important_camera_message)
          : false,
      mdm_ibm:
        deviceDetails && 'mdm_ibm' in deviceDetails
          ? Boolean(deviceDetails.mdm_ibm)
          : false,
      mdm_idm:
        deviceDetails && 'mdm_idm' in deviceDetails
          ? Boolean(deviceDetails.mdm_idm)
          : false,
      mdm_icm:
        deviceDetails && 'mdm_icm' in deviceDetails
          ? Boolean(deviceDetails.mdm_icm)
          : false,
      ...defaultValues,
    },
  });

  const category = watch('category') as Category;
  const brand = watch('brand') ?? '';
  const nameSuggestions = useMemo(
    () => suggestedNamesForCategoryAndBrand(category, brand),
    [category, brand],
  );
  const mode = getCategoryMode(category);
  const isSerialized = mode === 'serialized';
  const showImei = category === 'phones' || category === 'tablets';
  const showAppleMobileFields = isAppleMobileDevice(brand, category);
  const showAppleLaptopFields = isAppleLaptopDevice(brand, category);

  const networkStatus = watch('network_status');
  const simConfiguration = watch('sim_configuration');

  const handleScan = (value: string) => {
    if (scanTarget) setValue(scanTarget, value);
    setScanTarget(null);
  };

  const submit = async (data: FormData, options?: {fromAddAnother?: boolean}) => {
    const input: InventoryItemInput = {
      name: data.name,
      category: data.category as Category,
      brand: data.brand,
      price: data.price,
      cost_price: canViewProfit ? data.cost_price : undefined,
      description: data.description,
      barcode: data.barcode,
      serial_number: isSerialized ? data.serial_number : undefined,
      imei: isSerialized && showImei ? data.imei : undefined,
      imei2: isSerialized && showImei ? data.imei2 : undefined,
      condition: isSerialized ? data.condition : undefined,
      deviceDetails: showAppleMobileFields
        ? {
            battery_health: data.battery_health,
            battery_cycle_count: data.battery_cycle_count,
            icloud_lock_status: data.icloud_lock_status,
            biometric_status: data.biometric_status,
            ...mobileNetworkDeviceDetails({
              status: data.network_status ?? '',
              simConfig: data.sim_configuration ?? '',
              esimStatus: data.esim_status ?? '',
            }),
            storage: data.storage as
              | '64GB'
              | '128GB'
              | '256GB'
              | '512GB'
              | '1TB'
              | undefined,
            color: data.color || undefined,
            ...(data.important_battery_message
              ? {important_battery_message: true}
              : {}),
            ...(data.important_display_message
              ? {important_display_message: true}
              : {}),
            ...(data.important_camera_message
              ? {important_camera_message: true}
              : {}),
            serviced_battery_third_party:
              typeof data.battery_health === 'number' &&
              data.battery_health < 80,
            ...(data.mdm_ibm ? {mdm_ibm: true} : {}),
            ...(data.mdm_idm ? {mdm_idm: true} : {}),
            ...(data.mdm_icm ? {mdm_icm: true} : {}),
          }
        : showAppleLaptopFields
          ? {
              battery_health: data.battery_health,
              battery_cycle_count: data.battery_cycle_count,
              storage: data.storage as
                | '256GB'
                | '512GB'
                | '1TB'
                | '2TB'
                | undefined,
              ram: data.ram,
              chip: data.chip || undefined,
              screen_size: data.screen_size,
              keyboard_status: data.keyboard_status,
              screen_condition: data.screen_condition,
              color: data.color || undefined,
            }
          : undefined,
      quantity: isSerialized ? 1 : (data.quantity ?? 0),
      low_stock_threshold: isSerialized ? 0 : (data.low_stock_threshold ?? 5),
    };
    await onSubmit(input);
    setSavedCount(c => c + 1);
    if (!options?.fromAddAnother) {
      onSaved?.();
    }
  };

  const handleAddAnother = handleSubmit(async data => {
    await submit(data, {fromAddAnother: true});
    // Keep brand/name/price/cost_price/category — clear identifiers
    const base: Partial<FormData> = {
      name: data.name,
      brand: data.brand,
      category: data.category,
      price: data.price,
      cost_price: canViewProfit ? data.cost_price : undefined,
      description: data.description,
      battery_health: data.battery_health,
      battery_cycle_count: data.battery_cycle_count,
      icloud_lock_status: data.icloud_lock_status,
      network_status: data.network_status,
      sim_configuration: data.sim_configuration,
      esim_status: data.esim_status,
      biometric_status: data.biometric_status,
      important_battery_message: data.important_battery_message,
      important_display_message: data.important_display_message,
      important_camera_message: data.important_camera_message,
      mdm_ibm: data.mdm_ibm,
      mdm_idm: data.mdm_idm,
      mdm_icm: data.mdm_icm,
      storage: data.storage,
      color: data.color,
      ram: data.ram,
      chip: data.chip,
      screen_size: data.screen_size,
      keyboard_status: data.keyboard_status,
      screen_condition: data.screen_condition,
      low_stock_threshold: data.low_stock_threshold,
      quantity: data.quantity,
    };
    if (onAddAnother) {
      onAddAnother(base);
    } else {
      reset({...base, serial_number: '', imei: '', imei2: '', barcode: ''});
    }
  });

  const fieldClass = shellFieldClass;
  const labelClass = shellLabelClass;
  const sectionClass = shellSectionClass;
  const sectionHeadingClass = shellSectionHeadingClass;
  const errorClass = 'text-red-400 text-xs mt-1';

  return (
    <>
      <form
        onSubmit={handleSubmit(submit as never)}
        className={cn(
          'space-y-4',
          isModal ? 'pb-2' : 'app-page py-4 md:py-6 pb-28 max-lg:pb-36 lg:pb-32',
        )}>
        {/* Saved count banner */}
        {savedCount > 0 && onAddAnother && (
          <div className='flex items-center gap-2 bg-teal/10 border border-teal/30 text-teal rounded-xl px-4 py-2.5 text-sm font-medium'>
            <CheckCircle2 size={16} />
            {savedCount} unit{savedCount !== 1 ? 's' : ''} added
          </div>
        )}

        {/* Basic info */}
        <section className={sectionClass}>
          <h3 className={sectionHeadingClass}>Basic Info</h3>

          <p className={shellHintClass}>
            Choose{' '}
            <strong className={shellHintStrongClass}>category</strong> and{' '}
            <strong className={shellHintStrongClass}>brand</strong> first — item name suggestions filter by brand so lists stay relevant
            (you can still type anything).
          </p>

          <div className='grid grid-cols-2 gap-3'>
            <div>
              <Label className={labelClass} htmlFor='category'>
                Category *
              </Label>
              <Controller
                name='category'
                control={control}
                render={({field}) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id='category' className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <Controller
              name='brand'
              control={control}
              render={({field}) => (
                <ComboboxField
                  {...field}
                  id='brand'
                  label='Brand *'
                  options={BRAND_SUGGESTIONS}
                  placeholder='Search brands or type…'
                  error={errors.brand?.message}
                  emptyHint='Pick from the list or type any brand — names below update to match.'
                />
              )}
            />
          </div>

          {nameSuggestions.length > 0 ? (
            <Controller
              name='name'
              control={control}
              render={({field}) => (
                <ComboboxField
                  {...field}
                  id='name'
                  label='Item Name *'
                  options={nameSuggestions}
                  placeholder={
                    brand.trim()
                      ? 'Pick a model or type your own'
                      : 'Pick brand for filtered models, or type any name'
                  }
                  error={errors.name?.message}
                  emptyHint='Suggestions update when you change brand. Custom names always allowed.'
                />
              )}
            />
          ) : (
            <div>
              <Label className={labelClass} htmlFor='name'>
                Item Name *
              </Label>
              <Input
                id='name'
                {...register('name')}
                placeholder='e.g. USB-C Cable 2m'
                className={fieldClass}
              />
              {errors.name && (
                <p className={errorClass}>{errors.name.message}</p>
              )}
            </div>
          )}

          {/* Mode hint */}
          <p className='text-xs text-shell-muted rounded-lg border border-shell-line bg-shell-surface-2/40 px-3 py-2'>
            {isSerialized
              ? 'Serialized mode — each unit is a separate record. Add one unit at a time.'
              : 'Non-serialized mode — tracked by quantity.'}
          </p>

          <div>
            <Label className={labelClass} htmlFor='description'>
              Description
            </Label>
            <Textarea
              id='description'
              {...register('description')}
              rows={2}
              placeholder='Optional notes'
              className={`${fieldClass} resize-none`}
            />
          </div>

          {(showAppleMobileFields || showAppleLaptopFields) && (
            <p className='text-xs text-brand-300 rounded-lg border border-brand-400/20 bg-brand-500/10 px-3 py-2'>
              Apple device details will be saved as structured metadata and will
              appear in search, inventory badges, and receipts.
            </p>
          )}
        </section>

        {/* Pricing */}
        <section className={sectionClass}>
          <h3 className={sectionHeadingClass}>Pricing</h3>
          <div
            className={`grid gap-3 ${canViewProfit ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div>
              <Label className={labelClass} htmlFor='price'>
                Selling Price (₦) *
              </Label>
              <Controller
                name='price'
                control={control}
                render={({field}) => (
                  <CurrencyInput
                    id='price'
                    ref={field.ref}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    className={fieldClass}
                    placeholder='₦0'
                    aria-invalid={!!errors.price}
                  />
                )}
              />
              {errors.price && (
                <p className={errorClass}>{errors.price.message}</p>
              )}
            </div>
            {canViewProfit && (
              <div>
                <Label className={labelClass} htmlFor='cost_price'>
                  Cost Price (₦)
                </Label>
                <Controller
                  name='cost_price'
                  control={control}
                  render={({field}) => (
                    <CurrencyInput
                      id='cost_price'
                      ref={field.ref}
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      allowEmpty
                      className={fieldClass}
                      placeholder='Optional'
                      aria-invalid={!!errors.cost_price}
                    />
                  )}
                />
                {errors.cost_price && (
                  <p className={errorClass}>{errors.cost_price.message}</p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Stock — only for non-serialized */}
        {!isSerialized && (
          <section className={sectionClass}>
            <h3 className={sectionHeadingClass}>Stock</h3>
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <Label className={labelClass} htmlFor='quantity'>
                  Quantity *
                </Label>
                <Input
                  id='quantity'
                  type='number'
                  inputMode='numeric'
                  {...register('quantity')}
                  className={fieldClass}
                />
                {errors.quantity && (
                  <p className={errorClass}>{errors.quantity.message}</p>
                )}
              </div>
              <div>
                <Label className={labelClass} htmlFor='low_stock_threshold'>
                  Low Stock Alert
                </Label>
                <Input
                  id='low_stock_threshold'
                  type='number'
                  inputMode='numeric'
                  {...register('low_stock_threshold')}
                  className={fieldClass}
                />
              </div>
            </div>
          </section>
        )}

        {/* Identifiers */}
        <section className={sectionClass}>
          <h3 className={sectionHeadingClass}>
            {isSerialized ? 'Identifiers *' : 'Identifiers'}
          </h3>

          {isSerialized && (
            <div>
              <ScanField
                id='serial_number'
                label={
                  categoryRequiresSerialNumber(category)
                    ? 'Serial Number *'
                    : 'Serial Number'
                }
                placeholder='S/N'
                {...register('serial_number')}
                onScan={() => setScanTarget('serial_number')}
              />
              {errors.serial_number && (
                <p className={errorClass}>{errors.serial_number.message}</p>
              )}
            </div>
          )}

          {isSerialized && (
            <Controller
              name='condition'
              control={control}
              render={({field}) => (
                <OptionalStringSelect
                  id='condition'
                  label='Condition'
                  labelClassName={labelClass}
                  placeholder='Select condition'
                  value={field.value}
                  onChange={field.onChange}
                  options={CONDITION_OPTIONS}
                />
              )}
            />
          )}

          {isSerialized && showImei && (
            <>
              <div>
                <ScanField
                  id='imei'
                  label='IMEI 1 *'
                  placeholder='15-digit IMEI'
                  {...register('imei')}
                  onScan={() => setScanTarget('imei')}
                />
                {errors.imei && (
                  <p className={errorClass}>{errors.imei.message}</p>
                )}
              </div>
              <ScanField
                id='imei2'
                label='IMEI 2 (dual SIM)'
                placeholder='15-digit IMEI'
                {...register('imei2')}
                onScan={() => setScanTarget('imei2')}
              />
            </>
          )}

          <ScanField
            id='barcode'
            label='Barcode / QR'
            placeholder='Scan or enter manually'
            {...register('barcode')}
            onScan={() => setScanTarget('barcode')}
          />
        </section>

        {showAppleMobileFields && (
          <section className={sectionClass}>
            <h3 className={sectionHeadingClass}>Apple Device Details</h3>
            <div className='grid grid-cols-2 gap-3'>
              <NumberField
                id='battery_health'
                label='Battery Health'
                register={register('battery_health')}
                suffix='%'
              />
              <NumberField
                id='battery_cycle_count'
                label='Battery Cycle Count'
                register={register('battery_cycle_count')}
              />
            </div>
            <Controller
              name='icloud_lock_status'
              control={control}
              render={({field}) => (
                <OptionalStringSelect
                  id='icloud_lock_status'
                  label='iCloud Lock Status'
                  labelClassName={labelClass}
                  placeholder='Select option'
                  value={field.value}
                  onChange={field.onChange}
                  options={ICLOUD_OPTIONS}
                />
              )}
            />
            <p className={cn(shellHintClass, 'rounded-lg border border-shell-line bg-shell-surface-2/40 px-3 py-2')}>
              Apple shows{' '}
              <strong className={shellHintStrongClass}>Important Battery Message</strong> or{' '}
              <strong className={shellHintStrongClass}>Important Display Message</strong> /{' '}
              <strong className={shellHintStrongClass}>Unknown Part</strong> in Settings when a part wasn&apos;t verified through Apple or an
              Authorized Provider — separate from Find My / iCloud lock. Trade terms{' '}
              <strong className={shellHintStrongClass}>IBM</strong>,{' '}
              <strong className={shellHintStrongClass}>IDM</strong>,{' '}
              <strong className={shellHintStrongClass}>ICM</strong> often pair with those warnings; tick all that apply on this unit.{' '}
              <strong className={shellHintStrongClass}>Battery health under 80%</strong> is stored automatically as a serviced / low-health battery
              disclosure (receipts and badges).
            </p>
            <div className='space-y-2.5 rounded-xl border border-shell-line bg-shell-surface-2/35 px-3 py-3'>
              <p className='text-xs font-semibold text-shell-ink'>
                Disclosures (check all that apply)
              </p>
              <div className='grid gap-2.5 sm:grid-cols-2'>
                <AppleDetailCheckbox
                  control={control}
                  name='important_battery_message'
                  id='important_battery_message'
                  label='Important Battery Message'
                  hint='Non-genuine or unverified battery (Settings → Battery / About)'
                />
                <AppleDetailCheckbox
                  control={control}
                  name='important_display_message'
                  id='important_display_message'
                  label='Important Display Message'
                  hint='Non-genuine or unverified display (About → Parts history)'
                />
                <AppleDetailCheckbox
                  control={control}
                  name='important_camera_message'
                  id='important_camera_message'
                  label='Important Camera Message'
                  hint='Non-genuine or unverified camera (Settings → Camera / About)'
                />
                <AppleDetailCheckbox
                  control={control}
                  name='mdm_ibm'
                  id='mdm_ibm'
                  label='IBM (bypass MDM)'
                  hint='Extra flag beyond dropdown, if needed'
                />
                <AppleDetailCheckbox
                  control={control}
                  name='mdm_idm'
                  id='mdm_idm'
                  label='IDM profile'
                  hint='iCloud disabled – MDM disclosure'
                />
                <AppleDetailCheckbox
                  control={control}
                  name='mdm_icm'
                  id='mdm_icm'
                  label='ICM (managed)'
                  hint='Enterprise / managed iCloud'
                />
              </div>
            </div>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
              <Controller
                name='network_status'
                control={control}
                render={({field}) => (
                  <OptionalStringSelect
                    id='network_status'
                    label='Network / unlock'
                    labelClassName={labelClass}
                    placeholder='Select unlock status'
                    value={field.value}
                    onChange={field.onChange}
                    options={NETWORK_STATUS_FORM_OPTIONS}
                  />
                )}
              />
              <Controller
                name='biometric_status'
                control={control}
                render={({field}) => (
                  <OptionalStringSelect
                    id='biometric_status'
                    label='Face ID / Touch ID'
                    labelClassName={labelClass}
                    placeholder='Select option'
                    value={field.value}
                    onChange={field.onChange}
                    options={BIOMETRIC_OPTIONS}
                  />
                )}
              />
            </div>
            {networkStatus ? (
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                <Controller
                  name='sim_configuration'
                  control={control}
                  render={({field}) => (
                    <OptionalStringSelect
                      id='sim_configuration'
                      label='SIM configuration'
                      labelClassName={labelClass}
                      placeholder='Select SIM setup'
                      value={field.value}
                      onChange={field.onChange}
                      options={SIM_CONFIG_FORM_OPTIONS}
                    />
                  )}
                />
                {simConfigNeedsEsimStatus(simConfiguration ?? '') ? (
                  <Controller
                    name='esim_status'
                    control={control}
                    render={({field}) => (
                      <OptionalStringSelect
                        id='esim_status'
                        label='eSIM activation'
                        labelClassName={labelClass}
                        placeholder='Select eSIM status'
                        value={field.value}
                        onChange={field.onChange}
                        options={ESIM_STATUS_FORM_OPTIONS}
                      />
                    )}
                  />
                ) : null}
              </div>
            ) : null}
            <div className='grid grid-cols-2 gap-3'>
              <Controller
                name='storage'
                control={control}
                render={({field}) => (
                  <OptionalStringSelect
                    id='storage'
                    label='Storage'
                    labelClassName={labelClass}
                    placeholder='Select storage'
                    value={field.value}
                    onChange={field.onChange}
                    options={MOBILE_STORAGE_OPTIONS.map(o => ({
                      value: o,
                      label: o,
                    }))}
                  />
                )}
              />
              <div>
                <Label className={labelClass} htmlFor='color'>
                  Color
                </Label>
                <Input
                  id='color'
                  {...register('color')}
                  className={fieldClass}
                  placeholder='Black Titanium'
                />
              </div>
            </div>
          </section>
        )}

        {showAppleLaptopFields && (
          <section className={sectionClass}>
            <h3 className={sectionHeadingClass}>MacBook Details</h3>
            <div className='grid grid-cols-2 gap-3'>
              <NumberField
                id='battery_cycle_count'
                label='Battery Cycle Count'
                register={register('battery_cycle_count')}
              />
              <NumberField
                id='battery_health'
                label='Battery Health'
                register={register('battery_health')}
                suffix='%'
              />
            </div>
            <div className='grid grid-cols-2 gap-3'>
              <Controller
                name='storage'
                control={control}
                render={({field}) => (
                  <OptionalStringSelect
                    id='storage'
                    label='Storage'
                    labelClassName={labelClass}
                    placeholder='Select storage'
                    value={field.value}
                    onChange={field.onChange}
                    options={LAPTOP_STORAGE_OPTIONS.map(o => ({
                      value: o,
                      label: o,
                    }))}
                  />
                )}
              />
              <Controller
                name='ram'
                control={control}
                render={({field}) => (
                  <OptionalStringSelect
                    id='ram'
                    label='RAM'
                    labelClassName={labelClass}
                    placeholder='Select RAM'
                    value={field.value}
                    onChange={field.onChange}
                    options={RAM_OPTIONS.map(o => ({value: o, label: o}))}
                  />
                )}
              />
            </div>
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <Label className={labelClass} htmlFor='chip'>
                  Chip
                </Label>
                <Input
                  id='chip'
                  {...register('chip')}
                  className={fieldClass}
                  placeholder='M5 Max'
                />
              </div>
              <Controller
                name='screen_size'
                control={control}
                render={({field}) => (
                  <OptionalStringSelect
                    id='screen_size'
                    label='Screen Size'
                    labelClassName={labelClass}
                    placeholder='Select size'
                    value={field.value}
                    onChange={field.onChange}
                    options={SCREEN_SIZE_OPTIONS.map(o => ({
                      value: o,
                      label: o,
                    }))}
                  />
                )}
              />
            </div>
            <div className='grid grid-cols-2 gap-3'>
              <Controller
                name='keyboard_status'
                control={control}
                render={({field}) => (
                  <OptionalStringSelect
                    id='keyboard_status'
                    label='Keyboard Status'
                    labelClassName={labelClass}
                    placeholder='Select option'
                    value={field.value}
                    onChange={field.onChange}
                    options={KEYBOARD_OPTIONS}
                  />
                )}
              />
              <Controller
                name='screen_condition'
                control={control}
                render={({field}) => (
                  <OptionalStringSelect
                    id='screen_condition'
                    label='Screen Condition'
                    labelClassName={labelClass}
                    placeholder='Select option'
                    value={field.value}
                    onChange={field.onChange}
                    options={SCREEN_CONDITION_OPTIONS}
                  />
                )}
              />
            </div>
            <div>
              <Label className={labelClass} htmlFor='color'>
                Color
              </Label>
              <Input
                id='color'
                {...register('color')}
                className={fieldClass}
                placeholder='Space Black'
              />
            </div>
          </section>
        )}

        {/* Submit buttons */}
        <div
          className={cn(
            isModal
              ? 'sticky bottom-0 -mx-1 border-t border-shell-line bg-shell-surface pt-3 pb-1'
              : 'fixed z-30 max-lg:bottom-[0] lg:bottom-0 left-0 right-0 px-3 md:px-5 pb-[max(0.35rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-shell-bg via-shell-bg/96 to-transparent pt-3 pb-4',
          )}>
          <div
            className={cn(
              'w-full grid gap-2',
              isSerialized && onAddAnother ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1',
              !isModal && 'max-w-lg mx-auto lg:max-w-3xl xl:max-w-4xl',
            )}>
            <button
              type='submit'
              disabled={isSubmitting}
              className={cn(
                'rounded-xl py-3.5 font-display font-semibold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 bg-brand-400 text-[#04231d] hover:bg-brand-300',
              )}>
              {isSubmitting && <Loader2 size={16} className='animate-spin' />}
              {submitLabel}
            </button>

            {isSerialized && onAddAnother && (
              <button
                type='button'
                disabled={isSubmitting}
                onClick={handleAddAnother}
                className={cn(
                  'rounded-xl py-3.5 font-display font-semibold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 border border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2',
                )}>
                {isSubmitting ? (
                  <Loader2 size={16} className='animate-spin' />
                ) : (
                  <Plus size={16} />
                )}
                Add Another
              </button>
            )}
          </div>
        </div>
      </form>

      {scanTarget && (
        <Suspense fallback={null}>
          <BarcodeScanner
            onScan={handleScan}
            onClose={() => setScanTarget(null)}
          />
        </Suspense>
      )}
    </>
  );
}

function AppleDetailCheckbox({
  control,
  name,
  id,
  label,
  hint,
}: {
  control: Control<FormData>;
  name:
    | 'important_battery_message'
    | 'important_display_message'
    | 'important_camera_message'
    | 'mdm_ibm'
    | 'mdm_idm'
    | 'mdm_icm';
  id: string;
  label: string;
  hint: string;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({field}) => (
        <label
          htmlFor={id}
          className='flex cursor-pointer gap-2.5 rounded-lg border border-shell-line bg-shell-surface-2/35 px-2.5 py-2 text-left'>
          <Checkbox
            id={id}
            className='mt-0.5'
            checked={field.value ?? false}
            onCheckedChange={checked => field.onChange(checked === true)}
          />
          <span className='min-w-0'>
            <span className='block text-sm font-medium text-shell-ink'>{label}</span>
            <span className='block text-[10px] leading-snug text-shell-muted'>{hint}</span>
          </span>
        </label>
      )}
    />
  );
}

// ─── Scan field component ─────────────────────────────────────────────────────

interface ScanFieldProps extends ComponentProps<typeof Input> {
  id: string;
  label: string;
  onScan: () => void;
}

const ScanField = ({id, label, onScan, className, ...props}: ScanFieldProps) => (
  <div>
    <Label className={shellLabelClass} htmlFor={id}>
      {label}
    </Label>
    <div className='flex gap-2'>
      <Input id={id} className={cn(shellFieldClass, 'flex-1', className)} {...props} />
      <button
        type='button'
        onClick={onScan}
        className='shrink-0 rounded-lg border border-shell-line bg-shell-surface px-3 py-2.5 text-shell-muted transition-colors hover:bg-shell-surface-2 hover:text-brand-300'
        aria-label={`Scan ${label}`}>
        <ScanLine size={18} />
      </button>
    </div>
  </div>
);

function NumberField({
  id,
  label,
  register,
  suffix,
}: {
  id: string;
  label: string;
  register: ReturnType<typeof useForm<FormData>>['register'] extends (
    ...args: infer _A
  ) => infer _R
    ? _R
    : never;
  suffix?: string;
}) {
  return (
    <div>
      <Label className={shellLabelClass} htmlFor={id}>
        {label}
      </Label>
      <div className='relative'>
        <Input
          id={id}
          type='number'
          inputMode='numeric'
          {...register}
          className={cn(shellFieldClass, 'pr-8')}
        />
        {suffix && (
          <span className='absolute right-3 top-1/2 -translate-y-1/2 text-xs text-shell-muted'>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function OptionalStringSelect({
  id,
  label,
  labelClassName,
  placeholder,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  labelClassName: string;
  placeholder: string;
  value: string | undefined;
  onChange: (v: string) => void;
  options: {value: string; label: string}[];
}) {
  const selectValue = value && value !== '' ? value : SELECT_NONE;
  /** Remount when toggling unset ↔ set so Radix Select reliably shows the sentinel row after clearing. */
  const selectInstanceKey = value && value !== '' ? 'set' : 'empty';
  return (
    <div>
      <Label className={labelClassName} htmlFor={id}>
        {label}
      </Label>
      <Select
        key={selectInstanceKey}
        value={selectValue}
        onValueChange={v => onChange(v === SELECT_NONE ? '' : v)}>
        <SelectTrigger id={id} className='w-full'>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SELECT_NONE}>{placeholder}</SelectItem>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
