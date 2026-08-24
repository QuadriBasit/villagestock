import { lazy, Suspense, useMemo, useState } from 'react';
import { Phone, Plus, Users } from 'lucide-react';
import { useContacts } from '@/hooks/useContacts';
import { useContactActions } from '@/hooks/useContactActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { cn, formatCurrency } from '@/lib/utils';
import type { ContactRecord, ContactType } from '@/types';

const AddContactModal = lazy(() => import('@/components/contacts/AddContactModal'));
const ContactDetailModal = lazy(() => import('@/components/contacts/ContactDetailModal'));

const TYPE_TABS: { value: ContactType; label: string }[] = [
  { value: 'supplier', label: 'Suppliers' },
  { value: 'customer', label: 'Customers' },
];

export default function ContactsPage() {
  const [tab, setTab] = useState<ContactType>('supplier');
  const { contacts: allContacts, isLoading: allLoading } = useContacts();
  const { contacts, isLoading: tabLoading } = useContacts(tab);
  const { addContact } = useContactActions();
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<ContactRecord | null>(null);

  const counts = useMemo(() => {
    const rows = allContacts ?? [];
    return {
      suppliers: rows.filter(c => c.type === 'supplier').length,
      customers: rows.filter(c => c.type === 'customer').length,
    };
  }, [allContacts]);

  const isLoading = allLoading || tabLoading;

  if (isLoading) {
    return <div className="app-page py-8 text-sm text-shell-muted">Loading contacts…</div>;
  }

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <PageHeader
        title="Suppliers & customers"
        subtitle={`${counts.suppliers} supplier${counts.suppliers === 1 ? '' : 's'} · ${counts.customers} customer${counts.customers === 1 ? '' : 's'}`}
      >
        <Button
          size="sm"
          className="bg-brand-400 text-[#04231d] hover:bg-brand-300"
          onClick={() => setAddOpen(true)}
        >
          <Plus size={16} />
          Add contact
        </Button>
      </PageHeader>

      <div className="overflow-hidden rounded-lg border border-shell-line bg-shell-surface">
        <div className="flex gap-0 overflow-x-auto px-1" role="tablist" aria-label="Contact type">
          {TYPE_TABS.map(t => {
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.value)}
                className={cn(
                  'relative shrink-0 px-3.5 py-2.5 text-xs font-medium transition-colors',
                  active
                    ? 'text-shell-ink after:absolute after:inset-x-3.5 after:bottom-0 after:h-px after:bg-shell-ink/70'
                    : 'text-shell-muted hover:text-shell-ink'
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-20 text-center">
          <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-brand-400/10">
            <Users size={28} className="text-brand-300" />
          </div>
          <h2 className="font-display text-lg font-semibold text-shell-ink">
            No {tab === 'supplier' ? 'suppliers' : 'customers'} yet
          </h2>
          <p className="mt-1 max-w-sm text-sm text-shell-muted">
            Add the people and businesses you buy from or sell to.
          </p>
          <Button
            className="mt-4 bg-brand-400 text-[#04231d] hover:bg-brand-300"
            onClick={() => setAddOpen(true)}
          >
            <Plus size={16} />
            Add contact
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {contacts.map(contact => (
            <ContactCard key={contact.id} contact={contact} onOpen={() => setSelected(contact)} />
          ))}
        </div>
      )}

      {addOpen ? (
        <Suspense fallback={null}>
          <AddContactModal
            open={addOpen}
            type={tab}
            onClose={() => setAddOpen(false)}
            onSave={async input => {
              await addContact({
                ...input,
                type: tab,
                balance_owed: 0,
              });
            }}
          />
        </Suspense>
      ) : null}

      {selected ? (
        <Suspense fallback={null}>
          <ContactDetailModal contact={selected} onClose={() => setSelected(null)} />
        </Suspense>
      ) : null}
    </div>
  );
}

function ContactCard({ contact, onOpen }: { contact: ContactRecord; onOpen: () => void }) {
  const isSupplier = contact.type === 'supplier';
  const initial = contact.name.trim().charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-3 rounded-lg border border-shell-line bg-shell-surface p-4 text-left transition-colors hover:border-shell-muted/40 hover:bg-shell-surface-2/30"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-400/15 font-display text-base font-bold text-brand-300">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-shell-ink">{contact.name}</p>
          <p className="truncate text-xs text-shell-muted">{contact.note || contact.location_text || '—'}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-shell-line pt-3">
        <div>
          <p className="text-[11px] text-shell-muted">{isSupplier ? 'You owe' : 'Lifetime deals'}</p>
          <p
            className={cn(
              'font-mono text-sm font-semibold tabular-nums',
              isSupplier && contact.balance_owed > 0 ? 'text-amber-300' : 'text-shell-ink'
            )}
          >
            {isSupplier
              ? contact.balance_owed > 0
                ? formatCurrency(contact.balance_owed)
                : 'Settled'
              : contact.deal_count}
          </p>
        </div>
        {contact.phone ? (
          <a
            href={`tel:${contact.phone}`}
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-shell-muted transition-colors hover:bg-shell-surface-2 hover:text-shell-ink"
          >
            <Phone size={14} />
            Call
          </a>
        ) : null}
      </div>
    </button>
  );
}
