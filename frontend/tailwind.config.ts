import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F8F65',
          hover: '#0C7A56',
          soft: '#E6F4EE',
          'soft-2': '#D1EADD',
        },
        surface: { DEFAULT: '#FFFFFF', 2: '#F5F4EE' },
        border: { DEFAULT: '#E8E6DD', strong: '#D9D6CB' },
        text: { DEFAULT: '#14201C', muted: '#6B7570', subtle: '#97A09B' },
        bg: '#FAFAF7',
        blue: { DEFAULT: '#2563EB', soft: '#E8EFFE' },
        warn: { DEFAULT: '#C2691B', soft: '#FBEFDF' },
        danger: { DEFAULT: '#B43A3A', soft: '#F8E5E5' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '12px',
        lg: '16px',
        xl: '18px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15,32,28,0.05)',
        md: '0 1px 2px rgba(15,32,28,0.04), 0 6px 16px rgba(15,32,28,0.05)',
        lg: '0 1px 2px rgba(15,32,28,0.04), 0 12px 32px rgba(15,32,28,0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config;
