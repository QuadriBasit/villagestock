import { useEffect, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { ModalSheetClose } from '@/components/ui/ModalSheetClose';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn, formatCurrency } from '@/lib/utils';
import { modalSheetBodyScroll, modalSheetPanelMd } from '@/lib/modalSheet';
import type { TodayTill } from '@/hooks/useTodayTill';
import type { CashSessionRecord } from '@/types';

const NOTES = [1000, 500, 200, 100, 50] as const;

type CashCountModalProps = {
  open: boolean;
  till: TodayTill;
  onClose: () => void;
  onCloseDay: (input: {
    opening_float: number;
    cash_sales: number;
    cash_collected: number;
    cash_expenses: number;
    expected: number;
    counted: number;
    variance: number;
  }) => Promise<CashSessionRecord>;
};

export default function CashCountModal({ open, till, onClose, onCloseDay }: CashCountModalProps) {
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [done, setDone] = useState<CashSessionRecord | null>(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (open) {
      setCounts({});
      setDone(null);
    }
  }, [open]);

  if (!open) return null;

  const counted = NOTES.reduce((a, n) => a + n * (counts[n] || 0), 0);
  const expected = till.expected;
  const variance = counted - expected;

  const post = async () => {
    if (counted <= 0 || posting) return;
    setPosting(true);
    try {
      const rec = await onCloseDay({
        opening_float: till.openingFloat,
        cash_sales: till.cashSales,
        cash_collected: till.cashCollected,
        cash_expenses: till.cashExpenses,
        expected,
        counted,
        variance,
      });
      setDone(rec);
    } finally {
      setPosting(false);
    }
  };

  return (
    <ModalSheetPortal>
      <ModalSheetFrame onClose={onClose} panelClassName={modalSheetPanelMd} backdropClassName="bg-black/70">
<div className="flex items-center justify-between border-b border-shell-line px-5 py-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-shell-ink">
                {done ? 'Day closed' : 'Close of day'}
              </h2>
              {!done ? <p className="text-xs text-shell-muted">Count the cash in the drawer</p> : null}
            </div>
            <ModalSheetClose onClick={onClose} />
          </div>

          <div className={cn(modalSheetBodyScroll, 'space-y-4 px-5 py-4')}>
            {done ? (
              <div className="py-4 text-center">
                <div
                  className={cn(
                    'mx-auto mb-4 grid size-14 place-items-center rounded-full',
                    variance === 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-300'
                  )}
                >
                  <Check size={28} strokeWidth={2.2} />
                </div>
                <p className="font-mono text-2xl font-bold text-shell-ink">{formatCurrency(counted)}</p>
                <p className="mt-2 text-sm leading-relaxed text-shell-muted">
                  {variance === 0
                    ? 'Drawer balanced perfectly against expected cash.'
                    : `${variance < 0 ? 'Short by' : 'Over by'} ${formatCurrency(Math.abs(variance))} against the ${formatCurrency(expected)} expected.`}
                </p>
                <Button className="mt-5 w-full bg-violet-400 text-[#160a2e] hover:bg-violet-300" onClick={onClose}>
                  Done
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-shell-line bg-shell-line">
                  {(
                    [
                      ['Opening float', formatCurrency(till.openingFloat)],
                      ['Cash sales', formatCurrency(till.cashSales)],
                      ['Cash collected', formatCurrency(till.cashCollected)],
                      ['Cash expenses', `−${formatCurrency(till.cashExpenses)}`],
                    ] as const
                  ).map(([label, val]) => (
                    <div key={label} className="bg-shell-surface-2/50 px-3 py-2.5">
                      <p className="text-[11px] text-shell-muted">{label}</p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-shell-ink">{val}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-shell-muted">
                    Count by denomination
                  </p>
                  <div className="space-y-2">
                    {NOTES.map(n => (
                      <div
                        key={n}
                        className="flex items-center gap-3 rounded-lg border border-shell-line bg-shell-surface-2/35 px-3 py-2"
                      >
                        <span className="w-16 font-mono text-sm font-semibold text-shell-ink">
                          ₦{n.toLocaleString()}
                        </span>
                        <span className="text-shell-muted">×</span>
                        <DenomStepper
                          value={counts[n] || 0}
                          onChange={v => setCounts(c => ({ ...c, [n]: v }))}
                        />
                        <span className="ml-auto font-mono text-sm font-semibold tabular-nums text-shell-ink">
                          {formatCurrency(n * (counts[n] || 0))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-400/20 bg-violet-400/8 px-4 py-3">
                  <div className="flex flex-wrap gap-5">
                    <Stat label="Expected" value={formatCurrency(expected)} />
                    <Stat label="Counted" value={formatCurrency(counted)} />
                    <Stat
                      label="Variance"
                      value={variance === 0 ? '₦0' : `${variance < 0 ? '−' : '+'}${formatCurrency(Math.abs(variance))}`}
                      accent={
                        variance === 0 ? 'text-emerald-400' : variance < 0 ? 'text-red-400' : 'text-amber-300'
                      }
                    />
                  </div>
                  <Button
                    className="bg-violet-400 text-[#160a2e] hover:bg-violet-300"
                    disabled={counted <= 0 || posting}
                    onClick={() => void post()}
                  >
                    {posting ? 'Posting…' : 'Post close'}
                  </Button>
                </div>
              </>
            )}
          </div>
        
      </ModalSheetFrame>
    </ModalSheetPortal>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-[11px] text-shell-muted">{label}</p>
      <p className={cn('font-mono text-base font-semibold tabular-nums text-shell-ink', accent)}>{value}</p>
    </div>
  );
}

function DenomStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-md border border-shell-line bg-shell-surface">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="shell-inset-field grid h-8 w-8 place-items-center text-shell-muted hover:bg-shell-surface-2"
      >
        <Minus size={14} />
      </button>
      <Input
        value={value}
        onChange={e =>
          onChange(Math.max(0, Number(e.target.value.replace(/[^0-9]/g, '')) || 0))
        }
        className="shell-inset-field h-8 w-10 border-0 bg-transparent px-0 text-center font-mono text-sm font-semibold text-shell-ink shadow-none outline-none focus-visible:ring-0"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="shell-inset-field grid h-8 w-8 place-items-center text-shell-muted hover:bg-shell-surface-2"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
