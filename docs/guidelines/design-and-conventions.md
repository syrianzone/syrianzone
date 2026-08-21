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
- Business logic isolated in `app/Services` (e.g. `PlaceImageService`, `HalaSyriaService`).
- Rate limiters named in `AppServiceProvider`: `voting` (10/min), `public-api` (60/min per IP); widget endpoints 60/min.
- Role middleware aliases: `admin`, `transit_admin`, `syofficial_admin`, `phonebook_admin`, `superadmin`; superadmin bypasses gates via `Gate::before`.
- CSRF exceptions are explicit in `bootstrap/app.php` (studio routes, poll votes, submit, guesswho broadcasting auth).
- Public voting data must never select `voter_key` / `ip_hash` / `user_agent` / poll owner columns — keep column selection explicit.
- Migrations follow the create-then-alter history; avoid resurrecting dropped tables (place likes/comments/reports were removed deliberately).
- **UserFactory role trap**: factories default to role `admin` — override when seeding non-admin users.

## Testing & quality

- **Pest** (`vendor/bin/pest`), RefreshDatabase auto-applied; sqlite :memory:, array cache/session drivers.
- Lint/format with **Pint** (`vendor/bin/pint`).
- Feature suites cover Polls, Places, Voting API, Weather, Sitemap, Prayer, middleware, models, VotingService.

## Commits

Conventional-ish format: `feat(module): …`, `fix(module): …` (see root CONTRIBUTING.md).
