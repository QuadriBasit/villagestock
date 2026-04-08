import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Wrench, X } from 'lucide-react';
import { useEngineerNames } from '@/hooks/useRepairs';
import { useRepairActions } from '@/hooks/useRepairActions';
import { useTradingGateState } from '@/hooks/useStockSessions';
import type { InventoryItem } from '@/types';

const schema = z.object({
  engineer_name: z.string().min(1, 'Engineer name is required'),
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
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      date_sent: toLocalDatetimeValue(new Date()),
    },
  });

  const fieldClass = 'w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition bg-white';
  const labelClass = 'block text-sm font-medium text-dark mb-1';

  const tradeLocked =
    tradingGate.gateApplies && tradingGate.isReady && tradingGate.tradingBlocked;
  const canSend = item.status === 'in_stock' && !tradeLocked;

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-border" /></div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-accent" />
            <h2 className="font-heading font-bold text-dark text-base">Send To Engineer</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-border text-muted"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
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
          <section className="bg-white rounded-2xl p-4 space-y-4 shadow-sm">
            <div className="text-sm font-medium text-dark">{item.brand} {item.name}</div>
            <div className="text-xs text-muted">{item.imei || item.serial_number || 'No IMEI / serial recorded'}</div>
          </section>
          <section className="bg-white rounded-2xl p-4 space-y-4 shadow-sm">
            <div>
              <label className={labelClass} htmlFor="engineer_name">Engineer Name *</label>
              <input id="engineer_name" list="engineer-names" {...register('engineer_name')} className={fieldClass} />
              <datalist id="engineer-names">
                {engineerNames.map(name => <option key={name} value={name} />)}
              </datalist>
              {errors.engineer_name && <p className="text-red-500 text-xs mt-1">{errors.engineer_name.message}</p>}
            </div>
            <div>
              <label className={labelClass} htmlFor="engineer_phone">Engineer Phone</label>
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
                <input id="repair_cost" type="number" inputMode="decimal" {...register('repair_cost')} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="date_sent">Date Sent *</label>
                <input id="date_sent" type="datetime-local" {...register('date_sent')} className={fieldClass} />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="expected_return_date">Expected Return Date</label>
              <input id="expected_return_date" type="date" {...register('expected_return_date')} className={fieldClass} />
            </div>
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
  );
}
