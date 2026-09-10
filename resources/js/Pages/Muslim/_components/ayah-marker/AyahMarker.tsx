import React, { useMemo } from 'react';
import rawSvg from './marker-015-regular.svg?raw';

// End-of-ayah rosette from quranpedia/ayah-markers (015-regular — see
// ATTRIBUTION.md). Rendered inline so the line's measured width stays close
// to the pipeline width the scaleX factor was computed for.
// Number geometry (cx/cy/height) is the hand-placed box from collection.json,
// in the same units as the SVG viewBox.
const NUM_CX = 586.2;
const NUM_CY = 291.2;
const VIEW_W = 1312.98;
const VIEW_H = 1229.38;
// Numeral size: hand box height (290) would give ~276, but the interior disc
// (r=398) safely holds more — 350 keeps 3-digit numbers inside the disc
// while reading clearly at rendered sizes.
const NUM_FONT_SIZE = 350;

/** Ornate-bracket marker tokens as stored in the skill database text. */
const MARKER_RE = /﴿([٠-٩]{1,3})﴾/g;

export type Segment = { kind: 'text'; value: string } | { kind: 'marker'; digits: string };

/** Split a part's display text on inline marker tokens (spaces preserved). */
export function splitMarkerTokens(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  MARKER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKER_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: 'text', value: text.slice(last, m.index) });
    out.push({ kind: 'marker', digits: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', value: text.slice(last) });
  return out;
}

interface Props {
  /** Hindi digits as stored in the marker token, e.g. "٢٥٥". */
  digits: string;
  /** Width matched to the original token's advance (preserves justification). */
  width: number;
}

export default function AyahMarker({ digits, width }: Props) {
  const height = (width * VIEW_H) / VIEW_W;
  const svg = useMemo(() => {
    const label = `<text x="${NUM_CX}" y="${NUM_CY}" text-anchor="middle" dominant-baseline="central" font-size="${NUM_FONT_SIZE}" class="ayah-marker-num">${digits}</text></svg>`;
    return rawSvg.replace('</svg>', label);
  }, [digits]);

  return (
    <span
      className="ayah-marker-svg"
      aria-hidden="true"
      // Middle alignment centers the rosette on the text body (like the
      // original inline glyph); baseline alignment left it floating above.
      style={{ display: 'inline-block', width, height, verticalAlign: 'middle', lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
