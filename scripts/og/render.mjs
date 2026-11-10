// Draws share cards from JSON card models.
//
//   echo '<model json>' | node scripts/og/render.mjs --out card.png
//   echo '[{"out":"a.png","model":{...}}, ...]' | node scripts/og/render.mjs
//
// This is the one entry point both the build (fixed pages) and the application
// (per-record cards, called from PHP) use, so every card comes from the same
// templates. It prints one line per card and exits non-zero on any failure.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drawCard } from './lib/cards.mjs'
import { init, renderPng } from './lib/engine.mjs'

/** Draws one card model to PNG bytes. `init()` must have resolved first. */
export function renderCard(model) {
  return renderPng(drawCard(model))
}

export { init }

async function main() {
  const outFlag = process.argv.indexOf('--out')
  const single = outFlag > -1 ? process.argv[outFlag + 1] : null
  const input = JSON.parse(readFileSync(0, 'utf8'))
  const jobs = single ? [{ out: single, model: input }] : input
  if (!Array.isArray(jobs)) throw new Error('expected a card model with --out, or an array of { out, model }')

  await init()
  for (const { out, model } of jobs) {
    const png = renderCard(model)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, png)
    console.log(`${out} ${png.length}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack ?? String(error))
    process.exit(1)
  })
}
