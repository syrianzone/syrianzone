// Building blocks shared by every card template: theme colours, text, icons,
// the wordmark and pills. Each returns an SVG fragment.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FONT_FAMILY, ROOT } from './engine.mjs'
import { escapeXml, ltr, measureLine, rtl } from './text.mjs'

const read = (path) => readFileSync(join(ROOT, path))
const tokens = JSON.parse(read('resources/og/tokens.json'))
const iconSet = JSON.parse(read('resources/og/icons.json'))

/** The colours of one colourway ("dark" or "light"), plus the brand extras. */
export function theme(name = 'dark') {
  if (!tokens[name]) throw new Error(`unknown card theme: ${name}`)
  return { name, ...tokens[name], gold: tokens.brand.gold }
}

/** `#RRGGBBAA` is split into a colour and an opacity, which every SVG renderer understands. */
export function paint(property, colour, extraOpacity = 1) {
  if (!colour || colour === 'none') return `${property}="none"`
  const alpha = colour.length === 9 ? parseInt(colour.slice(7), 16) / 255 : 1
  const opacity = alpha * extraOpacity
  return `${property}="${colour.slice(0, 7)}"${opacity < 1 ? ` ${property}-opacity="${opacity.toFixed(3)}"` : ''}`
}

/** `#RRGGBB` at the given alpha, as `#RRGGBBAA`. */
export const alpha = (colour, amount) =>
  colour.slice(0, 7) + Math.round(amount * 255).toString(16).padStart(2, '0')

/**
 * One line of text. `x` is the right edge for RTL text and the left edge for
 * LTR text, so callers always position from the side the text starts on.
 */
export function line(content, { x, y, size, weight = 400, colour, dir = 'rtl', anchor }) {
  const wrapped = dir === 'rtl' ? rtl(content) : ltr(content)
  const textAnchor = anchor ?? (dir === 'rtl' ? 'end' : 'start')
  return `<text x="${x}" y="${y}" font-family="${FONT_FAMILY}" font-size="${size}" font-weight="${weight}" text-anchor="${textAnchor}" ${paint('fill', colour)}>${escapeXml(wrapped)}</text>`
}

/** A multicolour module icon from the site's own set, drawn into a square box. */
export function icon(key, t, { x, y, size }) {
  const entry = iconSet.icons[key]
  if (!entry) throw new Error(`unknown card icon: ${key}`)
  const body = entry[t.name]
    .replaceAll('hsl(var(--primary))', t.primary)
    .replaceAll('currentColor', t.primary)
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${entry.viewBox}">${body}</svg>`
}

export const hasIcon = (key) => Boolean(iconSet.icons[key])

/** A small single-colour glyph (lucide), drawn into a square box. */
export function glyph(name, { x, y, size, colour }) {
  const entry = iconSet.glyphs[name]
  if (!entry) throw new Error(`unknown card glyph: ${name}`)
  const body = entry.body.replaceAll('currentColor', colour.slice(0, 7))
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${entry.viewBox}">${body}</svg>`
}

const assets = new Map()

/** A file from the repository as a data URI, read once. */
export function asset(path, mime) {
  let uri = assets.get(path)
  if (!uri) {
    uri = `data:${mime};base64,${read(path).toString('base64')}`
    assets.set(path, uri)
  }
  return uri
}

const WORDMARK_RATIO = 570.55 / 298.43

/** The SYRIAN.ZONE wordmark, positioned by its top-right corner (the RTL start corner). */
export function wordmark(t, { right, top, height, onPhoto = false }) {
  const file = t.name === 'dark' || onPhoto ? 'public/assets/logo-darkmode.svg' : 'public/assets/logo-lightmode.svg'
  const width = height * WORDMARK_RATIO
  return `<image x="${right - width}" y="${top}" width="${width}" height="${height}" href="${asset(file, 'image/svg+xml')}"/>`
}

/** Fill, border and text colour for each pill tone. */
function pillColours(t, tone) {
  switch (tone) {
    case 'primary':
      return { fill: t.primary, border: 'none', text: t.primaryForeground }
    case 'destructive':
      return { fill: t.destructive, border: 'none', text: t.destructiveForeground }
    case 'outline':
      return { fill: 'none', border: alpha(t.foreground, 0.28), text: t.foreground }
    case 'glass': // over a photograph
      return { fill: '#00000073', border: '#FFFFFF40', text: '#FFFFFF' }
    default: // soft
      return { fill: alpha(t.foreground, t.name === 'dark' ? 0.09 : 0.06), border: 'none', text: t.foreground }
  }
}

/**
 * A rounded chip with an optional icon, like the badges on the site.
 * Returns its size and a `draw(right, top)` that places it by its right edge.
 */
export function pill(t, { label, tone = 'soft', glyph: glyphName, icon: iconKey, size = 26, weight = 400, markAtEnd = false }) {
  const height = Math.round(size * 1.92)
  const padding = Math.round(size * 0.8)
  const mark = glyphName || iconKey ? Math.round(size * 1.05) : 0
  const gap = mark ? Math.round(size * 0.36) : 0
  const textWidth = measureLine(label, size, weight)
  const width = Math.ceil(padding * 2 + mark + gap + textWidth)
  const colours = pillColours(t, tone)

  const draw = (right, top) => {
    const left = right - width
    const box = `<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="${height / 2}" ${paint('fill', colours.fill)}${colours.border === 'none' ? '' : ` ${paint('stroke', colours.border)} stroke-width="2"`}/>`
    // The mark leads the label (on its right) unless it is a trailing arrow.
    const markX = markAtEnd ? left + padding : right - padding - mark
    const markY = top + (height - mark) / 2
    const markSvg = glyphName
      ? glyph(glyphName, { x: markX, y: markY, size: mark, colour: colours.text })
      : iconKey
        ? icon(iconKey, t, { x: markX, y: markY, size: mark })
        : ''
    const labelRight = markAtEnd ? right - padding : right - padding - mark - gap
    const label_ = line(label, { x: labelRight, y: top + height / 2 + size * 0.345, size, weight, colour: colours.text })
    return box + markSvg + label_
  }

  return { width, height, draw }
}

/** Lays pills out from the right edge towards the left, the reading order of the page. */
export function flow(pills, { right, top, gap = 14 }) {
  let cursor = right
  let svg = ''
  for (const item of pills) {
    svg += item.draw(cursor, top)
    cursor -= item.width + gap
  }
  return svg
}
