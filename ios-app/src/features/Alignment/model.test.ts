import { expect, test } from 'bun:test';
import {
  addDot,
  alignmentSvg,
  createAlignmentWriter,
  decodeAlignment,
  defaultAlignment,
  dotAt,
  moveDot,
  normalizePoint,
  positionFromFields,
  removeDot
} from './model';

test('custom chart preserves the original axes, quadrant colors and automatic point palette', () => {
  const initial = defaultAlignment();
  expect(initial.axes).toEqual({ left: 'اقتصادي', right: 'ليبرالي', top: 'محافظ', bottom: 'تقدمي' });
  expect(initial.colors).toEqual({ topLeft: '#4CAF50', topRight: '#2196F3', bottomLeft: '#FF9800', bottomRight: '#9C27B0' });
  const first = addDot(initial, { x: 0.25, y: 0.75 }, 10),
    second = addDot(first, { x: 0.5, y: 0.5 }, 10);
  expect(first.dots[0]).toEqual({ id: 10, x: 0.25, y: 0.75, name: 'نقطة 1', color: '#f44336' });
  expect(second.dots[1]?.id).toBe(11);
  expect(second.dots[1]?.color).toBe('#4caf50');
  expect(initial.dots).toEqual([]);
});
test('native drag coordinates keep relative positions across phone and tablet sizes', () => {
  expect(normalizePoint(75, 225, 300)).toEqual({ x: 0.25, y: 0.75 });
  expect(normalizePoint(150, 450, 600)).toEqual({ x: 0.25, y: 0.75 });
  expect(normalizePoint(-10, 700, 600)).toEqual({ x: 0, y: 1 });
  expect(() => normalizePoint(1, 1, 0)).toThrow();
  const original = addDot(defaultAlignment(), { x: 0.25, y: 0.75 }, 10),
    moved = moveDot(original, 10, { x: 0.5, y: 0.1 });
  expect(moved.dots[0]?.x).toBe(0.5);
  expect(original.dots[0]?.x).toBe(0.25);
});
test('accessible position fields accept decimal Arabic digits and reject incomplete or out-of-range values', () => {
  expect(positionFromFields('25.5', '٧٥٫٢')).toEqual({ x: 0.255, y: 0.752 });
  expect(positionFromFields('۰', '۱۰۰')).toEqual({ x: 0, y: 1 });
  for (const value of ['', '1oops', '-1', '101']) expect(() => positionFromFields(value, '50')).toThrow();
});
test('overlapping hit tests select the most recently placed point with the source fifteen-point tolerance', () => {
  const first = addDot(defaultAlignment(), { x: 0.5, y: 0.5 }, 10),
    second = addDot(first, { x: 0.5, y: 0.5 }, 11);
  expect(dotAt(second.dots, { x: 0.54, y: 0.5 }, 300)?.id).toBe(11);
  expect(dotAt(second.dots, { x: 0.6, y: 0.5 }, 300)).toBeNull();
  expect(removeDot(second, 11).dots.map((dot) => dot.id)).toEqual([10]);
});
test('persisted drawings reject duplicate ids, invalid colors and unbounded coordinates without losing valid names', () => {
  const state = addDot(defaultAlignment(), { x: 0.5, y: 0.5 }, 10);
  expect(decodeAlignment(state)).toEqual(state);
  expect(() => decodeAlignment({ ...state, dots: [...state.dots, state.dots[0]] })).toThrow();
  expect(() => decodeAlignment({ ...state, dots: [{ ...state.dots[0], x: Infinity }] })).toThrow();
  expect(() => decodeAlignment({ ...state, colors: { ...state.colors, topLeft: 'url(https://example.org)' } })).toThrow();
});
test('SVG export retains every chart mark and escapes user labels as text', () => {
  const state = addDot(defaultAlignment(), { x: 0.25, y: 0.75 }, 10);
  state.axes.left = '<محور & "خاص">';
  state.dots[0]!.name = '</text><script>bad</script>';
  const svg = alignmentSvg(state);
  expect(svg).toContain('width="600" height="600"');
  expect(svg).toContain('cx="150" cy="450"');
  expect(svg).toContain('&lt;محور &amp; &quot;خاص&quot;&gt;');
  expect(svg).not.toContain('<script>');
  expect(svg).toContain('fill="#4CAF50"');
  expect(svg).toContain('fill="#9C27B0"');
});
test('local drawing writes are serialized and a failed save does not poison the next save', async () => {
  const stored: number[] = [],
    finish: (() => void)[] = [];
  const writer = createAlignmentWriter(
    (state) =>
      new Promise<void>((resolve, reject) => {
        stored.push(state.dots.length);
        finish.push(() => (stored.length === 1 ? reject(new Error('disk')) : resolve()));
      })
  );
  const first = writer.save(defaultAlignment()),
    second = writer.save(addDot(defaultAlignment(), { x: 0.5, y: 0.5 }, 10));
  await Promise.resolve();
  await Promise.resolve();
  expect(stored).toEqual([0]);
  finish[0]!();
  await expect(first).rejects.toThrow('disk');
  await Promise.resolve();
  await Promise.resolve();
  expect(stored).toEqual([0, 1]);
  finish[1]!();
  await second;
});
