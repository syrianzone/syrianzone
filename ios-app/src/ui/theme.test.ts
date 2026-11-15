import { expect, test } from 'bun:test';
import { themeColors } from './theme';

function luminance(color: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Contrast checks require opaque six-digit sRGB colors.');
  const channel = (offset: number): number => {
    const value = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

for (const [mode, colors] of Object.entries(themeColors)) {
  test(`${mode} prominent button text meets WCAG AA contrast against its accent fill`, () => {
    const foreground = luminance(colors.onAccent);
    const background = luminance(colors.accent);
    const ratio = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
}
