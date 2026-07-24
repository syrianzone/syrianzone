const GLYPH_BLOCK_SIZE = 256;
const MAX_BMP_CODE_POINT = 0xffff;
const MAX_UNICODE_CODE_POINT = 0x10ffff;

export const glyphPayloadSha256 =
  'd0a644e48279d4a0fe35e54505e482f76ed0a60cf7af91e1066f43d2d0db9792';

export const glyphStacks = [
  {
    file: 'IBMPlexSansArabic-Regular.woff',
    name: 'IBM Plex Sans Arabic Regular',
  },
  {
    file: 'IBMPlexSansArabic-Bold.woff',
    name: 'IBM Plex Sans Arabic Bold',
  },
];

// MapLibre requests fixed 256-codepoint blocks for every character found in
// map labels. Complete BMP coverage prevents valid global labels from
// producing missing-glyph HTTP responses.
const requiredGlyphCoverage = [[0, MAX_BMP_CODE_POINT]];

export function expandGlyphRanges(coverage) {
  const blockStarts = new Set();
  for (const interval of coverage) {
    if (!Array.isArray(interval) || interval.length !== 2) {
      throw new TypeError('glyph intervals must contain a start and end');
    }
    const [start, end] = interval;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      throw new TypeError('glyph interval bounds must be finite safe integers');
    }
    if (
      start < 0 ||
      end < start ||
      end > MAX_UNICODE_CODE_POINT
    ) {
      throw new RangeError('glyph intervals must be ordered Unicode ranges');
    }
    const firstBlock = Math.floor(start / GLYPH_BLOCK_SIZE);
    const lastBlock = Math.floor(end / GLYPH_BLOCK_SIZE);
    for (let block = firstBlock; block <= lastBlock; block += 1) {
      blockStarts.add(block * GLYPH_BLOCK_SIZE);
    }
  }

  return [...blockStarts]
    .sort((left, right) => left - right)
    .map((start) => [start, start + GLYPH_BLOCK_SIZE - 1]);
}

export const glyphRanges = expandGlyphRanges(requiredGlyphCoverage);
