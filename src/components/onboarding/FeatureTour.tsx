import { Package, ShoppingCart, HandCoins, Wrench, FileBarChart2 } from 'lucide-react';

const ITEMS = [
  { Icon: Package, title: 'Inventory', text: 'Track phones, laptops, accessories, and parts — serialized or bulk.' },
  { Icon: ShoppingCart, title: 'Sales & swaps', text: 'Record sales, swaps, and print receipts with your shop details.' },
  { Icon: HandCoins, title: 'Credit sales', text: 'Follow up on balance owed and mark payments as they come in.' },
  { Icon: Wrench, title: 'Repairs', text: 'Send units out for repair and track status until they return.' },
  { Icon: FileBarChart2, title: 'Reports', text: 'See performance by period and export PDF summaries.' },
] as const;

export default function FeatureTour() {
  return (
    <ul className="space-y-3 text-left">
      {ITEMS.map(({ Icon, title, text }) => (
        <li
          key={title}
          className="flex gap-3 rounded-xl border border-shell-line bg-shell-surface-2/30 p-3"
        >
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-400/15 text-violet-300">
            <Icon size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-shell-ink">{title}</p>
            <p className="mt-0.5 text-xs text-shell-muted">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
