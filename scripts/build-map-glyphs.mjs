// Builds the self-hosted map glyph PBFs for the mishwar vector basemap styles
// and copies the mapbox RTL text plugin into public/styles/.
// Run: node scripts/build-map-glyphs.mjs   (output is committed)
//
// Note: @ibm/plex-sans-arabic ships WOFF (not TTF); fontnik's freetype reads
// WOFF v1 directly, verified at authoring time.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fontnik = require('fontnik');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fontDir = join(root, 'node_modules/@ibm/plex-sans-arabic/fonts/complete/woff');
const outRoot = join(root, 'public/fonts/map');

const stacks = [
  { name: 'IBM Plex Sans Arabic Regular', file: 'IBMPlexSansArabic-Regular.woff' },
  { name: 'IBM Plex Sans Arabic Bold', file: 'IBMPlexSansArabic-Bold.woff' },
];

// 256-codepoint blocks: latin+digits, Arabic, Arabic Supplement, general
// punctuation, and the Arabic Presentation Forms the RTL shaper emits.
const ranges = [
  [0, 255],
  [1536, 1791],
  [1792, 2047],
  [8192, 8447],
  [64256, 64511],
  [64512, 64767],
  [64768, 65023],
  [65024, 65279],
];

const range = (opts) =>
  new Promise((resolve, reject) => fontnik.range(opts, (err, res) => (err ? reject(err) : resolve(res))));

for (const stack of stacks) {
  const font = readFileSync(join(fontDir, stack.file));
  const dir = join(outRoot, stack.name);
  mkdirSync(dir, { recursive: true });
  for (const [start, end] of ranges) {
    const pbf = await range({ font, start, end });
    if (!pbf || pbf.length === 0) throw new Error(`empty pbf for ${stack.name} ${start}-${end}`);
    const out = join(dir, `${start}-${end}.pbf`);
    writeFileSync(out, pbf);
    console.log(`wrote ${out} (${pbf.length} bytes)`);
  }
}

const rtlSrc = join(root, 'node_modules/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js');
const rtlDst = join(root, 'public/styles/mapbox-gl-rtl-text.min.js');
copyFileSync(rtlSrc, rtlDst);
console.log(`copied ${rtlDst}`);
