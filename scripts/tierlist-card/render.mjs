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
    withHandle && handle ? `(@${handle})` : null,
  ].filter(Boolean)
  return `${index + 1}. ${parts.join(' ')}`
}

function caption(top, bottom) {
  const label = periodLabel()
  // The vote call and link live in the image footer, not the tweet text.
  const compose = (withTitle, withHandle) => [
    `الأعلى تقييماً ${label}`,
    ...top.map((row, index) => captionLine(row, index, withTitle, withHandle)),
    '',
    `الأقل تقييماً ${label}`,
    // Names only for the bottom three: tagging someone on a bad ranking is not our style.
    ...bottom.map((row, index) => captionLine(row, index, withTitle, false)),
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

const ROOT = resolve(HERE, '..', '..')
const TOKENS = JSON.parse(readFileSync(join(ROOT, 'resources', 'og', 'tokens.json'), 'utf8'))
const FONT_WOFF2 = (relPath) => readFileSync(join(ROOT, 'public', 'fonts', relPath)).toString('base64')
const LOGO = readFileSync(join(ROOT, 'public', 'assets', 'logo-darkmode.svg'), 'utf8')

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function personRow(row, index, tone) {
  const handle = handleOf(row)
  return `
  <div class="person ${tone}">
    <div class="rank">${index + 1}</div>
    <img class="photo" src="${row.photo}" alt="">
    <div class="who">
      <div class="name">${escapeHtml(row.name)}</div>
      <div class="title">${escapeHtml(row.title ?? '')}</div>
      ${handle ? `<div class="handle">@${escapeHtml(handle)}</div>` : ''}
    </div>
    <div class="score">${escapeHtml(row.avg)}</div>
  </div>`
}

function html(groupKey, top, bottom) {
  const t = TOKENS.dark
  const date = damascusNow()
  const dateLabel = `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
  const groupLabel = GROUP_LABELS[groupKey] || groupKey
  return `<!doctype html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>
  @font-face {
    font-family: 'Beiruti';
    font-weight: 200 900;
    font-style: normal;
    src: url(data:font/woff2;base64,${FONT_WOFF2('beiruti/Beiruti-VariableFont_wght.woff2')}) format('woff2');
  }
  @font-face {
    font-family: 'IBM Plex Sans Arabic';
    font-weight: 400 500;
    font-style: normal;
    src: url(data:font/woff2;base64,${FONT_WOFF2('ibm-plex-sans-arabic/ibm-plex-sans-arabic-regular.woff2')}) format('woff2');
  }
  @font-face {
    font-family: 'IBM Plex Sans Arabic';
    font-weight: 600 700;
    font-style: normal;
    src: url(data:font/woff2;base64,${FONT_WOFF2('ibm-plex-sans-arabic/ibm-plex-sans-arabic-bold.woff2')}) format('woff2');
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    position: relative;
    width: 1080px;
    height: 1350px;
    overflow: hidden;
    font-family: 'IBM Plex Sans Arabic', sans-serif;
    line-height: 1.35;
    color: ${t.foreground};
    background: linear-gradient(180deg, ${t.card} 0%, ${t.background} 22%, ${t.background} 100%);
    display: flex;
    flex-direction: column;
    padding: 40px 64px 0 56px;
  }
  /* Madar signature: 12px RTL right-edge primary rail + saffron node notch */
  .rail {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 12px;
    background: ${t.primary};
  }
  .rail-notch {
    position: absolute;
    top: 48px;
    right: 0;
    width: 12px;
    height: 44px;
    background: ${t.node};
  }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 22px;
    border-bottom: 1px solid ${t.border};
  }
  .topbar svg {
    height: 60px;
    width: auto;
    display: block;
  }
  .module-pill {
    font-size: 23px;
    font-weight: 700;
    color: ${t.primary};
    background: ${t.card};
    border: 1px solid ${t.border};
    border-radius: 999px;
    padding: 9px 24px;
    white-space: nowrap;
  }
  .hero {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 24px;
    margin-top: 26px;
    margin-bottom: 22px;
  }
  .hero h1 {
    font-family: 'Beiruti', 'IBM Plex Sans Arabic', sans-serif;
    font-size: 54px;
    font-weight: 800;
    line-height: 1.1;
    color: ${t.foreground};
  }
  .hero .period {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 23px;
    white-space: nowrap;
  }
  .hero .period-name {
    font-weight: 700;
    color: ${t.node};
  }
  .hero .period-sep {
    color: ${t.border};
  }
  .hero .period-date {
    color: ${t.mutedForeground};
  }
  .sections {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 22px;
    min-height: 0;
  }
  .section {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-radius: 22px;
    padding: 20px 28px 14px;
    background: ${t.card};
    border: 1px solid ${t.border};
  }
  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 12px;
    margin-bottom: 4px;
    border-bottom: 1px solid ${t.border};
  }
  .section h2 {
    font-family: 'Beiruti', 'IBM Plex Sans Arabic', sans-serif;
    font-size: 32px;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 12px;
    line-height: 1.15;
  }
  .section h2 .bar {
    width: 6px;
    height: 26px;
    border-radius: 999px;
    display: inline-block;
  }
  .section-tag {
    font-size: 19px;
    font-weight: 600;
    color: ${t.mutedForeground};
  }
  .top h2 { color: ${t.node}; }
  .top .bar { background: ${t.node}; }
  .bottom h2 { color: ${t.destructive}; }
  .bottom .bar { background: ${t.destructive}; }
  .person {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 13px 4px;
  }
  .person + .person {
    border-top: 1px solid ${t.border};
  }
  .rank {
    font-family: 'Beiruti', 'IBM Plex Sans Arabic', sans-serif;
    font-size: 40px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    width: 38px;
    text-align: center;
    line-height: 1;
  }
  .top .rank { color: ${t.node}; }
  .bottom .rank { color: ${t.destructive}; }
  .photo {
    width: 88px;
    height: 88px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid ${t.border};
    flex-shrink: 0;
  }
  .top .photo { border-color: ${t.node}; }
  .bottom .photo { border-color: ${t.destructive}; }
  .who {
    flex: 1;
    min-width: 0;
  }
  .name {
    font-size: 30px;
    font-weight: 700;
    color: ${t.foreground};
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .title {
    font-size: 22px;
    font-weight: 400;
    color: ${t.mutedForeground};
    margin-top: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .handle {
    font-size: 19px;
    color: ${t.primary};
    direction: ltr;
    text-align: right;
    margin-top: 2px;
  }
  .score {
    font-family: 'Beiruti', 'IBM Plex Sans Arabic', sans-serif;
    font-size: 32px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    background: ${t.secondary};
    border: 1px solid ${t.border};
    border-radius: 14px;
    padding: 8px 20px;
    min-width: 96px;
    text-align: center;
    line-height: 1.1;
  }
  .top .score { color: ${t.node}; border-color: ${t.node}; }
  .bottom .score { color: ${t.destructive}; border-color: ${t.destructive}; }
  .footer {
    margin-top: 26px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 0 32px;
    border-top: 1px solid ${t.border};
    font-size: 24px;
  }
  .footer .cta {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .footer .vote {
    color: ${t.node};
    font-weight: 700;
  }
  .footer .brand-name {
    color: ${t.mutedForeground};
    font-weight: 400;
  }
  .footer .site {
    direction: ltr;
    color: ${t.primary};
    font-weight: 700;
    letter-spacing: 0.2px;
  }
</style></head>
<body>
  <div class="rail"></div>
  <div class="rail-notch"></div>
  <div class="topbar">
    ${LOGO}
    <div class="module-pill">تقييم الحكومة · ${escapeHtml(groupLabel)}</div>
  </div>
  <div class="hero">
    <h1>الأعلى والأقل تقييماً</h1>
    <div class="period">
      <span class="period-name">${escapeHtml(periodLabel())}</span>
      <span class="period-sep">·</span>
      <span class="period-date">${escapeHtml(dateLabel)}</span>
    </div>
  </div>
  <div class="sections">
    <div class="section top">
      <div class="section-head">
        <h2><span class="bar"></span>الأعلى تقييماً</h2>
        <span class="section-tag">أعلى 3 تقييمات</span>
      </div>
      ${top.map((row, index) => personRow(row, index, 'top')).join('')}
    </div>
    <div class="section bottom">
      <div class="section-head">
        <h2><span class="bar"></span>الأقل تقييماً</h2>
        <span class="section-tag">أدنى 3 تقييمات</span>
      </div>
      ${bottom.map((row, index) => personRow(row, index, 'bottom')).join('')}
    </div>
  </div>
  <div class="footer">
    <div class="cta">
      <span class="vote">صوّت الآن</span>
      <span class="brand-name">· المساحة السورية</span>
    </div>
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
