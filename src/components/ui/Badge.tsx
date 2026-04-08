import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1 dark:focus:ring-offset-zinc-900',
  {
    variants: {
      variant: {
        default:
          'border-primary/15 bg-primary/12 text-primary hover:bg-primary/16 dark:border-primary/25 dark:bg-primary/18 dark:text-violet-200 dark:hover:bg-primary/24',
        secondary:
          'border-zinc-200/80 bg-zinc-100/95 text-zinc-700 hover:bg-zinc-200/80 dark:border-zinc-600/60 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-700/85',
        destructive: 'border-transparent bg-[#ef4444]/12 text-[#b91c1c] dark:bg-[#ef4444]/12 dark:text-[#fca5a5]',
        outline:
          'border-zinc-200/80 text-zinc-700 bg-white/80 dark:border-zinc-600/80 dark:text-zinc-200 dark:bg-zinc-900/55 dark:hover:border-zinc-500',
        success:
          'border-emerald-500/20 bg-[#22c55e]/12 text-[#15803d] dark:border-emerald-400/25 dark:bg-emerald-500/14 dark:text-[#86efac] dark:hover:bg-emerald-500/18',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
