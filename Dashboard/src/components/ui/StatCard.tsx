import type { ComponentType, ReactNode } from 'react';
import { ArrowDownIcon, ArrowUpIcon } from '@/components/ui/Icon';

/**
 * Tuile de KPI.
 *
 * Un indicateur sans point de comparaison n'est pas actionnable : la variation
 * par rapport à la période précédente fait partie du composant, pas d'une
 * option. `trend` à `null` signifie « pas de base de comparaison » et n'affiche
 * rien plutôt qu'un faux 0 %.
 */
export interface StatCardProps {
  label: string;
  value: string;
  hint?: ReactNode;
  Icon?: ComponentType<{ size?: number; className?: string }>;
  trend?: number | null;
  /** Une hausse est-elle une bonne nouvelle ? (faux pour les échecs de reversement) */
  trendPositiveIsGood?: boolean;
  trendLabel?: string;
  tone?: 'default' | 'primary' | 'warn' | 'danger';
}

const TONES: Record<string, { bg: string; text: string }> = {
  default: { bg: 'bg-surface-2', text: 'text-text-muted' },
  primary: { bg: 'bg-primary-soft', text: 'text-primary' },
  warn: { bg: 'bg-warn-soft', text: 'text-warn' },
  danger: { bg: 'bg-danger-soft', text: 'text-danger' },
};

export default function StatCard({
  label,
  value,
  hint,
  Icon,
  trend,
  trendPositiveIsGood = true,
  trendLabel = 'vs période précédente',
  tone = 'default',
}: StatCardProps) {
  const palette = TONES[tone] ?? TONES.default;
  const hasTrend = typeof trend === 'number' && Number.isFinite(trend);
  const isUp = hasTrend && trend! > 0;
  const isFlat = hasTrend && trend === 0;
  const good = isUp === trendPositiveIsGood;

  return (
    <div className="bg-surface border border-border rounded-xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text-muted">
          {label}
        </span>
        {Icon && (
          <span className={`w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 ${palette.bg}`}>
            <Icon size={16} className={palette.text} />
          </span>
        )}
      </div>

      <div className="mt-3 text-[26px] sm:text-[28px] font-semibold tracking-[-0.02em] leading-none text-text">
        {value}
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap min-h-[18px]">
        {hasTrend && !isFlat && (
          <span
            className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${
              good ? 'text-primary' : 'text-danger'
            }`}
          >
            {isUp ? <ArrowUpIcon size={13} /> : <ArrowDownIcon size={13} />}
            {Math.abs(trend!)} %
          </span>
        )}
        {hasTrend && isFlat && <span className="text-[12px] font-semibold text-text-muted">stable</span>}
        {hasTrend && <span className="text-[11.5px] text-text-subtle">{trendLabel}</span>}
        {hint && <span className="text-[12px] text-text-muted">{hint}</span>}
      </div>
    </div>
  );
}
