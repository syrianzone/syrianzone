// Builds a contact sheet of every share card, for reviewing the design.
//
//   node scripts/og/preview.mjs [--out dir] [--samples file.json] [--meta file.json]
//
// Fixed pages come from resources/data/seo.json (paths) and
// resources/og/cards.json (artwork). Record cards (promises,
// places, routes, ...) need data, so they are drawn from a samples file;
// preview-samples.json is used unless another is given:
//
//   [{ "group": "Promises", "note": "...", "items": [{ "name": "...", "model": {...},
//       "meta": { "title": "...", "description": "...", "url": "..." }, "jpeg": false }] }]
//
// `--meta` maps a page path to the title and description its link preview
// shows, so the sheet can mock the whole chat bubble and not only the image.
// Every card is drawn in both colourways; the page has a switch between them.
// Serve the output folder over HTTP to view it (for example
// `python3 -m http.server --directory storage/app/og-preview`).

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { drawCard } from './lib/cards.mjs'
import { init, renderPng, ROOT } from './lib/engine.mjs'
import { cardPaths, pageModel, readCards } from './lib/pages.mjs'

const args = {}
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1]

const OUT = resolve(args.out ?? join(ROOT, 'storage', 'app', 'og-preview'))
const samples = JSON.parse(readFileSync(args.samples ?? join(ROOT, 'scripts', 'og', 'preview-samples.json'), 'utf8'))
const meta = args.meta ? JSON.parse(readFileSync(args.meta, 'utf8')) : {}

const THEMES = ['dark', 'light']
const escapeHtml = (text) => String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

/** Photo cards are served as JPEG; PHP's GD does that in the app, so it does here too. */
function toJpeg(png, jpg) {
  execFileSync('php', ['-r', 'imagejpeg(imagecreatefromstring(file_get_contents($argv[1])), $argv[2], 84);', png, jpg])
}

function draw(model, file, { jpeg = false } = {}) {
  const files = {}
  for (const name of THEMES) {
    // A photograph looks the same in both colourways, so it is drawn once.
    if (model.kind === 'photo' && model.photo && name === 'light') {
      files.light = files.dark
      continue
    }
    const png = join(OUT, `${file}-${name}.png`)
    writeFileSync(png, renderPng(drawCard({ ...model, theme: name })))
    if (jpeg) {
      const jpg = png.replace(/\.png$/, '.jpg')
      toJpeg(png, jpg)
      rmSync(png)
      files[name] = { src: `${file}-${name}.jpg`, bytes: statSync(jpg).size }
    } else {
      files[name] = { src: `${file}-${name}.png`, bytes: statSync(png).size }
    }
  }
  return files
}

await init()
mkdirSync(OUT, { recursive: true })

const groups = []

const fixed = readCards().map((entry) => {
  const paths = cardPaths(entry.slug)
  const path = paths[0]
  const preview = meta[path] ?? {}
  return {
    name: paths.length ? paths.join('  ') : `(${entry.slug})`,
    files: draw(pageModel(entry), `page-${entry.slug}`),
    title: preview.title ?? entry.title,
    description: preview.description ?? entry.subtitle,
    url: path ? `syrian.zone${path === '/' ? '' : path}` : entry.url,
  }
})
groups.push({ group: 'Fixed pages', note: `${fixed.length} cards, one per page`, items: fixed })

for (const [g, { group, note, items }] of samples.entries()) {
  groups.push({
    group,
    note,
    items: items.map((item, i) => ({
      name: item.name,
      files: draw(item.model, `sample-${g}-${i}`, { jpeg: item.jpeg }),
      title: item.meta?.title ?? item.model.title,
      description: item.meta?.description ?? '',
      url: item.meta?.url ?? item.model.url,
    })),
  })
}

const total = groups.reduce((sum, { items }) => sum + items.length, 0)
const kb = (bytes) => `${Math.round(bytes / 1024)} KB`

const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Share card matrix</title>
<style>
  :root { color-scheme: light dark; --bg: #f4f4f1; --fg: #151515; --muted: #666; --line: #d9d9d4; --panel: #fff; --bubble: #e7ffdb; }
  @media (prefers-color-scheme: dark) { :root { --bg: #121517; --fg: #f2f2f2; --muted: #9aa3a8; --line: #2a3033; --panel: #1b2023; --bubble: #134d37; } }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0 16px 80px; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  header { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 12px 20px; align-items: center; padding: 14px 0; background: var(--bg); border-bottom: 1px solid var(--line); }
  h1 { margin: 0; font-size: 18px; }
  header p { margin: 0; color: var(--muted); }
  .controls { display: flex; flex-wrap: wrap; gap: 8px; margin-inline-start: auto; }
  button { font: inherit; padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; background: var(--panel); color: var(--fg); cursor: pointer; }
  button[aria-pressed="true"] { background: var(--fg); color: var(--bg); border-color: var(--fg); }
  h2 { margin: 36px 0 2px; font-size: 16px; }
  h2 + p { margin: 0 0 14px; color: var(--muted); }
  .grid { display: grid; gap: 22px 18px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); }
  body.large .grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 600px), 1fr)); }
  figure { margin: 0; min-width: 0; }
  .frame { position: relative; display: block; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); background: var(--panel); }
  .frame img { display: block; width: 100%; height: auto; aspect-ratio: 1200 / 630; }
  .guides { position: absolute; inset: 0; pointer-events: none; display: none; }
  body.guides .guides { display: block; }
  /* centre square (the crop some apps use for small thumbnails) and the 2:1 crop X uses */
  .guides::before { content: ""; position: absolute; top: 0; bottom: 0; left: 50%; width: 52.5%; transform: translateX(-50%); border-inline: 2px dashed #ff5b5b; }
  .guides::after { content: ""; position: absolute; left: 0; right: 0; top: 2.38%; bottom: 2.38%; border-block: 2px dashed #ffb02e; }
  figcaption { display: flex; justify-content: space-between; gap: 12px; margin-top: 6px; color: var(--muted); font-size: 13px; }
  figcaption code { font: 12px ui-monospace, Menlo, monospace; overflow-wrap: anywhere; }
  .bubble { display: none; width: 300px; max-width: 100%; margin-top: 10px; padding: 4px; border-radius: 10px; background: var(--bubble); direction: rtl; }
  body.chat .bubble { display: block; }
  .bubble img { display: block; width: 100%; border-radius: 7px 7px 0 0; aspect-ratio: 1200 / 630; }
  .bubble div { padding: 6px 8px 8px; background: rgb(0 0 0 / 0.08); border-radius: 0 0 7px 7px; }
  .bubble b { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 14px; line-height: 1.35; }
  .bubble span { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 12.5px; opacity: 0.75; }
  .bubble small { display: block; margin-top: 2px; font-size: 11.5px; opacity: 0.6; direction: ltr; text-align: right; }
</style>
<header>
  <div><h1>Share card matrix</h1><p>${total} cards, drawn by the real renderer at 1200×630.</p></div>
  <div class="controls">
    <button data-theme="dark" aria-pressed="true">Dark</button>
    <button data-theme="light" aria-pressed="false">Light</button>
    <button data-toggle="large" aria-pressed="false">Large</button>
    <button data-toggle="chat" aria-pressed="true">Chat bubble</button>
    <button data-toggle="guides" aria-pressed="false">Crop guides</button>
  </div>
</header>
${groups.map(({ group, note, items }) => `<h2>${escapeHtml(group)}</h2><p>${escapeHtml(note ?? '')}</p>
<div class="grid">
${items.map((item) => `<figure>
  <a class="frame" href="${item.files.dark.src}" target="_blank" rel="noopener"><img loading="lazy" alt="${escapeHtml(item.title)}" src="${item.files.dark.src}" data-dark="${item.files.dark.src}" data-light="${item.files.light.src}"><span class="guides"></span></a>
  <figcaption><code>${escapeHtml(item.name)}</code><span data-dark="${kb(item.files.dark.bytes)}" data-light="${kb(item.files.light.bytes)}">${kb(item.files.dark.bytes)}</span></figcaption>
  <div class="bubble"><img loading="lazy" alt="" src="${item.files.dark.src}" data-dark="${item.files.dark.src}" data-light="${item.files.light.src}"><div><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.description)}</span><small>${escapeHtml(item.url)}</small></div></div>
</figure>`).join('\n')}
</div>`).join('\n')}
<script>
  document.body.classList.add('chat');
  for (const button of document.querySelectorAll('button[data-toggle]')) {
    button.addEventListener('click', () => {
      const on = document.body.classList.toggle(button.dataset.toggle);
      button.setAttribute('aria-pressed', String(on));
    });
  }
  for (const button of document.querySelectorAll('button[data-theme]')) {
    button.addEventListener('click', () => {
      const theme = button.dataset.theme;
      for (const other of document.querySelectorAll('button[data-theme]')) other.setAttribute('aria-pressed', String(other === button));
      for (const img of document.querySelectorAll('img[data-dark]')) img.src = img.dataset[theme];
      for (const link of document.querySelectorAll('a.frame')) link.href = link.querySelector('img').dataset[theme];
      for (const size of document.querySelectorAll('figcaption span[data-dark]')) size.textContent = size.dataset[theme];
    });
  }
</script>
</html>
`

writeFileSync(join(OUT, 'index.html'), html)
console.log(`wrote ${total} cards in ${THEMES.length} colourways to ${OUT}/index.html`)
