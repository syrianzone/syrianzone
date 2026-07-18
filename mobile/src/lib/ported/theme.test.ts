import {
  getThemeById,
  isDarkTheme,
  resolveTheme,
  THEME_REGISTRY,
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
