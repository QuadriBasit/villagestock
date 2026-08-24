import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AppLoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-shell-bg text-shell-muted">
      <Loader2 size={28} className="animate-spin text-brand-300" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function AppLoadingInline({ className }: { className?: string }) {
  return (
    <div className={cn('flex min-h-[40vh] items-center justify-center text-shell-muted', className)}>
      <Loader2 size={24} className="animate-spin text-brand-300" aria-hidden />
    </div>
  );
}
