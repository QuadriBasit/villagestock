import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Wrench } from 'lucide-react';
import { useEngineerNames } from '@/hooks/useRepairs';
import { useRepairActions } from '@/hooks/useRepairActions';
import { useTradingGateState } from '@/hooks/useStockSessions';
import type { InventoryItem } from '@/types';
import { modalSheetBodyScroll, modalSheetHeader, modalSheetPanelMd } from '@/lib/modalSheet';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { ModalSheetClose } from '@/components/ui/ModalSheetClose';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { DateTimeField, toLocalDatetimeValue } from '@/components/ui/DateTimeField';
import { settingsBtnPrimary, settingsField, settingsInset, settingsLabel } from '@/components/settings/settingsUi';
import { cn } from '@/lib/utils';

const schema = z.object({
  engineer_name: z.string().min(1, 'Repair shop or technician name is required'),
  engineer_phone: z.string().optional(),
  issue_description: z.string().min(1, 'Issue description is required'),
  repair_cost: z.coerce.number().min(0).optional(),
  date_sent: z.string().min(1),
  expected_return_date: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function SendToEngineerForm({
  item,
  onClose,
  onSuccess,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const engineerNames = useEngineerNames();
  const { sendToEngineer } = useRepairActions();
  const tradingGate = useTradingGateState();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      date_sent: toLocalDatetimeValue(new Date()),
    },
  });

  const tradeLocked = tradingGate.gateApplies && tradingGate.isReady && tradingGate.tradingBlocked;
  const canSend = item.status === 'in_stock' && !tradeLocked;
  const expectedReturn = watch('expected_return_date') ?? '';

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    try {
      await sendToEngineer({
        item_id: item.id,
        engineer_name: data.engineer_name,
        engineer_phone: data.engineer_phone || undefined,
        issue_description: data.issue_description,
        repair_cost: data.repair_cost,
        date_sent: new Date(data.date_sent).toISOString(),
        expected_return_date: data.expected_return_date ? new Date(data.expected_return_date).toISOString() : undefined,
        notes: undefined,
      });
      onSuccess();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not send');
    }
  };

  return (
    <ModalSheetPortal>
      <ModalSheetFrame onClose={onClose} panelClassName={cn(
            modalSheetPanelMd,
            'border-shell-line bg-shell-surface ring-shell-line/40 dark:border-shell-line dark:bg-shell-surface',
          )}>
<div className={cn(modalSheetHeader, 'border-shell-line')}>
            <div className="flex items-center gap-2">
              <Wrench size={18} className="text-violet-300" />
              <h2 className="font-display text-base font-bold text-shell-ink">Send for repair</h2>
            </div>
            <ModalSheetClose />
          </div>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className={cn(modalSheetBodyScroll, 'min-h-0 space-y-4 bg-shell-surface-2/20')}
          >
            {tradeLocked ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200">
                {tradingGate.message}
              </p>
            ) : null}
            {submitError ? (
              <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300">
                {submitError}
              </p>
            ) : null}
            <section className={cn(settingsInset, 'space-y-1 rounded-xl p-4')}>
              <div className="text-sm font-medium text-shell-ink">
                {item.brand} {item.name}
              </div>
              <div className="text-xs text-shell-muted">
                {item.imei || item.serial_number || 'No IMEI / serial recorded'}
              </div>
            </section>
            <section className={cn(settingsInset, 'space-y-4 rounded-xl p-4')}>
              <div>
                <label className={settingsLabel} htmlFor="engineer_name">
                  Repair shop / technician *
                </label>
                <Input id="engineer_name" list="engineer-names" {...register('engineer_name')} className={settingsField} />
                <datalist id="engineer-names">
                  {engineerNames.map(name => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                {errors.engineer_name ? (
                  <p className="mt-1 text-xs text-red-400">{errors.engineer_name.message}</p>
                ) : null}
              </div>
              <div>
                <label className={settingsLabel} htmlFor="engineer_phone">
                  Phone (optional)
                </label>
                <Input id="engineer_phone" {...register('engineer_phone')} className={settingsField} />
              </div>
              <div>
                <label className={settingsLabel} htmlFor="issue_description">
                  Issue description *
                </label>
                <Textarea
                  id="issue_description"
                  rows={3}
                  {...register('issue_description')}
                  className={cn(settingsField, 'min-h-0 resize-none')}
                />
                {errors.issue_description ? (
                  <p className="mt-1 text-xs text-red-400">{errors.issue_description.message}</p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={settingsLabel} htmlFor="repair_cost">
                    Agreed repair cost
                  </label>
                  <Controller
                    name="repair_cost"
                    control={control}
                    render={({ field }) => (
                      <CurrencyInput
                        id="repair_cost"
                        ref={field.ref}
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        allowEmpty
                        className={settingsField}
                      />
                    )}
                  />
                </div>
                <Controller
                  name="date_sent"
                  control={control}
                  render={({ field }) => (
                    <DateTimeField
                      id="date_sent"
                      label="Date sent *"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
              <DatePickerField
                id="expected_return_date"
                label="Expected return date"
                value={expectedReturn}
                onChange={v => setValue('expected_return_date', v, { shouldDirty: true, shouldValidate: true })}
              />
            </section>
            <div className="pb-4">
              <button
                type="submit"
                disabled={isSubmitting || !canSend}
                className={cn(settingsBtnPrimary, 'w-full py-3.5')}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Sending…
                  </>
                ) : !canSend ? (
                  tradeLocked ? tradingGate.message : `Status: ${item.status ?? '—'}`
                ) : (
                  <>
                    <Wrench size={16} /> Confirm
                  </>
                )}
              </button>
            </div>
          </form>
        
      </ModalSheetFrame>
    </ModalSheetPortal>
  );
}
