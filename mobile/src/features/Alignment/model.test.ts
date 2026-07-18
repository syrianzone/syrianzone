import {
  canAddCompassDot,
  closestDot,
  compassSvg,
  createDot,
  defaultAxes,
  defaultCompassColors,
  normalizeCompassColor,
} from './model';

describe('custom alignment compass', () => {
  test('bounds new dots and selects the topmost nearby dot', () => {
    const first = createDot([], 1.5, -1);
    const second = createDot([first], 0.5, 0.5);
    expect(first).toMatchObject({ id: 1, x: 1, y: 0 });
    expect(closestDot([first, second], 0.51, 0.5, 0.05)?.id).toBe(2);
  });

  test('escapes labels in the portable SVG export', () => {
    const svg = compassSvg({
      axes: { ...defaultAxes, top: '<محافظ>' },
      colors: defaultCompassColors,
      dots: [{ ...createDot([], 0.5, 0.5), name: 'أ & ب' }],
    });
    expect(svg).toContain('&lt;محافظ&gt;');
    expect(svg).toContain('أ &amp; ب');
  });

  test('accepts bounded hex colors and rejects unsafe values', () => {
    expect(normalizeCompassColor(' #Aa00fF ')).toBe('#aa00ff');
    expect(normalizeCompassColor('#123')).toBeNull();
    expect(normalizeCompassColor('red')).toBeNull();
  });

  test('caps the persisted compass at fifty dots', () => {
    const dots = Array.from({ length: 50 }, (_, index) => ({
      ...createDot([], 0.5, 0.5),
      id: index + 1,
    }));
    expect(canAddCompassDot(dots)).toBe(false);
    expect(canAddCompassDot(dots.slice(0, 49))).toBe(true);
  });
});
