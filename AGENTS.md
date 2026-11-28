# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository. Read this
first; it points to the detailed, normative docs under `docs/` (see
[docs/INDEX.md](docs/INDEX.md)).

Syrian Zone is a Laravel 13 + Inertia + React 19 + TypeScript monolith for a
civic portal (Arabic, RTL). Stack and commands:

```bash
bun install && bun run dev        # dev: artisan serve + reverb + vite
npm run build                     # vite build + ssr build
bash scripts/gate.sh              # THE GATE: tsc + lint + vitest + build + answer-card + og:check + pest (+ advisory Pint); CI runs this
npm run lint                      # eslint: rules-of-hooks, no-alert, no-console, no direct axios
npm run test:js                   # vitest (layering, theme contrast, a11y/RTL structure, unit tests)
vendor/bin/pest                   # PHP tests only
vendor/bin/pint                   # PHP lint (pint.json excludes routes/web.php & bootstrap/app.php)
npx tsc --noEmit                  # typecheck
python3 scripts/a11y_axe_audit.py --base http://localhost:8000   # a11y gate
```

## Non-negotiable conventions

These are enforced by docs, by tests, and (where possible) by tooling. Follow
them without being asked.

1. **Accessibility** — every page has one `<main>` and one `<h1>`; every control
   has an accessible name; outcomes use `Lib/notify.ts`; destructive actions use
   `confirmDialog()`; real tabs use `Lib/useTabList.ts`; no `<Badge onClick>`; no
   native `alert`/`confirm`. `resources/js/a11yStructure.test.ts` guards dialog/sheet
   titles, RTL spacing, and `<Badge onClick>`. The axe sweep must stay at **0 violations**.
   → [docs/guidelines/accessibility.md](docs/guidelines/accessibility.md)
2. **RTL** — the document is RTL. Use logical utilities (`ms/me/ps/pe`,
   `start/end`, `border-s/e`), never physical `ml/mr/pl/pr` or `left/right`
   outside a deliberate `dir="ltr"` island.
3. **Theming** — colour is always a token (`hsl(var(--…))` or a token class);
   never a literal hex. The theme is two attributes set together at
   `document.documentElement`: `data-theme` (which theme) and `data-scheme`
   (`light`/`dark`, which the dark tokens and the `dark:` variant key off).
   `resources/data/themes.json` defines 14 concrete themes plus `system`
   (resolving to `nili` / `nili-night`), read by `Lib/theme.ts` and Blade.
   `Lib/theme.test.ts` verifies WCAG contrast across all 14 themes.
4. **Language** — product copy is Arabic (RTL); code, comments, commits and docs
   are English. Quran-related names follow the `quranic-terminology-lint` hook.
5. **No overlapping abstractions** — search `Components/` and `Components/ui/`
   before writing anything, including shared brand (`Components/brand/`), layout
   (`Components/layout/`), share (`Components/share/`), directory
   (`Components/directory/ResponsiveTable`), and `Lib/useProgressiveList`. One
   primitive per concern; extend it with a prop instead of forking.
   → [docs/guidelines/design-and-conventions.md](docs/guidelines/design-and-conventions.md)
6. **Layering** — dependencies run `Pages/<Feature>` → `Domain/<module>` →
   `Components/`+`Lib/`+`Layouts/`+`Contexts/`+`Providers/`. The shared layer and
   `Domain/` never import `Pages/**`, and no feature imports another feature.
   `resources/js/layering.test.ts` enforces it (`npm run test:js`).
   → [docs/guidelines/design-and-conventions.md §Layering](docs/guidelines/design-and-conventions.md#layering-pages--domain--shared)
7. **One API client** — browser JSON calls go through `resources/js/Lib/api.ts`
   (`api.get/post/put/patch/delete`, `apiErrorMessage`, `apiFieldErrors`), with
   typed per-resource functions in `Domain/<module>/api.ts`. Never import
   `axios`, spell an `/api/...` URL in a page or component, read the CSRF cookie
   by hand, or swallow an API failure. → [docs/reference/api.md](docs/reference/api.md)

## Where the rules live

| Topic | Doc |
|---|---|
| Docs map & entry points | [docs/INDEX.md](docs/INDEX.md) |
| Styling, tokens, RTL, backend/frontend conventions, testing | [docs/guidelines/design-and-conventions.md](docs/guidelines/design-and-conventions.md) |
| Accessibility standard + axe gate | [docs/guidelines/accessibility.md](docs/guidelines/accessibility.md) |
| SEO: server-rendered meta, canonical/OG, JSON-LD, sitemap | [docs/guidelines/seo.md](docs/guidelines/seo.md) |
| Feature specs (board, transit, mishwar, muslim, …) | [docs/modules/](docs/modules/) |
| Architecture, routes, schema | [docs/architecture/system_map.md](docs/architecture/system_map.md), [docs/reference/](docs/reference/) |

## Pitfalls (things that have bitten us)

- **Do not run Pint on `routes/web.php` or `bootstrap/app.php`** — `pint.json`
  excludes them because Pint's fixers rewrite FQCNs/aliases and break them.
- **Worktrees and `vendor/`** — never symlink `vendor/` from the main checkout
  into a git worktree: Composer resolves `app/` relative to `vendor/`'s realpath,
  so Pest would run the main repo's code instead of the worktree's. `gate.sh` blocks this.
- **Do not add a second `<main>`, a second Toaster, or a second theme switcher.**
- **Do not re-derive permissions in TypeScript** — use `useCan()` (`Lib/useCan.ts`) against
  the server-resolved `effective_permissions`.
- When you finish a UI change, run the axe sweep and `tsc`; don't claim it works
  without them.
- **Production deploys overlap two releases for a few seconds** (blue/green,
  [ADR-0003](docs/adr/0003-zero-downtime-deploys.md)). A migration must not
  break the previous release: add first, drop in a later release. Keep
  `docker/10-startup.sh` to what a request needs; anything else goes in
  `docker/s6/post-boot-run`. There is no `syrianzone-app` container any more:
  run artisan with `docker exec "$(cat /opt/syrianzone/active-container)" …`.

<!--
This file is the vendor-neutral entry point read by Codex, Cursor, opencode,
Jules, Amp and others. Keep it short and imperative; put depth in docs/.
-->
