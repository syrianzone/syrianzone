// Turns the entries of resources/og/cards.json (the fixed pages) into card models.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './engine.mjs'

const HOST = 'syrian.zone'

/** Every fixed-page card, as listed in resources/og/cards.json. */
export function readCards() {
  return JSON.parse(readFileSync(join(ROOT, 'resources', 'og', 'cards.json'), 'utf8')).cards
}

/** The card model for one cards.json entry. */
export function pageModel(entry, theme = 'dark') {
  const path = entry.paths[0]
  const url = entry.url ?? (path && path !== '/' ? HOST + path : HOST)
  if (entry.kind === 'brand') {
    return { kind: 'brand', theme, url, title: entry.title, subtitle: entry.subtitle }
  }
  return {
    kind: 'split',
    theme,
    url,
    title: entry.title,
    subtitle: entry.subtitle,
    art: entry.emblem ? { type: 'emblem' } : { type: 'icon', icon: entry.icon },
    cta: entry.cta,
  }
}
