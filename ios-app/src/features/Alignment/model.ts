import { array, finiteNumber, integer, record, text } from '../../platform/validation';

export interface Dot {
  id: number;
  x: number;
  y: number;
  color: string;
  name: string;
}
export interface Axes {
  left: string;
  right: string;
  top: string;
  bottom: string;
}
export interface Colors {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
}
export interface Alignment {
  version: 1;
  axes: Axes;
  colors: Colors;
  dots: Dot[];
}
export type Point = Pick<Dot, 'x' | 'y'>;
export const AXIS_LABELS: Record<keyof Axes, string> = {
  left: 'المحور الأفقي (اليسار)',
  right: 'المحور الأفقي (اليمين)',
  top: 'المحور العمودي (الأعلى)',
  bottom: 'المحور العمودي (الأسفل)'
};
export const QUADRANT_LABELS: Record<keyof Colors, string> = {
  topLeft: 'أعلى اليسار',
  topRight: 'أعلى اليمين',
  bottomLeft: 'أسفل اليسار',
  bottomRight: 'أسفل اليمين'
};
const DOT_COLORS = ['#f44336', '#4caf50', '#2196f3', '#ffeb3b', '#e91e63', '#00bcd4', '#ff9800', '#9c27b0'];
export function defaultAlignment(): Alignment {
  return {
    version: 1,
    axes: { left: 'اقتصادي', right: 'ليبرالي', top: 'محافظ', bottom: 'تقدمي' },
    colors: { topLeft: '#4CAF50', topRight: '#2196F3', bottomLeft: '#FF9800', bottomRight: '#9C27B0' },
    dots: []
  };
}
const clamp = (value: number): number => Math.max(0, Math.min(1, finiteNumber(value)));
export function normalizePoint(x: number, y: number, size: number): Point {
  if (!Number.isFinite(size) || size <= 0) throw new Error('حجم الرسم غير صالح.');
  return { x: clamp(x / size), y: clamp(y / size) };
}
export function positionFromFields(x: string, y: string): Point {
  const number = (value: string): number => {
    const normalized = value
      .trim()
      .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
      .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0))
      .replace('٫', '.');
    if (!/^\d+(?:\.\d+)?$/.test(normalized) || Number(normalized) > 100) throw new Error('أدخل موضعاً من 0 إلى 100 لكل محور.');
    return Number(normalized) / 100;
  };
  return { x: number(x), y: number(y) };
}
export function addDot(state: Alignment, point: Point, seed: number): Alignment {
  if (state.dots.length >= 5000) throw new Error('بلغ الرسم الحد الأقصى، 5000 نقطة.');
  const id = Math.max(integer(seed), ...state.dots.map((dot) => dot.id + 1));
  if (id < 1 || !Number.isSafeInteger(id)) throw new Error('معرّف النقطة غير صالح.');
  return {
    ...state,
    dots: [
      ...state.dots,
      { id, x: clamp(point.x), y: clamp(point.y), color: DOT_COLORS[state.dots.length % DOT_COLORS.length]!, name: `نقطة ${state.dots.length + 1}` }
    ]
  };
}
export function moveDot(state: Alignment, id: number, point: Point): Alignment {
  return { ...state, dots: state.dots.map((dot) => (dot.id === id ? { ...dot, x: clamp(point.x), y: clamp(point.y) } : dot)) };
}
export function removeDot(state: Alignment, id: number): Alignment {
  return { ...state, dots: state.dots.filter((dot) => dot.id !== id) };
}
export function dotAt(dots: readonly Dot[], point: Point, size: number): Dot | null {
  return [...dots].reverse().find((dot) => Math.hypot(dot.x - point.x, dot.y - point.y) * size <= 15) ?? null;
}
function color(value: unknown): string {
  const result = text(value);
  if (!/^#[a-f\d]{6}$/i.test(result)) throw new Error('لون الرسم غير صالح.');
  return result;
}
function label(value: unknown): string {
  const result = text(value);
  if (result.length > 1000) throw new Error('اسم المحور أو النقطة يتجاوز 1000 حرف.');
  return result;
}
export function decodeAlignment(value: unknown): Alignment {
  const row = record(value),
    axes = record(row.axes),
    colors = record(row.colors),
    ids = new Set<number>();
  if (row.version !== 1) throw new Error('نسخة الرسم المحفوظ غير مدعومة.');
  const dots = array(row.dots).map((item) => {
    const dot = record(item),
      id = integer(dot.id),
      x = finiteNumber(dot.x),
      y = finiteNumber(dot.y);
    if (id < 1 || ids.has(id) || x < 0 || x > 1 || y < 0 || y > 1) throw new Error('نقطة الرسم المحفوظ غير صالحة.');
    ids.add(id);
    return { id, x, y, name: label(dot.name), color: color(dot.color) };
  });
  if (dots.length > 5000) throw new Error('الرسم المحفوظ يتجاوز الحد الأقصى للنقاط.');
  return {
    version: 1,
    axes: { left: label(axes.left), right: label(axes.right), top: label(axes.top), bottom: label(axes.bottom) },
    colors: {
      topLeft: color(colors.topLeft),
      topRight: color(colors.topRight),
      bottomLeft: color(colors.bottomLeft),
      bottomRight: color(colors.bottomRight)
    },
    dots
  };
}
const escapeXml = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
export function alignmentSvg(input: Alignment): string {
  const { axes, colors, dots } = decodeAlignment(input),
    style = 'fill="#fff" font-family="IBM Plex Sans Arabic,sans-serif" font-weight="bold" font-size="16" text-anchor="middle"';
  return `<svg width="600" height="600" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="300" height="300" fill="${colors.topLeft}"/><rect x="300" y="0" width="300" height="300" fill="${colors.topRight}"/><rect x="0" y="300" width="300" height="300" fill="${colors.bottomLeft}"/><rect x="300" y="300" width="300" height="300" fill="${colors.bottomRight}"/><path d="M300 0V600M0 300H600" stroke="#fff" stroke-width="2"/><text x="200" y="290" ${style}>${escapeXml(axes.left)}</text><text x="400" y="290" ${style}>${escapeXml(axes.right)}</text><text x="315" y="200" transform="rotate(90,315,200)" ${style}>${escapeXml(axes.top)}</text><text x="315" y="400" transform="rotate(90,315,400)" ${style}>${escapeXml(axes.bottom)}</text>${dots.map((dot) => `<circle cx="${dot.x * 600}" cy="${dot.y * 600}" r="8" fill="${dot.color}" stroke="#fff" stroke-width="2"/>${dot.name ? `<text x="${dot.x * 600}" y="${dot.y * 600 - 20}" fill="#fff" font-family="sans-serif" font-size="12" text-anchor="middle">${escapeXml(dot.name)}</text>` : ''}`).join('')}</svg>`;
}
export function createAlignmentWriter(write: (state: Alignment) => Promise<void>) {
  let tail = Promise.resolve();
  return {
    save(state: Alignment): Promise<void> {
      const snapshot = decodeAlignment(state);
      const next = tail.catch(() => {}).then(() => write(snapshot));
      tail = next;
      return next;
    }
  };
}
// PORT STATUS: source Pages/Alignment/CompassClient.tsx; confidence medium; todos 1 native gesture/export review. Coordinates use normalized fractions to preserve positions on resize.
