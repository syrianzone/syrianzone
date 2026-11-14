import { describe, expect, test } from 'bun:test';
import { deriveLayout, type LayoutMetrics, type Rect } from './layout';

const metrics = (changes: Partial<LayoutMetrics> = {}): LayoutMetrics => ({
  width: 1000,
  height: 800,
  horizontalSizeClass: 'regular',
  hasHinge: false,
  verticalBarEdge: 'none',
  safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
  reservedRegions: [],
  ...changes
});

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('adaptive native layout', () => {
  test('uses a single phone pane before native metrics arrive', () => {
    expect(deriveLayout(null, 390, 700)).toEqual({ axis: 'single', primary: { x: 0, y: 0, width: 390, height: 700 }, secondary: null });
  });

  test('puts the browsing pane at the Arabic leading edge on wide windows', () => {
    const layout = deriveLayout(metrics(), 1000, 800);
    expect(layout.axis).toBe('horizontal');
    expect(layout.secondary).not.toBeNull();
    expect(layout.primary.x).toBeGreaterThan(layout.secondary!.x);
    expect(overlaps(layout.primary, layout.secondary!)).toBe(false);
  });

  test('keeps wide single-content screens in one full-width pane', () => {
    expect(deriveLayout(metrics(), 1000, 800, false)).toEqual({
      axis: 'single', primary: { x: 0, y: 0, width: 1000, height: 800 }, secondary: null,
    });
  });

  test('fits single-content controls in the largest region outside interior reservations', () => {
    const reservations = [
      { kind: 'division' as const, x: 490, y: 0, width: 20, height: 800 },
      { kind: 'occlusion' as const, x: 0, y: 0, width: 160, height: 120 },
    ];
    const layout = deriveLayout(metrics({ reservedRegions: reservations }), 1000, 800, false);
    expect(layout).toEqual({ axis: 'single', primary: { x: 510, y: 0, width: 490, height: 800 }, secondary: null });
    for (const reservation of reservations) expect(overlaps(layout.primary, reservation)).toBe(false);
  });

  test('keeps single-content panes outside camera and hinge reservations at different positions', () => {
    for (const hingeX of [80, 350, 700, 920]) {
      for (const cameraY of [0, 250, 650]) {
        const reservations = [
          { kind: 'division' as const, x: hingeX, y: 0, width: 20, height: 800 },
          { kind: 'occlusion' as const, x: 400, y: cameraY, width: 200, height: 120 },
        ];
        const layout = deriveLayout(metrics({ reservedRegions: reservations }), 1000, 800, false);
        expect(layout.secondary).toBeNull();
        expect(layout.primary.width).toBeGreaterThan(0);
        expect(layout.primary.height).toBeGreaterThan(0);
        expect(layout.primary.x).toBeGreaterThanOrEqual(0);
        expect(layout.primary.y).toBeGreaterThanOrEqual(0);
        expect(layout.primary.x + layout.primary.width).toBeLessThanOrEqual(1000);
        expect(layout.primary.y + layout.primary.height).toBeLessThanOrEqual(800);
        for (const reservation of reservations) expect(overlaps(layout.primary, reservation)).toBe(false);
      }
    }
  });

  test('insets panes by the observing view safe area only', () => {
    const layout = deriveLayout(metrics({ width: 390, safeArea: { top: 20, bottom: 30, left: 8, right: 12 } }), 390, 800);
    expect(layout.primary).toEqual({ x: 8, y: 20, width: 370, height: 750 });
  });

  test('keeps both panes away from a vertical fold reservation', () => {
    const hinge = { kind: 'division' as const, x: 490, y: 0, width: 20, height: 800 };
    const layout = deriveLayout(metrics({ hasHinge: true, reservedRegions: [hinge] }), 1000, 800);
    expect(layout.axis).toBe('horizontal');
    expect(layout.primary).toEqual({ x: 510, y: 0, width: 490, height: 800 });
    expect(layout.secondary).toEqual({ x: 0, y: 0, width: 490, height: 800 });
    expect(overlaps(layout.primary, hinge)).toBe(false);
    expect(overlaps(layout.secondary!, hinge)).toBe(false);
  });

  test('stacks panes above and below a horizontal hinge', () => {
    const hinge = { kind: 'occlusion' as const, x: 0, y: 390, width: 1000, height: 20 };
    const layout = deriveLayout(metrics({ hasHinge: true, reservedRegions: [hinge] }), 1000, 800);
    expect(layout.axis).toBe('vertical');
    expect(layout.primary).toEqual({ x: 0, y: 0, width: 1000, height: 390 });
    expect(layout.secondary).toEqual({ x: 0, y: 410, width: 1000, height: 390 });
  });

  test('never places controls over an interior occlusion', () => {
    const occlusion = { kind: 'occlusion' as const, x: 400, y: 200, width: 200, height: 400 };
    const layout = deriveLayout(metrics({ reservedRegions: [occlusion] }), 1000, 800);
    expect(overlaps(layout.primary, occlusion)).toBe(false);
    if (layout.secondary) expect(overlaps(layout.secondary, occlusion)).toBe(false);
  });

  test('returns to one pane after the device folds or the window narrows', () => {
    expect(deriveLayout(metrics({ width: 390, horizontalSizeClass: 'compact', hasHinge: true }), 390, 800).axis).toBe('single');
  });

  test('clips stale native geometry while a resize event catches up', () => {
    const folded = deriveLayout(metrics(), 390, 600);
    expect(folded.primary).toEqual({ x: 0, y: 0, width: 390, height: 600 });
    expect(folded.secondary).toBeNull();
    expect(deriveLayout(metrics({ width: 390, height: 600 }), 1000, 800).primary).toEqual(folded.primary);
  });

  test('excludes every active reservation when camera and fold regions coexist', () => {
    const reservations = [
      { kind: 'division' as const, x: 490, y: 0, width: 20, height: 800 },
      { kind: 'occlusion' as const, x: 0, y: 0, width: 160, height: 120 }
    ];
    const layout = deriveLayout(metrics({ reservedRegions: reservations }), 1000, 800);
    for (const rect of [layout.primary, layout.secondary].filter((candidate): candidate is Rect => candidate !== null)) {
      for (const reservation of reservations) expect(overlaps(rect, reservation)).toBe(false);
    }
    if (layout.secondary) expect(overlaps(layout.primary, layout.secondary)).toBe(false);
  });

  test('ignores invalid reservations and clamps unusable dimensions', () => {
    const layout = deriveLayout(metrics({ width: 0, height: Number.NaN, reservedRegions: [{ kind: 'occlusion', x: Number.NaN, y: 0, width: 20, height: 20 }] }), 390, 700);
    expect(layout.primary).toEqual({ x: 0, y: 0, width: 390, height: 700 });
    expect(deriveLayout(null, -1, 0).primary).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});
