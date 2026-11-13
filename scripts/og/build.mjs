// Draws the share card of every fixed page into public/og/.
//
//   node scripts/og/build.mjs            render the cards and public/og/manifest.json
//   node scripts/og/build.mjs --check    fail if they are out of date or any text is cut
//
// The cards are committed, so a page's preview never depends on a renderer
// being available at request time. The manifest records two things:
//
//   recipe   a hash of everything a card is made from (copy, templates, tokens,
//            icons, fonts, artwork). `--check` recomputes it, so editing any of
//            those without rebuilding fails the test suite.
//   cards    a short content hash per card, appended to its URL as `?v=` so a
//            redrawn card is fetched again instead of served from a year-long cache.

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { inspectCard } from './lib/cards.mjs'
import { init, renderPng, ROOT } from './lib/engine.mjs'
import { pageModel, readCards } from './lib/pages.mjs'

const OUT = join(ROOT, 'public', 'og')
const MANIFEST = join(OUT, 'manifest.json')

/** Every file that changes how a card looks. */
const INGREDIENTS = [
  'package.json:@resvg/resvg-wasm',
  'resources/data/seo.json',
  'resources/og/cards.json',
  'resources/og/tokens.json',
  'resources/og/icons.json',
  'scripts/og/lib/cards.mjs',
  'scripts/og/lib/draw.mjs',
  'scripts/og/lib/engine.mjs',
  'scripts/og/lib/pages.mjs',
  'scripts/og/lib/text.mjs',
  'scripts/answers-card/fonts/IBMPlexSansArabic-Regular.ttf',
  'scripts/answers-card/fonts/IBMPlexSansArabic-Bold.ttf',
  'public/assets/logo-darkmode.svg',
  'public/assets/logo-lightmode.svg',
  'public/assets/favicon.png',
]

function recipe() {
  const hash = createHash('sha1')
  for (const ingredient of INGREDIENTS) {
    const [file, dependency] = ingredient.split(':')
    const content = dependency
      ? JSON.parse(readFileSync(join(ROOT, file), 'utf8')).dependencies[dependency]
      : readFileSync(join(ROOT, file))
    hash.update(ingredient).update('\0').update(content).update('\0')
  }
  return hash.digest('hex').slice(0, 16)
}

const check = process.argv.includes('--check')
const cards = readCards()
const problems = []

await init()

const drawn = cards.map((entry) => {
  const { svg, truncated } = inspectCard(pageModel(entry))
  for (const what of truncated) problems.push(`${entry.slug}: the ${what} does not fit and was cut. Shorten it in resources/og/cards.json.`)
  return { slug: entry.slug, svg }
})

if (check) {
  let manifest = null
  try {
    manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  } catch {
    problems.push('public/og/manifest.json is missing or unreadable.')
  }
  if (manifest) {
    if (manifest.recipe !== recipe()) problems.push('The cards in public/og are older than their sources.')
    for (const { slug } of drawn) {
      if (!manifest.cards?.[slug]) problems.push(`${slug}: no card has been built.`)
    }
  }
  if (problems.length) {
    console.error(problems.join('\n'))
    console.error('\nRun `npm run og:build` and commit the result.')
    process.exit(1)
  }
  console.log(`${drawn.length} cards are up to date`)
  process.exit(0)
}

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })
const wanted = new Set(drawn.map(({ slug }) => `${slug}.png`))
for (const file of readdirSync(OUT)) {
  // A card whose page is gone must not linger as a stale, reachable image.
  if (file.endsWith('.png') && !wanted.has(file)) rmSync(join(OUT, file))
}

const versions = {}
for (const { slug, svg } of drawn) {
  const png = renderPng(svg)
  writeFileSync(join(OUT, `${slug}.png`), png)
  versions[slug] = createHash('sha1').update(png).digest('hex').slice(0, 10)
}
writeFileSync(MANIFEST, `${JSON.stringify({ recipe: recipe(), cards: versions }, null, 2)}\n`)
console.log(`wrote ${drawn.length} cards to public/og`)
