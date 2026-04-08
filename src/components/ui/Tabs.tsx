import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-11 items-center justify-center gap-1 rounded-2xl bg-zinc-100/90 p-1 text-muted shadow-inner shadow-zinc-900/5 dark:bg-zinc-900/80 dark:shadow-none',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex min-w-[100px] items-center justify-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold text-zinc-500 transition-all data-[state=active]:bg-white data-[state=active]:text-[#0f172a] data-[state=active]:shadow-md data-[state=active]:shadow-zinc-900/8 dark:text-zinc-400 dark:data-[state=active]:bg-[#1e293b] dark:data-[state=active]:text-white dark:data-[state=active]:shadow-black/25',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/25 rounded-xl', className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
