// Single source of truth for the sz-theme preference.
// The preference (localStorage) can be 'system' or a concrete theme name;
// the data-theme attribute on <html> always holds a concrete theme.
// The blade inline script in app.blade.php mirrors resolveTheme for first paint.

export const THEME_KEY = 'sz-theme';
export const SYSTEM_THEME = 'system';

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePreference(): string {
  try {
    return localStorage.getItem(THEME_KEY) || SYSTEM_THEME;
  } catch {
    return SYSTEM_THEME;
  }
}

export function resolveTheme(pref: string): string {
  return pref === SYSTEM_THEME ? (darkQuery().matches ? 'dark' : 'light') : pref;
}

export function applyTheme(pref: string) {
  try { localStorage.setItem(THEME_KEY, pref); } catch {}
  document.documentElement.setAttribute('data-theme', resolveTheme(pref));
}

// Follow the device scheme while the preference is 'system'. Call once at boot.
export function watchSystemTheme(): () => void {
  const query = darkQuery();
  const onChange = () => {
    if (getThemePreference() === SYSTEM_THEME) {
      document.documentElement.setAttribute('data-theme', resolveTheme(SYSTEM_THEME));
    }
  };
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
