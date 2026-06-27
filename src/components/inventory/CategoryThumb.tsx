import { Box, Headphones, Laptop, Smartphone, Tablet } from 'lucide-react';
import type { Category } from '@/types';
import { cn } from '@/lib/utils';

const ICONS: Record<Category, typeof Smartphone> = {
  phones: Smartphone,
  laptops: Laptop,
  tablets: Tablet,
  accessories: Headphones,
  parts: Box,
};

export function CategoryThumb({ category, size = 'md', className }: { category: Category; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const Icon = ICONS[category] ?? Box;
  const dim = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-[4.5rem] w-[4.5rem]' : 'h-11 w-11';
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 28 : 18;

  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center rounded-xl border border-zinc-200/90 bg-[repeating-linear-gradient(135deg,rgba(0,0,0,0.03),rgba(0,0,0,0.03)_6px,transparent_6px,transparent_12px)] text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-500',
        dim,
        className
      )}
    >
      <Icon size={iconSize} strokeWidth={1.75} />
    </div>
  );
}
