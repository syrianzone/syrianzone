import { THEME_REGISTRY } from '@/Lib/theme';

const VECTOR_STYLES = {
  dark: '/styles/styles/dark-matter-vector.json',
  light: '/styles/styles/light-vector.json',
};

export function resolveBasemapStyle(themeId?: string | null): string {
  const id = themeId ?? document.documentElement.getAttribute('data-theme');
  const dark = THEME_REGISTRY.find((t) => t.id === id)?.isDark ?? true;
  return dark ? VECTOR_STYLES.dark : VECTOR_STYLES.light;
}
