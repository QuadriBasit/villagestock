import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:ring-offset-1 focus:ring-offset-shell-bg',
  {
    variants: {
      variant: {
        default:
          'border-[color-mix(in_oklch,var(--accent)_25%,transparent)] bg-[color-mix(in_oklch,var(--accent)_15%,transparent)] shell-accent-text-soft hover:bg-[color-mix(in_oklch,var(--accent)_20%,transparent)]',
        secondary:
          'border-shell-line bg-shell-surface-2/60 text-shell-muted hover:bg-shell-surface-2',
        destructive: 'border-transparent bg-red-500/12 text-red-300',
        outline: 'border-shell-line text-shell-ink bg-shell-surface/80 hover:border-shell-muted/50',
        success: 'border-emerald-400/25 bg-emerald-500/14 text-emerald-300 hover:bg-emerald-500/18',
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
