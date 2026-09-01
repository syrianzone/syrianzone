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

const FONT = (name) => readFileSync(join(HERE, '..', 'tierlist-card', 'fonts', name)).toString('base64')
const LOGO = readFileSync(join(HERE, '..', '..', 'public', 'assets', 'logo-darkmode.svg'), 'utf8')

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

function html(question, answer) {
  // The answer's own date, not the render date: a card can go out up to a
  // lookback window after the answer was written.
  const date = damascusDate(answer.create_time)
  const dateLabel = `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
  const description = (question.description || '').trim()
  // The upstream `html` field is deliberately unused: rendering server-made
  // markup from user content would reopen the injection door escapeHtml closes.
  // The markdown source shown as pre-wrap plain text is close enough visually.
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
  .head-text .kicker { font-weight: 700; font-size: 34px; }
  .head-text .date { font-size: 24px; color: #e7d191; margin-top: 6px; }
  .question { margin-top: 26px; }
  .question h1 { font-size: 44px; font-weight: 700; line-height: 1.4;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
  .question .description { font-size: 26px; font-weight: 300; color: #cfe3d3; margin-top: 12px;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
  .answer { margin-top: 26px; border-radius: 26px; padding: 26px 32px;
    background: rgba(79,208,127,0.08); border: 1px solid rgba(255,255,255,0.09); }
  .answer .label-row { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
  .answer .label { font-size: 28px; font-weight: 700; color: #a9e5b8; }
  .answer .accepted { font-size: 22px; font-weight: 700; color: #e7d191;
    background: rgba(231,209,145,0.12); border: 1px solid rgba(231,209,145,0.35);
    border-radius: 14px; padding: 4px 16px; }
  .answer .text { font-size: 30px; line-height: 1.7; white-space: pre-wrap; word-break: break-word;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 12; overflow: hidden; }
  .answer .byline { font-size: 24px; font-weight: 300; color: #9fc4ad; margin-top: 18px; }
  .footer { margin-top: auto; display: flex; align-items: center; justify-content: space-between;
    padding: 18px 4px 28px; font-size: 26px; }
  .footer .more { color: #e7d191; font-weight: 700; }
  .footer .site { direction: ltr; color: #cfe3d3; }
</style></head>
<body>
  <div class="header">
    <div class="head-text">
      <div class="kicker">إجابات سوريا</div>
      <div class="date">${dateLabel}</div>
    </div>
    ${LOGO}
  </div>
  <div class="question">
    <h1>${escapeHtml(question.title)}</h1>
    ${description ? `<div class="description">${escapeHtml(description)}</div>` : ''}
  </div>
  <div class="answer">
    <div class="label-row">
      <div class="label">الإجابة</div>
      ${answer.accepted === 2 ? '<div class="accepted">إجابة معتمدة</div>' : ''}
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
mkdirSync(OUT_DIR, { recursive: true })

for (const { question, answer } of selected) {
  const url = `${BASE_URL}/questions/${answer.question_id}/${answer.id}`
  const page = join(OUT_DIR, `answer-${answer.id}.html`)
  const png = join(OUT_DIR, `answer-${answer.id}.png`)
  writeFileSync(page, html(question, answer))
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
