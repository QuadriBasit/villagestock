import { useEffect, useState, type ReactNode } from 'react';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { ModalSheetClose } from '@/components/ui/ModalSheetClose';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import { modalSheetBodyScroll, modalSheetPanelMd } from '@/lib/modalSheet';
import type { ContactRecordInput, ContactType } from '@/types';

type AddContactModalProps = {
  open: boolean;
  type: ContactType;
  onClose: () => void;
  onSave: (input: Omit<ContactRecordInput, 'type' | 'balance_owed'>) => Promise<void>;
};

export default function AddContactModal({ open, type, onClose, onSave }: AddContactModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [locationText, setLocationText] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setPhone('');
    setLocationText('');
    setNote('');
    setSaving(false);
  }, [open, type]);

  if (!open) return null;

  const label = type === 'supplier' ? 'supplier' : 'customer';

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim() || undefined,
        location_text: locationText.trim() || undefined,
        note: note.trim() || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheetPortal>
      <ModalSheetFrame onClose={onClose} panelClassName={modalSheetPanelMd} backdropClassName="bg-black/70">
<div className="flex items-center justify-between border-b border-shell-line px-5 py-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-shell-ink">Add {label}</h2>
              <p className="text-xs text-shell-muted">Business or person you trade with</p>
            </div>
            <ModalSheetClose onClick={onClose} />
          </div>

          <div className={cn(modalSheetBodyScroll, 'space-y-4 px-5 py-4')}>
            <Field label="Name" required>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                className="shell-inset-field h-10 w-full rounded-lg border border-shell-line bg-shell-surface-2/40 px-3 text-sm text-shell-ink outline-none placeholder:text-shell-muted focus:border-shell-muted/60"
                placeholder={type === 'supplier' ? 'Alhaji Musa Phones' : 'Customer name'}
                autoFocus
              />
            </Field>
            <Field label="Phone">
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="shell-inset-field h-10 w-full rounded-lg border border-shell-line bg-shell-surface-2/40 px-3 text-sm text-shell-ink outline-none placeholder:text-shell-muted focus:border-shell-muted/60"
                placeholder="0803 000 0000"
              />
            </Field>
            <Field label="Location">
              <Input
                value={locationText}
                onChange={e => setLocationText(e.target.value)}
                className="shell-inset-field h-10 w-full rounded-lg border border-shell-line bg-shell-surface-2/40 px-3 text-sm text-shell-ink outline-none placeholder:text-shell-muted focus:border-shell-muted/60"
                placeholder="Computer Village"
              />
            </Field>
            <Field label="Note">
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                className="shell-inset-field min-h-0 w-full rounded-lg border border-shell-line bg-shell-surface-2/40 px-3 py-2 text-sm text-shell-ink outline-none placeholder:text-shell-muted focus:border-shell-muted/60"
                placeholder={type === 'supplier' ? 'iPhone plug · Used stock' : 'Regular buyer · pays on delivery'}
              />
            </Field>
            <Button
              className="w-full bg-brand-400 text-[#04231d] hover:bg-brand-300"
              disabled={!name.trim() || saving}
              onClick={() => void save()}
            >
              {saving ? 'Saving…' : 'Save contact'}
            </Button>
          </div>
        
      </ModalSheetFrame>
    </ModalSheetPortal>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-shell-muted">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </div>
  );
}
