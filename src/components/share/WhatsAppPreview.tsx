import { cn } from '@/lib/utils';

/** Renders WhatsApp-style *bold* markers in preview text. */
export function WhatsAppPreview({
  shopName,
  text,
  className,
}: {
  shopName: string;
  text: string;
  className?: string;
}) {
  const initial = (shopName.trim()[0] || 'V').toUpperCase();

  return (
    <div className={cn('overflow-hidden rounded-xl border border-shell-line bg-[#0b141a]', className)}>
      <div className="flex items-center gap-2.5 border-b border-white/8 px-4 py-3">
        <span className="grid size-9 place-items-center rounded-full bg-[#25d366] font-display text-sm font-bold text-[#0b141a]">
          {initial}
        </span>
        <div>
          <p className="text-[13px] font-semibold text-[#e9edef]">{shopName || 'Village Stock'}</p>
          <p className="text-[11px] text-[#8696a0]">My status · now</p>
        </div>
      </div>
      <div className="max-h-[460px] overflow-y-auto p-4">
        <div className="rounded-[10px_10px_10px_3px] bg-[#005c4b] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#e9edef]">
          {text ? (
            text.split('\n').map((line, li) => (
              <div key={li} className={cn(!line && 'min-h-2')}>
                {line.split(/(\*[^*]+\*)/g).map((part, i) =>
                  part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
                    <strong key={i} className="font-semibold text-white">
                      {part.slice(1, -1)}
                    </strong>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </div>
            ))
          ) : (
            <span className="text-[#8696a0]">Select products to preview your list.</span>
          )}
        </div>
      </div>
    </div>
  );
}
