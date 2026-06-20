export const marqueeItems = [
  'Phone retailers',
  'Laptop dealers',
  'Accessory shops',
  'Repair centres',
  'Computer Village',
  'Multi-branch chains',
  'Gadget kiosks',
];

export interface Feature {
  title: string;
  desc: string;
  icon: string;
}

export const features: Feature[] = [
  {
    title: 'Smart inventory',
    desc: 'Track serialized items (IMEI, serial numbers) and non-serialized accessories side by side. Low-stock alerts surface before you run out.',
    icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  },
  {
    title: 'Sales & receipts',
    desc: 'Record cash, POS and bank transfer sales. Issue branded receipts. Manage credit sales with due dates and full payment history.',
    icon: '<svg viewBox="0 0 24 24"><path d="M3 3h18v4H3zM3 11h18M3 17h18M7 7v14M17 7v14"/></svg>',
  },
  {
    title: 'Repair tracking',
    desc: 'Send items to engineers with expected return dates. Track repair status and costs — automatically factored into profit calculations.',
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  },
  {
    title: 'Returns & swaps',
    desc: 'Process returns, exchanges and trade-ins cleanly. Every swap links back to the original sale for complete traceability.',
    icon: '<svg viewBox="0 0 24 24"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>',
  },
  {
    title: 'Credit management',
    desc: 'Never lose track of who owes what. See outstanding balances, overdue counts and full payment history at a glance.',
    icon: '<svg viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
  },
  {
    title: 'Reports & analytics',
    desc: 'Daily, weekly and custom-range reports. Revenue, profit, best sellers, payment breakdowns — export to PDF in one tap.',
    icon: '<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-7"/></svg>',
  },
  {
    title: 'Multi-branch & roles',
    desc: 'Owner, manager and staff permissions. Run multiple locations with branch-scoped data and access control for sensitive info.',
    icon: '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
  },
  {
    title: 'Stock sessions',
    desc: 'Daily opening and closing stock counts with accountability built in. Track discrepancies, missing items and resolutions over time.',
    icon: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  },
  {
    title: 'Audit log',
    desc: 'A full, filterable audit trail of every action across your business — who did what, when and on which branch.',
    icon: '<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
  },
];

export const oldWay = [
  'Sales scattered across notebooks and WhatsApp',
  'No idea what stock is actually left',
  'Credit debts forgotten or written on paper',
  'Profit guessed at the end of the month',
  'Repairs lost track of at the engineer',
  'Staff theft impossible to trace',
];

export const newWay = [
  'Every sale recorded with a branded receipt',
  'Live stock counts with low-stock alerts',
  'Credit balances and due dates tracked automatically',
  'Real-time profit on every sale and report',
  'Repairs tracked with return dates and costs',
  'Full audit trail of who did what, when',
];

export const steps = [
  { title: 'Create your shop', desc: 'Sign up and set up your shop profile — name, address, contact info — in a guided onboarding flow.' },
  { title: 'Add your inventory', desc: 'Load your phones, laptops, accessories and parts. Serialized or not — VillageStock handles both.' },
  { title: 'Start selling', desc: 'Record sales, issue receipts, manage credit customers and track repairs from day one.' },
  { title: 'Grow with data', desc: 'Use dashboards and reports to see what is working, what is selling and where your profit comes from.' },
];

export const testimonials = [
  {
    quote: 'I used to lose track of credit customers all the time. Now I know exactly who owes what — it has paid for itself many times over.',
    name: 'Amaka Yusuf',
    role: 'Phone retailer, Ikeja',
    initials: 'AY',
  },
  {
    quote: 'The offline mode is the killer feature. Network goes down in the market all the time, but we never stop selling or lose a single sale.',
    name: 'Chukwu Emeka',
    role: 'Gadget shop owner, Onitsha',
    initials: 'CE',
  },
  {
    quote: 'Running three branches used to be chaos. Now I see every location\u2019s sales and profit from one dashboard on my phone.',
    name: 'Femi Adeyemi',
    role: 'Multi-branch owner, Lagos',
    initials: 'FA',
  },
];

export const faqs = [
  {
    q: 'Does VillageStock really work without internet?',
    a: 'Yes. VillageStock is local-first — your data is stored securely on your device, so you can record sales, manage inventory and print receipts with no connection at all. When you come back online, everything syncs automatically to the cloud.',
  },
  {
    q: 'Do I need to install anything?',
    a: 'No. VillageStock runs in your browser and can be installed as an app (PWA) on your phone, tablet or computer with one tap — no app store, no downloads, no updates to manage.',
  },
  {
    q: 'Can I track phones by IMEI and serial number?',
    a: 'Absolutely. You can track serialized items like phones and laptops by IMEI or serial number, alongside non-serialized accessories — all in the same inventory.',
  },
  {
    q: 'Is my data safe?',
    a: 'Your data is encrypted in transit and stored in the cloud with Supabase, with role-based access control so staff only see what they should. Sensitive financial data can be hidden from non-owner roles.',
  },
  {
    q: 'What happens after my free trial ends?',
    a: 'You get 14 days free with no credit card required. After that you can pick a plan that fits your shop, or stay on the limited free Starter tier — you will never lose your data.',
  },
  {
    q: 'Can I manage more than one shop?',
    a: 'Yes. The Pro and Enterprise plans support multiple branches with branch-scoped data, staff roles and centralized reporting across all locations.',
  },
];
