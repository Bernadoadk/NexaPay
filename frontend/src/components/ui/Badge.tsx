import type { QuoteStatus } from '@/types';

const CONFIG: Record<QuoteStatus | string, { label: string; dot: string; bg: string; text: string }> = {
  DRAFT:     { label: 'Brouillon',          dot: '#97A09B', bg: '#F5F4EE', text: '#6B7570' },
  SENT:      { label: 'Envoyé',             dot: '#2563EB', bg: '#E8EFFE', text: '#2563EB' },
  AWAITING:  { label: 'En attente paiement',dot: '#C2691B', bg: '#FBEFDF', text: '#A1530F' },
  PAID:      { label: 'Payé',               dot: '#0F8F65', bg: '#E6F4EE', text: '#0C7A56' },
  OVERDUE:   { label: 'En retard',          dot: '#B43A3A', bg: '#F8E5E5', text: '#B43A3A' },
  CANCELLED: { label: 'Annulé',             dot: '#97A09B', bg: '#F5F4EE', text: '#6B7570' },
};

// Variant configurations for the new generic badge style
const VARIANT_CONFIG: Record<string, { bg: string; text: string }> = {
  primary:   { bg: '#E8EFFE', text: '#2563EB' },
  secondary: { bg: '#F5F4EE', text: '#6B7570' },
  outline:   { bg: 'transparent', text: '#6B7570' }, // Will use border instead
  destructive: { bg: '#F8E5E5', text: '#B43A3A' },
  warning:   { bg: '#FBEFDF', text: '#A1530F' },
  success:   { bg: '#E6F4EE', text: '#0C7A56' },
};

interface BadgeProps {
  // Old status-based props
  status?: QuoteStatus | string;
  pulse?: boolean;
  className?: string;

  // New generic props
  variant?: string;
  children?: React.ReactNode;
}

export function Badge({
  status,
  pulse,
  className,
  variant,
  children
}: BadgeProps) {
  // If status is provided, use the old behavior (backwards compatibility)
  if (status !== undefined) {
    const cfg = CONFIG[status] ?? CONFIG.DRAFT;
    return (
      <span
        className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[11.5px] font-semibold ${className ?? ''}`}
        style={{ background: cfg.bg, color: cfg.text }}
      >
        <span className="relative flex w-1.5 h-1.5 flex-shrink-0">
          {pulse && (
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-70"
              style={{ background: cfg.dot }}
            />
          )}
          <span className="relative w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
        </span>
        {cfg.label}
      </span>
    );
  }

  // If variant is provided, use the new generic behavior
  if (variant !== undefined) {
    const cfg = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.secondary;

    // Handle outline variant differently (uses border instead of background)
    const isOutline = variant === 'outline';
    const bgStyle = isOutline ? 'transparent' : cfg.bg;
    const borderStyle = isOutline ? `1px solid ${cfg.text}` : 'none';
    const textStyle = cfg.text;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 rounded-full text-[11.5px] font-semibold ${className ?? ''} ${isOutline ? 'border' : ''}`}
        style={{
          background: bgStyle,
          color: textStyle,
          border: borderStyle
        }}
      >
        {children}
      </span>
    );
  }

  // If neither status nor variant is provided, return null to avoid rendering anything
  return null;
}

export default Badge;