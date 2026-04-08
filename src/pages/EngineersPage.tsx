import { useMemo, useState } from 'react';
import { Phone, Wrench, X } from 'lucide-react';
import { useActiveRepairs } from '@/hooks/useRepairs';
import { useRepairActions } from '@/hooks/useRepairActions';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { DeviceCondition, InventoryItem, RepairRecord } from '@/types';
import {
  modalSheetBackdrop,
  modalSheetBodyScroll,
  modalSheetHandle,
  modalSheetHeader,
  modalSheetPanelMd,
} from '@/lib/modalSheet';

export default function EngineersPage() {
  const { repairs, isLoading } = useActiveRepairs();
  const [selected, setSelected] = useState<RepairRecord | null>(null);
  const itemIds = useMemo(() => repairs.map(record => record.item_id), [repairs]);
  const items = useLiveQuery(async (): Promise<InventoryItem[]> => {
    if (!itemIds.length) return [];
    const rows = await db.inventory_items.bulkGet(itemIds);
    return rows.filter((item): item is InventoryItem => !!item);
  }, [itemIds.join('|')]);
  const itemMap = new Map((items ?? []).map(item => [item.id, item]));
  const groups = useMemo(() => {
    const map = new Map<string, RepairRecord[]>();
    for (const record of repairs) {
      if (!map.has(record.engineer_name)) map.set(record.engineer_name, []);
      map.get(record.engineer_name)!.push(record);
    }
    return [...map.entries()];
  }, [repairs]);

  if (isLoading) return <div className="px-4 py-8 text-sm text-muted">Loading engineer jobs…</div>;

  return (
    <div className="app-page py-5 md:py-8 space-y-4">
      <div>
        <h2 className="font-heading text-xl font-bold text-dark">Engineers</h2>
        <p className="text-sm text-muted">Items currently with engineers, grouped by contact.</p>
      </div>
      {groups.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted">No items currently with engineers.</CardContent></Card>
      ) : groups.map(([engineerName, records]) => (
        <Card key={engineerName}>
          <CardHeader><CardTitle>{engineerName}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {records.map(record => {
              const item = itemMap.get(record.item_id);
              const overdue = !!record.expected_return_date && new Date(record.expected_return_date) < new Date();
              return (
                <button key={record.id} onClick={() => setSelected(record)} className={`w-full rounded-xl border px-4 py-3 text-left ${overdue ? 'border-red-200 bg-red-50/40' : 'border-border bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-dark">{item ? `${item.brand} ${item.name}` : 'Unknown item'}</div>
                      <div className="text-xs text-muted">{item?.imei || item?.serial_number || 'No IMEI / serial'}</div>
                    </div>
                    <div className={`text-xs ${overdue ? 'text-red-500' : 'text-muted'}`}>{daysOut(record.date_sent)} out</div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      ))}
      {selected && <RepairDetailsModal record={selected} itemName={itemMap.get(selected.item_id)?.name} onClose={() => setSelected(null)} />}
    </div>
  );
}

function RepairDetailsModal({ record, itemName, onClose }: { record: RepairRecord; itemName?: string; onClose: () => void }) {
  const { updateRepairStatus, markCollected } = useRepairActions();
  const [condition, setCondition] = useState<DeviceCondition>('working');
  const [notes, setNotes] = useState('');

  return (
    <div className={modalSheetBackdrop} onClick={onClose}>
      <div className={modalSheetPanelMd} onClick={e => e.stopPropagation()}>
        <div className={modalSheetHandle}>
          <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>
        <div className={modalSheetHeader}>
          <div>
            <h3 className="font-heading text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {itemName || 'Repair Job'}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{record.engineer_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>
        <div className={`${modalSheetBodyScroll} space-y-4 bg-zinc-50/70 dark:bg-zinc-950/35`}>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="text-sm text-dark">{record.issue_description}</div>
              <div className="text-xs text-muted">Sent {new Date(record.date_sent).toLocaleDateString('en-NG')}</div>
              {record.expected_return_date && <div className="text-xs text-muted">Expected {new Date(record.expected_return_date).toLocaleDateString('en-NG')}</div>}
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => updateRepairStatus(record.id, 'completed')}>Mark Completed</Button>
            <a href={record.engineer_phone ? `tel:${record.engineer_phone}` : undefined} className={!record.engineer_phone ? 'pointer-events-none opacity-50' : ''}>
              <Button variant="outline" className="w-full"><Phone size={16} /> Call Engineer</Button>
            </a>
          </div>
          <Card>
            <CardHeader><CardTitle>Mark Collected</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-dark mb-1">Updated Condition</label>
                <select value={condition} onChange={e => setCondition(e.target.value as DeviceCondition)} className="flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-dark outline-none">
                  <option value="working">Working</option>
                  <option value="minor_faults">Minor Faults</option>
                  <option value="major_faults">Major Faults</option>
                  <option value="not_working">Not Working</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-1">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-dark outline-none" />
              </div>
              <Button className="w-full" onClick={async () => { await markCollected(record.id, record.item_id, condition, notes || undefined); onClose(); }}>
                <Wrench size={16} /> Mark Collected
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function daysOut(dateSent: string) {
  return `${Math.max(1, Math.ceil((Date.now() - new Date(dateSent).getTime()) / 86400000))} days`;
}
