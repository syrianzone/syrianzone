// Turns the page table (resources/data/seo.json, one record per public page) and
// the card artwork (resources/og/cards.json) into card models.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './engine.mjs'

const HOST = 'syrian.zone'

/** Every fixed-page card, as listed in resources/og/cards.json. */
export function readCards() {
  return JSON.parse(readFileSync(join(ROOT, 'resources', 'og', 'cards.json'), 'utf8')).cards
}

/** Every public page, as listed in resources/data/seo.json. */
export function readPages() {
  return JSON.parse(readFileSync(join(ROOT, 'resources', 'data', 'seo.json'), 'utf8')).pages
}

/** The paths that use a card, in page-table order. */
export function cardPaths(slug) {
  return readPages().filter((page) => page.card === slug).map((page) => page.path)
}

/** The card model for one cards.json entry. */
export function pageModel(entry, theme = 'dark') {
  const [path] = cardPaths(entry.slug)
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
