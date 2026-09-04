import {
  type ConcreteThemeId,
  getThemeById,
  hsl,
  isDarkTheme,
  resolveTheme,
  THEME_REGISTRY,
  type ThemePalette,
} from './theme';

describe('native theme registry', () => {
  test('preserves every source theme id in order', () => {
    expect(THEME_REGISTRY.map((theme) => theme.id)).toEqual([
      'system',
      'light',
      'dark',
      'dark-blue',
      'dark-purple',
      'dark-green',
      'high-contrast',
      'damascus-rose',
      'jasmine',
    ]);
  });

  test('resolves the system preference without changing concrete themes', () => {
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('damascus-rose', false)).toBe('damascus-rose');
  });

  test('retains source dark and light behavior', () => {
    expect(isDarkTheme('dark-purple', false)).toBe(true);
    expect(isDarkTheme('jasmine', true)).toBe(false);
    expect(getThemeById('high-contrast')?.primary).toBe('#00ff00');
  });
});

describe('hsl', () => {
  test('converts the triplets app.css annotates with their hex values', () => {
    expect(hsl(203, 13.3, 11.8)).toBe('#1a1f22');
    expect(hsl(195, 23.5, 6.7)).toBe('#0d1315');
    expect(hsl(0, 0, 100)).toBe('#ffffff');
    expect(hsl(120, 100, 50)).toBe('#00ff00');
  });

  test('renders an alpha channel as rgba', () => {
    expect(hsl(0, 0, 100, 0.1)).toBe('rgba(255, 255, 255, 0.1)');
  });
});

describe('theme palettes', () => {
  // Converted independently from the app.css variables (Python colorsys), not
  // from hsl(), so a silent change to either the table or the helper fails.
  const golden: Record<
    ConcreteThemeId,
    Pick<ThemePalette, 'background' | 'surface' | 'primary' | 'foreground'>
  > = {
    light: {
      background: '#ffffff',
      surface: '#ffffff',
      primary: '#556a4e',
      foreground: '#0a0a0a',
    },
    dark: {
      background: '#1a1f22',
      surface: '#0d1315',
      primary: '#556a4e',
      foreground: '#ffffff',
    },
    'dark-blue': {
      background: '#0f141f',
      surface: '#0b0f17',
      primary: '#3c83f6',
      foreground: '#f8fafc',
    },
    'dark-purple': {
      background: '#140e1b',
      surface: '#0e0a12',
      primary: '#9b27b0',
      foreground: '#faf8fc',
    },
    'dark-green': {
      background: '#0e1a11',
      surface: '#0a120c',
      primary: '#4cae4f',
      foreground: '#f8fcf9',
    },
    'high-contrast': {
      background: '#000000',
      surface: '#000000',
      primary: '#00ff00',
      foreground: '#ffffff',
    },
    'damascus-rose': {
      background: '#1a0f12',
      surface: '#130a0c',
      primary: '#dd4b7c',
      foreground: '#f6f4f3',
    },
    jasmine: {
      background: '#fcfaf3',
      surface: '#ffffff',
      primary: '#d48d11',
      foreground: '#261f17',
    },
  };

  test.each(Object.entries(golden))(
    '%s renders the website CSS variables',
    (id, expected) => {
      expect(getThemeById(id)?.palette).toMatchObject(expected);
    },
  );

  test('follows the remaining CSS variables for the shared dark block', () => {
    expect(getThemeById('dark')?.palette).toMatchObject({
      surfaceRaised: '#1a2023',
      mutedForeground: '#9da9af',
      border: 'rgba(255, 255, 255, 0.1)',
      primaryForeground: '#ffffff',
      danger: '#a73f46',
    });
  });

  test('gives every concrete theme its own background instead of the dark base', () => {
    const concrete = THEME_REGISTRY.filter((theme) => theme.id !== 'system');
    const backgrounds = concrete.map((theme) => theme.palette.background);
    expect(new Set(backgrounds).size).toBe(concrete.length);

    const darkBase = getThemeById('dark')?.palette.background;
    for (const theme of concrete) {
      if (theme.isDark && theme.id !== 'dark') {
        expect(theme.palette.background).not.toBe(darkBase);
      }
    }
  });

  test('keeps swatch colors in sync with the website registry', () => {
    const swatches = THEME_REGISTRY.map((theme) => [
      theme.id,
      theme.previewBackground,
      theme.primary,
    ]);
    expect(swatches).toEqual([
      ['system', '#f5f5f5', '#5a714a'],
      ['light', '#f5f5f5', '#5a714a'],
      ['dark', '#1a1f22', '#5a714a'],
      ['dark-blue', '#0f1520', '#4d84f5'],
      ['dark-purple', '#130e1a', '#9b2ec4'],
      ['dark-green', '#0e1a10', '#4cac5a'],
      ['high-contrast', '#0a0a0a', '#00ff00'],
      ['damascus-rose', '#1a0810', '#d4527a'],
      ['jasmine', '#fdf8ef', '#c47e10'],
    ]);
    expect(getThemeById('system')?.previewBackgroundDark).toBe('#1a1f22');
  });
});
