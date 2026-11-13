import { useSyncExternalStore } from 'react';
import themeData from '../../data/themes.json';

export const FONT_KEY = themeData.font.key;

export type FontPreference = 'ibm-plex' | 'system';

function isFontPreference(value: string | null | undefined): value is FontPreference {
  return value === 'system' || value === 'ibm-plex';
}

function defaultFont(cohort: 'syrian' | 'other'): FontPreference {
  const value = themeData.font.defaults[cohort];
  if (!isFontPreference(value)) {
    throw new Error(`themes.json: font.defaults.${cohort} is not a font id`);
  }
  return value;
}

export function getFontPreference(isSyrianIp?: boolean): FontPreference {
  try {
    const saved = localStorage.getItem(FONT_KEY);
    if (isFontPreference(saved)) {
      return saved;
    }
    const defaultSyrian = isSyrianIp ?? (typeof window !== 'undefined' && Boolean((window as Window & { IS_SYRIAN_IP?: boolean }).IS_SYRIAN_IP));
    return defaultSyrian ? defaultFont('syrian') : defaultFont('other');
  } catch {
    return defaultFont('other');
  }
}

export function applyFont(font: FontPreference) {
  try {
    localStorage.setItem(FONT_KEY, font);
  } catch {}
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-font', font);
  }
}

function subscribeToFont(onChange: () => void): () => void {
  const observer =
    typeof document === 'undefined'
      ? null
      : new MutationObserver(onChange);
  observer?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-font'] });
  return () => observer?.disconnect();
}

/**
 * The font currently applied to the document, reactive — the appearance menu's
 * pressed state. Read it here instead of observing `data-font` yourself; the
 * server snapshot is the registry's default so SSR markup hydrates unchanged.
 */
export function useFontPreference(): FontPreference {
  return useSyncExternalStore(subscribeToFont, getFontPreference, () => defaultFont('other'));
}
