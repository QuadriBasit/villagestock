import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Loader2, ScanLine, Wrench } from 'lucide-react';
import { PercentDraftInput } from '@/components/ui/PercentDraftInput';
import { normalizeImeiDigits } from '@/lib/serializedIdentifiers';
import { useInventoryItem } from '@/hooks/useInventory';
import { useInventoryActions } from '@/hooks/useInventoryActions';
import { useEngineerNames } from '@/hooks/useRepairs';
import { useRepairActions } from '@/hooks/useRepairActions';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import {
  applyExistingProductToState,
  existingStockByVariantLabel,
  fetchExistingProductItems,
} from '@/lib/existingProductIntake';
import { ComboboxField } from '@/components/ui/ComboboxField';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { rememberModelName, useModelNameSuggestions } from '@/lib/modelNameSuggestions';
import { ChoiceGrid } from '@/components/ui/ChoiceGrid';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { inputShellClass } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import type { ContactRecord, PaymentMethod, PurchaseArrival, PurchaseLine, PurchaseRecord, PurchaseTerms } from '@/types';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { ModalSheetClose } from '@/components/ui/ModalSheetClose';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CategoryThumb } from '@/components/inventory/CategoryThumb';
import { cn, formatCurrency } from '@/lib/utils';
import { modalSheetPanelLg } from '@/lib/modalSheet';
import {
  buildIntakeItems,
  flowSteps,
  idTypeFor,
  isIdmFlagged,
  purchaseLinesFromIntake,
  stockValue,
  switchCategory,
  totalUnits,
} from './buildItems';
import { itemToAddProductState } from './parseItem';
import {
  APLabel,
  APChoiceStack,
  APMoney,
  APMsg,
  APMulti,
  APSeg,
  APTextField,
  APToggle,
  CategoryPicker,
  fieldClass,
  StepProgress,
  TrackToggle,
  VariantTable,
} from './ui';
import {
  ESIM_STATUS_OPTIONS,
  formatNetworkSummary,
  networkStateIsComplete,
  NETWORK_STATUS_OPTIONS,
  networkStatusNeedsSimConfig,
  SIM_CONFIG_OPTIONS,
  simConfigNeedsEsimStatus,
} from '@/lib/networkLock';
import {
  blankAddProductState,
  CAT_META,
  INTAKE_FAULTS,
  isHandheldCat,
  isSimpleStockCat,
  resizeUnitPricing,
  unitEconomicsForVariant,
  syncVariants,
  syncVariantsForEdit,
  type AddProductState,
} from './types';

const BarcodeScanner = lazy(() => import('@/components/inventory/BarcodeScanner'));

type ScanTarget = { label: string; index: number };

type PurchaseFlowSave = {
  supplier_contact_id: string;
  supplier_name: string;
  items: PurchaseLine[];
  total: number;
  paid: number;
  payment_method: PaymentMethod;
  terms: PurchaseTerms;
  purchased_at: string;
  arrival: PurchaseArrival;
  alreadyStocked?: boolean;
};

type AddProductFlowProps = {
  open: boolean;
  onClose: () => void;
  /** When set, wizard edits an existing inventory row instead of creating new ones. */
  itemId?: string;
  /** Same product steps as inventory, then a supplier bill. */
  purchase?: {
    suppliers: ContactRecord[];
    presetSupplierId?: string;
    canStock?: boolean;
    onSave: (input: PurchaseFlowSave) => Promise<PurchaseRecord>;
  };
};

const PURCHASE_TERMS: { value: PurchaseTerms; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Part-pay' },
  { value: 'credit', label: 'Credit' },
];

const PURCHASE_PAY: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Transfer' },
  { value: 'pos', label: 'POS' },
];

type SavedSummary = {
  count: number;
  units: number;
  engineer: string | null;
};

export default function AddProductFlow({ open, onClose, itemId, purchase }: AddProductFlowProps) {
  const isEdit = Boolean(itemId);
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();
  const engineerNames = useEngineerNames();
  const engineerDefault = engineerNames[0] ?? '';
  const { item: editItem, isLoading: editItemLoading } = useInventoryItem(itemId ?? '');
  const { addItem, updateItem } = useInventoryActions();
  const { sendToEngineer } = useRepairActions();
  const mergedModelRef = useRef('');
  const hydratedFor = useRef<string | null>(null);
  const sessionOpen = useRef(false);

  const [state, setState] = useState<AddProductState>(() => blankAddProductState(engineerDefault));
  const [drafts, setDrafts] = useState<AddProductState[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [arrival, setArrival] = useState<PurchaseArrival>('in_shop');
  const [terms, setTerms] = useState<PurchaseTerms>('paid');
  const [paidNow, setPaidNow] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [purchaseDone, setPurchaseDone] = useState<PurchaseRecord | null>(null);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState<SavedSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scanTarget, setScanTarget] = useState<ScanTarget | null>(null);

  useEffect(() => {
    if (!open) {
      sessionOpen.current = false;
      return;
    }
    if (isEdit || sessionOpen.current) return;
    sessionOpen.current = true;
    mergedModelRef.current = '';
    setState(blankAddProductState(engineerDefault));
    setDrafts([]);
    setSupplierId(purchase?.presetSupplierId || purchase?.suppliers[0]?.id || '');
    setArrival(purchase?.canStock === false ? 'on_the_way' : 'in_shop');
    setTerms('paid');
    setPaidNow(0);
    setMethod('bank_transfer');
    setPurchaseDone(null);
    setStep(0);
    setSaved(null);
    setSaving(false);
    setSaveError(null);
    setLoadError(null);
    setScanTarget(null);
  }, [open, isEdit, engineerDefault, purchase]);

  const existingProductItems = useLiveQuery(async () => {
    if (isEdit || !open || !shopOwnerId || !locationReady || !activeLocationId) return [];
    const brand = state.brand.trim();
    const name = state.model.trim();
    if (!brand || !name) return [];
    const category = CAT_META[state.cat].category;
    return fetchExistingProductItems(shopOwnerId, activeLocationId, brand, name, category);
  }, [
    isEdit,
    open,
    shopOwnerId,
    activeLocationId,
    locationReady,
    state.brand,
    state.model,
    state.cat,
  ]);

  useEffect(() => {
    if (isEdit || !existingProductItems?.length) return;
    const key = `${state.cat}|${state.brand.trim().toLowerCase()}|${state.model.trim().toLowerCase()}`;
    if (mergedModelRef.current === key) return;
    mergedModelRef.current = key;
    setState(s => applyExistingProductToState(s, existingProductItems));
  }, [existingProductItems, isEdit, state.cat, state.brand, state.model]);

  const existingStock = useMemo(
    () => (existingProductItems?.length ? existingStockByVariantLabel(existingProductItems) : undefined),
    [existingProductItems],
  );

  const existingVariantCount = existingStock ? Object.keys(existingStock).length : 0;

  const existingUnitCount = useMemo(() => {
    if (!existingProductItems?.length) return 0;
    return existingProductItems.reduce((sum, item) => {
      if (item.mode === 'serialized') return item.status === 'in_stock' ? sum + 1 : sum;
      return sum + item.quantity;
    }, 0);
  }, [existingProductItems]);

  useEffect(() => {
    if (!open) {
      hydratedFor.current = null;
      return;
    }
    if (!isEdit || !itemId) return;
    if (editItemLoading) return;
    if (hydratedFor.current === itemId) return;
    if (!editItem || editItem.deleted) {
      setLoadError('Item not found');
      return;
    }
    const parsed = itemToAddProductState(editItem, engineerDefault);
    if (!parsed) {
      setLoadError('This item type cannot be edited in the product wizard yet.');
      return;
    }
    hydratedFor.current = itemId;
    setState(parsed);
    setStep(0);
    setSaved(null);
    setSaving(false);
    setSaveError(null);
    setLoadError(null);
  }, [open, isEdit, itemId, editItem, editItemLoading, engineerDefault]);

  const syncVar = isEdit ? syncVariantsForEdit : syncVariants;
  const variantQtySectionRef = useRef<HTMLDivElement>(null);
  const prevVariantRowCountRef = useRef(0);

  const set = (patch: Partial<AddProductState>) => setState(p => ({ ...p, ...patch }));

  const steps = useMemo(
    () => flowSteps(state, { skipSerials: Boolean(purchase) && arrival !== 'in_shop' }),
    [state, purchase, arrival],
  );
  const cur = steps[Math.min(step, steps.length - 1)] ?? 'Identify';
  const meta = CAT_META[state.cat];
  const nameSuggestions = useModelNameSuggestions(meta.category, state.brand);
  const needsInspect = (isHandheldCat(state.cat) || state.cat === 'Laptop') && state.condition !== 'New';
  const idType = idTypeFor(state);
  const tracks = (isHandheldCat(state.cat) || state.cat === 'Laptop') && state.track;
  const idm = isIdmFlagged(state);
  const units = totalUnits(state);
  const value = stockValue(state);

  useEffect(() => {
    if (!open || cur !== 'Variants') return;
    const count = state.variants.length;
    if (count > 0 && prevVariantRowCountRef.current === 0) {
      requestAnimationFrame(() => {
        variantQtySectionRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    }
    prevVariantRowCountRef.current = count;
  }, [open, cur, state.variants.length]);

  const codesOf = (label: string) => state.serials[label] ?? [];
  const setSerial = (label: string, index: number, value: string) => {
    set({
      serials: {
        ...state.serials,
        [label]: Object.assign([], codesOf(label), { [index]: value }),
      },
    });
  };

  const findNextEmptySerial = (): ScanTarget | null => {
    for (const v of state.variants) {
      const codes = codesOf(v.label);
      for (let k = 0; k < v.qty; k++) {
        if (!(codes[k] || '').trim()) return { label: v.label, index: k };
      }
    }
    return null;
  };

  const handleScan = (raw: string) => {
    if (!scanTarget) return;
    const trimmed = raw.trim();
    if (trimmed) {
      const value = idType === 'IMEI' ? normalizeImeiDigits(trimmed) : trimmed;
      setSerial(scanTarget.label, scanTarget.index, value);
    }
    setScanTarget(null);
  };

  const setVar = (i: number, patch: Partial<(typeof state.variants)[0]>) => {
    setState(prev => {
      const variants = prev.variants.map((variant, index) =>
        index === i ? { ...variant, ...patch } : variant,
      );
      const touched = variants[i];
      if (!touched) return { ...prev, variants };
      const unitPricing = resizeUnitPricing(prev.unitPricing, touched.label, touched.qty, {
        cost: touched.cost,
        price: touched.price,
      });
      return { ...prev, variants, unitPricing };
    });
  };

  const setUnitEconomics = (
    label: string,
    index: number,
    patch: Partial<{ cost: number; price: number }>,
  ) => {
    setState(prev => {
      const variant = prev.variants.find(v => v.label === label);
      const fallback = {
        cost: variant?.cost ?? prev.baseCost,
        price: variant?.price ?? prev.basePrice,
      };
      const base = resizeUnitPricing(prev.unitPricing, label, variant?.qty ?? 0, fallback)[label] ?? [];
      const next = base.map((row, i) => (i === index ? { ...row, ...patch } : row));
      return { ...prev, unitPricing: { ...prev.unitPricing, [label]: next } };
    });
  };

  const applyBase = (key: 'baseCost' | 'basePrice', val: number) => {
    const field = key === 'baseCost' ? 'cost' : 'price';
    setState(prev => ({
      ...prev,
      [key]: val,
      variants: prev.variants.map(variant => (variant[field] > 0 ? variant : { ...variant, [field]: val })),
    }));
  };

  const canNext = () => {
    if (cur === 'Identify') return Boolean(state.brand && state.model.trim());
    if (cur === 'Variants') {
      return (
        state.variants.length > 0 &&
        units > 0 &&
        state.variants.every(v => v.price > 0 && v.cost > 0)
      );
    }
    if (cur === 'Stock') {
      const v = state.variants[0];
      return Boolean(v && v.qty > 0 && v.price > 0 && v.cost > 0);
    }
    if (cur === 'Network') return networkStateIsComplete(state.network);
    if (cur === 'Serials') {
      return state.variants.every(v => {
        if (v.qty <= 0) return true;
        return unitEconomicsForVariant(state, v).every(u => u.cost > 0 && u.price > 0);
      });
    }
    return true;
  };

  const doSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const stockBatch = async (batch: AddProductState) => {
        const inputs = buildIntakeItems(batch);
        const stockedAtIso = new Date(batch.stockedAt).toISOString();
        const ids: string[] = [];
        for (const input of inputs) {
          ids.push(await addItem(input, { deferIdentifiers: true, stockedAt: stockedAtIso }));
        }
        let engineerSent: string | null = null;
        const batchInspect = (isHandheldCat(batch.cat) || batch.cat === 'Laptop') && batch.condition !== 'New';
        if (batchInspect && batch.toEngineer && ids.length > 0) {
          const engineerName = batch.engineer || engineerDefault || 'Engineer';
          for (const stockedId of ids) {
            await sendToEngineer({
              item_id: stockedId,
              engineer_name: engineerName,
              issue_description:
                [...batch.faults, batch.fault.trim()].filter(Boolean).join(' · ') || 'Intake inspection',
              repair_cost: batch.partsEst || undefined,
              date_sent: new Date().toISOString(),
            });
          }
          engineerSent = engineerName;
        }
        rememberModelName(CAT_META[batch.cat].category, batch.brand, batch.model);
        return { ids, engineerSent, count: inputs.length };
      };

      if (purchase) {
        const supplier = purchase.suppliers.find(row => row.id === supplierId);
        if (!supplier) throw new Error('Choose a supplier');
        const batches = [...drafts, state];
        for (const batch of batches) {
          if (!batch.brand.trim() || !batch.model.trim()) throw new Error('Each product needs a brand and a name');
          const lines = purchaseLinesFromIntake(batch);
          if (lines.length === 0 || lines.some(line => line.qty <= 0)) {
            throw new Error(`Enter a quantity for ${batch.model.trim() || 'each product'}`);
          }
          if (lines.some(line => line.unit_cost <= 0 || !(line.sell_price && line.sell_price > 0))) {
            throw new Error(`Enter a cost and a selling price for ${batch.model.trim()}`);
          }
        }
        if (arrival === 'in_shop') {
          if (purchase.canStock === false) {
            throw new Error('You can record the bill. Adding these to stock needs Add products.');
          }
          for (const batch of batches) await stockBatch(batch);
        } else {
          for (const batch of batches) {
            rememberModelName(CAT_META[batch.cat].category, batch.brand, batch.model);
          }
        }
        const items = batches.flatMap(purchaseLinesFromIntake);
        const total = items.reduce((sum, line) => sum + line.qty * line.unit_cost, 0);
        const paid = terms === 'paid' ? total : terms === 'credit' ? 0 : Math.min(paidNow, total);
        const record = await purchase.onSave({
          supplier_contact_id: supplier.id,
          supplier_name: supplier.name,
          items,
          total,
          paid,
          payment_method: method,
          terms,
          purchased_at: new Date().toISOString(),
          arrival,
          alreadyStocked: arrival === 'in_shop',
        });
        setPurchaseDone(record);
        setSaved({
          count: items.length,
          units: items.reduce((sum, line) => sum + line.qty, 0),
          engineer: null,
        });
        return;
      }

      if (isEdit && itemId) {
        const inputs = buildIntakeItems(state);
        const [first, ...rest] = inputs;
        if (!first) throw new Error('Nothing to save');
        const stockedAtIso = new Date(state.stockedAt).toISOString();
        await updateItem(itemId, { ...first, created_at: stockedAtIso }, { deferIdentifiers: true });
        for (const input of rest) {
          await addItem(input, { deferIdentifiers: true, stockedAt: stockedAtIso });
        }
        rememberModelName(first.category, state.brand, state.model);
        setSaved({
          count: isSimpleStockCat(state.cat) ? 1 : Math.max(state.variants.length, 1),
          units,
          engineer: null,
        });
        return;
      }

      const { engineerSent } = await stockBatch(state);

      setSaved({
        count: isSimpleStockCat(state.cat) ? 1 : state.variants.length,
        units,
        engineer: engineerSent,
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save product');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (cur === 'Identify' && state.variants.length === 0) {
      setState(syncVar(state, {}));
    }
    if (cur === 'Review') {
      void doSave();
      return;
    }
    setStep(s => s + 1);
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  if (!open) return null;

  const addAnother = () => {
    if (!state.brand.trim() || !state.model.trim()) return;
    setDrafts(prev => [...prev, state]);
    rememberModelName(CAT_META[state.cat].category, state.brand, state.model);
    setState(blankAddProductState(state.engineer || engineerDefault));
    setStep(0);
    setSaveError(null);
  };

  const editDraft = (index: number) => {
    const draft = drafts[index];
    if (!draft) return;
    setDrafts(prev => prev.filter((_, i) => i !== index));
    setState(draft);
    setStep(0);
  };

  const noSuppliers = Boolean(purchase && purchase.suppliers.length === 0);
  const title = saved
    ? purchase
      ? 'Purchase recorded'
      : isEdit
        ? 'Product updated'
        : 'Product added'
    : purchase
      ? 'Record purchase'
      : isEdit
        ? 'Edit product'
        : 'Add product';

  return (
    <>
    <ModalSheetPortal>
      <ModalSheetFrame onClose={handleClose} panelClassName={cn(modalSheetPanelLg, 'max-w-[640px] sm:max-h-[min(90dvh,calc(100dvh-2rem))]')} backdropClassName="bg-black/70">
<div className="shrink-0 px-5 pt-4 pb-0">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-shell-ink">{title}</h2>
              <ModalSheetClose onClick={handleClose} className="size-8" />
            </div>
            {!saved && !noSuppliers ? <StepProgress steps={steps} step={step} /> : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto overscroll-contain px-5 py-5">
            {noSuppliers ? (
              <p className="py-6 text-center text-sm text-shell-muted">
                Add a supplier in Contacts before recording a purchase.
              </p>
            ) : isEdit && editItemLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-shell-muted">
                <Loader2 size={18} className="animate-spin" />
                Loading item…
              </div>
            ) : loadError ? (
              <div className="py-10 text-center">
                <p className="text-sm text-red-300">{loadError}</p>
                <Button variant="ghost" className="mt-4" onClick={handleClose}>
                  Close
                </Button>
              </div>
            ) : saved ? (
              <div className="py-2 text-center">
                <div className="mx-auto mb-4 grid size-[58px] place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <Check size={30} strokeWidth={2.4} />
                </div>
                <p className="font-display text-[17px] font-semibold text-shell-ink">{state.model}</p>
                <p className="mt-1.5 text-[13.5px] text-shell-muted">
                  {purchaseDone
                    ? `${purchaseDone.supplier_name} · ${formatCurrency(purchaseDone.total)}${purchaseDone.received_at ? ' · added to inventory' : ' · still on the way'}.`
                    : isEdit
                      ? 'Changes saved to inventory.'
                      : `${saved.units} unit${saved.units !== 1 ? 's' : ''} across ${saved.count} variant${saved.count !== 1 ? 's' : ''} added to inventory${idm ? ' · IDM flagged' : ''}.`}
                </p>
                {saved.engineer ? (
                  <p className="mt-1.5 text-[13px] font-semibold text-sky-400">
                    Repair ticket opened for {saved.engineer}.
                  </p>
                ) : null}
                <Button className="mt-5 w-full bg-brand-400 text-[#04231d] hover:bg-brand-300" onClick={handleClose}>
                  Done
                </Button>
              </div>
            ) : cur === 'Identify' ? (
              <>
                {purchase ? (
                  <>
                    <APLabel label="Supplier">
                      <Select value={supplierId || undefined} onValueChange={setSupplierId}>
                        <SelectTrigger className="shell-inset-field h-11 w-full rounded-[10px] border border-shell-line bg-shell-surface-2/40 px-3 text-sm text-shell-ink shadow-none">
                          <SelectValue placeholder="Choose supplier…" />
                        </SelectTrigger>
                        <SelectContent>
                          {purchase.suppliers.map(supplier => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </APLabel>
                    <APLabel label="Goods">
                      {purchase.canStock === false ? (
                        <p className="text-[13px] text-shell-muted">
                          This bill stays on the way. Putting the goods on the shelf needs Add products.
                        </p>
                      ) : (
                        <ChoiceGrid
                          columns={2}
                          options={[
                            { value: 'in_shop' as const, label: 'Already here' },
                            { value: 'on_the_way' as const, label: 'Still on the way' },
                          ]}
                          value={arrival}
                          onChange={setArrival}
                        />
                      )}
                    </APLabel>
                  </>
                ) : null}
                {!isEdit && existingUnitCount > 0 ? (
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] text-emerald-200">
                    <strong className="font-semibold text-emerald-100">{state.model.trim()}</strong> is already in
                    stock — {existingUnitCount} unit{existingUnitCount !== 1 ? 's' : ''}
                    {existingVariantCount > 1 ? ` across ${existingVariantCount} variants` : ''}. Variant
                    prices below are pre-filled from what you have.
                  </div>
                ) : null}
                <div>
                  <p className="mb-2 text-[12.5px] font-semibold text-shell-muted">Category</p>
                  <CategoryPicker
                    cat={state.cat}
                    onChange={cat => setState(current => switchCategory(current, cat))}
                  />
                </div>
                <APLabel label="Brand">
                  <APMulti
                    single
                    options={meta.brands}
                    value={state.brand ? [state.brand] : []}
                    onChange={v => set({ brand: v[v.length - 1] || '' })}
                    addLabel="Brand"
                  />
                </APLabel>
                <ComboboxField
                  id="add-product-model"
                  label="Model name"
                  options={nameSuggestions}
                  value={state.model}
                  onChange={e => set({ model: e.target.value })}
                  placeholder={
                    state.brand.trim()
                      ? 'Pick a model or type your own'
                      : 'Pick a brand, or type any name'
                  }
                  emptyHint="Names you have used before show up here. A new name is saved for next time."
                  className={cn(fieldClass, 'h-11 rounded-[10px] shadow-none ring-offset-0')}
                  wrapperClassName="[&_label]:mb-2 [&_label]:text-[12.5px] [&_label]:font-semibold [&_label]:text-shell-muted"
                />
                {state.cat === 'Laptop' ? (
                  <APLabel label="Processor" hint="optional">
                    <APTextField
                      value={state.processor}
                      onChange={e => set({ processor: e.target.value })}
                      placeholder="e.g. Intel i7 · 8th Gen"
                    />
                  </APLabel>
                ) : null}
                {isSimpleStockCat(state.cat) ? (
                  <APLabel label="Spec">
                    <APTextField
                      value={state.spec}
                      onChange={e => set({ spec: e.target.value })}
                      placeholder="e.g. 20000mAh · 22.5W"
                    />
                  </APLabel>
                ) : null}
                <APLabel label="Condition">
                  <APSeg
                    options={['New', 'Used', 'UK Used', 'Refurb'] as const}
                    value={state.condition}
                    onChange={v => set({ condition: v })}
                  />
                </APLabel>
                {isHandheldCat(state.cat) || state.cat === 'Laptop' ? (
                  <TrackToggle idType={idType} track={state.track} onChange={v => set({ track: v })} />
                ) : null}
              </>
            ) : cur === 'Variants' ? (
              <>
                {isHandheldCat(state.cat) ? (
                  <>
                    <APLabel label="RAM" hint="skip for iPhone if it doesn’t matter">
                      <APMulti
                        options={meta.rams ?? []}
                        value={state.rams}
                        onChange={v => setState(s => syncVar(s, { rams: v }))}
                        addLabel="RAM"
                      />
                    </APLabel>
                    <APLabel label="Storage" hint="pick all you carry">
                      <APMulti
                        options={meta.storages ?? []}
                        value={state.storages}
                        onChange={v => setState(s => syncVar(s, { storages: v }))}
                        addLabel="Size"
                      />
                    </APLabel>
                    <APLabel label="Colours">
                      <APMulti
                        options={meta.colors ?? []}
                        value={state.colors}
                        onChange={v => setState(s => syncVar(s, { colors: v }))}
                        addLabel="Colour"
                      />
                    </APLabel>
                  </>
                ) : (
                  <>
                    <APLabel label="RAM">
                      <APMulti
                        options={meta.rams ?? []}
                        value={state.rams}
                        onChange={v => setState(s => syncVar(s, { rams: v }))}
                        addLabel="RAM"
                      />
                    </APLabel>
                    <APLabel label="Storage (ROM)">
                      <APMulti
                        options={meta.roms ?? []}
                        value={state.roms}
                        onChange={v => setState(s => syncVar(s, { roms: v }))}
                        addLabel="Size"
                      />
                    </APLabel>
                  </>
                )}
                {state.variants.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-shell-line py-[18px] text-center text-[13px] text-shell-muted">
                    Pick a {isHandheldCat(state.cat) ? 'storage, colour, or RAM' : 'RAM or storage'} above — then
                    set <span className="font-medium text-shell-ink">Qty</span> for each row.
                  </div>
                ) : (
                  <div
                    ref={variantQtySectionRef}
                    id="add-product-variant-qty"
                    className="scroll-mt-3 space-y-2.5 rounded-xl border border-brand-400/35 bg-brand-400/5 p-3"
                  >
                    <p className="text-[13px] font-semibold text-shell-ink">
                      How many of each? Set <span className="text-brand-300">Qty</span>, cost, and sell here.
                    </p>
                    <VariantTable
                      variants={state.variants}
                      totalUnits={units}
                      stockValue={value}
                      existingStock={!isEdit ? existingStock : undefined}
                      onQty={(i, qty) => setVar(i, { qty })}
                      onCost={(i, cost) => setVar(i, { cost })}
                      onPrice={(i, price) => setVar(i, { price })}
                    />
                  </div>
                )}
                {state.variants.length !== 1 ? (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <APLabel
                      label="Default cost"
                      hint={state.variants.length === 0 ? 'applies when you pick specs' : 'fills empty variant rows'}
                    >
                      <APMoney value={state.baseCost} onChange={v => applyBase('baseCost', v)} />
                    </APLabel>
                    <APLabel label="Default sell" hint="optional; per unit on Serials if prices differ">
                      <APMoney value={state.basePrice} onChange={v => applyBase('basePrice', v)} />
                    </APLabel>
                  </div>
                ) : null}
                {state.variants.some(v => v.qty > 1) ? (
                  <p className="text-[12px] leading-relaxed text-shell-muted">
                    Different cost or sell per phone? Set each unit on the{' '}
                    <span className="font-medium text-shell-ink">Serials</span> step.
                  </p>
                ) : null}
              </>
            ) : cur === 'Serials' ? (
              <>
                <div className="-mt-1 flex items-start justify-between gap-3">
                  <p className="text-[13px] leading-relaxed text-shell-muted">
                    For each unit: {idType}, what you paid (cost), and what you will sell for. IMEI can be blank now and
                    added later on the product page.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      const next = findNextEmptySerial();
                      if (next) setScanTarget(next);
                    }}
                  >
                    <ScanLine size={14} />
                    Scan
                  </Button>
                </div>
                {state.variants.map(v => (
                  <div key={v.label} className="overflow-hidden rounded-xl border border-shell-line">
                    <div className="flex items-center justify-between bg-shell-surface-2/60 px-3.5 py-2">
                      <span className="text-[13px] font-semibold text-shell-ink">{v.label}</span>
                      <span className="text-[11.5px] text-shell-muted">
                        {codesOf(v.label).filter(c => (c || '').trim()).length}/{v.qty} entered
                      </span>
                    </div>
                    <div className="flex flex-col gap-3 p-3">
                      {Array.from({ length: v.qty }, (_, k) => {
                        const econ = unitEconomicsForVariant(state, v)[k] ?? {
                          cost: v.cost,
                          price: v.price,
                        };
                        return (
                          <div
                            key={k}
                            className="space-y-2 rounded-lg border border-shell-line/70 bg-shell-surface-2/25 p-2.5"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-[22px] shrink-0 font-mono text-xs text-shell-muted">{k + 1}</span>
                              <APTextField
                                value={codesOf(v.label)[k] || ''}
                                onChange={e => setSerial(v.label, k, e.target.value)}
                                inputMode={idType === 'IMEI' ? 'numeric' : 'text'}
                                maxLength={idType === 'IMEI' ? 17 : 24}
                                placeholder={idType === 'IMEI' ? '15-digit IMEI' : 'Serial number'}
                                className="min-w-0 flex-1 font-mono text-[13.5px]"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-10 shrink-0"
                                onClick={() => setScanTarget({ label: v.label, index: k })}
                                aria-label={`Scan ${idType} ${k + 1} for ${v.label}`}
                              >
                                <ScanLine size={18} />
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 gap-2 pl-0 min-[420px]:grid-cols-2 min-[420px]:pl-7 sm:pl-7">
                              <APLabel label="Cost">
                                <APMoney
                                  value={econ.cost}
                                  onChange={n => setUnitEconomics(v.label, k, { cost: n })}
                                />
                              </APLabel>
                              <APLabel label="Sell">
                                <APMoney
                                  value={econ.price}
                                  onChange={n => setUnitEconomics(v.label, k, { price: n })}
                                />
                              </APLabel>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            ) : cur === 'Stock' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <APLabel label="Cost / unit">
                    <APMoney
                      value={state.variants[0]?.cost ?? state.baseCost}
                      onChange={v => {
                        if (state.variants.length === 0) {
                          setState(syncVar({ ...state, baseCost: v }, {}));
                          setVar(0, { cost: v });
                        } else setVar(0, { cost: v });
                      }}
                    />
                  </APLabel>
                  <APLabel label="Sell / unit">
                    <APMoney
                      value={state.variants[0]?.price ?? state.basePrice}
                      onChange={v => {
                        if (state.variants.length === 0) {
                          setState(syncVar({ ...state, basePrice: v }, {}));
                        } else setVar(0, { price: v });
                      }}
                    />
                  </APLabel>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <APLabel label="Quantity in stock">
                    <APTextField
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={state.variants[0]?.qty ?? 1}
                      onChange={e => {
                        const qty = Math.max(0, Number(e.target.value) || 0);
                        setState(prev => {
                          const base = prev.variants.length === 0 ? syncVar(prev, {}) : prev;
                          const variants = base.variants.length
                            ? base.variants.map((variant, index) => (index === 0 ? { ...variant, qty } : variant))
                            : [{ label: 'Stock', attrs: {}, qty, cost: base.baseCost, price: base.basePrice }];
                          return { ...base, variants };
                        });
                      }}
                      className="font-mono"
                    />
                  </APLabel>
                  <APLabel label="Reorder at">
                    <APTextField
                      type="number"
                      value={state.reorder}
                      onChange={e => set({ reorder: Number(e.target.value) || 0 })}
                      className="font-mono"
                    />
                  </APLabel>
                </div>
                <APLabel label="Shelf" hint="optional">
                  <APTextField
                    value={state.shelf}
                    onChange={e => set({ shelf: e.target.value })}
                    placeholder="e.g. D1"
                  />
                </APLabel>
              </>
            ) : cur === 'Network' ? (
              <>
                <p className="-mt-1 text-[13px] leading-relaxed text-shell-muted">
                  How is this phone unlocked, and what SIM setup does it have? This goes on the listing and sale
                  receipt so staff can disclose it at checkout.
                </p>
                <APLabel label="Unlock status">
                  <APChoiceStack
                    options={NETWORK_STATUS_OPTIONS}
                    value={state.network.status}
                    onChange={status =>
                      set({
                        network: {
                          status,
                          simConfig: networkStatusNeedsSimConfig(status) ? state.network.simConfig : '',
                          esimStatus: '',
                        },
                      })
                    }
                  />
                </APLabel>
                {state.network.status ? (
                  <>
                    <APLabel
                      label="SIM configuration"
                      hint={
                        networkStatusNeedsSimConfig(state.network.status) ? 'required for locked phones' : 'optional'
                      }
                    >
                      <APChoiceStack
                        options={SIM_CONFIG_OPTIONS}
                        value={state.network.simConfig}
                        onChange={simConfig =>
                          set({
                            network: {
                              ...state.network,
                              simConfig,
                              esimStatus: simConfigNeedsEsimStatus(simConfig) ? state.network.esimStatus : '',
                            },
                          })
                        }
                      />
                    </APLabel>
                    {simConfigNeedsEsimStatus(state.network.simConfig) ? (
                      <APLabel label="eSIM activation" hint="iPhone 14+ and newer">
                        <APChoiceStack
                          options={ESIM_STATUS_OPTIONS}
                          value={state.network.esimStatus}
                          onChange={esimStatus => set({ network: { ...state.network, esimStatus } })}
                        />
                      </APLabel>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : cur === 'Inspect' ? (
              <>
                <p className="-mt-1 text-[13px] leading-relaxed text-shell-muted">
                  Record what&apos;s been changed on this {state.cat === 'Laptop' ? 'laptop' : state.cat === 'Tablet' ? 'tablet' : 'phone'} so you can price
                  it right and disclose it at the point of sale.
                </p>
                {isHandheldCat(state.cat) ? (
                  <>
                    <APLabel label="Display" hint="Changed = carries IDM">
                      <APSeg
                        options={['Original', 'Changed'] as const}
                        value={state.insp.display}
                        onChange={v => set({ insp: { ...state.insp, display: v } })}
                      />
                    </APLabel>
                    {idm ? (
                      <APMsg
                        code="IDM"
                        title="Important Display Message"
                        text="Screen was replaced and isn't recognised as genuine. Staff will be prompted to disclose it on sale."
                      />
                    ) : null}
                    <APLabel label="Battery">
                      <APSeg
                        options={['Original', 'Changed'] as const}
                        value={state.insp.battery}
                        onChange={v => set({ insp: { ...state.insp, battery: v } })}
                      />
                    </APLabel>
                    {state.insp.battery === 'Changed' ? (
                      <APMsg
                        code="IBM"
                        title="Important Battery Message"
                        text="Battery was replaced with a non-genuine cell — the phone shows a service warning. Disclose at sale."
                      />
                    ) : null}
                    <APLabel label="Battery health" hint="1–100%">
                      <PercentDraftInput
                        value={state.insp.batteryHealth}
                        onChange={batteryHealth =>
                          set({
                            insp: {
                              ...state.insp,
                              batteryHealth: batteryHealth ?? state.insp.batteryHealth,
                            },
                          })
                        }
                        min={1}
                        max={100}
                        emptyDefault={100}
                        className="font-mono"
                      />
                    </APLabel>
                    <APLabel label="Camera">
                      <APSeg
                        options={['Original', 'Changed'] as const}
                        value={state.insp.camera}
                        onChange={v => set({ insp: { ...state.insp, camera: v } })}
                      />
                    </APLabel>
                    {state.insp.camera === 'Changed' ? (
                      <APMsg
                        code="ICM"
                        title="Important Camera Message"
                        text="Camera was replaced and isn't recognised as genuine — the phone shows a warning. Disclose at sale."
                      />
                    ) : null}
                    <div className="flex items-center justify-between rounded-[11px] border border-shell-line bg-shell-surface-2/40 px-3.5 py-3">
                      <span className="text-[13.5px] font-semibold text-shell-ink">Face ID / fingerprint works</span>
                      <APToggle
                        checked={state.insp.faceId}
                        onChange={v => set({ insp: { ...state.insp, faceId: v } })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <APLabel label="Screen">
                      <APSeg
                        options={['Original', 'Changed'] as const}
                        value={state.insp.display}
                        onChange={v => set({ insp: { ...state.insp, display: v } })}
                      />
                    </APLabel>
                    <APLabel label="Battery health" hint="1–100%">
                      <PercentDraftInput
                        value={state.insp.batteryHealth}
                        onChange={batteryHealth =>
                          set({
                            insp: {
                              ...state.insp,
                              batteryHealth: batteryHealth ?? state.insp.batteryHealth,
                            },
                          })
                        }
                        min={1}
                        max={100}
                        emptyDefault={100}
                        className="font-mono"
                      />
                    </APLabel>
                  </>
                )}
                <APLabel label="Body grade" hint="A = clean · C = heavy use">
                  <APSeg
                    options={['A', 'B', 'C'] as const}
                    value={state.insp.grade}
                    onChange={v => set({ insp: { ...state.insp, grade: v } })}
                  />
                </APLabel>
                <div className="rounded-xl border border-shell-line bg-shell-surface-2/40 p-3.5">
                  {!isEdit ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Wrench size={17} className="text-sky-400" />
                          <span className="text-[13.5px] font-semibold text-shell-ink">Send to engineer first</span>
                        </div>
                        <APToggle checked={state.toEngineer} onChange={v => set({ toEngineer: v })} />
                      </div>
                      {state.toEngineer ? (
                    <div className="mt-3.5 flex flex-col gap-3">
                      <APLabel label="What's damaged / needs changing" hint="tap all that apply">
                        <APMulti
                          options={INTAKE_FAULTS}
                          value={state.faults}
                          onChange={v => set({ faults: v })}
                          addLabel="Other"
                        />
                      </APLabel>
                      <APLabel label="Notes for engineer" hint="optional">
                        <APTextField
                          value={state.fault}
                          onChange={e => set({ fault: e.target.value })}
                          placeholder="e.g. back glass shattered, port not charging"
                        />
                      </APLabel>
                      <div className="grid grid-cols-2 gap-3">
                        <APLabel label="Engineer">
                          <APSeg
                            options={
                              engineerNames.length > 0
                                ? engineerNames
                                : [state.engineer || 'Engineer']
                            }
                            value={state.engineer || engineerDefault || 'Engineer'}
                            onChange={v => set({ engineer: v })}
                          />
                        </APLabel>
                        <APLabel label="Parts estimate">
                          <APMoney value={state.partsEst} onChange={v => set({ partsEst: v })} />
                        </APLabel>
                      </div>
                      <p className="text-xs leading-relaxed text-shell-muted">
                        A repair ticket opens automatically when you save — the unit shows on the bench until
                        it&apos;s cleared for sale.
                      </p>
                    </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3.5">
                  <CategoryThumb category={meta.category} size="lg" className="rounded-[14px]" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">{state.condition}</Badge>
                      {idm ? <Badge className="bg-amber-400/15 text-amber-300">IDM</Badge> : null}
                      {tracks ? <Badge className="bg-sky-400/15 text-sky-300">{idType} tracked</Badge> : null}
                      {isHandheldCat(state.cat) && formatNetworkSummary(state.network) ? (
                        <Badge className="bg-brand-400/15 text-brand-200">{formatNetworkSummary(state.network)}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 font-display text-[17px] font-semibold text-shell-ink">
                      {state.model || 'Untitled'}
                    </p>
                    <p className="text-[13px] text-shell-muted">
                      {state.brand}
                      {state.cat === 'Laptop' && state.processor ? ` · ${state.processor}` : ''}
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-shell-line">
                  {(state.variants.length
                    ? state.variants
                    : [{ label: 'Stock', qty: 1, cost: state.baseCost, price: state.basePrice }]
                  ).map(
                    (v, i) => (
                      <div
                        key={v.label}
                        className={cn(
                          'flex items-center justify-between px-3.5 py-2.5',
                          i > 0 && 'border-t border-shell-line',
                        )}
                      >
                        <span className="text-[13.5px] text-shell-ink">
                          {isSimpleStockCat(state.cat) ? state.spec || 'Stock' : v.label}
                        </span>
                        <span className="text-right text-[13px] text-shell-muted">
                          <span className="font-mono">{v.qty}</span> × cost{' '}
                          <span className="font-mono text-shell-ink">{formatCurrency(v.cost)}</span>
                          {' · sell '}
                          <span className="font-mono font-semibold text-shell-ink">{formatCurrency(v.price)}</span>
                        </span>
                      </div>
                    ),
                  )}
                  <div className="flex items-center justify-between border-t border-shell-line bg-shell-surface-2/60 px-3.5 py-2.5">
                    <span className="text-[12.5px] text-shell-muted">{units} units · stock value</span>
                    <span className="font-mono text-sm font-semibold text-shell-ink">{formatCurrency(value)}</span>
                  </div>
                </div>

                {needsInspect ? (
                  <div className="flex flex-wrap gap-1.5">
                    {isHandheldCat(state.cat) ? (
                      <>
                        <Badge className={state.insp.display === 'Changed' ? 'bg-amber-400/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-400'}>
                          Display {state.insp.display}
                          {state.insp.display === 'Changed' ? ' · IDM' : ''}
                        </Badge>
                        <Badge className={state.insp.battery === 'Changed' ? 'bg-amber-400/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-400'}>
                          Battery {state.insp.battery} · {state.insp.batteryHealth}%
                          {state.insp.battery === 'Changed' ? ' · IBM' : ''}
                        </Badge>
                        <Badge className={state.insp.camera === 'Changed' ? 'bg-amber-400/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-400'}>
                          Camera {state.insp.camera}
                          {state.insp.camera === 'Changed' ? ' · ICM' : ''}
                        </Badge>
                        <Badge className={state.insp.faceId ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}>
                          Face ID {state.insp.faceId ? 'OK' : 'Faulty'}
                        </Badge>
                      </>
                    ) : (
                      <>
                        <Badge className={state.insp.display === 'Changed' ? 'bg-amber-400/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-400'}>
                          Screen {state.insp.display}
                        </Badge>
                        <Badge className="bg-emerald-500/15 text-emerald-400">Battery {state.insp.batteryHealth}%</Badge>
                      </>
                    )}
                    <Badge variant="outline">Grade {state.insp.grade}</Badge>
                    {state.faults.length > 0 ? (
                      <Badge className="bg-red-500/15 text-red-400">Repair: {state.faults.join(', ')}</Badge>
                    ) : null}
                    {state.toEngineer ? (
                      <Badge className="bg-sky-400/15 text-sky-300">→ {state.engineer}</Badge>
                    ) : null}
                  </div>
                ) : null}

                <DateTimeField
                  id="stocked_at"
                  label="Date added to stock"
                  hint="Backdate if you collected or bought this stock earlier — used for stock-takes and reports."
                  value={state.stockedAt}
                  onChange={v => set({ stockedAt: v })}
                />

                {purchase && cur === 'Review' ? (
                  <div className="space-y-4">
                    {drafts.length > 0 ? (
                      <div className="overflow-hidden rounded-xl border border-shell-line">
                        {drafts.map((draft, index) => (
                          <div
                            key={`${draft.model}-${index}`}
                            className={cn(
                              'flex items-center justify-between gap-3 px-3.5 py-2.5',
                              index > 0 && 'border-t border-shell-line',
                            )}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[13.5px] font-semibold text-shell-ink">{draft.model}</p>
                              <p className="text-[12px] text-shell-muted">
                                {draft.cat} · {draft.brand}
                              </p>
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={() => editDraft(index)}>
                              Edit
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <APLabel label="Terms">
                      <ChoiceGrid options={PURCHASE_TERMS} value={terms} onChange={setTerms} />
                    </APLabel>
                    {terms === 'partial' ? (
                      <APLabel label="Paid now">
                        <CurrencyInput
                          value={paidNow}
                          onValueChange={value => setPaidNow(value ?? 0)}
                          className={cn(inputShellClass, 'font-mono')}
                        />
                      </APLabel>
                    ) : null}
                    {terms !== 'credit' ? (
                      <APLabel label="Method">
                        <ChoiceGrid options={PURCHASE_PAY} value={method} onChange={setMethod} />
                      </APLabel>
                    ) : null}
                  </div>
                ) : null}

                {saveError ? (
                  <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">
                    {saveError}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {!saved && !loadError && !noSuppliers && !(isEdit && editItemLoading) ? (
            <div className="flex shrink-0 items-center gap-2.5 border-t border-shell-line px-5 py-4">
              {step > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-shell-muted hover:bg-shell-surface-2 hover:text-shell-ink"
                  onClick={() => setStep(s => s - 1)}
                  disabled={saving}
                >
                  Back
                </Button>
              ) : null}
              <div className="flex-1" />
              {cur === 'Variants' && state.variants.length > 0 ? (
                <p className="max-w-[min(46vw,200px)] text-[11px] leading-snug text-shell-muted">
                  {units} unit{units !== 1 ? 's' : ''}
                  {units === 1 ? ' · change Qty in green box above' : ''}
                </p>
              ) : null}
              {purchase && cur === 'Review' ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-shell-line"
                  disabled={!canNext() || saving}
                  onClick={addAnother}
                >
                  Add another
                </Button>
              ) : null}
              <Button
                type="button"
                className="bg-brand-400 text-[#04231d] hover:bg-brand-300 disabled:opacity-45"
                disabled={!canNext() || saving}
                onClick={next}
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving…
                  </>
                ) : cur === 'Review' ? (
                  <>
                    <Check size={16} />
                    {purchase ? 'Save purchase' : isEdit ? 'Save changes' : 'Save to inventory'}
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </div>
          ) : null}
        
      </ModalSheetFrame>
    </ModalSheetPortal>
    {scanTarget ? (
      <Suspense fallback={null}>
        <BarcodeScanner onScan={handleScan} onClose={() => setScanTarget(null)} />
      </Suspense>
    ) : null}
  </>
  );
}
