import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

type SpaceUiArrowButtonProps = {
  children: React.ReactNode;
  className?: string;
  to?: string;
};

/** Space UI hover-arrow CTA, on VillageStock landing button styles. */
export function SpaceUiArrowButton({
  children,
  className,
  to = '/auth',
}: SpaceUiArrowButtonProps) {
  return (
    <Link to={to} className={cn('landing-btn landing-btn-primary landing-btn-lg group', className)}>
      {children}
      <ArrowRight
        aria-hidden
        className="btn-arrow transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] group-hover:translate-x-0.5"
      />
    </Link>
  );
}
