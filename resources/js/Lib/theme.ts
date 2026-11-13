import { useSyncExternalStore } from 'react';
import { Monitor, Sun, Moon, Palette, type LucideIcon } from 'lucide-react';
import themeData from '../../data/themes.json';

// The registry, the storage keys and the font defaults live in
// resources/data/themes.json so the pre-paint script (resources/views/app.blade.php)
// and this module read the same record. <html> carries data-theme (the applied
// theme id) and data-scheme (its light/dark scheme) together; CSS keys the shared
// dark tokens and Tailwind's dark: variant off data-scheme alone.

export interface PrioritiesPalette {
  gradient: string;
  accentBg: string;
  accentText: string;
  badgeBg: string;
  headerSubtitle: string;
  urlText: string;
}

export interface ThemeConfig {
  id: string;
  nameAr: string;
  nameEn: string;
  shortNameAr?: string;
  emoji: string;
  icon: LucideIcon;
  isDark: boolean;
  /** Swatch background for the theme picker: the theme's --background. */
  bg: string;
  /** Swatch accent for the theme picker: the theme's --primary. */
  primary: string;
  group: 'system' | 'standard' | 'heritage';
  priorities?: PrioritiesPalette;
}

export const THEME_KEY = themeData.theme.key;
export const SYSTEM_THEME = themeData.theme.system;

const THEME_ICONS: Record<string, LucideIcon> = {
  monitor: Monitor,
  sun: Sun,
  moon: Moon,
  palette: Palette,
};

type ThemeEntry = (typeof themeData.themes)[number];

function isThemeGroup(value: string): value is ThemeConfig['group'] {
  return value === 'system' || value === 'standard' || value === 'heritage';
}

function toThemeConfig(entry: ThemeEntry): ThemeConfig {
  const icon = THEME_ICONS[entry.icon];
  if (!icon) throw new Error(`themes.json: theme "${entry.id}" names an unknown icon "${entry.icon}"`);
  if (!isThemeGroup(entry.group)) throw new Error(`themes.json: theme "${entry.id}" names an unknown group "${entry.group}"`);
  return {
    id: entry.id,
    nameAr: entry.nameAr,
    nameEn: entry.nameEn,
    ...('shortNameAr' in entry ? { shortNameAr: entry.shortNameAr } : {}),
    emoji: entry.emoji,
    icon,
    isDark: entry.isDark,
    bg: entry.bg,
    primary: entry.primary,
    group: entry.group,
    ...('priorities' in entry ? { priorities: entry.priorities } : {}),
  };
}

export const THEME_REGISTRY: ThemeConfig[] = themeData.themes.map(toThemeConfig);

export function getThemeById(id: string): ThemeConfig | undefined {
  return THEME_REGISTRY.find((t) => t.id === id);
}

export interface ShareCardPalette {
  /** The `light` theme draws a dark-on-light card; every other theme is the reverse. */
  isLight: boolean;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  /** Panel fill and hairline inside the card. */
  cardBg: string;
  cardBorder: string;
}

/**
 * The text palette a 360×640 story card draws on its `priorities` gradient. The
 * gradient is a theme record; these sets are not — the card is painted by
 * html2canvas, which cannot read CSS tokens — so they live here once and both
 * share cards (`Compass/components/CompassShareCard`, `PrioritiesApp`) read them
 * instead of keeping a copy each.
 */
export function shareCardPalette(themeId: string): ShareCardPalette {
  const isLight = themeId === 'light';
  return isLight
    ? {
        isLight,
        textPrimary: '#0f172a',
        textSecondary: '#475569',
        textMuted: '#64748b',
        cardBg: 'rgba(255,255,255,0.75)',
        cardBorder: 'rgba(203,213,225,0.8)',
      }
    : {
        isLight,
        textPrimary: '#ffffff',
        textSecondary: '#94a3b8',
        textMuted: 'rgba(255,255,255,0.5)',
        cardBg: 'rgba(15,23,42,0.5)',
        cardBorder: 'rgba(148,163,184,0.22)',
      };
}

export type ColorScheme = 'light' | 'dark';

function colorSchemeOf(themeId: string): ColorScheme {
  return getThemeById(themeId)?.isDark ? 'dark' : 'light';
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

// Apply the resolved theme id and its scheme together. The scheme also drives
// <meta name="color-scheme"> so native UI and the canvas match; no-ops without a
// document (SSR) or without the meta. The blade pre-paint script does the same
// before first paint; this covers switches after load.
function applyThemeAttributes(themeId: string) {
  if (typeof document === 'undefined') return;
  const scheme = colorSchemeOf(themeId);
  const root = document.documentElement;
  root.setAttribute('data-theme', themeId);
  root.setAttribute('data-scheme', scheme);
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.setAttribute('content', scheme);
}

export function applyTheme(pref: string) {
  try { localStorage.setItem(THEME_KEY, pref); } catch {}
  applyThemeAttributes(resolveTheme(pref));
  notifyThemeChanged();
}

// Follow the device scheme while the preference is 'system'. Call once at boot.
export function watchSystemTheme(): () => void {
  const query = darkQuery();
  const onChange = () => {
    if (getThemePreference() === SYSTEM_THEME) {
      applyThemeAttributes(resolveTheme(SYSTEM_THEME));
      notifyThemeChanged();
    }
  };
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export function getColorScheme(): ColorScheme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-scheme') === 'dark' ? 'dark' : 'light';
}

function subscribeToScheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-scheme'] });
  return () => observer.disconnect();
}

/**
 * The scheme currently applied to the document, re-rendering on every theme
 * change. The server snapshot is light so SSR markup hydrates unchanged; React
 * re-reads the document scheme right after hydration.
 */
export function useColorScheme(): ColorScheme {
  return useSyncExternalStore(subscribeToScheme, getColorScheme, () => 'light');
}

/** The theme id currently applied to the document (`data-theme`). */
export function getThemeId(): string {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') || 'light';
}

// `applyTheme` also reports here, because picking 'system' while already on the
// resolved theme changes the preference without changing the attribute.
const themeListeners = new Set<() => void>();

function notifyThemeChanged(): void {
  for (const listener of themeListeners) listener();
}

function subscribeToTheme(onChange: () => void): () => void {
  themeListeners.add(onChange);
  const observer =
    typeof document === 'undefined'
      ? null
      : new MutationObserver(onChange);
  observer?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    themeListeners.delete(onChange);
    observer?.disconnect();
  };
}

/**
 * The theme id the page is rendering with, reactive. Use it instead of reading
 * `data-theme` yourself: a share card, a palette lookup or a preview all want
 * the applied theme, and the server snapshot is the registry's light default so
 * SSR markup hydrates unchanged.
 */
export function useThemeId(): string {
  return useSyncExternalStore(subscribeToTheme, getThemeId, () => 'light');
}

/**
 * The stored theme preference (`'system'` or a registry id), reactive — the
 * appearance menu's pressed state. Distinct from `useThemeId()`: under
 * `'system'` the applied id is whatever the device scheme resolved to.
 */
export function useThemePreference(): string {
  return useSyncExternalStore(subscribeToTheme, getThemePreference, () => SYSTEM_THEME);
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** An app.css token value (`203 13.3% 11.8%`, alpha optional) as channels. */
function parseHslToken(value: string): Rgba | null {
  const match = value.trim().match(/^([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:\s*\/\s*([\d.]+)%)?$/);
  if (!match) return null;
  const hue = Number(match[1]) / 30;
  const saturation = Number(match[2]) / 100;
  const lightness = Number(match[3]) / 100;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => {
    const k = (n + hue) % 12;
    const value = lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255);
  };
  return {
    r: channel(0),
    g: channel(8),
    b: channel(4),
    a: match[4] === undefined ? 1 : Number(match[4]) / 100,
  };
}

function readTokenChannels(variable: string, themeId?: string): Rgba | null {
  if (typeof document === 'undefined') return null;
  const root = document.documentElement;
  if (themeId !== undefined && root.getAttribute('data-theme') !== themeId) return null;
  return parseHslToken(getComputedStyle(root).getPropertyValue(variable));
}

/**
 * A live CSS token as a usable CSS colour, for renderers that must show the
 * colour the page is actually using (share images). Pass the theme id the
 * renderer was built for so a not-yet-applied theme falls back to its palette
 * instead of mixing two themes. Null on the server.
 */
export function readThemeColor(variable: string, themeId?: string): string | null {
  const color = readTokenChannels(variable, themeId);
  if (!color) return null;
  return color.a === 1
    ? `rgb(${color.r}, ${color.g}, ${color.b})`
    : `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
}

/** The same token as `r, g, b`, for renderers that compose their own rgba(). */
export function readThemeRgb(variable: string, themeId?: string): string | null {
  const color = readTokenChannels(variable, themeId);
  return color ? `${color.r}, ${color.g}, ${color.b}` : null;
}

/** `#5a714a` -> `90, 113, 74`, the channel form share cards compose rgba() from. */
export function hexToRgbString(hex: string): string {
  const digits = hex.replace('#', '');
  const full = digits.length === 3 ? [...digits].map((c) => c + c).join('') : digits;
  const value = Number.parseInt(full, 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}
