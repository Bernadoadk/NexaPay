import type { QuoteStatus } from '@/types';

const CONFIG: Record<QuoteStatus | string, { label: string; dot: string; bg: string; text: string }> = {
  DRAFT:     { label: 'Brouillon',          dot: '#97A09B', bg: '#F5F4EE', text: '#6B7570' },
  SENT:      { label: 'Envoyé',             dot: '#2563EB', bg: '#E8EFFE', text: '#2563EB' },
  AWAITING:  { label: 'En attente paiement',dot: '#C2691B', bg: '#FBEFDF', text: '#A1530F' },
  PAID:      { label: 'Payé',               dot: '#0F8F65', bg: '#E6F4EE', text: '#0C7A56' },
  OVERDUE:   { label: 'En retard',          dot: '#B43A3A', bg: '#F8E5E5', text: '#B43A3A' },
  CANCELLED: { label: 'Annulé',             dot: '#97A09B', bg: '#F5F4EE', text: '#6B7570' },
};

interface BadgeProps {
  status: QuoteStatus | string;
  pulse?: boolean;
  className?: string;
}

export default function Badge({ status, pulse, className }: BadgeProps) {
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
