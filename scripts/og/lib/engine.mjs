// The drawing engine behind every share card: SVG in, PNG out, plus the text
// measurement the layout code relies on.
//
// resvg (WebAssembly build) is used rather than a browser because it runs
// anywhere Node does, starts in milliseconds and shapes Arabic properly. The
// wasm build is deliberate: the production image installs node_modules on
// Alpine and runs on Debian, which a native binary would not survive.

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initWasm, Resvg } from '@resvg/resvg-wasm'

const require = createRequire(import.meta.url)

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
export const WIDTH = 1200
export const HEIGHT = 630
export const FONT_FAMILY = 'IBM Plex Sans Arabic'

// The site font. These files already ship with the answers-card renderer, so
// they are read from there rather than stored twice.
const FONT_DIR = join(ROOT, 'scripts', 'answers-card', 'fonts')
const FONT_FILES = { 400: 'IBMPlexSansArabic-Regular.ttf', 700: 'IBMPlexSansArabic-Bold.ttf' }

let state = null

/** Loads the wasm module and the fonts once per process. */
export async function init() {
  if (state) return state
  await initWasm(readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')))
  const fonts = Object.values(FONT_FILES).map((file) => readFileSync(join(FONT_DIR, file)))
  state = {
    options: { font: { fontBuffers: fonts, loadSystemFonts: false, defaultFontFamily: FONT_FAMILY } },
    coverage: readCoverage(fonts[0]),
  }
  return state
}

function ready() {
  if (!state) throw new Error('call init() before drawing')
  return state
}

/** Rasterises a complete SVG document to PNG bytes. */
export function renderPng(svg) {
  const resvg = new Resvg(svg, ready().options)
  try {
    return Buffer.from(resvg.render().asPng())
  } finally {
    resvg.free()
  }
}

/** Width of the ink a single line of markup produces, in pixels. */
export function inkWidth(textElement) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8000" height="400">${textElement}</svg>`
  const resvg = new Resvg(svg, ready().options)
  try {
    return resvg.getBBox()?.width ?? 0
  } finally {
    resvg.free()
  }
}

/** True when the font has a glyph for the code point, so nothing draws as an empty box. */
export function hasGlyph(codePoint) {
  return ready().coverage.has(codePoint)
}

/**
 * Reads the set of code points a TrueType font maps, from its `cmap` table
 * (formats 4 and 12, which is what this font and most others carry).
 */
function readCoverage(font) {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength)
  const tableCount = view.getUint16(4)
  let cmap = -1
  for (let i = 0; i < tableCount; i++) {
    const record = 12 + i * 16
    const tag = String.fromCharCode(view.getUint8(record), view.getUint8(record + 1), view.getUint8(record + 2), view.getUint8(record + 3))
    if (tag === 'cmap') cmap = view.getUint32(record + 8)
  }
  if (cmap < 0) throw new Error('font has no cmap table')

  const covered = new Set()
  const subtableCount = view.getUint16(cmap + 2)
  for (let i = 0; i < subtableCount; i++) {
    const offset = cmap + view.getUint32(cmap + 4 + i * 8 + 4)
    const format = view.getUint16(offset)
    if (format === 4) {
      const segments = view.getUint16(offset + 6) / 2
      const ends = offset + 14
      const starts = ends + segments * 2 + 2
      const deltas = starts + segments * 2
      const rangeOffsets = deltas + segments * 2
      for (let s = 0; s < segments; s++) {
        const start = view.getUint16(starts + s * 2)
        const end = view.getUint16(ends + s * 2)
        const delta = view.getInt16(deltas + s * 2)
        const rangeOffset = view.getUint16(rangeOffsets + s * 2)
        for (let code = start; code <= end && code !== 0xffff; code++) {
          let glyph
          if (rangeOffset === 0) {
            glyph = (code + delta) & 0xffff
          } else {
            const at = rangeOffsets + s * 2 + rangeOffset + (code - start) * 2
            glyph = view.getUint16(at)
            if (glyph !== 0) glyph = (glyph + delta) & 0xffff
          }
          if (glyph !== 0) covered.add(code)
        }
      }
    } else if (format === 12) {
      const groups = view.getUint32(offset + 12)
      for (let g = 0; g < groups; g++) {
        const group = offset + 16 + g * 12
        const start = view.getUint32(group)
        const end = view.getUint32(group + 4)
        for (let code = start; code <= end; code++) covered.add(code)
      }
    }
  }
  return covered
}
