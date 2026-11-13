// Exports the theme tokens the share cards use, read from the app's own CSS.
//
//   node scripts/og/export-tokens.mjs      -> resources/og/tokens.json
//
// Cards are drawn outside the browser, so they cannot read CSS variables. This
// copies the light and dark values out of resources/css/app.css as hex, which
// keeps the cards on the site's palette without a second hand-kept list.
// Re-run after changing a token; a test fails when the JSON is stale.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CSS = join(ROOT, 'resources', 'css', 'app.css')
const OUT = join(ROOT, 'resources', 'og', 'tokens.json')

/** CSS variable -> key in tokens.json. */
const WANTED = {
  '--background': 'background',
  '--foreground': 'foreground',
  '--card': 'card',
  '--muted': 'muted',
  '--muted-foreground': 'mutedForeground',
  '--secondary': 'secondary',
  '--border': 'border',
  '--primary': 'primary',
  '--primary-foreground': 'primaryForeground',
  '--destructive': 'destructive',
  '--destructive-foreground': 'destructiveForeground',
}

/** Colours that live in the logo artwork rather than in a theme token. */
const BRAND = {
  gold: '#988561', // public/syid-assets/materials/logo.ai.svg and pattern.svg
}

function hslToHex(h, s, l) {
  s /= 100
  l /= 100
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const channel = (n) => {
    const value = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    return Math.round(value * 255).toString(16).padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase()
}

/** `203 13.3% 11.8%` or `0 0% 100% / 10%` -> `#RRGGBB` or `#RRGGBBAA`. */
function parseColour(value) {
  const match = value.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+)%)?$/)
  if (!match) return null
  const hex = hslToHex(Number(match[1]), Number(match[2]), Number(match[3]))
  if (match[4] === undefined) return hex
  return hex + Math.round((Number(match[4]) / 100) * 255).toString(16).padStart(2, '0').toUpperCase()
}

/** Declarations of every rule whose selector list equals `selectors`, later rules winning. */
function declarations(css, selectors) {
  const wanted = selectors.join(',')
  const found = {}
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rule[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((part) => part.trim()).join(',')
    if (selector !== wanted) continue
    for (const declaration of rule[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      found[declaration[1]] = declaration[2].trim()
    }
  }
  return found
}

export function readTokens(css = readFileSync(CSS, 'utf8')) {
  const light = declarations(css, [':root'])
  const darkShared = declarations(css, ['[data-scheme="dark"]'])
  const darkOnly = declarations(css, ['[data-theme="dark"]'])

  const pick = (source) => {
    const theme = {}
    for (const [variable, key] of Object.entries(WANTED)) {
      const colour = source[variable] && parseColour(source[variable])
      if (!colour) throw new Error(`token ${variable} is missing or not an HSL triple`)
      theme[key] = colour
    }
    return theme
  }

  return { light: pick(light), dark: pick({ ...light, ...darkShared, ...darkOnly }), brand: BRAND }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(OUT, `${JSON.stringify(readTokens(), null, 2)}\n`)
  console.log('wrote resources/og/tokens.json')
}
