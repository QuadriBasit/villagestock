import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Loader2, Wrench } from 'lucide-react';
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
import { suggestedNamesForCategoryAndBrand } from '@/lib/devicePresets';
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
  buildSingleIntakeItem,
  flowSteps,
  idTypeFor,
  isIdmFlagged,
  resetForCategory,
  stockValue,
  totalUnits,
} from './buildItems';
import { itemToAddProductState } from './parseItem';
import {
  APLabel,
  APMoney,
  APMsg,
  APMulti,
  APSeg,
  APStepper,
  APTextField,
  APToggle,
  CategoryPicker,
  fieldClass,
  StepProgress,
  TrackToggle,
  VariantTable,
} from './ui';
import {
  blankAddProductState,
  CAT_META,
  INTAKE_FAULTS,
  syncVariants,
  syncVariantsForEdit,
  type AddProductState,
} from './types';

type AddProductFlowProps = {
  open: boolean;
  onClose: () => void;
  /** When set, wizard edits an existing inventory row instead of creating new ones. */
  itemId?: string;
};

type SavedSummary = {
  count: number;
  units: number;
  engineer: string | null;
};

export default function AddProductFlow({ open, onClose, itemId }: AddProductFlowProps) {
  const isEdit = Boolean(itemId);
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();
  const engineerNames = useEngineerNames();
  const engineerDefault = engineerNames[0] ?? '';
  const { item: editItem, isLoading: editItemLoading } = useInventoryItem(itemId ?? '');
  const { addItem, updateItem } = useInventoryActions();
  const { sendToEngineer } = useRepairActions();
  const mergedModelRef = useRef('');

  const [state, setState] = useState<AddProductState>(() => blankAddProductState(engineerDefault));
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState<SavedSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (isEdit) return;
    mergedModelRef.current = '';
    setState(blankAddProductState(engineerDefault));
    setStep(0);
    setSaved(null);
    setSaving(false);
    setSaveError(null);
    setLoadError(null);
  }, [open, engineerDefault, isEdit]);

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
    if (!open || !isEdit || !itemId) return;
    if (editItemLoading) return;
    if (!editItem || editItem.deleted) {
      setLoadError('Item not found');
      return;
    }
    const parsed = itemToAddProductState(editItem, engineerDefault);
    if (!parsed) {
      setLoadError('This item type cannot be edited in the product wizard yet.');
      return;
    }
    setState(parsed);
    setStep(0);
    setSaved(null);
    setSaving(false);
    setSaveError(null);
    setLoadError(null);
  }, [open, isEdit, itemId, editItem, editItemLoading, engineerDefault]);

  const syncVar = isEdit ? syncVariantsForEdit : syncVariants;

  const set = (patch: Partial<AddProductState>) => setState(p => ({ ...p, ...patch }));

  const steps = useMemo(() => flowSteps(state), [state]);
  const cur = steps[Math.min(step, steps.length - 1)] ?? 'Identify';
  const meta = CAT_META[state.cat];
  const nameSuggestions = useMemo(
    () => suggestedNamesForCategoryAndBrand(meta.category, state.brand),
    [meta.category, state.brand],
  );
  const needsInspect = (state.cat === 'Phone' || state.cat === 'Laptop') && state.condition !== 'New';
  const idType = idTypeFor(state);
  const tracks = (state.cat === 'Phone' || state.cat === 'Laptop') && state.track;
  const idm = isIdmFlagged(state);
  const units = totalUnits(state);
  const value = stockValue(state);

  const codesOf = (label: string) => state.serials[label] ?? [];
  const setSerial = (label: string, index: number, value: string) => {
    set({
      serials: {
        ...state.serials,
        [label]: Object.assign([], codesOf(label), { [index]: value }),
      },
    });
  };

  const setVar = (i: number, patch: Partial<(typeof state.variants)[0]>) => {
    set({ variants: state.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  };

  const applyBase = (key: 'baseCost' | 'basePrice', val: number) => {
    const field = key === 'baseCost' ? 'cost' : 'price';
    set({
      [key]: val,
      variants: state.variants.map(v => ({ ...v, [field]: val })),
    } as Partial<AddProductState>);
  };

  const canNext = () => {
    if (cur === 'Identify') return Boolean(state.brand && state.model.trim());
    if (cur === 'Variants') {
      return state.variants.length > 0 && units > 0 && state.variants.every(v => v.price > 0);
    }
    if (cur === 'Stock') {
      const v = state.variants[0];
      return Boolean(v && v.qty > 0 && v.price > 0);
    }
    return true;
  };

  const doSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if (isEdit && itemId) {
        const input = buildSingleIntakeItem(state);
        await updateItem(itemId, input, { deferIdentifiers: true });
        setSaved({ count: 1, units: 1, engineer: null });
        return;
      }

      const inputs = buildIntakeItems(state);
      const ids: string[] = [];
      for (const input of inputs) {
        ids.push(await addItem(input, { deferIdentifiers: true }));
      }

      let engineerSent: string | null = null;
      if (needsInspect && state.toEngineer && ids[0]) {
        await sendToEngineer({
          item_id: ids[0],
          engineer_name: state.engineer || engineerDefault || 'Engineer',
          issue_description:
            [...state.faults, state.fault.trim()].filter(Boolean).join(' · ') || 'Intake inspection',
          repair_cost: state.partsEst || undefined,
          date_sent: new Date().toISOString(),
        });
        engineerSent = state.engineer || engineerDefault || 'Engineer';
      }

      setSaved({
        count: state.cat === 'Accessory' ? 1 : state.variants.length,
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

  const title = saved ? (isEdit ? 'Product updated' : 'Product added') : isEdit ? 'Edit product' : 'Add product';

  return (
    <ModalSheetPortal>
      <ModalSheetFrame onClose={handleClose} panelClassName={cn(modalSheetPanelLg, 'max-w-[640px] sm:max-h-[min(90dvh,calc(100dvh-2rem))]')} backdropClassName="bg-black/70">
<div className="shrink-0 px-5 pt-4 pb-0">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-shell-ink">{title}</h2>
              <ModalSheetClose onClick={handleClose} className="size-8" />
            </div>
            {!saved ? <StepProgress steps={steps} step={step} /> : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto overscroll-contain px-5 py-5">
            {isEdit && editItemLoading ? (
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
                  {isEdit
                    ? 'Changes saved to inventory.'
                    : `${saved.units} unit${saved.units !== 1 ? 's' : ''} across ${saved.count} variant${saved.count !== 1 ? 's' : ''} added to inventory${idm ? ' · IDM flagged' : ''}.`}
                </p>
                {saved.engineer ? (
                  <p className="mt-1.5 text-[13px] font-semibold text-sky-400">
                    Repair ticket opened for {saved.engineer}.
                  </p>
                ) : null}
                <Button className="mt-5 w-full bg-violet-400 text-[#160a2e] hover:bg-violet-300" onClick={handleClose}>
                  Done
                </Button>
              </div>
            ) : cur === 'Identify' ? (
              <>
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
                    disabled={isEdit}
                    onChange={cat => setState(resetForCategory(cat, state.engineer || engineerDefault))}
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
                {nameSuggestions.length > 0 ? (
                  <ComboboxField
                    id="add-product-model"
                    label="Model name"
                    options={nameSuggestions}
                    value={state.model}
                    onChange={e => set({ model: e.target.value })}
                    placeholder={
                      state.brand.trim()
                        ? 'Pick a model or type your own'
                        : 'Pick brand for filtered models, or type any name'
                    }
                    emptyHint="Suggestions update when you change brand. Custom names always allowed."
                    className={cn(fieldClass, 'h-11 rounded-[10px] shadow-none ring-offset-0')}
                    wrapperClassName="[&_label]:mb-2 [&_label]:text-[12.5px] [&_label]:font-semibold [&_label]:text-shell-muted"
                  />
                ) : (
                  <APLabel
                    label="Model name"
                    hint={state.cat === 'Laptop' ? 'e.g. HP EliteBook 840 G5' : 'e.g. iPhone 13 Pro Max'}
                  >
                    <APTextField
                      value={state.model}
                      onChange={e => set({ model: e.target.value })}
                      placeholder="Type the model…"
                    />
                  </APLabel>
                )}
                {state.cat === 'Laptop' ? (
                  <APLabel label="Processor" hint="optional">
                    <APTextField
                      value={state.processor}
                      onChange={e => set({ processor: e.target.value })}
                      placeholder="e.g. Intel i7 · 8th Gen"
                    />
                  </APLabel>
                ) : null}
                {state.cat === 'Accessory' ? (
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
                {state.cat === 'Phone' || state.cat === 'Laptop' ? (
                  <TrackToggle idType={idType} track={state.track} onChange={v => set({ track: v })} />
                ) : null}
              </>
            ) : cur === 'Variants' ? (
              <>
                {state.cat === 'Phone' ? (
                  <>
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
                <div className="grid grid-cols-2 gap-2.5">
                  <APLabel label="Cost / unit">
                    <APMoney value={state.baseCost} onChange={v => applyBase('baseCost', v)} />
                  </APLabel>
                  <APLabel label="Sell / unit">
                    <APMoney value={state.basePrice} onChange={v => applyBase('basePrice', v)} />
                  </APLabel>
                </div>
                {state.variants.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-shell-line py-[18px] text-center text-[13px] text-shell-muted">
                    Pick a {state.cat === 'Phone' ? 'storage or colour' : 'RAM or storage'} above to build variants.
                  </div>
                ) : (
                  <VariantTable
                    variants={state.variants}
                    totalUnits={units}
                    stockValue={value}
                    lockQty={isEdit && state.cat !== 'Accessory'}
                    existingStock={!isEdit ? existingStock : undefined}
                    onQty={(i, qty) => setVar(i, { qty })}
                    onPrice={(i, price) => setVar(i, { price })}
                  />
                )}
              </>
            ) : cur === 'Serials' ? (
              <>
                <p className="-mt-1 text-[13px] leading-relaxed text-shell-muted">
                  Enter the {idType} for each unit. You can scan or type them now, or leave blanks and fill them in
                  later from the product page.
                </p>
                {state.variants.map(v => (
                  <div key={v.label} className="overflow-hidden rounded-xl border border-shell-line">
                    <div className="flex items-center justify-between bg-shell-surface-2/60 px-3.5 py-2">
                      <span className="text-[13px] font-semibold text-shell-ink">{v.label}</span>
                      <span className="text-[11.5px] text-shell-muted">
                        {codesOf(v.label).filter(c => (c || '').trim()).length}/{v.qty} entered
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 p-3">
                      {Array.from({ length: v.qty }, (_, k) => (
                        <div key={k} className="flex items-center gap-2.5">
                          <span className="w-[22px] shrink-0 font-mono text-xs text-shell-muted">{k + 1}</span>
                          <APTextField
                            value={codesOf(v.label)[k] || ''}
                            onChange={e => setSerial(v.label, k, e.target.value)}
                            inputMode={idType === 'IMEI' ? 'numeric' : 'text'}
                            maxLength={idType === 'IMEI' ? 17 : 24}
                            placeholder={idType === 'IMEI' ? '15-digit IMEI' : 'Serial number'}
                            className="font-mono text-[13.5px]"
                          />
                        </div>
                      ))}
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
                    <APStepper
                      value={state.variants[0]?.qty ?? 1}
                      onChange={n => {
                        if (state.variants.length === 0) setState(syncVar(state, {}));
                        setVar(0, { qty: n });
                      }}
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
            ) : cur === 'Inspect' ? (
              <>
                <p className="-mt-1 text-[13px] leading-relaxed text-shell-muted">
                  Record what&apos;s been changed on this {state.cat === 'Phone' ? 'phone' : 'laptop'} so you can price
                  it right and disclose it at the point of sale.
                </p>
                {state.cat === 'Phone' ? (
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
                    <APLabel label="Battery health" hint={`${state.insp.batteryHealth}%`}>
                      <APTextField
                        type="range"
                        min={1}
                        max={100}
                        value={state.insp.batteryHealth}
                        onChange={e =>
                          set({ insp: { ...state.insp, batteryHealth: Number(e.target.value) } })
                        }
                        className="w-full accent-violet-400"
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
                    <APLabel label="Battery health" hint={`${state.insp.batteryHealth}%`}>
                      <APTextField
                        type="range"
                        min={1}
                        max={100}
                        value={state.insp.batteryHealth}
                        onChange={e =>
                          set({ insp: { ...state.insp, batteryHealth: Number(e.target.value) } })
                        }
                        className="w-full accent-violet-400"
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
                  {(state.variants.length ? state.variants : [{ label: 'Stock', qty: 1, price: state.basePrice }]).map(
                    (v, i) => (
                      <div
                        key={v.label}
                        className={cn(
                          'flex items-center justify-between px-3.5 py-2.5',
                          i > 0 && 'border-t border-shell-line',
                        )}
                      >
                        <span className="text-[13.5px] text-shell-ink">
                          {state.cat === 'Accessory' ? state.spec || 'Stock' : v.label}
                        </span>
                        <span className="text-[13px] text-shell-muted">
                          <span className="font-mono">{v.qty}</span> ×{' '}
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
                    {state.cat === 'Phone' ? (
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

                {saveError ? (
                  <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">
                    {saveError}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {!saved && !loadError && !(isEdit && editItemLoading) ? (
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
              <Button
                type="button"
                className="bg-violet-400 text-[#160a2e] hover:bg-violet-300 disabled:opacity-45"
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
                    {isEdit ? 'Save changes' : 'Save to inventory'}
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </div>
          ) : null}
        
      </ModalSheetFrame>
    </ModalSheetPortal>
  );
}
