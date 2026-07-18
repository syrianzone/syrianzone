export const THEME_KEY = 'sz-theme';
export const SYSTEM_THEME = 'system';

export type ConcreteThemeId =
  | 'light'
  | 'dark'
  | 'dark-blue'
  | 'dark-purple'
  | 'dark-green'
  | 'high-contrast'
  | 'damascus-rose'
  | 'jasmine';

export type ThemePreference = typeof SYSTEM_THEME | ConcreteThemeId;

export interface ThemePalette {
  background: string;
  surface: string;
  surfaceRaised: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  primary: string;
  primaryForeground: string;
  danger: string;
  success: string;
  overlay: string;
}

export interface PriorityTheme {
  primaryRgb: string;
  gradient: readonly string[];
  accentBackground: string;
  accentText: string;
  badgeBackground: string;
  headerSubtitle: string;
  urlText: string;
}

export interface ThemeConfig {
  id: ThemePreference;
  nameAr: string;
  nameEn: string;
  shortNameAr?: string;
  emoji: string;
  isDark: boolean;
  previewBackground: string;
  primary: string;
  group: 'system' | 'standard' | 'heritage';
  palette: ThemePalette;
  priorities?: PriorityTheme;
}

const lightPalette = (
  background: string,
  primary: string,
): ThemePalette => ({
  background,
  surface: '#ffffff',
  surfaceRaised: '#f8fafc',
  foreground: '#18211a',
  mutedForeground: '#64748b',
  border: '#d8dfd6',
  primary,
  primaryForeground: '#ffffff',
  danger: '#b42318',
  success: '#287a3c',
  overlay: 'rgba(15, 23, 42, 0.48)',
});

const darkPalette = (
  background: string,
  primary: string,
): ThemePalette => ({
  background,
  surface: '#182019',
  surfaceRaised: '#202a22',
  foreground: '#f7faf7',
  mutedForeground: '#a8b4aa',
  border: '#344038',
  primary,
  primaryForeground: '#ffffff',
  danger: '#ff7a72',
  success: '#72d58a',
  overlay: 'rgba(0, 0, 0, 0.68)',
});

export const THEME_REGISTRY: readonly ThemeConfig[] = [
  {
    id: SYSTEM_THEME,
    nameAr: 'تلقائي (حسب الجهاز)',
    nameEn: 'System',
    emoji: '🌓',
    isDark: false,
    previewBackground: '#8a8f90',
    primary: '#5a714a',
    group: 'system',
    palette: lightPalette('#f5f5f5', '#5a714a'),
  },
  {
    id: 'light',
    nameAr: 'فاتح',
    nameEn: 'Light',
    emoji: '☀️',
    isDark: false,
    previewBackground: '#f5f5f5',
    primary: '#5a714a',
    group: 'standard',
    palette: lightPalette('#f5f5f5', '#5a714a'),
    priorities: {
      primaryRgb: '90, 113, 74',
      gradient: ['#f8fafc', '#e2e8f0'],
      accentBackground: '#e2e8f0',
      accentText: '#334155',
      badgeBackground: '#f1f5f9',
      headerSubtitle: '#475569',
      urlText: '#5a714a',
    },
  },
  {
    id: 'dark',
    nameAr: 'داكن',
    nameEn: 'Dark',
    emoji: '🌑',
    isDark: true,
    previewBackground: '#1a1f22',
    primary: '#5a714a',
    group: 'standard',
    palette: darkPalette('#1a1f22', '#6f8a5c'),
    priorities: {
      primaryRgb: '90, 113, 74',
      gradient: ['#0b0f19', '#064e3b', '#022c22'],
      accentBackground: '#163d31',
      accentText: '#34d399',
      badgeBackground: '#123129',
      headerSubtitle: '#a7f3d0',
      urlText: '#34d399',
    },
  },
  {
    id: 'dark-blue',
    nameAr: 'داكن أزرق',
    nameEn: 'Dark Blue',
    shortNameAr: 'أزرق',
    emoji: '🔵',
    isDark: true,
    previewBackground: '#0f1520',
    primary: '#4d84f5',
    group: 'standard',
    palette: darkPalette('#0f1520', '#4d84f5'),
    priorities: {
      primaryRgb: '77, 132, 245',
      gradient: ['#090d16', '#0f2b5c', '#061124'],
      accentBackground: '#152e5a',
      accentText: '#60a5fa',
      badgeBackground: '#102447',
      headerSubtitle: '#93c5fd',
      urlText: '#60a5fa',
    },
  },
  {
    id: 'dark-purple',
    nameAr: 'داكن بنفسجي',
    nameEn: 'Dark Purple',
    shortNameAr: 'بنفسجي',
    emoji: '🟣',
    isDark: true,
    previewBackground: '#130e1a',
    primary: '#9b2ec4',
    group: 'standard',
    palette: darkPalette('#130e1a', '#b34cd6'),
    priorities: {
      primaryRgb: '155, 46, 196',
      gradient: ['#0a0b14', '#3b1154', '#180526'],
      accentBackground: '#40204f',
      accentText: '#d8b4fe',
      badgeBackground: '#32183f',
      headerSubtitle: '#e9d5ff',
      urlText: '#d8b4fe',
    },
  },
  {
    id: 'dark-green',
    nameAr: 'داكن أخضر',
    nameEn: 'Dark Green',
    shortNameAr: 'أخضر',
    emoji: '🟢',
    isDark: true,
    previewBackground: '#0e1a10',
    primary: '#4cac5a',
    group: 'standard',
    palette: darkPalette('#0e1a10', '#4cac5a'),
    priorities: {
      primaryRgb: '76, 172, 90',
      gradient: ['#080d0a', '#144d21', '#051a0b'],
      accentBackground: '#173d20',
      accentText: '#86efac',
      badgeBackground: '#12331b',
      headerSubtitle: '#86efac',
      urlText: '#86efac',
    },
  },
  {
    id: 'high-contrast',
    nameAr: 'تباين عالي',
    nameEn: 'High Contrast',
    shortNameAr: 'تباين',
    emoji: '⚡',
    isDark: true,
    previewBackground: '#0a0a0a',
    primary: '#00ff00',
    group: 'standard',
    palette: {
      ...darkPalette('#000000', '#00ff00'),
      surface: '#0a0a0a',
      surfaceRaised: '#111111',
      foreground: '#ffffff',
      mutedForeground: '#e5e5e5',
      border: '#ffffff',
      primaryForeground: '#000000',
    },
    priorities: {
      primaryRgb: '0, 255, 0',
      gradient: ['#000000', '#111111'],
      accentBackground: '#063d06',
      accentText: '#00ff00',
      badgeBackground: '#052d05',
      headerSubtitle: '#00ff00',
      urlText: '#00ff00',
    },
  },
  {
    id: 'damascus-rose',
    nameAr: 'الورد الدمشقي',
    nameEn: 'Damascus Rose',
    shortNameAr: 'دمشقي',
    emoji: '🌹',
    isDark: true,
    previewBackground: '#1a0810',
    primary: '#d4527a',
    group: 'heritage',
    palette: darkPalette('#1a0810', '#d4527a'),
    priorities: {
      primaryRgb: '212, 82, 122',
      gradient: ['#0d0a0b', '#5c142e', '#24050f'],
      accentBackground: '#512035',
      accentText: '#f472b6',
      badgeBackground: '#42182b',
      headerSubtitle: '#fbcfe8',
      urlText: '#f472b6',
    },
  },
  {
    id: 'jasmine',
    nameAr: 'ياسمين',
    nameEn: 'Jasmine',
    shortNameAr: 'ياسمين',
    emoji: '🌸',
    isDark: false,
    previewBackground: '#fdf8ef',
    primary: '#c47e10',
    group: 'heritage',
    palette: lightPalette('#fdf8ef', '#a86609'),
    priorities: {
      primaryRgb: '196, 126, 16',
      gradient: ['#0d0c0a', '#523105', '#241402'],
      accentBackground: '#fef3c7',
      accentText: '#92400e',
      badgeBackground: '#fffbeb',
      headerSubtitle: '#fde68a',
      urlText: '#b56e08',
    },
  },
] as const;

export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === 'string' &&
    THEME_REGISTRY.some((theme) => theme.id === value)
  );
}

export function getThemeById(id: string): ThemeConfig | undefined {
  return THEME_REGISTRY.find((theme) => theme.id === id);
}

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): ConcreteThemeId {
  return preference === SYSTEM_THEME
    ? systemDark
      ? 'dark'
      : 'light'
    : preference;
}

export function isDarkTheme(
  preference: ThemePreference,
  systemDark: boolean,
): boolean {
  const resolved = resolveTheme(preference, systemDark);
  return getThemeById(resolved)?.isDark ?? false;
}

/*
PORT STATUS
  source:     resources/js/Lib/theme.ts (253 lines)
  confidence: high
  todos:      0
  notes:      Browser persistence and DOM mutation moved into ThemeContext.
*/
