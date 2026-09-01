// Renders a card PNG plus a meta json for each NEW answer on the community
// Q&A (answers.syrian.zone, Apache Answer) so a scheduled workflow can post
// them to the @SyrianZone X account via `answers:post-card`.
//
// Zero npm dependencies: node fetch + system chromium's --screenshot.
// Chromium from snap cannot write outside $HOME, so keep --out under it.
//
// usage:
//   node scripts/answers-card/render.mjs
//   optional: --base-url, --out, --chrome, --lookback-hours, --max, --pages

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

const BASE_URL = (args['base-url'] || 'https://answers.syrian.zone').replace(/\/$/, '')
const OUT_DIR = resolve(args.out || join(HERE, 'out'))
const LOOKBACK_HOURS = parseFloat(args['lookback-hours'] || '48')
// NOTE: the cap counts already-posted answers too (the server skips dupes),
// so a backlog beyond it needs a manual dispatch with a longer lookback.
const MAX_CARDS = parseInt(args.max || '20', 10)
const PAGES = parseInt(args.pages || '2', 10)

// Levantine month names, used in Syria.
const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول']

function damascusDate(unixSeconds) {
  return new Date(new Date(unixSeconds * 1000).toLocaleString('en-US', { timeZone: 'Asia/Damascus' }))
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

async function fetchApi(path) {
  const response = await fetch(`${BASE_URL}${path}`)
  if (!response.ok) throw new Error(`api fetch failed ${response.status}: ${path}`)
  const body = await response.json()
  if (body.code !== 200) throw new Error(`api error ${body.code}: ${path}`)
  return body.data
}

async function fetchDataUrl(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'syrianzone-card-renderer' } })
  if (!response.ok) throw new Error(`image fetch failed ${response.status}: ${url}`)
  const type = response.headers.get('content-type') || 'image/png'
  const bytes = Buffer.from(await response.arrayBuffer())
  return `data:${type};base64,${bytes.toString('base64')}`
}

// The site's own branding, inlined; the card should look like the site.
// The square icon, not the logo: the logo is white-on-transparent for the
// site's dark header and disappears on this light card.
async function fetchSiteLogo() {
  try {
    const { branding } = await fetchApi('/answer/api/v1/siteinfo')
    const url = branding?.square_icon || branding?.favicon
    return url ? await fetchDataUrl(url) : null
  } catch {
    return null
  }
}

async function fetchNewAnswers() {
  const cutoff = Date.now() - LOOKBACK_HOURS * 3600e3
  const found = []
  for (let page = 1; page <= PAGES; page++) {
    const { list } = await fetchApi(`/answer/api/v1/question/page?page=${page}&page_size=20&order=active`)
    for (const question of list || []) {
      if (!question.answer_count) continue
      // order=default ranks accepted/upvoted first, so a fresh answer on a
      // busy question can sit past page 1; walk up to 3 pages by count.
      for (let answerPage = 1; answerPage <= 3; answerPage++) {
        const answers = await fetchApi(`/answer/api/v1/answer/page?question_id=${question.id}&page=${answerPage}&page_size=20&order=default`)
        for (const answer of answers.list || []) {
          if (answer.create_time * 1000 < cutoff) continue
          // The ids become file paths and urls; trust nothing off-site.
          if (!/^\d+$/.test(answer.id) || !/^\d+$/.test(answer.question_id)) {
            console.log(`skipping answer with non-numeric ids on question ${question.id}`)
            continue
          }
          // A net-downvoted answer is the community saying no; do not amplify it.
          if ((answer.vote_count ?? 0) < 0) {
            console.log(`skipping downvoted answer ${answer.id}`)
            continue
          }
          found.push({ question, answer })
        }
        if (answerPage * 20 >= (answers.count || 0)) break
      }
    }
  }
  // Oldest first so the timeline reads in posting order.
  found.sort((a, b) => a.answer.create_time - b.answer.create_time)
  if (found.length > MAX_CARDS) {
    console.log(`dropping ${found.length - MAX_CARDS} answers beyond --max ${MAX_CARDS}`)
    return found.slice(0, MAX_CARDS)
  }
  return found
}

// ***** caption *****

// Bidi overrides in user text can visually reorder a caption or card line
// into something the author never wrote; drop them everywhere.
function stripBidi(text) {
  return String(text).replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
}

// X weighs a URL as 23 characters regardless of length, and per twitter-text
// these code point ranges weigh 1 while everything else (emoji, cjk, arabic
// presentation forms) weighs 2. Counting per code point overcounts zwj emoji
// sequences, which only errs toward shorter captions.
function weightedLength(text) {
  let length = 0
  for (const char of text.replace(/https?:\/\/\S+/g, 'x'.repeat(23))) {
    const cp = char.codePointAt(0)
    length += cp <= 0x10ff || (cp >= 0x2000 && cp <= 0x200a) || (cp >= 0x2010 && cp <= 0x201f) || (cp >= 0x2032 && cp <= 0x2037) ? 1 : 2
  }
  return length
}

// The title is user text entering an official account's tweet. Strip urls so
// nobody smuggles a link, and break @/#/$ autolinking with a zero-width space
// so a title cannot mention or tag anyone as @SyrianZone.
function tweetSafeTitle(title) {
  return stripBidi(title)
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[@#$]/g, (match) => `${match}\u200b`)
    .replace(/\s+/g, ' ')
    .trim() || 'سؤال وجواب على إجابات سوريا'
}

function caption(title, url) {
  const safe = tweetSafeTitle(title)
  let text = `${safe}\n\n${url}`
  if (weightedLength(text) <= 280) return text
  // The url must survive, so the title takes the trim. Iterate instead of
  // computing the excess once, since code points carry different weights.
  const kept = [...safe]
  do {
    kept.pop()
    text = `${kept.join('')}…\n\n${url}`
  } while (kept.length && weightedLength(text) > 280)
  return text
}

// ***** template *****

// The site renders in IBM Plex Sans Arabic; the card must match it, and
// unlike the tierlist AlJazeera faces these also cover Latin and digits.
const FONT = (name) => readFileSync(join(HERE, 'fonts', name)).toString('base64')

// The card shows the markdown source as plain text; strip the syntax that
// reads as noise on an image. The full formatting lives behind the link.
function stripMarkdown(text) {
  return String(text)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__|`)/g, '')
}

// Answers are user-generated, unlike the admin-controlled tierlist data,
// so everything from the API must be escaped before interpolation.
function escapeHtml(text) {
  return stripBidi(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function html(question, answer, logo) {
  // The answer's own date, not the render date: a card can go out up to a
  // lookback window after the answer was written.
  const date = damascusDate(answer.create_time)
  const dateLabel = `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
  const description = (question.description || '').trim()
  const tags = (question.tags || []).slice(0, 3)
    .map((tag) => `<span class="tag">${escapeHtml(tag.display_name || tag.slug_name || '')}</span>`).join('')
  // Palette lifted from the live site: white panels on warm off-white,
  // near-black text, primary #556A4E, muted #6c757d, borders #dee2e6.
  // The upstream `html` field is deliberately unused: rendering server-made
  // markup from user content would reopen the injection door escapeHtml closes.
  // The markdown source shown as pre-wrap plain text is close enough visually.
  return `<!doctype html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>
  @font-face { font-family: Plex; font-weight: 700; src: url(data:font/ttf;base64,${FONT('IBMPlexSansArabic-Bold.ttf')}); }
  @font-face { font-family: Plex; font-weight: 400; src: url(data:font/ttf;base64,${FONT('IBMPlexSansArabic-Regular.ttf')}); }
  @font-face { font-family: Plex; font-weight: 300; src: url(data:font/ttf;base64,${FONT('IBMPlexSansArabic-Light.ttf')}); }
  * { margin: 0; box-sizing: border-box; }
  body { line-height: 1.3; }
  body {
    width: 1080px; height: 1350px; overflow: hidden;
    font-family: Plex, sans-serif; color: #212529; background: #f7f7f5;
    display: flex; flex-direction: column; padding: 48px 56px 0;
  }
  .header { display: flex; align-items: center; justify-content: space-between; }
  .header .brand { display: flex; align-items: center; gap: 20px; }
  .header .logo { height: 76px; width: auto; }
  .header .logo-text { font-size: 40px; font-weight: 700; color: #556A4E; }
  .header .date { font-size: 24px; color: #6c757d; }
  .question { margin-top: 34px; }
  .question h1 { font-size: 46px; font-weight: 700; line-height: 1.4;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
  .tags { display: flex; gap: 12px; margin-top: 18px; }
  .tag { font-size: 22px; color: #495057; background: #fff; border: 1px solid #dee2e6;
    border-radius: 10px; padding: 6px 18px; }
  .question .description { font-size: 26px; color: #6c757d; margin-top: 18px; line-height: 1.6;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
  .answer { margin-top: 30px; border-radius: 14px; padding: 30px 34px;
    background: #fff; border: 1px solid #e4e4e1; }
  .answer .label-row { display: flex; align-items: center; gap: 16px; margin-bottom: 16px;
    padding-bottom: 16px; border-bottom: 1px solid #eceae6; }
  .answer .label { font-size: 28px; font-weight: 700; color: #556A4E; }
  .answer .accepted { font-size: 21px; font-weight: 700; color: #fff;
    background: #556A4E; border-radius: 999px; padding: 5px 20px; }
  .answer .text { font-size: 30px; line-height: 1.7; white-space: pre-wrap; word-break: break-word;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 12; overflow: hidden; }
  .answer .byline { font-size: 24px; color: #6c757d; margin-top: 20px; }
  .footer { margin-top: auto; display: flex; align-items: center; justify-content: space-between;
    padding: 20px 4px 30px; font-size: 26px; border-top: 1px solid #e4e4e1; }
  .footer .more { color: #556A4E; font-weight: 700; }
  .footer .site { direction: ltr; color: #6c757d; }
</style></head>
<body>
  <div class="header">
    <div class="brand">
      ${logo ? `<img class="logo" src="${logo}" alt="">` : ''}
      <div class="logo-text">إجابات سوريا</div>
    </div>
    <div class="date">${dateLabel}</div>
  </div>
  <div class="question">
    <h1>${escapeHtml(question.title)}</h1>
    ${tags ? `<div class="tags">${tags}</div>` : ''}
    ${description ? `<div class="description">${escapeHtml(description)}</div>` : ''}
  </div>
  <div class="answer">
    <div class="label-row">
      <div class="label">الإجابة</div>
      ${answer.accepted === 2 ? '<div class="accepted">معتمدة</div>' : ''}
    </div>
    <div class="text">${escapeHtml(stripMarkdown(answer.content))}</div>
    ${answer.user_info?.display_name ? `<div class="byline">${escapeHtml(answer.user_info.display_name)}</div>` : ''}
  </div>
  <div class="footer">
    <div class="more">الإجابة الكاملة عبر الرابط</div>
    <div class="site">answers.syrian.zone</div>
  </div>
</body></html>`
}

// ***** main *****

const selected = await fetchNewAnswers()
if (!selected.length) {
  console.log('no new answers')
  process.exit(0)
}

const chrome = chromeBinary()
const logo = await fetchSiteLogo()
mkdirSync(OUT_DIR, { recursive: true })

for (const { question, answer } of selected) {
  const url = `${BASE_URL}/questions/${answer.question_id}/${answer.id}`
  const page = join(OUT_DIR, `answer-${answer.id}.html`)
  const png = join(OUT_DIR, `answer-${answer.id}.png`)
  writeFileSync(page, html(question, answer, logo))
  execFileSync(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=2', '--window-size=1080,1350',
    `--screenshot=${png}`, page,
  ], { stdio: 'pipe' })
  rmSync(page)

  writeFileSync(join(OUT_DIR, `answer-${answer.id}.json`), JSON.stringify({
    answer_id: answer.id,
    question_id: answer.question_id,
    title: question.title,
    url,
    caption: caption(question.title, url),
  }, null, 2))
  console.log(`answer ${answer.id}: ${png}`)
}
