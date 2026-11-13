import { describe, expect, it } from 'vitest';
import { COLOR_INDEX_MAX } from '@/Domain/transit/limits';
import { ROUTE_COLOR_COUNT, ROUTE_PALETTE, buildColorMatch, getRouteColor } from './mapColors';

describe('transit route palette', () => {
  it('has distinct colours', () => {
    expect(new Set(ROUTE_PALETTE).size).toBe(ROUTE_PALETTE.length);
  });

  it('wraps a stored index around the palette, up to the highest index the server accepts', () => {
    for (let index = 0; index <= COLOR_INDEX_MAX; index += 1) {
      expect(getRouteColor(index)).toBe(ROUTE_PALETTE[index % ROUTE_COLOR_COUNT]);
    }
  });

  it('falls back to the first colour for missing or unusable indices', () => {
    expect(getRouteColor(null)).toBe(ROUTE_PALETTE[0]);
    expect(getRouteColor(undefined)).toBe(ROUTE_PALETTE[0]);
    expect(getRouteColor(Number.NaN)).toBe(ROUTE_PALETTE[0]);
    expect(getRouteColor('3')).toBe(ROUTE_PALETTE[3]);
  });

  it('paints the map layer from the same palette and the same wrap rule', () => {
    const expression = JSON.stringify(buildColorMatch());
    expect(expression).toContain(JSON.stringify(['literal', [...ROUTE_PALETTE]]));
    expect(expression).toContain(`,${ROUTE_COLOR_COUNT}]`);
  });

  it('reads the one colour key the payload carries', () => {
    const expression = JSON.stringify(buildColorMatch());
    expect(expression).toContain('"colorIndex"');
    expect(expression).not.toContain('color_index');
    expect(expression).not.toContain('coalesce');
  });
});
