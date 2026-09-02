import { useTheme } from '@/contexts/ThemeContext';

/**
 * Couleurs des graphiques Recharts.
 *
 * Recharts ne lit pas les classes Tailwind : ses couleurs doivent être passées
 * en dur. Les valeurs étaient donc figées sur le thème clair et devenaient
 * illisibles en sombre. Ce hook renvoie la palette correspondant au thème actif,
 * alignée sur les variables de `index.css`.
 */
export interface ChartPalette {
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  primary: string;
  blue: string;
  warn: string;
  danger: string;
  muted: string;
  /** Palette catégorielle, pour les camemberts. */
  categorical: string[];
}

const LIGHT: ChartPalette = {
  grid: '#E8E6DD',
  axis: '#6B7570',
  tooltipBg: '#FFFFFF',
  tooltipBorder: '#E8E6DD',
  tooltipText: '#14201C',
  primary: '#0F8F65',
  blue: '#2563EB',
  warn: '#C2691B',
  danger: '#B43A3A',
  muted: '#97A09B',
  categorical: ['#0F8F65', '#2563EB', '#C2691B', '#7C4FBF', '#97A09B'],
};

const DARK: ChartPalette = {
  grid: '#2A302E',
  axis: '#8A9490',
  tooltipBg: '#1A201E',
  tooltipBorder: '#2A302E',
  tooltipText: '#E8EAE9',
  primary: '#34B98A',
  blue: '#5B8DEF',
  warn: '#E08A3C',
  danger: '#F87171',
  muted: '#8A9490',
  categorical: ['#34B98A', '#5B8DEF', '#E08A3C', '#A78BFA', '#8A9490'],
};

export function useChartPalette(): ChartPalette {
  const { isDark } = useTheme();
  return isDark ? DARK : LIGHT;
}

/** Style de l'infobulle Recharts, cohérent avec les cartes de l'interface. */
export function tooltipStyle(palette: ChartPalette) {
  return {
    backgroundColor: palette.tooltipBg,
    border: `1px solid ${palette.tooltipBorder}`,
    borderRadius: 10,
    fontSize: 12.5,
    color: palette.tooltipText,
    boxShadow: '0 8px 24px rgba(15,32,28,0.10)',
  };
}

/** Formate un montant en FCFA, format court pour les axes. */
export function formatXof(value: number, compact = false): string {
  if (compact) {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M`;
    if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)} k`;
    return String(Math.round(value));
  }
  return `${Math.round(value).toLocaleString('fr-FR')} FCFA`;
}

/** Étiquette d'axe courte à partir d'une date ISO (AAAA-MM-JJ). */
export function formatDayLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
