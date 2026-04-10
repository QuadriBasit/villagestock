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
        <li key={title} className="ui-card flex gap-3 rounded-xl p-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-dark dark:text-zinc-100">{title}</p>
            <p className="mt-0.5 text-xs text-muted dark:text-zinc-400">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
