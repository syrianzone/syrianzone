# Board: Implementation Spec

## 1. THESIS

"لوحتي" is a customizable dashboard at `/board` where a visitor composes their own view of the Syrian.Zone ecosystem from pluggable widgets on a responsive grid, with the layout stored locally for guests and synced to the account for logged-in users.

Every feature is a widget: a self-contained folder with its own config, refresh policy, and data access, registered in one manifest. Adding a widget must require zero changes to the core.

This document is the single contract for the feature as implemented. Every name, path, prop, and JSON key below is normative. Do not invent alternatives.

## 2. HOUSE CONVENTIONS

Follows [mishwar-places.md](mishwar-places.md) §2 exactly. Additions specific to this feature:

- Widgets never call `axios` directly. They call a typed client in `_lib/`, or reuse an existing one (`Domain/places/api.ts`, `Domain/weather/weather.ts`, `Domain/transit/api.ts`).
- Cross-origin, non-app APIs (the weather worker, `api.aladhan.com`) are the one exception and use plain `fetch`.
- Widgets never handle auth or geolocation permission themselves. `BoardTile` enforces `requires` and only mounts a widget once its capabilities are satisfied.
- Widgets never render their own spinner, error, or empty state. `WidgetShell` owns all of them.
- UI imports must match the casing already used elsewhere in the repo for that component (both `@/components/ui/*` and `@/Components/ui/*` exist in tree, and tsc rejects mixing casings for one file).

## 3. LAYOUT FORMAT (the part that cannot be taken back)

Identical shape in `localStorage['sz-board:v1']` and the `boards.document` column:

```json
{
  "v": 1,
  "activeId": "d_main",
  "updatedAt": "2026-07-18T09:12:44.120Z",
  "dashboards": [
    { "id": "d_main", "name": "الرئيسية", "widgets": [
      { "i": "w_k3n1", "d": "clock", "w": 4, "h": 2, "c": { "format": "24", "showDate": true } }
    ] }
  ]
}
```

- `i` instance id, `d` widget definition id, `w` columns of 12, `h` row units, `c` config.
- Nothing derived is stored: no titles, no icons, no cached data, no per-breakpoint copies.
- Caps: 10 dashboards, 40 widgets each, `w` 1-12, `h` 1-8, 64KB per document.
- **Widget definition ids and these key names are permanent.** Renaming one orphans every saved board.

Two invariants, both covered by tests or manual checks:

1. **`migrate()` never throws.** Unparseable JSON, a `v` from a newer client, or a malformed dashboard falls back to `defaultDoc()`. A corrupt entry must never white-screen `/board`.
2. **Unknown `d` values round-trip verbatim.** They render `MissingWidget` and are written back unchanged, config included, so an older client cannot silently delete a widget added on the user's other device. Covered by `tests/Feature/BoardTest.php`.

## 4. GRID

- Position is array index. Reordering is a splice. There is no `x`/`y`, no compaction pass.
- Columns: `sm` 2, `md` 6, `lg` 12, from `colsAt()`. A widget renders at `Math.min(w, cols)`, so one stored width covers all three breakpoints.
- `grid-template-columns` and spans are **inline styles** driven by the `useBreakpoint()` media-query hook, not `md:`/`lg:` utilities: code-split CSS chunks each emit their own Tailwind layer, so responsive classes lose cascade order in a page chunk (`Pages/Places/_components/Lightbox.tsx` documents the same trap).
- Row height 76px, gap 12px, `grid-auto-flow: dense`.
- Reorder uses `@dnd-kit/sortable` with `rectSortingStrategy`, an 8px pointer activation distance, and the keyboard sensor. dnd-kit is transform-based, so RTL needs no mirroring. The drag surface is the header handle only, so scrolling a list widget on touch never starts a drag.
- **Resize is discrete**, chosen from `SizeMenu` and bounded by each widget's
  `minSize`/`maxSize`. There are no drag handles. The menu offers only
  `allowedSizes(def)` and the reducer stores only `clampSize(size, def)`, both in
  `_lib/doc.ts`, so no caller can bypass the grid caps or a widget's own bounds.

## 5. BACKEND CONTRACT

| Route | Auth | Returns |
|---|---|---|
| `GET /board` | public | Inertia page `Board/Index` |
| `GET /api/v1/board` | session | `{ document: object\|null, updated_at: string\|null }` |
| `PUT /api/v1/board` | session | `{ updated_at: string }` |

- One row per user (`boards.user_id` unique, cascade delete). The whole document lives in one `json` column.
- The server validates **shape and size only** and never interprets `c`. The 64KB body cap, the 40-widget cap, and `throttle:60,1` are what bound the open config bag; there is deliberately no per-widget schema validation server-side.
- Both write routes live in `routes/web.php` inside the `auth` group because they need session + CSRF, not in `api.php`.

## 6. SYNC

localStorage is written synchronously on every mutation. The network PUT debounces 1500ms, keeps a single request in flight with a monotonic stale guard, re-fires once on settle if a mutation landed during a save, and flushes on `visibilitychange === 'hidden'` via `fetch(..., { keepalive: true })` (`sendBeacon` cannot carry the CSRF header).

A failed save is non-fatal: localStorage already holds the document, so it surfaces a `غير محفوظ` badge with retry, never a modal.

Merge on login, last-write-wins on the whole document:

| local | server | result |
|---|---|---|
| no | no | seed `defaultDoc()`, PUT |
| yes | no | adopt local, PUT (the guest-to-account path) |
| no | yes | adopt server, write local |
| yes | yes | newer `updatedAt` wins; loser goes to `sz-board:v1:prev` with a one-click استعادة alert |

No CRDT and no field-level merge. Simultaneous edits on two devices means one loses, and the restore alert is the entire mitigation.

## 7. WIDGET CONTRACT

`WidgetDeclaration` (see `_lib/types.ts`) carries `id`, Arabic `name`/`description`,
a lucide `icon`, `category`, `defaultSize`/`minSize`/`maxSize`, `fields`,
`requires`, `refresh`, `multiple`, `seed` (where the widget sits on a new
visitor's board, or `null`), and `source` (the read it uses from `_lib/sources.ts`,
or `null`). The registry attaches the lazy `View` from the folder, so the
declaration never imports the widget's own code.

- `fields: ConfigField[]` is a declarative schema (`text` | `number` | `switch` | `select`). `WidgetConfigDialog` renders it generically, so a configurable widget ships no settings UI of its own. `[]` means not configurable.
- `requires: ('auth' | 'geo')[]` is enforced in `BoardTile`. `auth` renders a locked tile with a sign-in link and issues no request. `geo` requests one fix for the whole board via `GeoProvider`, caches it in `sz-board:geo`, and renders an enable-location tile on denial.
- `refresh: { staleMs, intervalMs }` feeds `useWidgetQuery`. `refetchIntervalInBackground` is always false: several polling widgets across many open tabs is real load for no benefit while hidden.
- `multiple: false` disables the widget in the gallery once placed.
- `category` must be one of `CATEGORIES`; the gallery's sections are exactly the categories its widgets use.
- `seed` sets both the default board's array order (one order is one visual row) and its size there. `null` keeps the widget in the gallery only.
- `source` names the fetcher in `_lib/sources.ts` that the widget's queries go
  through (`null` for a widget that reads nothing outside the document). The
  registry publishes the resulting table as `WIDGET_SOURCES`, and
  `registry.test.ts` fails if a declared source does not exist, is not a
  function, or is claimed by no widget.

Adding a widget:

1. Create `_widgets/<id>/index.ts` (the declaration, `export default`) and
   `_widgets/<id>/View.tsx` (the lazy view). The `id` must equal the folder name.
2. Nothing else. `_lib/registry.ts` discovers every folder under `_widgets/` with
   `import.meta.glob`, so the gallery, seeded board, category sections and source
   table pick the widget up with no edit to the core.

That is the whole extension surface. The config dialog, sizing, persistence, and
sync all pick it up with no further changes.

## 8. FILE MANIFEST

Backend:
- `database/migrations/2026_07_18_100001_create_boards_table.php`
- `app/Models/Board.php`, `database/factories/BoardFactory.php`
- `app/Http/Controllers/BoardController.php` (`renderIndex`, `show`, `update`)
- `tests/Feature/BoardTest.php`

Frontend, `resources/js/Pages/Board/`:
- `Index.tsx` owns the document and passes it down, matching `Pages/Places/Index.tsx`. No zustand.
- `_lib/`: `types.ts`, `doc.ts`, `layout.ts`, `registry.ts`, `storage.ts`, `api.ts`, `sync.ts`, `query.ts`, `sources.ts`
- `_components/`: `BoardGrid`, `BoardTile`, `BoardToolbar`, `DashboardTabs`, `WidgetShell`, `TileChrome`, `SizeMenu`, `MissingWidget`, `WidgetGallery`, `WidgetConfigDialog`, `GeoProvider`
- `_widgets/<id>/{index.ts,View.tsx}`: `clock`, `weather`, `prayer`, `quran`, `pomodoro`, `todo`, `notes`, `rss`, `answers`, `events-today`, `guides`, `places-nearby`, `transit-cities`, `recipe`

Shared: `resources/js/Providers/QueryProvider.tsx` (moved out of `Pages/Transit/_providers/`, it was always app-global).

## 9. WIDGETS AS SHIPPED

| id | category | source | requires | multiple |
|---|---|---|---|---|
| `clock` | time | local | | yes |
| `weather` | time | Cloudflare worker (cross-origin) | | yes |
| `prayer` | time | `GET /api/prayer-times`, method 3 (Muslim World League) by default; follows the shared location preference (`Domain/location`) and `Domain/prayer/times` | | no |
| `quran` | time | the global player (`Domain/quran/quranPlayer`); follows the recitation | | yes |
| `pomodoro` | personal | local timer | | no |
| `todo` | personal | text lives in `c` | | yes |
| `notes` | personal | text lives in `c` | | yes |
| `rss` | community | `GET /api/feed?source=` | | yes |
| `answers` | community | `GET /api/answers` (answers.syrian.zone) | | no |
| `events-today` | community | `GET /api/events/today` (F3alia) | | yes |
| `guides` | community | `GET /api/v1/guides` via `Domain/places/api` | | yes |
| `places-nearby` | places | `GET /api/v1/places/nearby` (radius capped at 25km) | `geo` | no |
| `transit-cities` | places | `GET /api/v1/cities` | | no |
| `recipe` | food | `GET /api/recipe-of-the-day` (food.syrian.zone) | | no |

Notes on environment:
- `weather` calls a worker that only allows the `https://syrian.zone` origin, so it always renders its error tile from localhost. This is correct degradation, not a bug.
- `transit-cities` needs PostGIS (`ST_AsGeoJSON`). On a sqlite dev database it renders its error tile; its happy path is only verifiable against PostGIS.
- `notes` is user text we render back. Plain text in a `<textarea>`, capped at 4000 chars. Never markdown, never `dangerouslySetInnerHTML`.

## 10. NON-GOALS (do not build these)

- Free-drag resize handles, `x`/`y` positioning, compaction.
- Public or shared boards, sharing a board by URL, templates beyond `defaultDoc()`.
- Remote or user-authored widgets, iframe sandboxing. The registry is in-repo and the "marketplace" is a gallery over it.
- Per-widget config schema validation on the server.
- Real-time sync, CRDT, or any conflict UI beyond the one-shot استعادة alert.
- Undo/redo for layout edits.
- i18n. Arabic strings stay inline, matching the rest of the app.
- Changes to `Home.tsx`. It keeps its own weather/prayer panels until `/board` proves out.
- News, government announcements, exchange rates, and electricity/water widgets. **No data source for any of these exists in the repo**; each needs an ingestion backend first, which is its own project.

## 11. VERIFICATION

Automated (`tests/Feature/BoardTest.php`, 9 tests): guest 401s, null document for a new user, create-then-update keeps one row, unknown widget id round-trips verbatim, owner scoping, oversize body 422, seven malformed-document cases 422, cascade delete.

`UserFactory` defaults `role` to `user`; privileged accounts need explicit grants.

The pure frontend engines are covered by Vitest (`bun run test:js`) in
`_lib/registry.test.ts`: the declarations (ids, categories, sizes inside the
grid and their own bounds, source table, seed order), the clamped resize, and a
stored v1 document — including an unknown widget id and PHP's `[]` for an empty
config — round-tripping unchanged through `migrate()`. The Board UI itself has no
unit tests, so it was verified by driving the running app. What was checked, and
what a future change should re-check:

- Renders at 375 / 820 / 1280: 2 / 6 / 12 columns, spans clamped, no horizontal overflow.
- Keyboard drag reorder, and that ArrowLeft moves a tile later in the order (correct in RTL).
- Corrupt localStorage, a `v: 99` document, and an unknown widget id all recover without a blank page.
- Guest board adopted on login; four mutations in one tick produce exactly one PUT; an older local document loses to the server and is recoverable; a save with the server down shows the unsaved badge and retries successfully.
- Gallery add seeds config from field defaults, `multiple: false` widgets disable once placed, config dialog changes persist and update the tile live.
- Geolocation denied renders the enable-location tile and issues no request; granted fetches and lists a real place.
- Dashboard add, rename, switch, and delete, with the delete control gone at one dashboard.
