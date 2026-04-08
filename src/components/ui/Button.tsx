import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white shadow-md shadow-primary/20 hover:bg-primary-dark',
        destructive: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
        outline:
          'border-2 border-zinc-200/90 bg-white/90 backdrop-blur-sm shadow-sm text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 dark:border-zinc-600/90 dark:bg-zinc-900/55 dark:text-zinc-100 dark:hover:bg-zinc-800/90 dark:hover:border-zinc-500',
        secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200/90',
        ghost:
          'text-zinc-800 hover:bg-zinc-100/80 dark:text-zinc-200 dark:hover:bg-zinc-800/80',
        link: 'text-primary underline-offset-4 hover:underline shadow-none',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-lg px-3 text-xs',
        lg: 'h-11 rounded-xl px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref as React.Ref<HTMLButtonElement>}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { buttonVariants };
