import { describe, expect, it } from 'vitest';
import { COLOR_INDEX_MAX } from '@/Domain/transit/limits';
import { ROUTE_COLOR_COUNT, ROUTE_PALETTE, buildColorMatch, getRouteColor } from './mapColors';

/** Every array inside a MapLibre expression, outermost first. */
function nodes(expression: unknown): unknown[][] {
  if (!Array.isArray(expression)) return [];
  return [expression, ...expression.flatMap(nodes)];
}

describe('transit route palette', () => {
  it('has distinct colours', () => {
    expect(new Set(ROUTE_PALETTE).size).toBe(ROUTE_PALETTE.length);
  });

  it('maps a stored index to its palette colour, in order', () => {
    expect(ROUTE_PALETTE.map((_, index) => getRouteColor(index))).toEqual(ROUTE_PALETTE);
  });

  it('wraps an index past the palette, for every index the server accepts', () => {
    expect(getRouteColor(ROUTE_COLOR_COUNT)).toBe(ROUTE_PALETTE[0]);
    expect(getRouteColor(ROUTE_COLOR_COUNT + 3)).toBe(ROUTE_PALETTE[3]);

    for (let index = 0; index <= COLOR_INDEX_MAX; index += 1) {
      expect(ROUTE_PALETTE, `index ${index}`).toContain(getRouteColor(index));
    }
  });

  it('falls back to the first colour for missing or unusable indices', () => {
    expect(getRouteColor(null)).toBe(ROUTE_PALETTE[0]);
    expect(getRouteColor(undefined)).toBe(ROUTE_PALETTE[0]);
    expect(getRouteColor(Number.NaN)).toBe(ROUTE_PALETTE[0]);
    expect(getRouteColor('3')).toBe(ROUTE_PALETTE[3]);
  });

  it('paints the map layer from the same palette and the same wrap rule', () => {
    const expression = buildColorMatch();
    const palette = nodes(expression).find((node) => node[0] === 'literal');
    const wrap = nodes(expression).find((node) => node[0] === '%');

    expect(palette?.[1]).toEqual(ROUTE_PALETTE);
    expect(wrap?.[2]).toBe(ROUTE_COLOR_COUNT);
  });

  it('reads the one colour key the payload carries', () => {
    const keys = nodes(buildColorMatch())
      .filter((node) => node[0] === 'get')
      .map((node) => node[1]);

    expect(keys).toEqual(['colorIndex']);
  });
});
