import { cn } from '@/lib/utils';

export function shellNavLinkClass(isActive: boolean) {
  return cn(
    'flex w-full items-center gap-3 rounded-[11px] border-none px-[13px] py-2.5 text-left text-sm font-semibold no-underline transition-colors duration-150',
    isActive ? 'shell-nav-active text-shell-ink' : 'text-shell-muted hover:bg-shell-surface hover:text-shell-ink',
  );
}
