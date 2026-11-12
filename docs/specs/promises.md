# Promises Tracker (عداد الوعود) — Design Spec

Status: **implemented (not yet deployed)** · Route: `/promises` · Module key: `promises`

A public, sourced record of every promise a Syrian government official makes
publicly (social media, interviews, press conferences, speeches), shown as
countdowns. The goal is transparency: each promise carries who said it, where,
when, what exactly was promised, by when, and what has happened since — with
evidence for every claim the site makes.

## 1. Decisions (from the design interview)

| Topic | Decision |
|---|---|
| Ownership | A promise belongs to the **speaker** (the person, with their title snapshotted at the time) **and** the responsible **institution** (ministry, governorate, …). |
| Speakers | A curated **speakers list** pre-filled from people already in the system — tier-list officials, officials-directory people (`ministers`, `public_figures`), People's Assembly 2026 members. The public can propose a new speaker; it is hidden until an editor approves it. |
| Deadlines | Editors turn the speaker's wording into a concrete date and the page shows the **original wording beside it** plus the reasoning. No timeframe at all → a **count-up** ("X days since promised"). |
| Overdue | Automatic display state when the deadline passes without a verdict. It **never** flips to Broken on its own; only an editor rules, with a source. |
| Statuses | Pending · In progress · Fulfilled · Partially fulfilled · Broken · Postponed · Retracted (+ derived Overdue, derived "kept late"). |
| Sources | Many per promise. One statement reported by several outlets on different days = **one promise with several sources**, each with its own publish date; the promise keeps the date the official actually said it. Each source can carry an archive copy, a screenshot and a video timestamp. |
| Restatements | The same official repeating the promise later with a **new deadline** = a **new promise**, linked to the original. The original is marked Postponed and points at its successor. |
| Targets | Optional measurable target (value, unit, baseline) with dated, sourced progress updates and a progress bar. |
| Grouping | Sector (editor-managed list), governorate (national or one or more), institution, free tags. |
| Public input | Signed-in users can: suggest a promise, submit progress/evidence, report an error. All go to a review queue. Anyone can cast a one-tap "will it be kept?" vote. |
| Period | Statements made on or after **8 Dec 2024**. |
| Language | Arabic only (quotes stay verbatim in their original language). |
| Numbers | Western digits; cards show whole days; the detail page adds a live days:hours:minutes clock. |
| Layout | Scoreboard on top, status chips + combined search and filters, card grid with a big countdown per card, or a compact list. |
| v1 pages | `/promises` list, `/promises/{number}` detail with share card, `/promises/suggest`, admin section. |
| Seed data | ~15 researched real promises, imported **unpublished** into the review queue; an editor verifies and publishes each one. |

Defaults chosen where there was no preference:

- **Placement:** a home-page tool tile only (added through Admin → icons & menus). Home strip, board widget and links from official profiles are later.
- **Extras in v1:** public change log (status/deadline history with sources), official-response entries, "kept late" tally. Every admin action but image upload is also an agent (MCP) tool under the same capability; see [agent-mcp.md](../modules/agent-mcp.md).

Out of scope for v1: follow/reminders, automatic posts to X, per-official scorecard pages, board widget, English/Kurdish content.

## 2. Data model

All new tables use UUID primary keys unless noted. Arabic text columns carry no
`_ar` suffix because the module is Arabic-only.

### `promise_speakers`

The person who made a promise. Rows link back to existing people records so
photos, names and handles are not re-entered.

| Column | Notes |
|---|---|
| `id` | uuid |
| `name` | Arabic display name |
| `title` | current title (e.g. وزير الطاقة); each promise snapshots the title at the time |
| `institution_id` | nullable FK → `official_entities.id` (string) — current institution |
| `image_url` | nullable; falls back to the linked record's image |
| `x_handle` | nullable |
| `candidate_id` | nullable unique FK → `candidates.id` (tier list) |
| `official_entity_id` | nullable unique FK → `official_entities.id` (the person's own directory entry) |
| `house_member_id` | nullable unique FK → `house_members_2026.id` |
| `status` | `approved` \| `pending` \| `rejected` |
| `submitted_by` / `reviewed_by` / `reviewed_at` / `rejection_reason` | moderation |
| timestamps | |

The admin speaker picker searches approved speakers **and** the three source
tables at once; picking a not-yet-linked person creates the speaker row with the
link (no bulk copy, no sync job). The unique link columns stop the same tier-list
or House record from becoming two speakers.

### `promise_sectors`

Editor-managed list (directory pattern): string `id` key (`electricity`,
`housing`, …), `label`, `icon`, `order_column`, `is_active`.

### `promises`

| Column | Notes |
|---|---|
| `id` | uuid |
| `number` | unique int, public id → `/promises/42`, "الوعد رقم 42" |
| `title` | short headline |
| `summary` | neutral 1–3 sentence context |
| `quote`, `quote_is_verbatim` | the promise in the speaker's words |
| `speaker_id` | FK → `promise_speakers` |
| `speaker_title` | title at the time of the statement (snapshot) |
| `institution_id` | nullable FK → `official_entities.id` |
| `sector_id` | FK → `promise_sectors.id` |
| `is_national` | bool; otherwise see `promise_governorate` |
| `statement_date` | date the official said it |
| `statement_venue` | `x_post` \| `facebook_post` \| `telegram_post` \| `tv_interview` \| `news_interview` \| `press_conference` \| `official_statement` \| `speech` \| `other` |
| `deadline_wording` | nullable, verbatim timeframe ("قبل الصيف") |
| `deadline_date` | nullable → count-up when null |
| `deadline_reasoning` | public note on how the wording became a date |
| `target_value`, `target_unit`, `baseline_value`, `baseline_note` | optional measurable target |
| `status` | `pending` \| `in_progress` \| `fulfilled` \| `partially_fulfilled` \| `broken` \| `postponed` \| `retracted` |
| `resolved_at` | date of the verdict (fulfilled/partial/broken/retracted) |
| `restates_promise_id` | nullable self-FK: this promise is a restatement of an earlier one |
| `review_status` | `pending` \| `published` \| `rejected` — the moderation state |
| `origin` | `editor` \| `public` \| `research` |
| `submitted_by`, `reviewed_by`, `reviewed_at`, `rejection_reason`, `published_at` | moderation |
| timestamps, soft deletes | |

Pivots: `promise_governorate (promise_id, governorate)` using the project's
governorate keys; `promise_tags (promise_id, tag)`.

Derived (computed in the model, never stored):

- **display state** — `overdue` when `deadline_date` < today (Asia/Damascus) and
  `status` ∈ {pending, in_progress}; otherwise `status`.
- **kept late** — `status = fulfilled` and `resolved_at > deadline_date`.
- **current value** — latest progress update's value (for the progress bar).

### `promise_sources`

`promise_id`, `url`, `outlet`, `type` (`x_post` \| `facebook_post` \|
`telegram_post` \| `tv_interview` \| `press_conference` \| `official_statement`
\| `news_article` \| `video`), `published_date`, `language`, `archive_url`,
`screenshot_url` (an upload on R2, or another web URL), `video_timestamp`,
`is_primary`, `sort`.

### `promise_updates` — the public change log

`promise_id`, `type` (`progress` \| `status_change` \| `official_response` \|
`note`), `happened_on` (date), `body`, `status_from`, `status_to`, `value`
(progress), `source_url`, `archive_url`, `created_by`. Every `status_change`
and `progress` entry **requires a source**. Text edits to the promise itself
are not logged publicly.

### `promise_reports` — public input on existing promises

`promise_id`, `user_id`, `kind` (`progress` \| `error`), `body`, `source_url`,
`status` (`pending` \| `accepted` \| `dismissed`), `reviewed_by`, `reviewed_at`,
`resolution_note`. Accepting a progress report turns it into a
`promise_updates` row.

### `promise_votes` — "will it be kept?"

`promise_id`, `voter_key` (hashed identity, same scheme as tier-list ballots),
`ip_hash`, `believes` (bool), timestamps; unique (`promise_id`, `voter_key`).
Changeable while the promise is open; closed (read-only) once a verdict is set.
Public reads return only aggregates.

## 3. Public pages

### `/promises`

- Scoreboard: total · kept (on time / late) · partially · broken · overdue · open.
  Each number is a toggle that shows only its promises (clearing other filters
  and search, so the list matches the number); the total shows them all.
- Grid or list view, remembered per browser. On phones a list row keeps only
  the speaker, state, title and countdown.
- Status chips, then a search field (`SmartFilterSearch`) with sector,
  governorate, speaker, institution and tag filters. Several values in one
  filter match any of them; different filters must all match. Chip counts follow
  the other filters; the scoreboard stays global.
- Filters and sort live in the URL (`state[]=overdue&state[]=broken`), so a
  filtered view can be shared. Search text is not put in the URL.
- Applied filters support RTL arrow navigation, Enter/Escape to edit/leave,
  and Delete/Backspace to remove a filter or value. Backspace in an empty
  input focuses the preceding item first.
- Closing suggestions keeps them hidden until Filters is activated again.
- The detail page's back link restores the list's filters and local search
  after a card visit. Direct visits, reloads and new tabs fall back to
  `?from=` (local `/promises` URLs only).
- Default sort by urgency: most overdue first, then soonest deadline, then
  count-ups, then resolved.
- Card: speaker avatar + name/title, title, the big number, status badge,
  progress bar when a target exists.

**The big number** comes from `Promise::counter()` so every surface agrees.
Open promises count down (`left`, `today`), keep counting once late
(`overdue`), or count up from the statement when there is no deadline
(`since`). Closed promises, whatever the verdict, freeze on the verdict date:
`early` / `ontime` / `late` relative to the deadline, or `took` N days after
the statement when there was no deadline (`closed` when no verdict date is
recorded). Arabic number agreement for «يوم» follows the last two digits
(`dayWord()`).

### `/promises/{number}`

Speaker header, status, big countdown with a live clock (server renders whole
days; the clock starts after hydration to avoid SSR mismatch), the quote with
venue and date, deadline wording vs interpreted date with reasoning, target
progress, change-log timeline (incl. official responses), sources with archive
links, related promises (restates / restated by), the vote, and actions:
suggest an update, report an error, share. Per-record OG card image and JSON-LD.

### `/promises/suggest` (signed-in)

Speaker picker (or "propose a new person"), quote, statement date, venue,
deadline wording, at least one source URL, optional notes. Lands as
`review_status = pending`, `origin = public`.

## 4. Admin (`/admin/promises`, capability group `promises`)

Pages: **Promises** (list + full-page editor; status changes go through a
dialog that requires a source and writes a `promise_updates` row) · **Review
queue** (pending promises, pending speakers, reports) · **Speakers** (link
people from the tier list / officials directory / People's Assembly, or add
manually) · **Sectors**. The dashboard sidebar links here for anyone holding a
`promises.*` capability; the public page has no admin button.

Status changes are dated in order (never before the statement or the previous
change), and are written under a row lock so concurrent verdicts cannot
interleave. No log entry precedes the statement, and the statement date cannot
move past the log. Once a promise has ever been public its status changes are
permanent, corrected by a new change. Before that, staff holding
`promises.rule` can undo the latest one, so a verdict date taken from research
can be fixed. Marking a restated original `postponed` is also a verdict, so it
happens automatically only for staff holding `promises.rule`. Reports are
resolved under a row lock, so one cannot be accepted twice.

Publishing needs at least one source and a speaker who is not rejected (a
pending one is approved with the promise); a speaker with published promises
cannot be rejected. Publishing locks the row, so concurrent publishes cannot
renumber a promise.

The editor page (`/admin/promises/{id}/edit`) is a read-only shell open to all
promises staff; saving needs `promises.edit`, verdicts `promises.rule`, and
publishing `promises.review`. Publish and reject are disabled while the form has
unsaved edits.

Capabilities: `promises.create`, `promises.edit`, `promises.rule` (set
verdicts/status), `promises.review` (moderation queue), `promises.delete`,
`promises.speakers` (speakers + sectors).

## 5. Implementation wiring

- **Moderation** follows Mishwar places: transport-free services in
  `app/Services/Promises/` throw `App\Exceptions\Promises\PromiseActionException`
  (a `DomainActionException`), and thin controllers adapt them.
- **Admin** is guarded by `PromisesAdmin` (`ModuleCapabilityGuard`, alias
  `promises_admin`), whose capabilities come from `PermissionCatalogue::forModule('promises')`.
  Every admin route names its capability. The dashboard sidebar link is gated by
  `canModule(perms, 'promises')`.
- **Governorates:** the one table is `resources/data/governorates.json`
  (see `resources/data/README.md`); `App\Support\Governorates` is the PHP
  projection and `Domain/geography/governorates.ts` the TypeScript one. The
  frontend receives the list as a prop instead of keeping a copy.
- **Votes:** `voter_key` = HMAC(app key, signed-in user id, or else the
  device id) and `ip_hash` = HMAC(app key, IP). Unique per promise, `voting`
  rate limiter, aggregates only in public reads.
- **SEO:** `SeoMeta` gets `/promises` and `/promises/suggest` entries, and
  `PromisePreview` describes `/promises/{number}` (title, description,
  canonical, breadcrumb; unknown or unpublished numbers get a 404).
  `SitemapBuilder` lists published promises.
- **Share images:** every promise has a link-preview card of its own, drawn on
  demand by `App\Support\Seo\Preview\Resolvers\PromisePreview` (see
  [seo.md](../guidelines/seo.md)). It shows the status, number, sector, speaker
  and the absolute deadline date, never a countdown: chat apps keep a preview
  for weeks, so a number of days baked into it would be wrong the next morning.
  The card is redrawn when any of those change. For the live count the detail
  page also offers a **"download share image"** rendered in the browser
  (`Lib/exportElementAsPng`, lazy-loaded). Nothing inside the captured node may
  use `truncate`: html2canvas clips ellipsised Arabic text.
- **Untrusted text:** titles and quotes can come from visitors, so the JSON-LD
  is encoded with `JSON_HEX_TAG | JSON_HEX_AMP`; every URL that is rendered as
  a link is validated as `http(s)` (or a `/storage/` upload) on the server and
  passed through `safeHref()` on the client.
- **Speaker search:** visitors only reach approved speakers and people the site
  lists publicly (the main tier-list poll's active categories, active
  directory entries); staff also see pending and hidden records.
- **Navigation:** a built-in item in `SiteSetting::defaultNavigationItems()`
  plus the frontend icon maps, so it appears on the home grid and admins can
  reorder or hide it.

## 6. Seed data

`database/seeders/data/promises-research.json` holds 14 researched promises
(Dec 2024 – Jun 2026). Load them into the review queue with:

```bash
php artisan promises:import-research            # or --dry-run first
```

Everything lands unpublished (`origin = research`). Speakers are matched to
people the site already knows by normalised name (titles and spelling variants
tolerated, single unambiguous match only); everyone else becomes a pending
speaker approved on publish. The researcher's confidence, caveats, unverified
links and unmatched institution names go into the note editors see. A verdict
is set only from the evidence item marked `supports_verdict`, dated by its
`event_date` when the evidence states one, otherwise by its publication date
(and the note asks the editor to confirm the real date). The command exits
non-zero when any row fails.

Tests use `PromiseFactory` / `PromiseSpeakerFactory`; there is no demo seeder.
