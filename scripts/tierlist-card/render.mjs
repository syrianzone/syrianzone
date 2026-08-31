// Renders the weekly/monthly top-3 and bottom-3 tierlist cards as PNGs plus
// caption files, one per group, from the public leaderboard API. The images
// are meant for the @SyrianZone X account after a human approves them.
//
// Zero npm dependencies: node fetch + system chromium's --screenshot.
// Chromium from snap cannot write outside $HOME, so keep --out under it.
//
// usage:
//   node scripts/tierlist-card/render.mjs --period weekly
//   node scripts/tierlist-card/render.mjs --period monthly --groups ministers
//   optional: --handles map.json (name -> handle overrides while the API
//   still lacks x_handle), --base-url, --out, --chrome

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

// ***** arguments *****

const args = {}
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1]
}

const PERIOD = args.period === 'monthly' ? 'monthly' : 'weekly'
const BASE_URL = (args['base-url'] || 'https://syrian.zone').replace(/\/$/, '')
const OUT_DIR = resolve(args.out || join(HERE, 'out'))
const GROUPS = (args.groups || 'ministers,governors,security').split(',')
const HANDLE_OVERRIDES = args.handles ? JSON.parse(readFileSync(args.handles, 'utf8')) : {}

const GROUP_LABELS = { ministers: 'الحكومة', governors: 'المحافظون', security: 'مسؤولو الأمن' }

// Levantine month names, used in Syria.
const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول']

function damascusNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Damascus' }))
}

function periodLabel() {
  if (PERIOD === 'weekly') return 'لهذا الأسبوع'
  return `لشهر ${MONTHS[damascusNow().getMonth()]}`
}

function chromeBinary() {
  const candidates = [args.chrome, process.env.CHROME_BIN, 'chromium-browser', 'chromium', 'google-chrome']
  for (const name of candidates.filter(Boolean)) {
    try {
      execFileSync('which', [name], { stdio: 'pipe' })
      return name
    } catch { /* keep looking */ }
  }
  throw new Error('no chromium found; pass --chrome or set CHROME_BIN')
}

// ***** data *****

async function fetchLeaderboard() {
  const response = await fetch(`${BASE_URL}/api/polls/best-ministers/leaderboard`)
  if (!response.ok) throw new Error(`leaderboard fetch failed: ${response.status}`)
  return response.json()
}

async function fetchDataUrl(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'syrianzone-card-renderer' } })
  if (!response.ok) throw new Error(`image fetch failed ${response.status}: ${url}`)
  const type = response.headers.get('content-type') || 'image/jpeg'
  const bytes = Buffer.from(await response.arrayBuffer())
  return `data:${type};base64,${bytes.toString('base64')}`
}

function pick(rows) {
  if (rows.length < 6) throw new Error(`group has only ${rows.length} candidates`)
  return { top: rows.slice(0, 3), bottom: rows.slice(-3).reverse() }
}

function handleOf(row) {
  return row.xHandle || HANDLE_OVERRIDES[row.name] || null
}

// ***** caption *****

// X weighs a URL as 23 characters regardless of length.
function weightedLength(text) {
  return [...text.replace(/https?:\/\/\S+/g, 'x'.repeat(23))].length
}

function captionLine(row, index, withTitle, withHandle) {
  const handle = handleOf(row)
  const parts = [
    row.name,
    withTitle ? row.title : null,
    withHandle && handle ? `@${handle}` : null,
  ].filter(Boolean)
  return `${index + 1}. ${parts.join(' ')}`
}

function caption(top, bottom) {
  const label = periodLabel()
  const compose = (withTitle, withHandle) => [
    `الأعلى تقييماً ${label}`,
    ...top.map((row, index) => captionLine(row, index, withTitle, withHandle)),
    `الأقل تقييماً ${label}`,
    ...bottom.map((row, index) => captionLine(row, index, withTitle, withHandle)),
    '',
    'صوّت الآن:',
    'https://syrian.zone/tierlist',
  ].join('\n')

  // The posts go out unattended, so the caption must fit a standard account.
  // Titles go first (the image shows them), handles only as a last resort.
  for (const [withTitle, withHandle] of [[true, true], [false, true], [false, false]]) {
    const text = compose(withTitle, withHandle)
    if (weightedLength(text) <= 280) return text
  }
  return compose(false, false)
}

// ***** template *****

const FONT = (name) => readFileSync(join(HERE, 'fonts', name)).toString('base64')
const LOGO = readFileSync(join(HERE, '..', '..', 'public', 'assets', 'logo-darkmode.svg'), 'utf8')

function personRow(row, index, tone) {
  const handle = handleOf(row)
  return `
  <div class="person ${tone}">
    <div class="rank">${index + 1}</div>
    <img class="photo" src="${row.photo}" alt="">
    <div class="who">
      <div class="name">${row.name}</div>
      <div class="title">${row.title ?? ''}</div>
      ${handle ? `<div class="handle">@${handle}</div>` : ''}
    </div>
    <div class="score">${row.avg}</div>
  </div>`
}

function html(groupKey, top, bottom) {
  const date = damascusNow()
  const dateLabel = `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
  return `<!doctype html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>
  @font-face { font-family: AlJazeera; font-weight: 700; src: url(data:font/ttf;base64,${FONT('AlJazeeraArabic-Bold.ttf')}); }
  @font-face { font-family: AlJazeera; font-weight: 400; src: url(data:font/ttf;base64,${FONT('AlJazeeraArabic-Regular.ttf')}); }
  @font-face { font-family: AlJazeera; font-weight: 300; src: url(data:font/ttf;base64,${FONT('AlJazeeraArabic-Light.ttf')}); }
  * { margin: 0; box-sizing: border-box; }
  body { line-height: 1.3; }
  body {
    width: 1080px; height: 1350px; overflow: hidden;
    font-family: AlJazeera, sans-serif; color: #f5f2e9;
    background: radial-gradient(140% 90% at 50% -10%, #14523f 0%, #0b3527 46%, #071f18 100%);
    display: flex; flex-direction: column; padding: 38px 56px 0;
  }
  .header { display: flex; align-items: center; justify-content: space-between; }
  .header svg { width: 190px; height: auto; }
  .head-text { text-align: right; }
  .head-text .kicker { font-weight: 300; font-size: 24px; color: #cfe3d3; letter-spacing: 0.5px; }
  .head-text h1 { font-size: 46px; font-weight: 700; margin-top: 4px; }
  .head-text .period { font-size: 25px; color: #e7d191; margin-top: 6px; }
  .section { margin-top: 22px; border-radius: 26px; padding: 16px 28px 6px;
    background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.09); }
  .section h2 { font-size: 30px; display: flex; align-items: center; gap: 14px; margin-bottom: 6px; }
  .section h2 .dot { width: 16px; height: 16px; border-radius: 50%; display: inline-block; }
  .top h2 { color: #a9e5b8; }   .top .dot { background: #4fd07f; }
  .bottom h2 { color: #f0b2a4; } .bottom .dot { background: #e0654a; }
  .person { display: flex; align-items: center; gap: 22px; padding: 9px 6px; }
  .person + .person { border-top: 1px solid rgba(255,255,255,0.08); }
  .rank { font-size: 38px; font-weight: 700; width: 40px; text-align: center; color: #e7d191; }
  .photo { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 4px solid; }
  .top .photo { border-color: #4fd07f; } .bottom .photo { border-color: #e0654a; }
  .who { flex: 1; min-width: 0; }
  .name { font-size: 32px; font-weight: 700; }
  .title { font-size: 23px; font-weight: 300; color: #cfe3d3; margin-top: 2px; }
  .handle { font-size: 21px; color: #9fc4ad; direction: ltr; text-align: right; margin-top: 2px; }
  .score { font-size: 30px; font-weight: 700; color: #e7d191; background: rgba(231,209,145,0.12);
    border: 1px solid rgba(231,209,145,0.35); border-radius: 16px; padding: 6px 18px; }
  .footer { margin-top: auto; display: flex; align-items: center; justify-content: space-between;
    padding: 18px 4px 28px; font-size: 26px; }
  .footer .vote { color: #e7d191; font-weight: 700; }
  .footer .site { direction: ltr; color: #cfe3d3; }
</style></head>
<body>
  <div class="header">
    <div class="head-text">
      <div class="kicker">تقييم الحكومة السورية · ${GROUP_LABELS[groupKey]}</div>
      <h1>الأعلى والأقل تقييماً</h1>
      <div class="period">${periodLabel()} · ${dateLabel}</div>
    </div>
    ${LOGO}
  </div>
  <div class="section top">
    <h2><span class="dot"></span>الأعلى تقييماً</h2>
    ${top.map((row, index) => personRow(row, index, 'top')).join('')}
  </div>
  <div class="section bottom">
    <h2><span class="dot"></span>الأقل تقييماً</h2>
    ${bottom.map((row, index) => personRow(row, index, 'bottom')).join('')}
  </div>
  <div class="footer">
    <div class="vote">صوّت الآن</div>
    <div class="site">syrian.zone/tierlist</div>
  </div>
</body></html>`
}

// ***** main *****

const leaderboard = await fetchLeaderboard()
const chrome = chromeBinary()
mkdirSync(OUT_DIR, { recursive: true })

for (const groupKey of GROUPS) {
  const rows = leaderboard[groupKey]
  if (!rows) throw new Error(`unknown group ${groupKey}`)
  const { top, bottom } = pick(rows)

  for (const row of [...top, ...bottom]) {
    row.photo = await fetchDataUrl(row.imageUrl)
  }

  const page = join(OUT_DIR, `${groupKey}-${PERIOD}.html`)
  const png = join(OUT_DIR, `${groupKey}-${PERIOD}.png`)
  writeFileSync(page, html(groupKey, top, bottom))
  execFileSync(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=2', '--window-size=1080,1350',
    `--screenshot=${png}`, page,
  ], { stdio: 'pipe' })
  rmSync(page)

  writeFileSync(join(OUT_DIR, `${groupKey}-${PERIOD}.txt`), caption(top, bottom))
  console.log(`${groupKey}: ${png}`)
}
