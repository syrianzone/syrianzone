import { z } from 'zod';

export interface CompassDot {
  color: string;
  id: number;
  name: string;
  x: number;
  y: number;
}

export interface CompassAxes {
  bottom: string;
  left: string;
  right: string;
  top: string;
}

export interface CompassColors {
  bottomLeft: string;
  bottomRight: string;
  topLeft: string;
  topRight: string;
}

export const MAX_COMPASS_DOTS = 50;

export const defaultAxes: CompassAxes = {
  bottom: 'تقدمي',
  left: 'اقتصادي',
  right: 'ليبرالي',
  top: 'محافظ',
};

export const defaultCompassColors: CompassColors = {
  bottomLeft: '#FF9800',
  bottomRight: '#9C27B0',
  topLeft: '#4CAF50',
  topRight: '#2196F3',
};

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i);

export const alignmentStateSchema = z.object({
  axes: z.object({
    bottom: z.string().max(40),
    left: z.string().max(40),
    right: z.string().max(40),
    top: z.string().max(40),
  }),
  colors: z.object({
    bottomLeft: hexColor,
    bottomRight: hexColor,
    topLeft: hexColor,
    topRight: hexColor,
  }),
  dots: z.array(
    z.object({
      color: hexColor,
      id: z.number().int().nonnegative(),
      name: z.string().max(60),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    }),
  ).max(MAX_COMPASS_DOTS),
});

export type AlignmentState = z.infer<typeof alignmentStateSchema>;

const dotColors = [
  '#f44336',
  '#4caf50',
  '#2196f3',
  '#ffeb3b',
  '#e91e63',
  '#00bcd4',
  '#ff9800',
  '#9c27b0',
] as const;

export function normalizeCompassColor(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : null;
}

export function canAddCompassDot(dots: readonly CompassDot[]): boolean {
  return dots.length < MAX_COMPASS_DOTS;
}

export function createDot(
  dots: readonly CompassDot[],
  x: number,
  y: number,
): CompassDot {
  return {
    color: dotColors[dots.length % dotColors.length]!,
    id: Math.max(0, ...dots.map((dot) => dot.id)) + 1,
    name: `نقطة ${dots.length + 1}`,
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  };
}

export function closestDot(
  dots: readonly CompassDot[],
  x: number,
  y: number,
  radius: number,
): CompassDot | null {
  return (
    [...dots]
      .reverse()
      .find((dot) => Math.hypot(dot.x - x, dot.y - y) <= radius) ?? null
  );
}

export function compassSvg(state: AlignmentState, size = 800): string {
  const half = size / 2;
  const escape = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  const dots = state.dots
    .map((dot) => {
      const x = dot.x * size;
      const y = dot.y * size;
      return `<circle cx="${x}" cy="${y}" r="12" fill="${dot.color}" stroke="#fff" stroke-width="4"/><text x="${x}" y="${y - 22}" fill="#fff" text-anchor="middle" font-size="20">${escape(dot.name)}</text>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${half}" height="${half}" fill="${state.colors.topLeft}"/><rect x="${half}" width="${half}" height="${half}" fill="${state.colors.topRight}"/><rect y="${half}" width="${half}" height="${half}" fill="${state.colors.bottomLeft}"/><rect x="${half}" y="${half}" width="${half}" height="${half}" fill="${state.colors.bottomRight}"/><path d="M ${half} 0 V ${size} M 0 ${half} H ${size}" stroke="#fff" stroke-width="4"/><text x="40" y="${half - 20}" fill="#fff" font-size="24">${escape(state.axes.left)}</text><text x="${size - 40}" y="${half - 20}" fill="#fff" text-anchor="end" font-size="24">${escape(state.axes.right)}</text><text x="${half}" y="40" fill="#fff" text-anchor="middle" font-size="24">${escape(state.axes.top)}</text><text x="${half}" y="${size - 24}" fill="#fff" text-anchor="middle" font-size="24">${escape(state.axes.bottom)}</text>${dots}</svg>`;
}
