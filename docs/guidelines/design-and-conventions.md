# Design & Conventions

Repo-wide styling and coding conventions. The most detailed normative reference is [modules/mishwar-places.md](../modules/mishwar-places.md) §2; this page summarizes and extends it.

## Styling system

- **Tailwind CSS v4** via `@tailwindcss/postcss`; entry `resources/css/app.css` uses `@import "tailwindcss"` with `@theme` tokens.
- **shadcn-style components**: Radix primitives + `class-variance-authority` + `cn()` (`clsx` + `tailwind-merge`, in `Lib/utils.ts`). Shared primitives live in `resources/js/Components/ui/` — reuse them before writing new ones.
- **Theming**: HSL token set (`--background`, `--primary`, `--chart-1..5`, `--sidebar-*`) mapped through `@theme`. The theme is an attribute (`data-theme="dark"`), not a class. The registry in `Lib/theme.ts` ships light, dark, dark-blue, dark-purple, dark-green, high-contrast, damascus-rose, and jasmine; users switch it from `Components/AppearanceMenu` (the navbar control).
- **Fonts**: IBM Plex Sans Arabic from npm (`@ibm/plex-sans-arabic`), `font-display: swap`; `--font-sans` falls back to `var(--site-font)`.
- **RTL is the default direction** — `<DirectionProvider dir="rtl">` wraps both client (`app.tsx`) and SSR entry (`ssr.tsx`). Never hardcode left/right without checking RTL semantics.
- Map labels use `@mapbox/mapbox-gl-rtl-text`; map font glyphs generated with fontnik (`scripts/build-map-glyphs.mjs`).

## Frontend conventions

- **Inertia for page loads**, react-query (`Providers/QueryProvider`, staleTime 5 min, offlineFirst) for API data, custom axios instance in `Lib/axios.ts`.
- **Zustand stores colocated per page** (e.g. `Pages/Transit/_store/useMapStore.ts`) — no global state store.
- Page-scoped folders under `Pages/<Module>/` with `_components`, `_lib`, `_widgets` subfolders for private code; shared cross-module UI goes to `Components/`.
- Grid layouts on the Board use inline styles instead of Tailwind responsive classes (CSS chunk cascade trap — see board spec).
- TypeScript strict mode; path aliases `@`, `@/lib`, `@/components`, `@/context`.

## Accessibility

Accessibility is a first-class requirement, not a polish pass. The full standard
lives in [accessibility.md](accessibility.md); the short version:

- One `<main id="main-content">` (from `ConditionalLayout`) and one `<h1>` per page.
- Every control has an accessible name; icon-only buttons carry `aria-label`.
- Outcomes go through `Lib/notify.ts`; destructive actions through
  `confirmDialog()` (`Lib/confirm.ts`). No native `alert`/`confirm`.
- Real tabs use `Lib/useTabList.ts`; filter chips use
  `Components/ui/filter-chip.tsx`; never `<Badge onClick>` or ad-hoc `aria-pressed`
  tab sets.
- Run the gate: `python3 scripts/a11y_axe_audit.py --base http://localhost:8000`.
  It must stay at **0 violations**.

## Language & i18n

- **The product surface is Arabic (RTL).** User-facing copy is Modern Standard
  Arabic; see the root `README.md` and the Arabic guide. Keep it free of
  translated-English syntax.
- **Code is English.** Identifiers, comments, commits, and docs are English.
- **Do not hardcode user-facing strings where a translation map exists.** The
  directories (SyOfficial, Phonebook, GovApps) and the Muslim section carry
  `TRANSLATIONS`/label maps — add to those rather than inlining strings.
- **Quran-related names follow the terminology standard** enforced by the
  `quranic-terminology-lint` pre-commit hook (`.terminology.json`). This is the
  model for any future naming standard: a machine-checkable rule, not prose.
- **Numbers/units** in LTR contexts (times, prices, coordinates) get `dir="ltr"`
  and `tabular-nums`; Arabic-Indic digits are used only where the design says so.

## Theming

- Colour is **always** a token (`hsl(var(--…))` or a Tailwind token class).
  Literal hex/`rgb()` in a component is a bug — it escapes the nine themes.
- The theme is `data-theme="…"`, applied at `document.documentElement`; the
  registry is `Lib/theme.ts`. Add a theme by adding its CSS variable block in
  `resources/css/app.css` **and** a `THEME_REGISTRY` entry, and check contrast.
- Every theme must satisfy `--primary` vs `--primary-foreground` (both
  directions) and `--muted-foreground` on `--background` for small text.
- User-chosen appearance (theme + font) is owned by `Components/AppearanceMenu`
  only; do not add a second theme switcher.

## Avoid overlapping abstractions

The single biggest source of drift is a second implementation of something that
already exists. Before writing a component, search `Components/` and
`Components/ui/`.

| Need | Use (do not re-create) |
|---|---|
| Toast / feedback | `Lib/notify.ts` + `Components/ui/sonner` |
| Confirm dialog | `Lib/confirm.ts` + `Components/ConfirmHost` |
| API error extraction | `Lib/apiError.ts` (`extractApiErrorMessage`, `extractApiFieldErrors`) |
| Alert (inline) | `Components/ui/alert.tsx` |
| Tabs / segmented switcher | `Lib/useTabList.ts` (custom) or `Components/ui/tabs` |
| Filter chips | `Components/ui/filter-chip.tsx` |
| Buttons, dialogs, sheets, selects, tables, scroll areas | `Components/ui/*` |
| Icon-only button | `Components/ui/button` + `aria-label` |
| Weather icons, cluster layers, media-query hook | one shared helper per concern |

Rules:

- **One primitive per concern.** If you need a variant, extend the existing
  component (a `variant`/prop) rather than forking it.
- **One source of truth for data** that several surfaces read (e.g. governorate
  tables, project icons, permission ids). Duplicated constants drift.
- **Extract on the second use, not the first.** A pattern copied a third time is
  a defect; a pattern used once can stay local.
- Cross-module UI goes to `Components/`; page-private UI stays in
  `Pages/<Module>/_components`.

## Backend conventions

- One controller per feature area under `app/Http/Controllers`, JSON APIs under `Api/` (versioned `V1`).
- Business logic isolated in `app/Services` (e.g. `PlaceImageService`, `HalaSyriaService`). When more than one transport needs a rule (dashboard + agent), extract it to a transport-free service and let both call it.
- **API error responses & domain exceptions**:
  - Every `4xx`/`5xx` JSON error response includes a top-level string `message` key (`{ "message": "..." }`), matching Laravel's default exception envelope. Validation errors (`422`) add `errors: Record<string, string[]>`, and domain/geographic errors may add `code: string`. Legacy endpoints that historically returned `error` emit both `message` and `error` (`bootstrap/app.php` also normalizes any exception-rendered `JsonResponse` that has `error` without `message`).
  - Domain services that back both HTTP controllers and MCP tools throw subclasses of `App\Exceptions\DomainActionException` (`PlaceActionException`, `DirectoryActionException`, `TransitActionException`, `UserModerationException`). `bootstrap/app.php` suppresses reporting for `DomainActionException` and renders it directly to `{ "message": $e->getMessage() }` with `$e->httpStatus()` (converting `404` on non-JSON web requests into a `NotFoundHttpException` so Inertia renders the 404 page).
- Rate limiters named in `AppServiceProvider`: `voting` (10/min), `public-api` (120/min per IP), `mcp` (120/min, keyed by API token id so one agent cannot starve another behind the same IP), `studio-submit`; widget endpoints 60/min.
- Module capability middleware aliases (`bootstrap/app.php`): `transit_admin`, `syofficial_admin`, `phonebook_admin`, `places_admin`, `polls_admin`, `govapps_admin`, `compass_admin`, `users_admin`, and `superadmin`. The `*_admin` aliases take per-route capability params (e.g. `transit_admin:transit.approve`). There is no general `admin` alias any more.
- Capability ids live **only** in `app/Support/Permissions/PermissionCatalogue.php` — the Filament user form and agent API tokens both read it. Never introduce a second permission vocabulary.
- Authorisation is capability-based, not role-based. `User::hasPermission()` is: superadmin, **or** the id is in the account's `permissions` array (which may contain `*`). The module roles (`*_admin`) and the old `admin` role stopped conferring capabilities (Phases D and G, `2026_09_27`); every non-superadmin account's access is exactly its stored `permissions`. `User::effectivePermissions()` resolves the same rule against the catalogue and is shared with the frontend.
- Capability checks in React go through `useAuth().can()` against the server-resolved `effective_permissions`. Never re-derive role implications in TypeScript — use `User::effectivePermissions()` server-side and share the result via `HandleInertiaRequests::userPayload()`.
- Agent (MCP) tools live in `app/Mcp/`, extend `AuditedTool`, and share domain services with the dashboard controllers rather than re-implementing rules. Token minting lives at `/admin/api-tokens` like every other admin section — not in Filament. Authorisation is an AND: user permission AND token ability. See [modules/agent-mcp.md](../modules/agent-mcp.md).
- CSRF exceptions are explicit in `bootstrap/app.php` (studio routes, poll votes, submit, guesswho broadcasting auth).
- Public voting data must never select `voter_key` / `ip_hash` / `user_agent` / poll owner columns — keep column selection explicit.
- Migrations follow the create-then-alter history; avoid resurrecting dropped tables (place likes/comments/reports were removed deliberately).
- **UserFactory**: defaults to `role => 'user'`; a fresh account holds no capabilities (only `superadmin` bypasses), so grant `permissions` explicitly when seeding privileged users.

## Testing & quality

- **Pest** (`vendor/bin/pest`), RefreshDatabase auto-applied; sqlite :memory:, array cache/session drivers.
- Lint/format with **Pint** (`vendor/bin/pint`).
- **Never run Pint on `routes/web.php`.** Its `fully_qualified_strict_types` fixer strips the leading `\` from FQCNs, assuming a `use` import exists. That file has no namespace declaration, keeps `use` statements mid-file, and references several controllers that are never imported — so Pint rewrites `\App\Http\Controllers\PlaceAdminController` to `PlaceAdminController`, which PHP then resolves against the global namespace and fails to find. It surfaces as ~122 `ReflectionException: Class "...Controller" does not exist` test failures. Pint the app code and leave the route files alone.
- **Do not run Pint on `bootstrap/app.php` either.** It is safe there, but Pint rewrites every inline FQCN into a new `use` import and realigns the whole alias table, so a one-line change to a middleware alias turns into a 40-line reformat that buries the real edit in review. Add the entry by hand and match the surrounding alignment.
- Pint is **not** run in CI, and roughly 170 pre-existing files are not Pint-clean, so it is advisory. Do not reformat untouched files to "fix" a Pint run — keep the diff to what the change actually needs.
- Feature suites cover Polls, Places, Voting API, Weather, Sitemap, Prayer, middleware, models, VotingService.

## Admin route authorisation

Admin panel groups are guarded by `ModuleCapabilityGuard`, which enforces **one
capability per route**:

- Every route inside a guarded group must name its capability, e.g.
  `->middleware('polls_admin:polls.delete')`. A route with no tag is **denied**,
  so a forgotten tag breaks a feature rather than silently over-granting.
- `ModuleCapabilityGuard::ANY` means "any one capability in this module". Use it
  only on page shells and read-only indexes, never on a mutating route.
- The capability must belong to the middleware's own module, or the route is
  locked out entirely.
- Adding a capability id means adding it to `PermissionCatalogue` — the same list
  the Filament user form renders. Never introduce a second vocabulary.
- `ModuleCapabilityRoutesTest` asserts the route table matches all of the above,
  so a typo fails the build instead of producing a route nobody can reach. Run
  it after touching any admin group.
- Role bypasses are resolved in `User::hasPermission()` (superadmin, the general
  `admin` role, the per-module `*_admin` roles, and the `*` wildcard). The
  middleware must not re-implement them.
- A new action that is **application-wide rather than module-specific** (banning
  a user, for example) gets its own capability and its own group — do not file it
  inside a content module's group just because the UI that calls it lives on that
  module's page. A capability is also the only way to grant an action to one
  person without granting it to everyone who shares a role, so prefer it over an
  inline role list in a controller.
- Adding a capability also means: `PermissionCatalogue::groups()` **and**
  `groupMeta()`, the Filament role select and badge map, and an entry in
  `resources/views/components/project-icon.blade.php` — the component renders
  nothing for an unknown name rather than failing, so a missing icon is silent.
  `TransitGovernorateScopeTest` asserts each group has meta and a matching
  `{group}.` prefix.

## Commits

Conventional-ish format: `feat(module): …`, `fix(module): …` (see root CONTRIBUTING.md).
