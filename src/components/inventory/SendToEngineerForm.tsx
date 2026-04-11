import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Wrench, X } from 'lucide-react';
import { useEngineerNames } from '@/hooks/useRepairs';
import { useRepairActions } from '@/hooks/useRepairActions';
import { useTradingGateState } from '@/hooks/useStockSessions';
import type { InventoryItem } from '@/types';
import {
  modalSheetBackdrop,
  modalSheetBodyScroll,
  modalSheetHandle,
  modalSheetHeader,
  modalSheetPanelMd,
} from '@/lib/modalSheet';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DatePickerField } from '@/components/ui/DatePickerField';

const schema = z.object({
  engineer_name: z.string().min(1, 'Repair shop or technician name is required'),
  engineer_phone: z.string().optional(),
  issue_description: z.string().min(1, 'Issue description is required'),
  repair_cost: z.coerce.number().min(0).optional(),
  date_sent: z.string().min(1),
  expected_return_date: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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

  const fieldClass =
    'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100';
  const labelClass = 'mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200';

  const tradeLocked =
    tradingGate.gateApplies && tradingGate.isReady && tradingGate.tradingBlocked;
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
    <div className={modalSheetBackdrop} onClick={onClose}>
      <div className={modalSheetPanelMd} onClick={e => e.stopPropagation()}>
        <div className={modalSheetHandle}>
          <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>
        <div className={modalSheetHeader}>
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-accent" />
            <h2 className="font-heading text-base font-bold text-zinc-900 dark:text-zinc-50">Send for repair</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className={`${modalSheetBodyScroll} min-h-0 space-y-5 bg-zinc-50/70 dark:bg-zinc-950/35`}>
          {tradeLocked && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-100">
              {tradingGate.message}
            </p>
          )}
          {submitError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {submitError}
            </p>
          )}
          <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-800/50 dark:ring-white/10">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {item.brand} {item.name}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {item.imei || item.serial_number || 'No IMEI / serial recorded'}
            </div>
          </section>
          <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-800/50 dark:ring-white/10">
            <div>
              <label className={labelClass} htmlFor="engineer_name">Repair shop / technician *</label>
              <input id="engineer_name" list="engineer-names" {...register('engineer_name')} className={fieldClass} />
              <datalist id="engineer-names">
                {engineerNames.map(name => <option key={name} value={name} />)}
              </datalist>
              {errors.engineer_name && <p className="text-red-500 text-xs mt-1">{errors.engineer_name.message}</p>}
            </div>
            <div>
              <label className={labelClass} htmlFor="engineer_phone">Phone (optional)</label>
              <input id="engineer_phone" {...register('engineer_phone')} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="issue_description">Issue Description *</label>
              <textarea id="issue_description" rows={3} {...register('issue_description')} className={`${fieldClass} resize-none`} />
              {errors.issue_description && <p className="text-red-500 text-xs mt-1">{errors.issue_description.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="repair_cost">Agreed Repair Cost</label>
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
                      className={fieldClass}
                    />
                  )}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="date_sent">Date Sent *</label>
                <input id="date_sent" type="datetime-local" {...register('date_sent')} className={fieldClass} />
              </div>
            </div>
            <DatePickerField
              id="expected_return_date"
              label="Expected return date"
              value={expectedReturn}
              onChange={v =>
                setValue('expected_return_date', v, { shouldDirty: true, shouldValidate: true })
              }
            />
          </section>
          <div className="pb-4">
            <button
              type="submit"
              disabled={isSubmitting || !canSend}
              className="w-full bg-accent text-white rounded-xl py-3.5 font-heading font-semibold text-sm hover:bg-accent-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <><Loader2 size={16} className="animate-spin" /> Sending…</>
              ) : !canSend ? (
                tradeLocked ? tradingGate.message : `Status: ${item.status ?? '—'}`
              ) : (
                <><Wrench size={16} /> Confirm</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalSheetPortal>
  );
}
