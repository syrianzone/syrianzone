import React, { useMemo } from 'react';
import rawSvg from './marker-015-regular.svg?raw';
import './quran.css';

// Ayah-mark rosette from quranpedia/ayah-marks (015-regular — see
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

interface Props {
  /** Hindi digits as stored in the marker token, e.g. "٢٥٥". */
  digits: string;
  /** Width matched to the original token's advance (preserves justification). */
  width: number;
}

export default function AyahMark({ digits, width }: Props) {
  const height = (width * VIEW_H) / VIEW_W;
  const svg = useMemo(() => {
    const label = `<text x="${NUM_CX}" y="${NUM_CY}" text-anchor="middle" dominant-baseline="central" font-size="${NUM_FONT_SIZE}" class="ayah-mark-num">${digits}</text></svg>`;
    return rawSvg.replace('</svg>', label);
  }, [digits]);

  return (
    <span
      className="ayah-mark-svg"
      aria-hidden="true"
      // Middle alignment centers the rosette on the text body (like the
      // original inline glyph); baseline alignment left it floating above.
      style={{ display: 'inline-block', width, height, verticalAlign: 'middle', lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
