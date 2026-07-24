export const FONT_KEY = 'sz-font';

export type FontPreference = 'ibm-plex' | 'system';

export function getFontPreference(isSyrianIp?: boolean): FontPreference {
  try {
    const saved = localStorage.getItem(FONT_KEY);
    if (saved === 'system' || saved === 'ibm-plex') {
      return saved;
    }
    const defaultSyrian = isSyrianIp ?? (typeof window !== 'undefined' && Boolean((window as any).IS_SYRIAN_IP));
    return defaultSyrian ? 'system' : 'ibm-plex';
  } catch {
    return 'ibm-plex';
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
