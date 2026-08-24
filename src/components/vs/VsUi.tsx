/* Port of prototype/vs-ui.jsx + PageHead + SearchBox from vs-screens-2.jsx */

import type { CSSProperties, ReactNode, ButtonHTMLAttributes } from 'react';
import type { Category } from '@/types';
import { Input } from '@/components/ui/Input';

const ICON_PATHS: Record<string, string> = {
  dashboard: 'M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zM13 3v6h8V3h-8z',
  box: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  cart: 'M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6',
  wrench: 'M14.7 6.3a4 4 0 0 0 4.6 5.6L21 13l-7 7-2.5-2.5a4 4 0 0 0-5.6-4.6L3 11l7-7 2.7 2.3z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  chart: 'M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.8L7 14.3',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  plus: 'M12 5v14M5 12h14',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  menu: 'M3 12h18M3 6h18M3 18h18',
  chevron: 'M9 18l6-6-6-6',
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z',
  tag: 'M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01',
  truck: 'M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  wallet: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 12h.01M21 9h-5a3 3 0 0 0 0 6h5',
  bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
  share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 3.98M15.4 6.5l-6.8 3.98',
  scan: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10',
  history: 'M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8M12 8v4l3 2',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  zap: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  copy: 'M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  alert: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  arrowUp: 'M12 19V5M5 12l7-7 7 7',
  arrowDown: 'M12 5v14M19 12l-7 7-7-7',
  swap: 'M7 16V4M3 8l4-4 4 4M17 8v12M21 16l-4 4-4-4',
};

export function VsIcon({ name, size = 20, stroke = 1.6 }: { name: string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[name] || ICON_PATHS.box} />
    </svg>
  );
}

type BadgeTone = 'slate' | 'green' | 'amber' | 'red' | 'violet' | 'blue';

const BADGE_TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  slate: { bg: 'rgba(148,163,184,.14)', fg: '#cbd5e1' },
  green: { bg: 'rgba(52,211,153,.14)', fg: '#6ee7b7' },
  amber: { bg: 'rgba(251,191,36,.15)', fg: '#fcd34d' },
  red: { bg: 'rgba(248,113,113,.15)', fg: '#fca5a5' },
  violet: { bg: 'rgba(0,179,152,.16)', fg: '#5ce8d1' },
  blue: { bg: 'rgba(96,165,250,.15)', fg: '#93c5fd' },
};

export function VsBadge({ children, tone = 'slate', size = 'sm' }: { children: ReactNode; tone?: BadgeTone; size?: 'sm' | 'md' }) {
  const t = BADGE_TONES[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: t.bg,
        color: t.fg,
        fontWeight: 600,
        fontSize: size === 'sm' ? 11.5 : 13,
        lineHeight: 1,
        padding: size === 'sm' ? '4px 8px' : '6px 11px',
        borderRadius: 999,
        letterSpacing: '.01em',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export function VsCard({
  children,
  style,
  pad = 20,
  hover,
  onClick,
  className = '',
}: {
  children: ReactNode;
  style?: CSSProperties;
  pad?: number;
  hover?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`vs-card ${hover ? 'vs-hover' : ''} ${className}`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 16,
        padding: pad,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function VsStat({
  label,
  value,
  delta,
  deltaDir,
  icon,
  accent,
}: {
  label: string;
  value: string;
  delta?: string | null;
  deltaDir?: 'up' | 'down';
  icon?: string;
  accent?: string;
}) {
  return (
    <VsCard pad={18}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 500 }}>{label}</span>
          {icon ? (
            <span
              style={{
                color: accent || 'var(--accent)',
                display: 'grid',
                placeItems: 'center',
                width: 32,
                height: 32,
                borderRadius: 9,
                background: 'color-mix(in oklch, currentColor 14%, transparent)',
              }}
            >
              <VsIcon name={icon} size={17} />
            </span>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span className="vs-num" style={{ fontSize: 27, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-.01em' }}>
            {value}
          </span>
          {delta != null ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 12.5,
                fontWeight: 600,
                color: deltaDir === 'down' ? '#fca5a5' : '#6ee7b7',
              }}
            >
              <VsIcon name={deltaDir === 'down' ? 'arrowDown' : 'arrowUp'} size={13} />
              {delta}
            </span>
          ) : null}
        </div>
      </div>
    </VsCard>
  );
}

type BtnVariant = 'primary' | 'ghost' | 'subtle' | 'danger';

export function VsBtn({
  children,
  variant = 'primary',
  icon,
  size = 'md',
  style,
  full,
  className = 'vs-btn',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  icon?: string;
  size?: 'sm' | 'md';
  full?: boolean;
}) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    borderRadius: 11,
    border: '1px solid transparent',
    transition: 'all .15s ease',
    whiteSpace: 'nowrap',
    fontSize: size === 'sm' ? 13 : 14.5,
    padding: size === 'sm' ? '7px 12px' : '10px 16px',
    width: full ? '100%' : 'auto',
  };
  const variants: Record<BtnVariant, CSSProperties> = {
    primary: { background: 'var(--accent)', color: '#04231d' },
    ghost: { background: 'transparent', color: 'var(--ink)', borderColor: 'var(--line)' },
    subtle: { background: 'var(--surface-2)', color: 'var(--ink)', borderColor: 'var(--line)' },
    danger: { background: 'rgba(248,113,113,.14)', color: '#fca5a5' },
  };
  return (
    <button className={className} style={{ ...base, ...variants[variant], ...style }} {...props}>
      {icon ? <VsIcon name={icon} size={size === 'sm' ? 15 : 17} /> : null}
      {children}
    </button>
  );
}

const CAT_GLYPH: Record<string, string> = {
  phones: 'phone',
  laptops: 'box',
  tablets: 'box',
  accessories: 'tag',
  parts: 'tag',
  Phones: 'phone',
  Laptops: 'box',
  Accessories: 'tag',
};

export function VsThumb({ cat, size = 44, radius = 11 }: { cat?: Category | string; size?: number; radius?: number }) {
  const glyph = CAT_GLYPH[cat ?? ''] || 'box';
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        background:
          'repeating-linear-gradient(135deg, var(--surface-2), var(--surface-2) 6px, transparent 6px, transparent 12px), var(--surface)',
        border: '1px solid var(--line)',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--muted)',
      }}
    >
      <VsIcon name={glyph} size={size * 0.42} stroke={1.5} />
    </div>
  );
}

export function VsPageHead({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 20,
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 600,
            color: 'var(--ink)',
            fontFamily: 'var(--font-display)',
            letterSpacing: '-.01em',
          }}
        >
          {title}
        </h1>
        {subtitle ? <div style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 5 }}>{subtitle}</div> : null}
      </div>
      {children ? <div style={{ display: 'flex', gap: 10 }}>{children}</div> : null}
    </div>
  );
}

export function VsSearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>
        <VsIcon name="search" size={17} />
      </span>
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-[var(--line)] bg-[var(--surface)] pl-10 text-[var(--ink)]"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          borderRadius: 11,
          padding: '10px 14px 10px 40px',
          fontFamily: 'inherit',
          fontSize: 14,
        }}
      />
    </div>
  );
}

export function VsSeg({
  active,
  onClick,
  children,
  style,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="vs-seg"
      style={{
        border: '1px solid var(--line)',
        borderRadius: 99,
        padding: '7px 15px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        background: active ? 'var(--accent)' : 'var(--surface)',
        color: active ? '#04231d' : 'var(--muted)',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function categoryToVsCat(category: Category): string {
  const map: Record<Category, string> = {
    phones: 'Phones',
    laptops: 'Laptops',
    tablets: 'Tablets',
    accessories: 'Accessories',
    parts: 'Parts',
  };
  return map[category] ?? category;
}
