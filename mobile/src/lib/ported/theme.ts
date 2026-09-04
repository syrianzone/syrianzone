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
  // The website's system swatch is a half light, half dark gradient. Native
  // views have no gradients, so the toggle paints the second half from this.
  previewBackgroundDark?: string;
  primary: string;
  group: 'system' | 'standard' | 'heritage';
  palette: ThemePalette;
  priorities?: PriorityTheme;
}

// Takes the CSS triplets from resources/css/app.css verbatim (`203 13.3% 11.8%`
// becomes hsl(203, 13.3, 11.8)) so the palettes below read like the stylesheet.
// Uses the CSS Color 4 reference formula; alpha yields rgba because that is
// what React Native and the tests print back.
export function hsl(h: number, s: number, l: number, alpha?: number): string {
  const sat = s / 100;
  const light = l / 100;
  const chroma = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round((light - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  const [r, g, b] = [channel(0), channel(8), channel(4)];
  if (alpha !== undefined) {
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const hex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

// success and overlay have no CSS variable on the website; they are the only
// palette entries chosen here rather than copied.
const lightExtras = { overlay: 'rgba(15, 23, 42, 0.48)', success: '#287a3c' };
const darkExtras = { overlay: 'rgba(0, 0, 0, 0.68)', success: '#72d58a' };

// Each block mirrors one selector in app.css, in the same variable order:
// background, card, secondary, foreground, muted-foreground, border, primary,
// primary-foreground, destructive. surfaceRaised takes --secondary rather than
// --accent because the app uses it for resting raised surfaces (secondary
// buttons, avatar fallbacks, chips), which is what shadcn paints with
// bg-secondary; --accent is the hover state, which touch UIs do not have.
const palettes: Record<ConcreteThemeId, ThemePalette> = {
  light: {
    background: hsl(0, 0, 100),
    surface: hsl(0, 0, 100),
    surfaceRaised: hsl(0, 0, 96.1),
    foreground: hsl(0, 0, 3.9),
    mutedForeground: hsl(0, 0, 45.1),
    border: hsl(0, 0, 89.8),
    primary: hsl(105, 15.2, 36.1),
    primaryForeground: hsl(0, 0, 98),
    danger: hsl(356, 45.2, 45.1),
    ...lightExtras,
  },
  jasmine: {
    background: hsl(45, 60, 97),
    surface: hsl(45, 50, 100),
    surfaceRaised: hsl(42, 35, 92),
    foreground: hsl(30, 25, 12),
    mutedForeground: hsl(30, 18, 42),
    border: hsl(38, 30, 85),
    primary: hsl(38, 85, 45),
    primaryForeground: hsl(0, 0, 100),
    danger: hsl(356, 45.2, 45.1),
    ...lightExtras,
  },
  // The shared dark block plus the [data-theme="dark"] primary override.
  dark: {
    background: hsl(203, 13.3, 11.8),
    surface: hsl(195, 23.5, 6.7),
    surfaceRaised: hsl(200, 15, 12),
    foreground: hsl(0, 0, 100),
    mutedForeground: hsl(200, 10, 65),
    border: hsl(0, 0, 100, 0.1),
    primary: hsl(105, 15.2, 36.1),
    primaryForeground: hsl(0, 0, 100),
    danger: hsl(356, 45.2, 45.1),
    ...darkExtras,
  },
  'dark-blue': {
    background: hsl(219, 36, 9),
    surface: hsl(219, 36, 6.5),
    surfaceRaised: hsl(219, 25, 15),
    foreground: hsl(210, 40, 98),
    mutedForeground: hsl(215, 20, 65),
    border: hsl(219, 25, 17),
    primary: hsl(217, 91, 60),
    primaryForeground: hsl(210, 40, 98),
    danger: hsl(0, 72, 51),
    ...darkExtras,
  },
  'dark-purple': {
    background: hsl(270, 30, 8),
    surface: hsl(270, 30, 5.5),
    surfaceRaised: hsl(270, 20, 14),
    foreground: hsl(270, 40, 98),
    mutedForeground: hsl(270, 20, 65),
    border: hsl(270, 20, 16),
    primary: hsl(291, 64, 42),
    primaryForeground: hsl(270, 40, 98),
    danger: hsl(0, 72, 51),
    ...darkExtras,
  },
  'dark-green': {
    background: hsl(135, 29, 8),
    surface: hsl(135, 29, 5.5),
    surfaceRaised: hsl(135, 20, 14),
    foreground: hsl(135, 40, 98),
    mutedForeground: hsl(130, 18, 65),
    border: hsl(135, 20, 16),
    primary: hsl(122, 39, 49),
    primaryForeground: hsl(135, 40, 98),
    danger: hsl(0, 72, 51),
    ...darkExtras,
  },
  'high-contrast': {
    background: hsl(0, 0, 0),
    surface: hsl(0, 0, 0),
    surfaceRaised: hsl(0, 0, 10),
    foreground: hsl(0, 0, 100),
    mutedForeground: hsl(0, 0, 85),
    border: hsl(120, 100, 50),
    primary: hsl(120, 100, 50),
    primaryForeground: hsl(0, 0, 0),
    danger: hsl(0, 100, 50),
    ...darkExtras,
  },
  'damascus-rose': {
    background: hsl(345, 28, 8),
    surface: hsl(345, 32, 5.5),
    surfaceRaised: hsl(345, 22, 13),
    foreground: hsl(10, 15, 96),
    mutedForeground: hsl(340, 18, 62),
    border: hsl(340, 35, 20),
    primary: hsl(340, 68, 58),
    primaryForeground: hsl(0, 0, 100),
    danger: hsl(0, 72, 51),
    ...darkExtras,
  },
};

// previewBackground and primary are the website registry's swatch values, which
// intentionally differ a little from the rendered CSS variables.
export const THEME_REGISTRY: readonly ThemeConfig[] = [
  {
    id: SYSTEM_THEME,
    nameAr: 'تلقائي (حسب الجهاز)',
    nameEn: 'System',
    emoji: '🌓',
    isDark: false,
    previewBackground: '#f5f5f5',
    previewBackgroundDark: '#1a1f22',
    primary: '#5a714a',
    group: 'system',
    palette: palettes.light,
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
    palette: palettes.light,
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
    palette: palettes.dark,
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
    palette: palettes['dark-blue'],
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
    palette: palettes['dark-purple'],
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
    palette: palettes['dark-green'],
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
    palette: palettes['high-contrast'],
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
    palette: palettes['damascus-rose'],
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
    palette: palettes.jasmine,
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
  source:     resources/js/Lib/theme.ts (253 lines) and the theme variable
              blocks in resources/css/app.css (lines 79 to 356)
  confidence: high
  todos:      0
  notes:      Browser persistence and DOM mutation moved into ThemeContext.
              Palettes are the CSS variables converted with hsl(); success and
              overlay have no web counterpart. The system swatch gradient is
              split into previewBackground and previewBackgroundDark.
*/
