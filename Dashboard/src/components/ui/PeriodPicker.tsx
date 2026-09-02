export type PeriodDays = 7 | 30 | 90;

const OPTIONS: { value: PeriodDays; label: string }[] = [
  { value: 7, label: '7 j' },
  { value: 30, label: '30 j' },
  { value: 90, label: '90 j' },
];

/**
 * Sélecteur de période des indicateurs. Un tableau de bord sans fenêtre
 * temporelle réglable oblige à comparer de tête.
 */
export default function PeriodPicker({
  value,
  onChange,
}: {
  value: PeriodDays;
  onChange: (days: PeriodDays) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Période"
      className="inline-flex items-center gap-0.5 p-0.5 bg-surface-2 border border-border rounded-lg"
    >
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`h-7 px-2.5 rounded-md text-[12px] font-semibold transition-colors ${
              active ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
