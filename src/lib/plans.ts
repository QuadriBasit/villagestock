import type { BusinessPlan } from '@/types';

export type PlanCardDef = {
  id: Exclude<BusinessPlan, 'trial'>;
  title: string;
  priceLabel: string;
  blurb: string;
  features: string[];
  highlight?: boolean;
};

export const PAID_PLANS: PlanCardDef[] = [
  {
    id: 'starter',
    title: 'Starter',
    priceLabel: '₦3,000/mo',
    blurb: 'Single shop, essentials',
    features: [
      'Up to 500 active listings',
      'Sales & receipts',
      'Basic reports',
      'Email support',
    ],
  },
  {
    id: 'pro',
    title: 'Pro',
    priceLabel: '₦7,500/mo',
    blurb: 'Growing retailers',
    highlight: true,
    features: [
      'Unlimited listings',
      'Swaps, returns & credit tracking',
      'Advanced reports & PDF export',
      'Priority support',
    ],
  },
  {
    id: 'business',
    title: 'Business',
    priceLabel: '₦15,000/mo',
    blurb: 'Teams & multiple counters',
    features: [
      'Everything in Pro',
      'Staff roles (coming soon)',
      'Multi-location prep',
      'Dedicated onboarding',
    ],
  },
];

export const COMING_SOON_CTA = 'Coming soon — enjoy extended free access';
