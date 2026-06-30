import type { CSSProperties } from 'react';
import type { Store } from '@/types';

export interface StoreThemeSource {
  themePrimaryColor?: string | null;
  themeAccentColor?: string | null;
  themeBackgroundColor?: string | null;
  themeSurfaceColor?: string | null;
  themeTextColor?: string | null;
  themeMutedTextColor?: string | null;
  themeBorderColor?: string | null;
  themeButtonTextColor?: string | null;
  themeInputBackgroundColor?: string | null;
  themeInputTextColor?: string | null;
  themeInputBorderColor?: string | null;
  themeFontFamily?: string | null;
}

export interface StoreThemeStyle extends CSSProperties {
  '--store-primary': string;
  '--store-accent': string;
  '--store-bg': string;
  '--store-surface': string;
  '--store-text': string;
  '--store-muted': string;
  '--store-border': string;
  '--store-button-text': string;
  '--store-input-bg': string;
  '--store-input-text': string;
  '--store-input-border': string;
  '--store-font': string;
}

export function buildStoreTheme(source?: StoreThemeSource | Store): StoreThemeStyle {
  const font = source?.themeFontFamily || 'Inter';
  return {
    '--store-primary': source?.themePrimaryColor || '#0F8F65',
    '--store-accent': source?.themeAccentColor || '#14201C',
    '--store-bg': source?.themeBackgroundColor || '#FAFAF7',
    '--store-surface': source?.themeSurfaceColor || '#FFFFFF',
    '--store-text': source?.themeTextColor || '#14201C',
    '--store-muted': source?.themeMutedTextColor || '#6B7570',
    '--store-border': source?.themeBorderColor || '#E2E4DF',
    '--store-button-text': source?.themeButtonTextColor || '#FFFFFF',
    '--store-input-bg': source?.themeInputBackgroundColor || '#FFFFFF',
    '--store-input-text': source?.themeInputTextColor || '#14201C',
    '--store-input-border': source?.themeInputBorderColor || '#C8CCC6',
    '--store-font': `"${font}", ui-sans-serif, system-ui, sans-serif`,
    backgroundColor: source?.themeBackgroundColor || '#FAFAF7',
    color: source?.themeTextColor || '#14201C',
    fontFamily: `"${font}", ui-sans-serif, system-ui, sans-serif`,
  };
}

export function loadGoogleFonts(families: string[]) {
  if (typeof document === 'undefined') return;
  const unique = Array.from(new Set(families.filter(Boolean))).slice(0, 80);
  for (let index = 0; index < unique.length; index += 12) {
    const batch = unique.slice(index, index + 12);
    const key = batch.join('|');
    if (document.querySelector(`link[data-store-fonts="${CSS.escape(key)}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.storeFonts = key;
    const params = batch.map(family => `family=${encodeURIComponent(family).replace(/%20/g, '+')}`).join('&');
    link.href = `https://fonts.googleapis.com/css2?${params}&display=swap`;
    document.head.appendChild(link);
  }
}

export function readableTextOn(hex: string) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return '#FFFFFF';
  const luminance = (0.299 * parseInt(match[1], 16) + 0.587 * parseInt(match[2], 16) + 0.114 * parseInt(match[3], 16)) / 255;
  return luminance > 0.62 ? '#14201C' : '#FFFFFF';
}
