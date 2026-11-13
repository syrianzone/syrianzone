import { describe, expect, it } from 'vitest';
import { MAP_COLOR_TOKENS, readMapColor, resolveMapColors } from './mapColors';

/**
 * A canvas paint property needs a concrete colour, so a token entry is read from
 * the document at paint time and falls back to the value in the table when
 * there is no document (the server render) — never to `undefined`, never to an
 * `hsl(var(--…))` string the renderer cannot parse.
 */
describe('map colour tokens', () => {
  it('falls back to a concrete colour without a document', () => {
    expect(typeof document).toBe('undefined');

    for (const [name, token] of Object.entries(MAP_COLOR_TOKENS)) {
      const colour = readMapColor(token);
      expect(colour, name).toBe(token.fallback);
      expect(colour, name).toMatch(/^#[0-9a-f]{3,8}$/i);
    }
  });

  it('passes data colours through untouched', () => {
    expect(readMapColor('#7d8a5c')).toBe('#7d8a5c');
    expect(resolveMapColors({ pin: '#c05621', accent: MAP_COLOR_TOKENS.primary })).toEqual({
      pin: '#c05621',
      accent: MAP_COLOR_TOKENS.primary.fallback,
    });
  });
});
