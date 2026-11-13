# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository. Read this
first; it points to the detailed, normative docs under `docs/`.

Syrian Zone is a Laravel 13 + Inertia + React 19 + TypeScript monolith for a
civic portal (Arabic, RTL). Stack and commands:

```bash
bun install && bun run dev        # dev: artisan serve + reverb + vite
npm run build                     # vite build + ssr build
bash scripts/gate.sh              # THE GATE: tsc + vitest + pest (+ advisory Pint); CI runs this
npm run test:js                   # vitest only
vendor/bin/pest                   # PHP tests only
vendor/bin/pint                   # PHP lint (see caveat below)
npx tsc --noEmit                  # typecheck
python3 scripts/a11y_axe_audit.py --base http://localhost:8000   # a11y gate
```

## Non-negotiable conventions

These are enforced by docs, by tests, and (where possible) by tooling. Follow
them without being asked.

1. **Accessibility** — every page has one `<main>` and one `<h1>`; every control
   has an accessible name; outcomes use `Lib/notify.ts`; destructive actions use
   `confirmDialog()`; real tabs use `Lib/useTabList.ts`; no `<Badge onClick>`; no
   native `alert`/`confirm`. The axe sweep must stay at **0 violations**.
   → [docs/guidelines/accessibility.md](docs/guidelines/accessibility.md)
2. **RTL** — the document is RTL. Use logical utilities (`ms/me/ps/pe`,
   `start/end`, `border-s/e`), never physical `ml/mr/pl/pr` or `left/right`
   outside a deliberate `dir="ltr"` island.
3. **Theming** — colour is always a token (`hsl(var(--…))` or a token class);
   never a literal hex. The theme is two attributes set together at
   `document.documentElement`: `data-theme` (which theme) and `data-scheme`
   (`light`/`dark`, which the dark tokens and the `dark:` variant key off). The
   registry — ids, labels, storage keys, dark flags — is
   `resources/data/themes.json`, read by `Lib/theme.ts` and by Blade.
   Every theme must pass contrast (`--primary` ↔ `--primary-foreground`).
4. **Language** — product copy is Arabic (RTL); code, comments, commits and docs
   are English. Quran-related names follow the `quranic-terminology-lint` hook.
5. **No overlapping abstractions** — search `Components/` and `Components/ui/`
   before writing anything. One primitive per concern; extend it with a prop
   instead of forking. → [docs/guidelines/design-and-conventions.md](docs/guidelines/design-and-conventions.md)
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
| Styling, tokens, RTL, backend/frontend conventions, testing | [docs/guidelines/design-and-conventions.md](docs/guidelines/design-and-conventions.md) |
| Accessibility standard + axe gate | [docs/guidelines/accessibility.md](docs/guidelines/accessibility.md) |
| SEO: server-rendered meta, canonical/OG, JSON-LD, sitemap | [docs/guidelines/seo.md](docs/guidelines/seo.md) |
| Feature specs (board, transit, mishwar, muslim, …) | [docs/modules/](docs/modules/) |
| Architecture, routes, schema | [docs/architecture/system_map.md](docs/architecture/system_map.md), [docs/reference/](docs/reference/) |

## Pitfalls (things that have bitten us)

- **Do not run Pint on `routes/web.php` or `bootstrap/app.php`** — its fixers
  rewrite FQCNs/aliases and break the file. See design-and-conventions §Testing.
- **Do not add a second `<main>`, a second Toaster, or a second theme switcher.**
- **Do not re-derive permissions in TypeScript** — use `useCan()` (`Lib/useCan.ts`) against
  the server-resolved `effective_permissions`.
- When you finish a UI change, run the axe sweep and `tsc`; don't claim it works
  without them.

<!--
This file is the vendor-neutral entry point read by Codex, Cursor, opencode,
Jules, Amp and others. Keep it short and imperative; put depth in docs/.
-->
