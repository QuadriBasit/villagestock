import { useState, lazy, Suspense, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ScanLine, Plus, CheckCircle2 } from 'lucide-react';
import { getCategoryMode, isAppleLaptopDevice, isAppleMobileDevice } from '@/types';
import { BRAND_SUGGESTIONS, suggestedNamesForCategoryAndBrand } from '@/lib/devicePresets';
import { ComboboxField } from '@/components/ui/ComboboxField';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import type { InventoryItemInput, Category, DeviceCondition, AppleICloudStatus, AppleCarrierLock, AppleBiometricStatus, MacKeyboardStatus, MacScreenCondition } from '@/types';

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
  battery_health: z.preprocess(v => v === '' ? undefined : v, z.coerce.number().min(0).max(100).optional()),
  battery_cycle_count: z.preprocess(v => v === '' ? undefined : v, z.coerce.number().min(0).optional()),
  icloud_lock_status: z.preprocess(v => v === '' ? undefined : v, z.enum(['clean', 'ibm', 'idm', 'icm', 'icloud_locked', 'find_my_on', 'find_my_off']).optional()),
  carrier_lock: z.preprocess(v => v === '' ? undefined : v, z.enum(['factory_unlocked', 'network_locked', 'esim_only', 'dual_sim']).optional()),
  biometric_status: z.preprocess(v => v === '' ? undefined : v, z.enum(['working', 'not_working']).optional()),
  storage: z.preprocess(v => v === '' ? undefined : v, z.enum(['64GB', '128GB', '256GB', '512GB', '1TB', '2TB']).optional()),
  color: z.string().optional(),
  ram: z.preprocess(v => v === '' ? undefined : v, z.enum(['8GB', '16GB', '18GB', '24GB', '32GB', '36GB', '64GB']).optional()),
  chip: z.string().optional(),
  screen_size: z.preprocess(v => v === '' ? undefined : v, z.enum(['13"', '14"', '15"', '16"']).optional()),
  keyboard_status: z.preprocess(v => v === '' ? undefined : v, z.enum(['working', 'faulty_keys', 'replaced']).optional()),
  screen_condition: z.preprocess(v => v === '' ? undefined : v, z.enum(['perfect', 'minor_scratches', 'cracked', 'replaced']).optional()),
};

const serializedSchema = z.object({
  ...baseSchema,
  serial_number: z.string().optional(),
  imei: z.string().optional(),
  imei2: z.string().optional(),
  condition: z.preprocess(
    value => value === '' ? undefined : value,
    z.enum(['working', 'minor_faults', 'major_faults', 'not_working']).optional()
  ),
  // Not used for serialized but must be in shape
  quantity: z.coerce.number().optional(),
  low_stock_threshold: z.coerce.number().optional(),
});

type FormData = z.infer<typeof serializedSchema> & {
  quantity?: number;
  low_stock_threshold?: number;
};

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'phones', label: 'Phones' },
  { value: 'laptops', label: 'Laptops' },
  { value: 'tablets', label: 'Tablets' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'parts', label: 'Parts' },
];

const CONDITION_OPTIONS: { value: DeviceCondition; label: string }[] = [
  { value: 'working', label: 'Working' },
  { value: 'minor_faults', label: 'Minor Faults' },
  { value: 'major_faults', label: 'Major Faults' },
  { value: 'not_working', label: 'Not Working' },
];

const ICLOUD_OPTIONS: { value: AppleICloudStatus; label: string }[] = [
  { value: 'clean', label: 'Clean' },
  { value: 'ibm', label: 'IBM (iCloud Bypassed - MDM)' },
  { value: 'idm', label: 'IDM (iCloud Disabled - MDM)' },
  { value: 'icm', label: 'ICM (iCloud Managed)' },
  { value: 'icloud_locked', label: 'iCloud Locked' },
  { value: 'find_my_on', label: 'Find My On' },
  { value: 'find_my_off', label: 'Find My Off' },
];

const CARRIER_OPTIONS: { value: AppleCarrierLock; label: string }[] = [
  { value: 'factory_unlocked', label: 'Factory Unlocked' },
  { value: 'network_locked', label: 'Network Locked' },
  { value: 'esim_only', label: 'eSIM Only' },
  { value: 'dual_sim', label: 'Dual SIM' },
];

const BIOMETRIC_OPTIONS: { value: AppleBiometricStatus; label: string }[] = [
  { value: 'working', label: 'Working' },
  { value: 'not_working', label: 'Not Working' },
];

const MOBILE_STORAGE_OPTIONS = ['64GB', '128GB', '256GB', '512GB', '1TB'] as const;
const LAPTOP_STORAGE_OPTIONS = ['256GB', '512GB', '1TB', '2TB'] as const;
const RAM_OPTIONS = ['8GB', '16GB', '18GB', '24GB', '32GB', '36GB', '64GB'] as const;
const SCREEN_SIZE_OPTIONS = ['13"', '14"', '15"', '16"'] as const;
const KEYBOARD_OPTIONS: { value: MacKeyboardStatus; label: string }[] = [
  { value: 'working', label: 'Working' },
  { value: 'faulty_keys', label: 'Faulty Keys' },
  { value: 'replaced', label: 'Replaced' },
];
const SCREEN_CONDITION_OPTIONS: { value: MacScreenCondition; label: string }[] = [
  { value: 'perfect', label: 'Perfect' },
  { value: 'minor_scratches', label: 'Minor Scratches' },
  { value: 'cracked', label: 'Cracked' },
  { value: 'replaced', label: 'Replaced' },
];

type ScanTarget = 'serial_number' | 'imei' | 'imei2' | 'barcode';

const formFieldClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100';

const formLabelClass = 'mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200';

/** Radix Select cannot use `value=""`; map empty / unset to this sentinel in the UI only. */
const SELECT_NONE = '__none__';
const sectionTitleClass =
  'font-heading text-sm font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100';

interface ItemFormProps {
  defaultValues?: (Partial<FormData> & { deviceDetails?: InventoryItemInput['deviceDetails'] });
  onSubmit: (data: InventoryItemInput) => Promise<void>;
  submitLabel?: string;
  /** When set, shows "Add Another" button after successful save */
  onAddAnother?: (baseValues: Partial<FormData>) => void;
}

export default function ItemForm({
  defaultValues,
  onSubmit,
  submitLabel = 'Save Item',
  onAddAnother,
}: ItemFormProps) {
  const [scanTarget, setScanTarget] = useState<ScanTarget | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const deviceDetails = defaultValues?.deviceDetails;

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(serializedSchema) as any,
    defaultValues: {
      quantity: 0,
      low_stock_threshold: 5,
      category: 'phones',
      battery_health: deviceDetails && 'battery_health' in deviceDetails ? deviceDetails.battery_health : undefined,
      battery_cycle_count: deviceDetails && 'battery_cycle_count' in deviceDetails ? deviceDetails.battery_cycle_count : undefined,
      icloud_lock_status: deviceDetails && 'icloud_lock_status' in deviceDetails ? deviceDetails.icloud_lock_status : undefined,
      carrier_lock: deviceDetails && 'carrier_lock' in deviceDetails ? deviceDetails.carrier_lock : undefined,
      biometric_status: deviceDetails && 'biometric_status' in deviceDetails ? deviceDetails.biometric_status : undefined,
      storage: deviceDetails && 'storage' in deviceDetails ? deviceDetails.storage : undefined,
      color: deviceDetails && 'color' in deviceDetails ? deviceDetails.color : undefined,
      ram: deviceDetails && 'ram' in deviceDetails ? deviceDetails.ram : undefined,
      chip: deviceDetails && 'chip' in deviceDetails ? deviceDetails.chip : undefined,
      screen_size: deviceDetails && 'screen_size' in deviceDetails ? deviceDetails.screen_size : undefined,
      keyboard_status: deviceDetails && 'keyboard_status' in deviceDetails ? deviceDetails.keyboard_status : undefined,
      screen_condition: deviceDetails && 'screen_condition' in deviceDetails ? deviceDetails.screen_condition : undefined,
      ...defaultValues,
    },
  });

  const category = watch('category') as Category;
  const brand = watch('brand') ?? '';
  const nameSuggestions = useMemo(
    () => suggestedNamesForCategoryAndBrand(category, brand),
    [category, brand]
  );
  const mode = getCategoryMode(category);
  const isSerialized = mode === 'serialized';
  const showImei = category === 'phones' || category === 'tablets';
  const showAppleMobileFields = isAppleMobileDevice(brand, category);
  const showAppleLaptopFields = isAppleLaptopDevice(brand, category);

  const handleScan = (value: string) => {
    if (scanTarget) setValue(scanTarget, value);
    setScanTarget(null);
  };

  const submit = async (data: FormData) => {
    const input: InventoryItemInput = {
      name: data.name,
      category: data.category as Category,
      brand: data.brand,
      price: data.price,
      cost_price: data.cost_price,
      description: data.description,
      barcode: data.barcode,
      serial_number: isSerialized ? data.serial_number : undefined,
      imei: isSerialized && showImei ? data.imei : undefined,
      imei2: isSerialized && showImei ? data.imei2 : undefined,
      condition: isSerialized ? data.condition : undefined,
      deviceDetails: showAppleMobileFields ? {
        battery_health: data.battery_health,
        battery_cycle_count: data.battery_cycle_count,
        icloud_lock_status: data.icloud_lock_status,
        carrier_lock: data.carrier_lock,
        biometric_status: data.biometric_status,
        storage: data.storage as '64GB' | '128GB' | '256GB' | '512GB' | '1TB' | undefined,
        color: data.color || undefined,
      } : showAppleLaptopFields ? {
        battery_health: data.battery_health,
        battery_cycle_count: data.battery_cycle_count,
        storage: data.storage as '256GB' | '512GB' | '1TB' | '2TB' | undefined,
        ram: data.ram,
        chip: data.chip || undefined,
        screen_size: data.screen_size,
        keyboard_status: data.keyboard_status,
        screen_condition: data.screen_condition,
        color: data.color || undefined,
      } : undefined,
      quantity: isSerialized ? 1 : (data.quantity ?? 0),
      low_stock_threshold: isSerialized ? 0 : (data.low_stock_threshold ?? 5),
    };
    await onSubmit(input);
    setSavedCount(c => c + 1);
  };

  const handleAddAnother = handleSubmit(async (data) => {
    await submit(data);
    // Keep brand/name/price/cost_price/category — clear identifiers
    const base: Partial<FormData> = {
      name: data.name,
      brand: data.brand,
      category: data.category,
      price: data.price,
      cost_price: data.cost_price,
      description: data.description,
      battery_health: data.battery_health,
      battery_cycle_count: data.battery_cycle_count,
      icloud_lock_status: data.icloud_lock_status,
      carrier_lock: data.carrier_lock,
      biometric_status: data.biometric_status,
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
      reset({ ...base, serial_number: '', imei: '', imei2: '', barcode: '' });
    }
  });

  const fieldClass = formFieldClass;
  const labelClass = formLabelClass;
  const errorClass = 'text-red-500 text-xs mt-1';

  return (
    <>
      <form onSubmit={handleSubmit(submit as never)} className="app-page py-4 md:py-6 space-y-4 pb-28 max-lg:pb-36 lg:pb-32">

        {/* Saved count banner */}
        {savedCount > 0 && onAddAnother && (
          <div className="flex items-center gap-2 bg-teal/10 border border-teal/30 text-teal rounded-xl px-4 py-2.5 text-sm font-medium">
            <CheckCircle2 size={16} />
            {savedCount} unit{savedCount !== 1 ? 's' : ''} added
          </div>
        )}

        {/* Basic info */}
        <section className="space-y-4 rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-900/70 md:p-4">
          <h3 className={sectionTitleClass}>Basic Info</h3>

          <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
            Choose <strong className="text-zinc-700 dark:text-zinc-300">category</strong> and{' '}
            <strong className="text-zinc-700 dark:text-zinc-300">brand</strong> first — item name suggestions filter by brand so
            lists stay relevant (you can still type anything).
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={labelClass} htmlFor="category">
                Category *
              </Label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="category" className="w-full">
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
              name="brand"
              control={control}
              render={({ field }) => (
                <ComboboxField
                  {...field}
                  id="brand"
                  label="Brand *"
                  options={BRAND_SUGGESTIONS}
                  placeholder="Search brands or type…"
                  error={errors.brand?.message}
                  emptyHint="Pick from the list or type any brand — names below update to match."
                />
              )}
            />
          </div>

          {nameSuggestions.length > 0 ? (
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <ComboboxField
                  {...field}
                  id="name"
                  label="Item Name *"
                  options={nameSuggestions}
                  placeholder={brand.trim() ? 'Pick a model or type your own' : 'Pick brand for filtered models, or type any name'}
                  error={errors.name?.message}
                  emptyHint="Suggestions update when you change brand. Custom names always allowed."
                />
              )}
            />
          ) : (
            <div>
              <Label className={labelClass} htmlFor="name">
                Item Name *
              </Label>
              <input
                id="name"
                {...register('name')}
                placeholder="e.g. USB-C Cable 2m"
                className={fieldClass}
              />
              {errors.name && <p className={errorClass}>{errors.name.message}</p>}
            </div>
          )}

          {/* Mode hint */}
          <p className="text-xs text-muted bg-surface rounded-lg px-3 py-2 border border-border">
            {isSerialized
              ? 'Serialized mode — each unit is a separate record. Add one unit at a time.'
              : 'Non-serialized mode — tracked by quantity.'}
          </p>

          <div>
            <Label className={labelClass} htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              rows={2}
              placeholder="Optional notes"
              className={`${fieldClass} resize-none`}
            />
          </div>

          {(showAppleMobileFields || showAppleLaptopFields) && (
            <p className="text-xs text-primary bg-primary/5 rounded-lg px-3 py-2 border border-primary/10">
              Apple device details will be saved as structured metadata and will appear in search, inventory badges, and receipts.
            </p>
          )}
        </section>

        {/* Pricing */}
        <section className="space-y-4 rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-900/70 md:p-4">
          <h3 className={sectionTitleClass}>Pricing</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={labelClass} htmlFor="price">Selling Price (₦) *</Label>
              <Controller
                name="price"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    id="price"
                    ref={field.ref}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    className={fieldClass}
                    placeholder="₦0"
                    aria-invalid={!!errors.price}
                  />
                )}
              />
              {errors.price && <p className={errorClass}>{errors.price.message}</p>}
            </div>
            <div>
              <Label className={labelClass} htmlFor="cost_price">Cost Price (₦)</Label>
              <Controller
                name="cost_price"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    id="cost_price"
                    ref={field.ref}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    allowEmpty
                    className={fieldClass}
                    placeholder="Optional"
                    aria-invalid={!!errors.cost_price}
                  />
                )}
              />
              {errors.cost_price && <p className={errorClass}>{errors.cost_price.message}</p>}
            </div>
          </div>
        </section>

        {/* Stock — only for non-serialized */}
        {!isSerialized && (
          <section className="space-y-4 rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-900/70 md:p-4">
            <h3 className={sectionTitleClass}>Stock</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className={labelClass} htmlFor="quantity">Quantity *</Label>
                <input id="quantity" type="number" inputMode="numeric" {...register('quantity')} className={fieldClass} />
                {errors.quantity && <p className={errorClass}>{errors.quantity.message}</p>}
              </div>
              <div>
                <Label className={labelClass} htmlFor="low_stock_threshold">Low Stock Alert</Label>
                <input id="low_stock_threshold" type="number" inputMode="numeric" {...register('low_stock_threshold')} className={fieldClass} />
              </div>
            </div>
          </section>
        )}

        {/* Identifiers */}
        <section className="space-y-4 rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-900/70 md:p-4">
          <h3 className={sectionTitleClass}>{isSerialized ? 'Identifiers *' : 'Identifiers'}</h3>

          {isSerialized && (
            <ScanField
              id="serial_number"
              label="Serial Number"
              placeholder="S/N"
              {...register('serial_number')}
              onScan={() => setScanTarget('serial_number')}
            />
          )}

          {isSerialized && (
            <Controller
              name="condition"
              control={control}
              render={({ field }) => (
                <OptionalStringSelect
                  id="condition"
                  label="Condition"
                  labelClassName={labelClass}
                  placeholder="Select condition"
                  value={field.value}
                  onChange={field.onChange}
                  options={CONDITION_OPTIONS}
                />
              )}
            />
          )}

          {isSerialized && showImei && (
            <>
              <ScanField
                id="imei"
                label="IMEI 1"
                placeholder="15-digit IMEI"
                {...register('imei')}
                onScan={() => setScanTarget('imei')}
              />
              <ScanField
                id="imei2"
                label="IMEI 2 (dual SIM)"
                placeholder="15-digit IMEI"
                {...register('imei2')}
                onScan={() => setScanTarget('imei2')}
              />
            </>
          )}

          <ScanField
            id="barcode"
            label="Barcode / QR"
            placeholder="Scan or enter manually"
            {...register('barcode')}
            onScan={() => setScanTarget('barcode')}
          />
        </section>

        {showAppleMobileFields && (
          <section className="space-y-4 rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-900/70 md:p-4">
            <h3 className={sectionTitleClass}>Apple Device Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <NumberField id="battery_health" label="Battery Health" register={register('battery_health')} suffix="%" />
              <NumberField id="battery_cycle_count" label="Battery Cycle Count" register={register('battery_cycle_count')} />
            </div>
            <Controller
              name="icloud_lock_status"
              control={control}
              render={({ field }) => (
                <OptionalStringSelect
                  id="icloud_lock_status"
                  label="iCloud Lock Status"
                  labelClassName={labelClass}
                  placeholder="Select option"
                  value={field.value}
                  onChange={field.onChange}
                  options={ICLOUD_OPTIONS}
                />
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <Controller
                name="carrier_lock"
                control={control}
                render={({ field }) => (
                  <OptionalStringSelect
                    id="carrier_lock"
                    label="Carrier Lock"
                    labelClassName={labelClass}
                    placeholder="Select option"
                    value={field.value}
                    onChange={field.onChange}
                    options={CARRIER_OPTIONS}
                  />
                )}
              />
              <Controller
                name="biometric_status"
                control={control}
                render={({ field }) => (
                  <OptionalStringSelect
                    id="biometric_status"
                    label="Face ID / Touch ID"
                    labelClassName={labelClass}
                    placeholder="Select option"
                    value={field.value}
                    onChange={field.onChange}
                    options={BIOMETRIC_OPTIONS}
                  />
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Controller
                name="storage"
                control={control}
                render={({ field }) => (
                  <OptionalStringSelect
                    id="storage"
                    label="Storage"
                    labelClassName={labelClass}
                    placeholder="Select storage"
                    value={field.value}
                    onChange={field.onChange}
                    options={MOBILE_STORAGE_OPTIONS.map(o => ({ value: o, label: o }))}
                  />
                )}
              />
              <div>
                <Label className={labelClass} htmlFor="color">Color</Label>
                <input id="color" {...register('color')} className={fieldClass} placeholder="Black Titanium" />
              </div>
            </div>
          </section>
        )}

        {showAppleLaptopFields && (
          <section className="space-y-4 rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-900/70 md:p-4">
            <h3 className={sectionTitleClass}>MacBook Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <NumberField id="battery_cycle_count" label="Battery Cycle Count" register={register('battery_cycle_count')} />
              <NumberField id="battery_health" label="Battery Health" register={register('battery_health')} suffix="%" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Controller
                name="storage"
                control={control}
                render={({ field }) => (
                  <OptionalStringSelect
                    id="storage"
                    label="Storage"
                    labelClassName={labelClass}
                    placeholder="Select storage"
                    value={field.value}
                    onChange={field.onChange}
                    options={LAPTOP_STORAGE_OPTIONS.map(o => ({ value: o, label: o }))}
                  />
                )}
              />
              <Controller
                name="ram"
                control={control}
                render={({ field }) => (
                  <OptionalStringSelect
                    id="ram"
                    label="RAM"
                    labelClassName={labelClass}
                    placeholder="Select RAM"
                    value={field.value}
                    onChange={field.onChange}
                    options={RAM_OPTIONS.map(o => ({ value: o, label: o }))}
                  />
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className={labelClass} htmlFor="chip">Chip</Label>
                <input id="chip" {...register('chip')} className={fieldClass} placeholder="M3 Max" />
              </div>
              <Controller
                name="screen_size"
                control={control}
                render={({ field }) => (
                  <OptionalStringSelect
                    id="screen_size"
                    label="Screen Size"
                    labelClassName={labelClass}
                    placeholder="Select size"
                    value={field.value}
                    onChange={field.onChange}
                    options={SCREEN_SIZE_OPTIONS.map(o => ({ value: o, label: o }))}
                  />
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Controller
                name="keyboard_status"
                control={control}
                render={({ field }) => (
                  <OptionalStringSelect
                    id="keyboard_status"
                    label="Keyboard Status"
                    labelClassName={labelClass}
                    placeholder="Select option"
                    value={field.value}
                    onChange={field.onChange}
                    options={KEYBOARD_OPTIONS}
                  />
                )}
              />
              <Controller
                name="screen_condition"
                control={control}
                render={({ field }) => (
                  <OptionalStringSelect
                    id="screen_condition"
                    label="Screen Condition"
                    labelClassName={labelClass}
                    placeholder="Select option"
                    value={field.value}
                    onChange={field.onChange}
                    options={SCREEN_CONDITION_OPTIONS}
                  />
                )}
              />
            </div>
            <div>
              <Label className={labelClass} htmlFor="color">Color</Label>
              <input id="color" {...register('color')} className={fieldClass} placeholder="Space Black" />
            </div>
          </section>
        )}

        {/* Submit buttons */}
        <div className="fixed z-30 max-lg:bottom-[0] lg:bottom-0 left-0 right-0 px-3 md:px-5 pb-[max(0.35rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#f0f0f3] via-[#f0f0f3]/96 to-transparent pt-3 dark:from-zinc-950 dark:via-zinc-950/96 pb-4">
          <div className={`max-w-lg mx-auto lg:max-w-3xl xl:max-w-4xl w-full grid gap-2 ${isSerialized && onAddAnother ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary text-white rounded-xl py-3.5 font-heading font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {submitLabel}
            </button>

            {isSerialized && onAddAnother && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleAddAnother}
                className="bg-teal text-white rounded-xl py-3.5 font-heading font-semibold text-sm hover:bg-teal-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
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

// ─── Scan field component ─────────────────────────────────────────────────────

interface ScanFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  onScan: () => void;
}

const ScanField = ({ id, label, onScan, ...props }: ScanFieldProps) => (
  <div>
    <Label className={formLabelClass} htmlFor={id}>
      {label}
    </Label>
    <div className="flex gap-2">
      <input id={id} className={`${formFieldClass} flex-1`} {...props} />
      <button
        type="button"
        onClick={onScan}
        className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-muted transition-colors hover:bg-zinc-50 hover:text-primary dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700/80 dark:hover:text-primary-light"
        aria-label={`Scan ${label}`}
      >
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
  register: ReturnType<typeof useForm<FormData>>['register'] extends (...args: infer _A) => infer _R ? _R : never;
  suffix?: string;
}) {
  return (
    <div>
      <Label className={formLabelClass} htmlFor={id}>{label}</Label>
      <div className="relative">
        <input id={id} type="number" inputMode="numeric" {...register} className={`${formFieldClass} pr-8`} />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 dark:text-zinc-400">
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
  options: { value: string; label: string }[];
}) {
  const selectValue = value && value !== '' ? value : SELECT_NONE;
  return (
    <div>
      <Label className={labelClassName} htmlFor={id}>
        {label}
      </Label>
      <Select
        value={selectValue}
        onValueChange={v => onChange(v === SELECT_NONE ? '' : v)}
      >
        <SelectTrigger id={id} className="w-full">
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
