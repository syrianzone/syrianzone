// The card templates. One standard layout carries every family:
//
//   brand    the site itself (home, last-resort fallback)
//   split    text on the right, optional artwork on the left: every fixed page
//            (module icon), every record (pills, person, figure) and invites
//   photo    a photograph with a name over a scrim (places)
//
// A card is described by a plain model so the same description can come from a
// JSON file at build time or from PHP at runtime. Layout follows the site: flat
// surfaces, hairline borders, rounded tiles, the multicolour module icons and
// the brand green, all read right to left.

import { HEIGHT, WIDTH } from './engine.mjs'
import { alpha, asset, flow, glyph, hasIcon, icon, line, paint, pill, theme, wordmark } from './draw.mjs'
import { clean, fitText, measureLine } from './text.mjs'

const PAD = 64
const ACCENT = 12
const SITE_NAME = 'المساحة السورية'
const HEADER_TOP = 48
const HEADER_HEIGHT = 72
const FOOTER_RULE = HEIGHT - 108
const FOOTER_BASELINE = HEIGHT - 52
const BODY_TOP = HEADER_TOP + HEADER_HEIGHT + 18
const BODY_BOTTOM = FOOTER_RULE - 18
const RIGHT = WIDTH - PAD - ACCENT
const TILE = 252
const TILE_GAP = 64

const svgOpen = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`

// Texts of the card being drawn that had to be cut short. The build reads this
// to refuse card copy that does not fit.
let cut = []
const noteCut = (fit, what) => {
  if (fit.truncated) cut.push(what)
  return fit
}

/** Draws a card and reports which of its texts did not fit and were cut. */
export function inspectCard(model) {
  cut = []
  const svg = drawCard(model)
  return { svg, truncated: [...cut] }
}

/** Draws a card model to a complete SVG document. */
export function drawCard(model) {
  const t = theme(model.theme ?? 'dark')
  switch (model.kind) {
    case 'brand':
      return brandCard(model, t)
    case 'photo':
      // Without its photograph a place is drawn like any other record.
      return model.photo ? photoCard(model, t) : splitCard(model, t)
    case 'split':
      return splitCard(model, t)
    default:
      throw new Error(`unknown card kind: ${model.kind}`)
  }
}

/**
 * The ground every non-photo card stands on: the page colour with a faint
 * vertical lift, and the brand green along the edge the text starts from.
 *
 * It is deliberately flat. A textured or radial background multiplies the file
 * size several times over, and previews are fetched on slow connections.
 */
function ground(t) {
  const [from, to] = t.name === 'dark' ? ['#232B2D', t.background] : ['#FFFFFF', '#F1F3EF']
  return (
    `<defs><linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#ground)"/>` +
    `<rect x="${WIDTH - ACCENT}" width="${ACCENT}" height="${HEIGHT}" ${paint('fill', t.primary)}/>`
  )
}

/** Wordmark in the top-right corner, with an optional module chip opposite it. */
function header(t, { kicker, onPhoto = false } = {}) {
  let svg = wordmark(t, { right: RIGHT, top: HEADER_TOP, height: HEADER_HEIGHT, onPhoto })
  if (kicker) {
    const chip = pill(t, {
      label: clean(kicker.label),
      icon: hasIcon(kicker.icon) ? kicker.icon : undefined,
      tone: onPhoto ? 'glass' : 'outline',
      size: 27,
      weight: 700,
    })
    svg += chip.draw(PAD + chip.width, HEADER_TOP + (HEADER_HEIGHT - chip.height) / 2)
  }
  return svg
}

/** Address on the left; the site name, or one fact about the record, on the right. */
function footer(t, { url, meta }) {
  let svg = `<rect x="${PAD}" y="${FOOTER_RULE}" width="${RIGHT - PAD}" height="2" ${paint('fill', alpha(t.foreground, 0.1))}/>`
  if (url) svg += line(url, { x: PAD, y: FOOTER_BASELINE, size: 26, colour: t.mutedForeground, dir: 'ltr' })
  if (!meta) return svg + line(SITE_NAME, { x: RIGHT, y: FOOTER_BASELINE, size: 26, colour: t.mutedForeground })

  let right = RIGHT
  if (meta.glyph) {
    svg += glyph(meta.glyph, { x: right - 30, y: FOOTER_BASELINE - 25, size: 30, colour: t.primary })
    right -= 42
  }
  if (meta.label) {
    const label = clean(meta.label)
    svg += line(label, { x: right, y: FOOTER_BASELINE, size: 26, colour: t.mutedForeground })
    right -= measureLine(label, 26) + 12
  }
  return svg + line(clean(meta.value), { x: right, y: FOOTER_BASELINE, size: 28, weight: 700, colour: t.foreground })
}

/** The artwork on the left of a split card: a module icon, the site emblem, a figure, or a route line. */
function artwork(t, art, centreY) {
  const x = PAD
  const y = Math.round(centreY - TILE / 2)
  // The emblem is dark green, so its tile is light in both colourways.
  const surface = art.type === 'emblem' ? '#F1F3EF' : t.name === 'dark' ? t.card : '#FFFFFF'
  const frame =
    `<rect x="${x}" y="${y}" width="${TILE}" height="${TILE}" rx="52" ${paint('fill', surface)}/>` +
    `<rect x="${x + 1}" y="${y + 1}" width="${TILE - 2}" height="${TILE - 2}" rx="51" fill="none" ${paint('stroke', alpha(t.foreground, 0.12))} stroke-width="2"/>`
  const centre = x + TILE / 2

  if (art.type === 'icon') {
    const size = 152
    return frame + icon(art.icon, t, { x: centre - size / 2, y: y + (TILE - size) / 2, size })
  }

  if (art.type === 'emblem') {
    const size = 150
    return frame + `<image x="${centre - size / 2}" y="${y + (TILE - size) / 2}" width="${size}" height="${size}" href="${asset('public/assets/favicon.png', 'image/png')}"/>`
  }

  if (art.type === 'figure') {
    const value = fitText(String(art.value), { maxWidth: TILE - 56, maxLines: 1, maxSize: 116, minSize: 56, weight: 700 })
    const label = fitText(art.label, { maxWidth: TILE - 40, maxLines: 1, maxSize: 30, minSize: 22 })
    return (
      frame +
      line(value.lines[0], { x: centre, y: y + TILE / 2 + value.size * 0.2, size: value.size, weight: 700, colour: t.primary, anchor: 'middle' }) +
      line(label.lines[0], { x: centre, y: y + TILE - 44, size: label.size, colour: t.mutedForeground, anchor: 'middle' })
    )
  }

  if (art.type === 'route') {
    // A stylised line with three stops, in the route's own colour.
    const colour = art.colour
    const left = x + 62
    const right = x + TILE - 62
    const top = y + 72
    const bottom = y + TILE - 72
    const bend = 30
    const path = `M ${right} ${top} H ${left + bend} a ${bend} ${bend} 0 0 0 0 ${bend * 2} H ${right - bend} a ${bend} ${bend} 0 0 1 0 ${bottom - top - bend * 2} H ${left}`
    const stop = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="15" ${paint('fill', surface)} stroke="${colour}" stroke-width="9"/>`
    return (
      frame +
      `<path d="${path}" fill="none" stroke="${colour}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>` +
      stop(right, top) + stop(centre, top + bend * 2) + stop(left, bottom)
    )
  }

  throw new Error(`unknown artwork type: ${art.type}`)
}

const AVATAR = 92

/** A person row: round photo (or an initial) with a name and a role beside it. */
function person(t, who, { right, top, maxWidth }) {
  const cx = right - AVATAR / 2
  const cy = top + AVATAR / 2
  const ring = `<circle cx="${cx}" cy="${cy}" r="${AVATAR / 2 - 1}" fill="none" ${paint('stroke', alpha(t.foreground, 0.18))} stroke-width="2"/>`
  const name = clean(who.name)
  const portrait = who.image
    ? `<defs><clipPath id="avatar"><circle cx="${cx}" cy="${cy}" r="${AVATAR / 2}"/></clipPath></defs>` +
      `<image x="${right - AVATAR}" y="${top}" width="${AVATAR}" height="${AVATAR}" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar)" href="${who.image}"/>`
    : `<circle cx="${cx}" cy="${cy}" r="${AVATAR / 2}" ${paint('fill', alpha(t.primary, 0.2))}/>` +
      line([...name][0] ?? '', { x: cx, y: cy + 16, size: 46, weight: 700, colour: t.primary, anchor: 'middle' })

  const textRight = right - AVATAR - 24
  const textWidth = maxWidth - AVATAR - 24
  const nameFit = fitText(name, { maxWidth: textWidth, maxLines: 1, maxSize: 36, minSize: 28, weight: 700 })
  if (!who.role) {
    return portrait + ring + line(nameFit.lines[0], { x: textRight, y: cy + 13, size: nameFit.size, weight: 700, colour: t.foreground })
  }
  const role = fitText(who.role, { maxWidth: textWidth, maxLines: 1, maxSize: 27, minSize: 27 })
  return (
    portrait + ring +
    line(nameFit.lines[0], { x: textRight, y: top + 39, size: nameFit.size, weight: 700, colour: t.foreground }) +
    line(role.lines[0], { x: textRight, y: top + 79, size: role.size, colour: t.mutedForeground })
  )
}

/** Stacks a column of text lines; returns its height and a draw function. */
function textBlock(fit, { leading, colour, weight }) {
  const advance = fit.size * leading
  return {
    height: fit.size * 1.1 + (fit.lines.length - 1) * advance,
    draw: (top) => fit.lines.map((text, i) => line(text, { x: RIGHT, y: top + fit.size * 0.86 + i * advance, size: fit.size, weight, colour })).join(''),
  }
}

function splitCard(m, t) {
  const columnWidth = RIGHT - PAD - (m.art ? TILE + TILE_GAP : 0)
  const isRecord = Boolean(m.pills?.length || m.person)
  const bodyHeight = BODY_BOTTOM - BODY_TOP

  // Everything except the title has a fixed height, so measure those first and
  // then give the title the largest size that still lets the stack fit.
  const fixed = []
  if (m.pills?.length) {
    const items = m.pills.map((p) => pill(t, { label: clean(p.label), tone: p.tone ?? 'soft', glyph: p.glyph, size: 26 }))
    fixed.push({ slot: 'pills', height: items[0].height, gap: 24, draw: (top) => flow(items, { right: RIGHT, top }) })
  }
  if (m.subtitle) {
    const fit = noteCut(fitText(m.subtitle, { maxWidth: columnWidth, maxLines: 2, maxSize: isRecord ? 32 : 38, minSize: isRecord ? 28 : 32, singleLineMin: isRecord ? 28 : 32 }), 'subtitle')
    fixed.push({ slot: 'subtitle', gap: 30, ...textBlock(fit, { leading: 1.5, colour: t.mutedForeground, weight: 400 }) })
  }
  if (m.person) {
    fixed.push({ slot: 'person', height: AVATAR, gap: 28, draw: (top) => person(t, m.person, { right: RIGHT, top, maxWidth: columnWidth }) })
  }
  if (m.cta) {
    const button = pill(t, { label: clean(m.cta), tone: 'primary', size: 30, weight: 700, glyph: 'ArrowLeft', markAtEnd: true })
    fixed.push({ slot: 'cta', height: button.height, gap: 0, draw: (top) => button.draw(RIGHT, top) })
  }

  const titleGap = m.subtitle ? 20 : 28
  const fixedHeight = fixed.reduce((sum, block) => sum + block.height + block.gap, 0)
  const maxSize = m.titleSize ?? (isRecord ? 70 : 104)
  const minSize = isRecord ? 44 : 56
  const maxLines = m.titleLines ?? (isRecord ? 3 : 2)
  // A page name reads best on one line; a record title is a sentence, so it
  // wraps rather than shrink far.
  const singleLineMin = Math.round(maxSize * (isRecord ? 0.86 : 0.7))

  const attempt = (size, lines) => {
    const fit = fitText(m.title, { maxWidth: columnWidth, maxLines: lines, maxSize: size, minSize: size, weight: 700 })
    const block = textBlock(fit, { leading: 1.3, colour: t.foreground, weight: 700 })
    return { fit, block, ok: !fit.truncated && block.height + titleGap + fixedHeight <= bodyHeight }
  }
  let chosen = null
  for (let size = maxSize; size >= singleLineMin && !chosen; size -= 2) {
    const tried = attempt(size, 1)
    if (tried.ok) chosen = tried
  }
  for (let size = maxSize; size >= minSize && !chosen; size -= 2) {
    const tried = attempt(size, maxLines)
    if (tried.ok) chosen = tried
  }
  chosen ??= attempt(minSize, maxLines)
  noteCut(chosen.fit, 'title')
  const title = chosen.block

  // Reading order, top to bottom: pills, title, then whatever supports it.
  const pills = fixed.filter((block) => block.slot === 'pills')
  const rest = fixed.filter((block) => block.slot !== 'pills')
  const stack = [...pills, { ...title, gap: titleGap }, ...rest]
  stack[stack.length - 1].gap = 0

  const total = stack.reduce((sum, block) => sum + block.height + block.gap, 0)
  const centreY = (BODY_TOP + BODY_BOTTOM) / 2
  let top = Math.max(BODY_TOP, Math.round(centreY - total / 2))
  let body = ''
  for (const block of stack) {
    body += block.draw(top)
    top += block.height + block.gap
  }

  return (
    svgOpen +
    ground(t) +
    header(t, { kicker: m.kicker }) +
    (m.art ? artwork(t, m.art, centreY) : '') +
    body +
    footer(t, { url: m.url, meta: m.meta }) +
    '</svg>'
  )
}

const WORDMARK_RATIO = 570.55 / 298.43

function brandCard(m, t) {
  const markHeight = 196
  const centre = (WIDTH - ACCENT) / 2
  const title = noteCut(fitText(m.title ?? SITE_NAME, { maxWidth: WIDTH - PAD * 4, maxLines: 1, maxSize: 76, minSize: 48, weight: 700 }), 'title')
  const tagline = noteCut(fitText(m.subtitle ?? 'منصة سورية مفتوحة المصدر', { maxWidth: WIDTH - PAD * 4, maxLines: 1, maxSize: 40, minSize: 30 }), 'subtitle')
  return (
    svgOpen +
    ground(t) +
    wordmark(t, { right: centre + (markHeight * WORDMARK_RATIO) / 2, top: 84, height: markHeight }) +
    line(title.lines[0], { x: centre, y: 392, size: title.size, weight: 700, colour: t.foreground, anchor: 'middle' }) +
    line(tagline.lines[0], { x: centre, y: 456, size: tagline.size, colour: t.mutedForeground, anchor: 'middle' }) +
    `<rect x="${PAD}" y="${FOOTER_RULE}" width="${RIGHT - PAD}" height="2" ${paint('fill', alpha(t.foreground, 0.1))}/>` +
    line(m.url ?? 'syrian.zone', { x: centre, y: FOOTER_BASELINE, size: 28, weight: 700, colour: t.primary, dir: 'ltr', anchor: 'middle' }) +
    '</svg>'
  )
}

function photoCard(m, t) {
  const title = noteCut(fitText(m.title, { maxWidth: RIGHT - PAD, maxLines: 2, maxSize: 88, minSize: 54, weight: 700, singleLineMin: 62 }), 'title')
  const leading = title.size * 1.28
  const titleHeight = title.size * 1.1 + (title.lines.length - 1) * leading
  const pills = (m.pills ?? []).map((p) => pill(t, { label: clean(p.label), tone: 'glass', glyph: p.glyph, size: 26 }))
  // Bottom row: the address on the left, the pills on the right. The name sits above it.
  const rowHeight = pills[0]?.height ?? 50
  const rowTop = HEIGHT - 44 - rowHeight
  const titleTop = rowTop - 18 - titleHeight

  return (
    svgOpen +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="#0D1315"/>` +
    `<image width="${WIDTH}" height="${HEIGHT}" preserveAspectRatio="xMidYMid slice" href="${m.photo}"/>` +
    // Darkens the top for the wordmark and the bottom for the name, and leaves
    // the middle of the photograph almost untouched.
    `<defs><linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#000" stop-opacity="0.66"/><stop offset="0.28" stop-color="#000" stop-opacity="0.1"/>` +
    `<stop offset="0.48" stop-color="#000" stop-opacity="0.26"/><stop offset="1" stop-color="#000" stop-opacity="0.94"/></linearGradient></defs>` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#scrim)"/>` +
    `<rect x="${WIDTH - ACCENT}" width="${ACCENT}" height="${HEIGHT}" ${paint('fill', theme('dark').primary)}/>` +
    header(t, { kicker: m.kicker, onPhoto: true }) +
    title.lines.map((text, i) => line(text, { x: RIGHT, y: titleTop + title.size * 0.86 + i * leading, size: title.size, weight: 700, colour: '#FFFFFF' })).join('') +
    (pills.length ? flow(pills, { right: RIGHT, top: rowTop }) : '') +
    (m.url ? line(m.url, { x: PAD, y: rowTop + rowHeight / 2 + 9, size: 26, colour: '#FFFFFFD9', dir: 'ltr' }) : '') +
    '</svg>'
  )
}
