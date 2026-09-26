# Design & Conventions

Repo-wide styling and coding conventions. The most detailed normative reference is [modules/mishwar-places.md](../modules/mishwar-places.md) §2; this page summarizes and extends it.

## Styling system

- **Tailwind CSS v4** via `@tailwindcss/postcss`; entry `resources/css/app.css` uses `@import "tailwindcss"` with `@theme` tokens.
- **shadcn-style components**: Radix primitives + `class-variance-authority` + `cn()` (`clsx` + `tailwind-merge`, in `Lib/utils.ts`). Shared primitives live in `resources/js/Components/ui/` — reuse them before writing new ones.
- **Theming**: HSL token set (`--background`, `--primary`, `--chart-1..5`, `--sidebar-*`) mapped through `@theme`. Dark mode is an attribute (`data-theme="dark"`), not a class, plus extra themes: dark-blue, dark-purple, dark-green, high-contrast, damascus-rose. Toggle via `Components/ThemeToggle`.
- **Fonts**: IBM Plex Sans Arabic from npm (`@ibm/plex-sans-arabic`), `font-display: swap`; `--font-sans` falls back to `var(--site-font)`.
- **RTL is the default direction** — `<DirectionProvider dir="rtl">` wraps both client (`app.tsx`) and SSR entry (`ssr.tsx`). Never hardcode left/right without checking RTL semantics.
- Map labels use `@mapbox/mapbox-gl-rtl-text`; map font glyphs generated with fontnik (`scripts/build-map-glyphs.mjs`).

## Frontend conventions

- **Inertia for page loads**, react-query (`Providers/QueryProvider`, staleTime 5 min, offlineFirst) for API data, custom axios instance in `Lib/axios.ts`.
- **Zustand stores colocated per page** (e.g. `Pages/Transit/_store/useMapStore.ts`) — no global state store.
- Page-scoped folders under `Pages/<Module>/` with `_components`, `_lib`, `_widgets` subfolders for private code; shared cross-module UI goes to `Components/`.
- Grid layouts on the Board use inline styles instead of Tailwind responsive classes (CSS chunk cascade trap — see board spec).
- TypeScript strict mode; path aliases `@`, `@/lib`, `@/components`, `@/context`.

## Backend conventions

- One controller per feature area under `app/Http/Controllers`, JSON APIs under `Api/` (versioned `V1`).
- Business logic isolated in `app/Services` (e.g. `PlaceImageService`, `HalaSyriaService`). When more than one transport needs a rule (dashboard + agent), extract it to a transport-free service and let both call it.
- Rate limiters named in `AppServiceProvider`: `voting` (10/min), `public-api` (60/min per IP), `mcp` (120/min, keyed by API token id so one agent cannot starve another behind the same IP), `studio-submit`; widget endpoints 60/min.
- Role middleware aliases: `admin`, `transit_admin` (variadic, takes capability params), `syofficial_admin`, `phonebook_admin`, `places_admin`, `polls_admin`, `superadmin`; `GovAppsAdmin` is applied by FQCN and has no alias. Superadmin bypasses gates via `Gate::before`.
- Capability ids live **only** in `app/Support/Permissions/PermissionCatalogue.php` — the Filament user form and agent API tokens both read it. Never introduce a second permission vocabulary.
- `admin` is the catch-all staff role and holds every capability; `superadmin` additionally bypasses `Gate`. A `role=admin` user with an empty `permissions` array still passes capability checks.
- Role → module implications live **only** in `User::ROLE_MODULE_PREFIXES`. `UserResource::roleOptions()` and `AutoLoginDevUser::DEV_ROLES` must both cover it; tests enforce both, since a role missing from the form is unassignable and one missing from dev impersonation is untestable.
- Capability checks in React go through `useAuth().can()` against the server-resolved `effective_permissions`. Never re-derive role implications in TypeScript — use `User::effectivePermissions()` server-side and share the result via `HandleInertiaRequests::userPayload()`.
- Agent (MCP) tools live in `app/Mcp/`, extend `AuditedTool`, and share domain services with the dashboard controllers rather than re-implementing rules. Token minting lives at `/admin/api-tokens` like every other admin section — not in Filament. Authorisation is an AND: user permission AND token ability. See [modules/agent-mcp.md](../modules/agent-mcp.md).
- CSRF exceptions are explicit in `bootstrap/app.php` (studio routes, poll votes, submit, guesswho broadcasting auth).
- Public voting data must never select `voter_key` / `ip_hash` / `user_agent` / poll owner columns — keep column selection explicit.
- Migrations follow the create-then-alter history; avoid resurrecting dropped tables (place likes/comments/reports were removed deliberately).
- **UserFactory role trap**: factories default to role `admin` — override when seeding non-admin users.

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

## Commits

Conventional-ish format: `feat(module): …`, `fix(module): …` (see root CONTRIBUTING.md).
