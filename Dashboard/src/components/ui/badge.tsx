import { cn } from '@/lib/utils';

/**
 * Pastille d'état.
 *
 * Les variantes s'appuient sur les tokens réellement définis dans
 * `tailwind.config.cjs` (`primary-soft`, `danger-soft`…). L'ancienne version
 * utilisait des classes inexistantes — `bg-secondary`, `text-*-foreground` —
 * que Tailwind ne générait pas : les badges s'affichaient vides.
 *
 * Les fonds « soft » restent lisibles dans les deux thèmes, contrairement à un
 * aplat de couleur pleine avec du texte blanc.
 */
export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'destructive' | 'warning' | 'info';

const VARIANTS: Record<BadgeVariant, string> = {
  default: 'border-border text-text-muted',
  primary: 'bg-primary-soft border-primary-soft-2 text-primary-hover',
  secondary: 'bg-surface-2 border-border text-text-muted',
  destructive: 'bg-danger-soft border-danger/25 text-danger',
  warning: 'bg-warn-soft border-warn/25 text-warn',
  info: 'bg-blue-soft border-blue/25 text-blue',
};

export const Badge = ({
  variant = 'default',
  className,
  children,
  ...props
}: {
  variant?: BadgeVariant;
  className?: string;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold leading-[18px] whitespace-nowrap',
      VARIANTS[variant] ?? VARIANTS.default,
      className,
    )}
    {...props}
  >
    {children}
  </span>
);

export default Badge;
