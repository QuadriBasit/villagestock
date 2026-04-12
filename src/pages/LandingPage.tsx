import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CreditCard,
  Layers3,
  Receipt,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { useAuthStore } from '@/store/auth';

const featureGroups = [
  {
    title: 'Sell Faster',
    icon: Receipt,
    items: [
      'Quick sales, swaps, and receipts',
      'Credit sales with due dates and payment follow-up',
      'PDF exports for receipts and reports',
    ],
  },
  {
    title: 'Track Devices Properly',
    icon: Smartphone,
    items: [
      'IMEI and serial-based inventory',
      'Apple-specific device fields and visual badges',
      'Instant search, barcode scan, and live stock status',
    ],
  },
  {
    title: 'Run Operations Cleanly',
    icon: Wrench,
    items: [
      'Engineer handoff and collection tracking',
      'Returns, exchanges, and trade-in intake',
      'Offline-first sync-ready workflow',
    ],
  },
];

const stats = [
  { label: 'Inventory Style', value: 'Serialized + Quantity' },
  { label: 'Built For', value: 'Phone Retail Shops' },
  { label: 'Runs', value: 'Offline First' },
  { label: 'Covers', value: 'Sales, Credits, Repairs' },
];

const valuePoints = [
  {
    title: 'Device-Aware By Default',
    description:
      'VillageStock is designed for real device retail workflows, so swaps, IMEI tracking, battery health, iCloud states, and repair movement fit naturally.',
    icon: Layers3,
  },
  {
    title: 'One System For The Shop',
    description:
      'Inventory, sales, credits, engineers, reports, and receipts all sit on the same local-first data model instead of being spread across notebooks and spreadsheets.',
    icon: CreditCard,
  },
  {
    title: 'Reports You Can Actually Use',
    description:
      'Track daily movement, weekly sales, returns, swap activity, payment mix, and outstanding balances, then export a clean PDF when needed.',
    icon: BarChart3,
  },
];

export default function LandingPage() {
  const { user } = useAuthStore();

  return (
    <div className="relative min-h-screen overflow-hidden text-zinc-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(108,92,231,0.18),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(255,107,61,0.15),transparent_25%),radial-gradient(circle_at_50%_100%,rgba(76,175,80,0.1),transparent_28%)]"
      />

      <header className="relative z-10 px-4 pt-5 md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl border border-white/55 bg-white/72 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-950/70">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/25">
              <span className="font-heading text-sm font-bold tracking-[0.18em]">VS</span>
            </div>
            <div>
              <div className="font-heading text-sm font-semibold text-zinc-950 dark:text-zinc-50">VillageStock</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Retail OS for device shops</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild className="hidden md:inline-flex">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to={user ? '/dashboard' : '/auth'}>
                {user ? 'Open Dashboard' : 'Get Started'}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="px-4 pb-14 pt-8 md:px-8 md:pb-20 md:pt-12">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div className="space-y-6">
              <Badge className="rounded-full border-primary/20 bg-primary/10 px-4 py-1.5 text-primary">
                <Sparkles size={14} />
                Built for high-volume device retail
              </Badge>

              <div className="space-y-4">
                <h1 className="max-w-3xl font-heading text-4xl font-semibold leading-[0.95] tracking-[-0.06em] text-zinc-950 md:text-6xl dark:text-zinc-50">
                  Inventory, swaps, credits, and repairs in one modern retail workflow.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-zinc-600 md:text-lg dark:text-zinc-300">
                  VillageStock helps phone and electronics retailers run serialized stock, Apple metadata,
                  trade-ins, credit sales, engineer handoffs, and reporting without losing speed on mobile.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild className="min-w-[200px]">
                  <Link to={user ? '/dashboard' : '/auth'}>
                    {user ? 'Go To Dashboard' : 'Start With VillageStock'}
                    <ArrowRight />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="min-w-[180px]">
                  <a href="#features">See Features</a>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => (
                  <Card key={stat.label} className="border-white/70 bg-white/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/72">
                    <CardContent className="p-4">
                      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                        {stat.label}
                      </div>
                      <div className="mt-2 font-heading text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                        {stat.value}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-8 h-36 w-36 rounded-full bg-primary/18 blur-3xl" />
              <div className="absolute bottom-2 right-4 h-36 w-36 rounded-full bg-accent/15 blur-3xl" />

              <Card className="relative overflow-hidden border-white/75 bg-white/80 p-0 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/80">
                <div className="border-b border-zinc-200/75 bg-gradient-to-r from-zinc-950 via-zinc-900 to-primary px-6 py-5 text-white dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-white/60">Daily Control</div>
                      <div className="mt-1 font-heading text-2xl font-semibold">One clear operating view</div>
                    </div>
                    <ShieldCheck className="text-white/80" />
                  </div>
                </div>

                <div className="grid gap-4 p-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <MetricPanel title="Inventory Value" value="₦18.4m" hint="serialized + accessories" tone="primary" />
                    <MetricPanel title="Outstanding Credits" value="₦1.26m" hint="8 balances still open" tone="accent" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <MetricPanel title="Swaps This Week" value="14" hint="cash + trade-in tracked" tone="teal" />
                    <MetricPanel title="With Engineers" value="6" hint="2 are overdue now" tone="slate" />
                  </div>

                  <Card className="border-zinc-200/80 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/65">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Device Metadata</div>
                          <div className="mt-1 font-heading text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                            Apple details surfaced clearly
                          </div>
                        </div>
                        <TrendingUp className="text-primary" />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DetailPill label="Battery Health" value="87%" state="good" />
                        <DetailPill label="iCloud Status" value="Clean" state="good" />
                        <DetailPill label="Carrier Lock" value="Factory Unlocked" state="neutral" />
                        <DetailPill label="Engineer Queue" value="2 due today" state="warn" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section id="features" className="px-4 py-14 md:px-8 md:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 max-w-2xl">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Feature Stack</div>
              <h2 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.05em] text-zinc-950 md:text-4xl dark:text-zinc-50">
                Designed around where phone retail gets operationally messy.
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {featureGroups.map((group) => {
                const Icon = group.icon;
                return (
                  <Card key={group.title} className="border-white/70 bg-white/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/72">
                    <CardHeader className="space-y-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950">
                        <Icon />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{group.title}</CardTitle>
                        <CardDescription>Structured workflows instead of manual follow-up.</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {group.items.map((item) => (
                        <div key={item} className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                          <CheckCircle2 className="mt-0.5 text-teal" size={16} />
                          <span>{item}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 py-8 md:px-8 md:py-12">
          <div className="mx-auto max-w-7xl">
            <Card className="overflow-hidden border-zinc-200/85 bg-zinc-950 text-white shadow-[0_20px_80px_rgba(15,23,42,0.22)]">
              <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-5 p-6 md:p-8">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-light">Why It Feels Different</div>
                  <h2 className="font-heading text-3xl font-semibold tracking-[-0.05em] md:text-4xl">
                    It behaves like a proper operating system for a real device shop.
                  </h2>
                  <p className="max-w-xl text-sm leading-7 text-zinc-300 md:text-base">
                    Instead of forcing swaps, repairs, credits, and Apple metadata into generic item rows, VillageStock
                    keeps those flows visible and usable inside the same interface.
                  </p>
                </div>
                <div className="grid gap-px bg-white/10 p-px lg:grid-cols-1">
                  {valuePoints.map((point) => {
                    const Icon = point.icon;
                    return (
                      <div key={point.title} className="bg-zinc-950/92 p-6">
                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-primary-light">
                          <Icon />
                        </div>
                        <h3 className="font-heading text-xl font-semibold">{point.title}</h3>
                        <p className="mt-2 text-sm leading-7 text-zinc-300">{point.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section className="px-4 pb-16 pt-8 md:px-8 md:pb-24">
          <div className="mx-auto max-w-6xl">
            <Card className="border-white/75 bg-white/82 p-0 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/76">
              <div className="grid gap-0 lg:grid-cols-[1fr_auto_1fr]">
                <div className="p-6 md:p-8">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Available Now</div>
                  <div className="mt-3 space-y-3">
                    <FeatureLine text="Serialized inventory with IMEI and serial tracking" />
                    <FeatureLine text="Swap / trade-in handling with structured receipts" />
                    <FeatureLine text="Credit balances and payment recovery workflow" />
                    <FeatureLine text="Engineer tracking and status management" />
                    <FeatureLine text="Daily and weekly reports with export" />
                  </div>
                </div>

                <Separator orientation="vertical" className="hidden h-auto lg:block" />
                <Separator className="lg:hidden" />

                <div className="p-6 md:p-8">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Start Here</div>
                  <h3 className="mt-3 font-heading text-2xl font-semibold tracking-[-0.04em] text-zinc-950 dark:text-zinc-50">
                    Launch a clean retail front door before users even enter the app.
                  </h3>
                  <p className="mt-3 max-w-lg text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                    This landing page gives the product a proper modern presentation while leaving the operational
                    app flow intact behind authentication.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Button size="lg" asChild>
                      <Link to={user ? '/dashboard' : '/auth'}>
                        {user ? 'Open Workspace' : 'Create Or Sign In'}
                        <ArrowRight />
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild>
                      <Link to="/auth">Go To Auth</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricPanel({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  tone: 'primary' | 'accent' | 'teal' | 'slate';
}) {
  const toneClass =
    tone === 'primary'
      ? 'from-primary/18 to-primary/5 text-primary'
      : tone === 'accent'
      ? 'from-accent/18 to-accent/5 text-accent'
      : tone === 'teal'
      ? 'from-teal/18 to-teal/5 text-teal'
      : 'from-slate-500/18 to-slate-500/5 text-slate-600 dark:text-slate-300';

  return (
    <div className={`rounded-2xl border border-zinc-200/80 bg-gradient-to-br ${toneClass} p-4 dark:border-zinc-800`}>
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{title}</div>
      <div className="mt-2 font-heading text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{value}</div>
      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</div>
    </div>
  );
}

function DetailPill({
  label,
  value,
  state,
}: {
  label: string;
  value: string;
  state: 'good' | 'warn' | 'neutral';
}) {
  const stateClass =
    state === 'good'
      ? 'border-teal/20 bg-teal/10 text-teal'
      : state === 'warn'
      ? 'border-accent/20 bg-accent/10 text-accent'
      : 'border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

  return (
    <div className={`rounded-xl border px-3 py-2 ${stateClass}`}>
      <div className="text-[11px] uppercase tracking-[0.18em] opacity-75">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function FeatureLine({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-300">
      <CheckCircle2 className="mt-0.5 text-primary" size={16} />
      <span>{text}</span>
    </div>
  );
}
