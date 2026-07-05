import { Monitor, Sun, Moon, Palette, type LucideIcon } from 'lucide-react';

// Single source of truth for the sz-theme preference.
// The preference (localStorage) can be 'system' or a concrete theme name;
// the data-theme attribute on <html> always holds a concrete theme.
// The blade inline script in app.blade.php mirrors resolveTheme for first paint.

export const THEME_KEY = 'sz-theme';
export const SYSTEM_THEME = 'system';

export interface ThemeConfig {
  id: string;
  nameAr: string;
  nameEn: string;
  shortNameAr?: string;
  emoji: string;
  icon: LucideIcon;
  isDark: boolean;
  bg: string;
  primary: string;
  group: 'system' | 'standard' | 'heritage';
  priorities?: {
    primaryRgb: string;
    gradient: string;
    accentBg: string;
    accentText: string;
    badgeBg: string;
    headerSubtitle: string;
    urlText: string;
  };
}

export const THEME_REGISTRY: ThemeConfig[] = [
  {
    id: SYSTEM_THEME,
    nameAr: 'تلقائي (حسب الجهاز)',
    nameEn: 'System',
    emoji: '🌓',
    icon: Monitor,
    isDark: false,
    bg: 'linear-gradient(90deg, #f5f5f5 50%, #1a1f22 50%)',
    primary: '#5a714a',
    group: 'system',
  },
  {
    id: 'light',
    nameAr: 'فاتح',
    nameEn: 'Light',
    emoji: '☀️',
    icon: Sun,
    isDark: false,
    bg: '#f5f5f5',
    primary: '#5a714a',
    group: 'standard',
    priorities: {
      primaryRgb: '90, 113, 74',
      gradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      accentBg: 'bg-slate-200 border-slate-300',
      accentText: 'text-slate-700',
      badgeBg: 'bg-slate-100 border-slate-200 text-slate-800',
      headerSubtitle: '#475569',
      urlText: '#5a714a',
    },
  },
  {
    id: 'dark',
    nameAr: 'داكن',
    nameEn: 'Dark',
    emoji: '🌑',
    icon: Moon,
    isDark: true,
    bg: '#1a1f22',
    primary: '#5a714a',
    group: 'standard',
    priorities: {
      primaryRgb: '90, 113, 74',
      gradient: 'linear-gradient(135deg, #0b0f19 0%, #064e3b 50%, #022c22 100%)',
      accentBg: 'bg-emerald-500/20 border-emerald-500/30',
      accentText: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
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
    icon: Palette,
    isDark: true,
    bg: '#0f1520',
    primary: '#4d84f5',
    group: 'standard',
    priorities: {
      primaryRgb: '77, 132, 245',
      gradient: 'linear-gradient(135deg, #090d16 0%, #0f2b5c 50%, #061124 100%)',
      accentBg: 'bg-blue-500/20 border-blue-500/30',
      accentText: 'text-blue-400',
      badgeBg: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
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
    icon: Palette,
    isDark: true,
    bg: '#130e1a',
    primary: '#9b2ec4',
    group: 'standard',
    priorities: {
      primaryRgb: '155, 46, 196',
      gradient: 'linear-gradient(135deg, #0a0b14 0%, #3b1154 50%, #180526 100%)',
      accentBg: 'bg-purple-500/20 border-purple-500/30',
      accentText: 'text-purple-400',
      badgeBg: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
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
    icon: Palette,
    isDark: true,
    bg: '#0e1a10',
    primary: '#4cac5a',
    group: 'standard',
    priorities: {
      primaryRgb: '76, 172, 90',
      gradient: 'linear-gradient(135deg, #080d0a 0%, #144d21 50%, #051a0b 100%)',
      accentBg: 'bg-green-500/20 border-green-500/30',
      accentText: 'text-green-400',
      badgeBg: 'bg-green-500/10 border-green-500/20 text-green-300',
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
    icon: Palette,
    isDark: true,
    bg: '#0a0a0a',
    primary: '#00ff00',
    group: 'standard',
    priorities: {
      primaryRgb: '0, 255, 0',
      gradient: 'linear-gradient(135deg, #000000 0%, #111111 100%)',
      accentBg: 'bg-green-500/20 border-green-500/30',
      accentText: 'text-green-400',
      badgeBg: 'bg-green-500/10 border-green-500/20 text-green-300',
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
    icon: Palette,
    isDark: true,
    bg: '#1a0810',
    primary: '#d4527a',
    group: 'heritage',
    priorities: {
      primaryRgb: '212, 82, 122',
      gradient: 'linear-gradient(135deg, #0d0a0b 0%, #5c142e 50%, #24050f 100%)',
      accentBg: 'bg-pink-500/20 border-pink-500/30',
      accentText: 'text-pink-400',
      badgeBg: 'bg-pink-500/10 border-pink-500/20 text-pink-300',
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
    icon: Palette,
    isDark: false,
    bg: '#fdf8ef',
    primary: '#c47e10',
    group: 'heritage',
    priorities: {
      primaryRgb: '196, 126, 16',
      gradient: 'linear-gradient(135deg, #0d0c0a 0%, #523105 50%, #241402 100%)',
      accentBg: 'bg-amber-500/20 border-amber-500/30',
      accentText: 'text-amber-400',
      badgeBg: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
      headerSubtitle: '#fde68a',
      urlText: '#fbbf24',
    },
  },
];

export function getThemeById(id: string): ThemeConfig | undefined {
  return THEME_REGISTRY.find(t => t.id === id);
}

export function isDarkTheme(id: string, systemDark: boolean): boolean {
  if (id === SYSTEM_THEME) return systemDark;
  const theme = getThemeById(id);
  return theme ? theme.isDark : false;
}


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
