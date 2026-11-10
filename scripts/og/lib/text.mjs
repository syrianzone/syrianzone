// Text handling for share cards: direction, cleaning, measuring and fitting.
//
// Everything here works from real measurements of the shaped text, never from
// character counts, which are off by a factor of two between Arabic and Latin.

import { FONT_FAMILY, hasGlyph, inkWidth } from './engine.mjs'

// resvg ignores the SVG `direction` attribute and lays every line out with a
// left-to-right base, which puts "في 2026" and "GitHub" on the wrong side of an
// Arabic sentence. Unicode's own isolate characters set the base direction
// instead; they are invisible and the shaper honours them.
const RLI = '⁧'
const LRI = '⁦'
const PDI = '⁩'

export const rtl = (text) => `${RLI}${text}${PDI}`
export const ltr = (text) => `${LRI}${text}${PDI}`

// "@name" in a right-to-left line would otherwise draw as "name@": the sign is
// direction-neutral and follows the paragraph, not the Latin word after it.
const isolateHandle = (word) => (/^[@#][A-Za-z0-9_.-]+[.,:;!?،؛]*$/.test(word) ? ltr(word) : word)

export const escapeXml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const ELLIPSIS = '…'
const REFERENCE_SIZE = 100

/**
 * Makes untrusted text safe to draw: one line, single spaces, and no character
 * the font cannot draw (emoji, rare symbols), which would otherwise show as an
 * empty box. Direction controls are dropped so a title cannot reorder the card.
 */
export function clean(text) {
  const kept = []
  for (const char of String(text ?? '').normalize('NFC')) {
    const code = char.codePointAt(0)
    if (/\s/.test(char)) {
      kept.push(' ')
    } else if ((code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)) {
      continue
    } else if (code === 0x200c || code === 0x200d || hasGlyph(code)) {
      kept.push(char) // joiners are invisible but change Arabic shaping, so they stay
    }
  }
  return kept.join('').replace(/ {2,}/g, ' ').trim()
}

const advances = new Map()

/**
 * Advance width of a run of text at the reference size.
 *
 * The bounding box of the text alone is its ink, which ignores side bearings.
 * Fencing the text between two bars and subtracting the fence leaves the true
 * advance, which is what adds up when words are joined into a line.
 */
function advance(text, weight) {
  const key = `${weight}|${text}`
  let width = advances.get(key)
  if (width === undefined) {
    const measure = (content) =>
      inkWidth(`<text x="4000" y="200" font-family="${FONT_FAMILY}" font-size="${REFERENCE_SIZE}" font-weight="${weight}" text-anchor="middle">${escapeXml(rtl(content))}</text>`)
    width = measure(`|${text}|`) - measure('||')
    advances.set(key, width)
  }
  return width
}

/** Width of a single line of text at the given size and weight. */
export function measureLine(text, size, weight = 400) {
  if (!text) return 0
  const words = text.split(' ')
  const total = words.reduce((sum, word) => sum + advance(word, weight), 0) + (words.length - 1) * advance(' ', weight)
  return (total * size) / REFERENCE_SIZE
}

/** Breaks words greedily into lines no wider than `limit` (measured at the reference size). */
function greedy(widths, space, limit) {
  const lines = [[0]]
  let used = widths[0]
  for (let i = 1; i < widths.length; i++) {
    if (used + space + widths[i] <= limit) {
      lines[lines.length - 1].push(i)
      used += space + widths[i]
    } else {
      lines.push([i])
      used = widths[i]
    }
  }
  return lines
}

/**
 * Splits words into exactly `count` lines so the widest line is as narrow as
 * possible, which evens the lines out and avoids a lone word on the last one.
 */
function balance(widths, space, count, limit) {
  const n = widths.length
  const prefix = [0]
  for (const width of widths) prefix.push(prefix[prefix.length - 1] + width)
  const span = (from, to) => prefix[to] - prefix[from] + (to - from - 1) * space

  // best[k][i]: smallest possible widest-line when the first i words fill k lines
  const best = Array.from({ length: count + 1 }, () => new Array(n + 1).fill(Infinity))
  const cut = Array.from({ length: count + 1 }, () => new Array(n + 1).fill(0))
  best[0][0] = 0
  for (let k = 1; k <= count; k++) {
    for (let i = k; i <= n; i++) {
      for (let j = k - 1; j < i; j++) {
        const line = span(j, i)
        if (line > limit) continue
        const widest = Math.max(best[k - 1][j], line)
        if (widest < best[k][i]) {
          best[k][i] = widest
          cut[k][i] = j
        }
      }
    }
  }
  if (best[count][n] === Infinity) return null

  const lines = []
  for (let k = count, i = n; k > 0; k--) {
    const j = cut[k][i]
    lines.unshift(Array.from({ length: i - j }, (_, offset) => j + offset))
    i = j
  }
  return lines
}

const RTL_LETTER = /[\u0590-\u08FF\uFB1D-\uFEFC]/

/** The longest prefix of a word that fits `limit` with an ellipsis after it. */
function trimWord(word, weight, limit) {
  const chars = [...word]
  // A Latin token keeps its ellipsis on its own right-hand end; left to the
  // paragraph it would jump to the other side and look like a cut beginning.
  const finish = RTL_LETTER.test(word) ? (text) => text : ltr
  let keep = chars.length
  while (keep > 1 && advance(finish(chars.slice(0, keep).join('') + ELLIPSIS), weight) > limit) keep--
  return finish(chars.slice(0, keep).join('') + ELLIPSIS)
}

/**
 * Fits text into a box: the largest size at which it wraps into `maxLines`
 * balanced lines, shrinking down to `minSize`, and ending in an ellipsis only
 * when it still does not fit at the smallest size.
 *
 * `singleLineMin` keeps the text on one line whenever that is possible at that
 * size or larger, instead of wrapping it at a bigger size.
 *
 * @returns {{ size: number, lines: string[], truncated: boolean, width: number }}
 */
export function fitText(text, { maxWidth, maxLines = 2, maxSize, minSize = maxSize, weight = 400, step = 2, singleLineMin }) {
  if (singleLineMin && maxLines > 1) {
    const single = fitText(text, { maxWidth, maxLines: 1, maxSize, minSize: Math.min(maxSize, singleLineMin), weight, step })
    if (!single.truncated) return single
  }

  let words = clean(text).split(' ').filter(Boolean).map(isolateHandle)
  if (words.length === 0) return { size: maxSize, lines: [], truncated: false, width: 0 }

  let widths = words.map((word) => advance(word, weight))
  const space = advance(' ', weight)
  const join = (indexes) => indexes.map((i) => words[i]).join(' ')
  const result = (size, lines, truncated) => ({ size, lines, truncated, width: Math.max(...lines.map((line) => measureLine(line, size, weight))) })

  for (let size = maxSize; size >= minSize; size -= step) {
    const limit = (maxWidth * REFERENCE_SIZE) / size
    if (Math.max(...widths) > limit) continue
    const count = greedy(widths, space, limit).length
    if (count > maxLines) continue
    return result(size, (balance(widths, space, count, limit) ?? greedy(widths, space, limit)).map(join), false)
  }

  // Still too long at the smallest size: keep what fits and end with an ellipsis.
  const size = minSize
  const limit = (maxWidth * REFERENCE_SIZE) / size
  let truncated = false
  if (Math.max(...widths) > limit) {
    // A single token wider than the box (a long Latin name or address) is cut.
    words = words.map((word, i) => (widths[i] > limit ? trimWord(word, weight, limit) : word))
    widths = words.map((word) => advance(word, weight))
    truncated = true
  }
  const all = greedy(widths, space, limit)
  if (all.length <= maxLines) return result(size, all.map(join), truncated)

  const kept = all.slice(0, maxLines)
  const last = kept[kept.length - 1]
  const ellipsis = advance(ELLIPSIS, weight)
  const lastWidth = () => last.reduce((sum, i) => sum + widths[i], 0) + (last.length - 1) * space + ellipsis
  while (last.length > 1 && lastWidth() > limit) last.pop()
  const lines = kept.map(join)
  if (!lines[lines.length - 1].endsWith(ELLIPSIS)) lines[lines.length - 1] += ELLIPSIS
  return result(size, lines, true)
}
