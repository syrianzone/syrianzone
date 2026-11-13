import { describe, expect, it } from 'vitest';
import { MAP_COLOR_TOKENS, readMapColor, resolveMapColors } from './mapColors';

/**
 * A canvas paint property needs a concrete colour, so a token entry is read from
 * the document at paint time and falls back to the value in the table when
 * there is no document (the server render) — never to `undefined`.
 */
describe('map colour tokens', () => {
  it('falls back to the table value without a document', () => {
    expect(typeof document).toBe('undefined');
    expect(readMapColor(MAP_COLOR_TOKENS.primary)).toBe('#556a4e');
    expect(readMapColor(MAP_COLOR_TOKENS.destructive)).toBe('#a83f45');
  });

  it('passes data colours through untouched', () => {
    expect(readMapColor('#7d8a5c')).toBe('#7d8a5c');
    expect(resolveMapColors({ pin: '#c05621', accent: MAP_COLOR_TOKENS.primary })).toEqual({
      pin: '#c05621',
      accent: '#556a4e',
    });
  });
});
