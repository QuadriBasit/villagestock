import { useState } from 'react';
import { Pencil, Phone, ShoppingBag, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { ModalSheetClose } from '@/components/ui/ModalSheetClose';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { cn, formatCurrency } from '@/lib/utils';
import { modalSheetBodyScroll, modalSheetPanelMd } from '@/lib/modalSheet';
import type { ContactRecord, ContactRecordInput } from '@/types';

type ContactDetailModalProps = {
  contact: ContactRecord | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<ContactRecordInput>) => Promise<void>;
};

const fieldClass =
  'shell-inset-field h-10 w-full rounded-lg border border-shell-line bg-shell-surface-2/40 px-3 text-sm text-shell-ink outline-none placeholder:text-shell-muted focus:border-shell-muted/60';

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
      <span className="shrink-0 text-shell-muted">{label}</span>
      <span className={cn('text-right text-shell-ink', mono && 'font-mono tabular-nums')}>{value}</span>
    </div>
  );
}

export default function ContactDetailModal({ contact, onClose, onUpdate }: ContactDetailModalProps) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [locationText, setLocationText] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!contact) return null;

  const isSupplier = contact.type === 'supplier';
  const subtitle = [
    isSupplier ? 'Supplier' : 'Customer',
    contact.location_text,
  ]
    .filter(Boolean)
    .join(' · ');

  const action = () => {
    onClose();
    navigate(isSupplier ? '/purchasing' : '/till');
  };

  const startEdit = () => {
    setName(contact.name);
    setPhone(contact.phone ?? '');
    setLocationText(contact.location_text ?? '');
    setNote(contact.note ?? '');
    setError(null);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onUpdate(contact.id, {
        name: name.trim(),
        phone: phone.trim(),
        location_text: locationText.trim(),
        note: note.trim(),
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheetPortal>
      <ModalSheetFrame onClose={onClose} panelClassName={modalSheetPanelMd} backdropClassName="bg-black/70">
<div className="flex shrink-0 items-start justify-between gap-3 border-b border-shell-line px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-400/15 font-display text-base font-bold text-brand-300">
                {contact.name.trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-semibold text-shell-ink">{contact.name}</h2>
                {subtitle ? <p className="text-xs text-shell-muted">{subtitle}</p> : null}
              </div>
            </div>
            <ModalSheetClose onClick={onClose} />
          </div>

          <div className={cn(modalSheetBodyScroll, 'px-5 py-4')}>
            {editing ? (
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-shell-muted">Name</span>
                  <Input value={name} onChange={e => setName(e.target.value)} className={fieldClass} autoFocus />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-shell-muted">Phone</span>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} className={fieldClass} placeholder="0803 000 0000" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-shell-muted">Location</span>
                  <Input value={locationText} onChange={e => setLocationText(e.target.value)} className={fieldClass} placeholder="Computer Village" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-shell-muted">Note</span>
                  <Textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={2}
                    className="shell-inset-field min-h-0 w-full rounded-lg border border-shell-line bg-shell-surface-2/40 px-3 py-2 text-sm text-shell-ink outline-none placeholder:text-shell-muted focus:border-shell-muted/60"
                  />
                </label>
                {error ? <p className="text-sm text-red-300">{error}</p> : null}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 border-shell-line" disabled={saving} onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1 bg-brand-400 text-[#04231d] hover:bg-brand-300" disabled={saving || !name.trim()} onClick={() => void saveEdit()}>
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>
            ) : (
            <>
            <div className="mb-3">
              <Button variant="outline" className="border-shell-line" onClick={startEdit}>
                <Pencil size={16} /> Edit details
              </Button>
            </div>
            <div className="divide-y divide-shell-line rounded-lg border border-shell-line">
              {contact.phone ? <DetailRow label="Phone" value={contact.phone} mono /> : null}
              {contact.note ? <DetailRow label="Note" value={contact.note} /> : null}
              <DetailRow label="Lifetime deals" value={String(contact.deal_count)} mono />
              {isSupplier ? (
                <DetailRow
                  label="Balance"
                  value={contact.balance_owed > 0 ? `${formatCurrency(contact.balance_owed)} owed` : 'Settled'}
                  mono
                />
              ) : contact.balance_owed > 0 ? (
                <DetailRow label="Outstanding" value={formatCurrency(contact.balance_owed)} mono />
              ) : null}
            </div>

            <div className="mt-4 flex gap-2">
              <a
                href={contact.phone ? `tel:${contact.phone}` : undefined}
                className={cn('flex-1', !contact.phone && 'pointer-events-none opacity-50')}
              >
                <Button
                  variant="outline"
                  className="w-full border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                >
                  <Phone size={16} /> Call
                </Button>
              </a>
              <Button
                className="flex-1 bg-brand-400 text-[#04231d] hover:bg-brand-300"
                onClick={action}
              >
                {isSupplier ? (
                  <>
                    <ShoppingBag size={16} /> New order
                  </>
                ) : (
                  <>
                    <ShoppingCart size={16} /> New sale
                  </>
                )}
              </Button>
            </div>
            </>
            )}
          </div>
        
      </ModalSheetFrame>
    </ModalSheetPortal>
  );
}
