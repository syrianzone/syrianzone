# Brand & UI System (Al-Madar / المدار)

Architectural overview of the Syrian Zone visual identity, theme tokens, typography, shared UI primitives, and social/OG share-card pipeline.

---

## 1. Al-Madar Tokens & Themes

Colour is always expressed through HSL CSS custom properties (`--background`, `--foreground`, `--primary`, `--primary-foreground`, `--muted`, `--muted-foreground`, `--card`, `--border`, `--accent`, …) declared in `resources/css/app.css` and mapped to Tailwind CSS v4 utilities via `@theme`. Literal hex or `rgb()` values in components are forbidden.

The active theme is represented by two attributes on `document.documentElement`, applied synchronously before first paint (`resources/views/app.blade.php`) and updated at runtime via `applyTheme()` in `resources/js/Lib/theme.ts`:

- `data-theme`: the active concrete theme id.
- `data-scheme`: `light` or `dark` (the single selector that shared dark tokens and Tailwind's `dark:` variant key off; CSS never enumerates dark theme ids).

`resources/data/themes.json` is the single registry (15 entries = 14 concrete themes + `system`), read by Blade, CSS, and TypeScript:

| Group | Theme IDs | Notes |
|---|---|---|
| `system` | `system` | Follows `prefers-color-scheme` → resolves to **`nili`** (light) or **`nili-night`** (dark) |
| `madar` (Al-Madar, 6) | `nili`, `nili-night`, `qashani`, `qashani-night`, `limestone`, `basalt` | Primary brand palettes (indigo/saffron, qashani tile teal, limestone/basalt & copper) |
| `standard` (6) | `light`, `dark`, `dark-blue`, `dark-purple`, `dark-green`, `high-contrast` | Classic light/dark variants + AAA-oriented high contrast |
| `heritage` (2) | `damascus-rose`, `jasmine` | Syrian heritage palettes |

Every concrete theme must maintain WCAG AA contrast in both directions (`--primary` vs. `--primary-foreground`, and `--muted-foreground` on `--background`). Theme switching is owned exclusively by `Components/AppearanceMenu`.

---

## 2. Typography

All web fonts are self-hosted under `public/fonts/` with `font-display: swap` and split by `unicode-range` so Arabic/Latin visitors download only the core subset:

- **Display — Beiruti (`750` / variable `700–800`)**: used for `.sz-display` and hero/page headings (`--font-display` / `--site-display-font`). Core subset `Beiruti-VariableFont_wght.woff2` (~32 KB) is preloaded in `resources/views/app.blade.php`; extended symbols live in `beiruti-ext.woff2`.
- **Body — IBM Plex Sans Arabic (`400` and `700`)**: sourced from `@ibm/plex-sans-arabic` (OFL-1.1), mapped to `font-weight: 400 500` and `font-weight: 600 700`. Core subsets (`regular.woff2`, `bold.woff2`) cover Arabic + basic Latin; extended glyphs (`-ext.woff2`) load only when needed.
- **Metric-matched fallback**: `IBM Plex Sans Arabic Fallback` (`local()`-only with `ascent-override: 108.5%`, `descent-override: 41.5%`, `line-gap-override: 0%`) prevents vertical CLS during font swap.
- **Quranic text**: `KFGQPC HAFS Uthmanic Script` (`public/fonts/quran-hafs.woff2`) via `.quran-rasm-uthmani`.

---

## 3. Shared UI Primitive Layers

Before building a new component, reuse the existing primitives under `resources/js/Components/` (see [guidelines/design-and-conventions.md](../guidelines/design-and-conventions.md#avoid-overlapping-abstractions)):

| Layer | Directory | Key Primitives |
|---|---|---|
| **Brand** | `Components/brand/` | `Logo` (variants + mono/custom colour overrides), `Node`, `Pattern` (`orbit`, `nodes`, `arcs`, `bowls`, `dots`, `tracks`), `Rings`, `SectionHeading`, `StatusBadge` (`done`, `progress`, `warning`, `late`, `pending`) |
| **Layout** | `Components/layout/` | `PageShell`, `PageBody`, `PageHeader` (with breadcrumbs), `PageToolbar`, `SplitLayout`, `KpiGrid`, `CardGrid`, `EmptyState`, `ReaderLayout`, `FlowLayout` — plus `Components/SiteFooter.tsx` |
| **Directory** | `Components/directory/` | `useDirectory`, `DirectorySearch`, `DirectoryFacetFilter`, `DirectoryFilterChips`, `DirectoryUnderlineTabs`, `DirectoryViewToggle`, `DirectoryResultCount`, `DirectoryEmptyState`, `DirectoryLoadMore`, `ResponsiveTable`, `ProgressiveListFooter`, `SortableList`, `CategoryDialog` |
| **Share** | `Components/share/` | `BrandShareFrame` (branded RTL card canvas), `ShareImageDialog` (preview, PNG export via `Lib/exportElementAsPng.ts`, Web Share / copy via `Lib/webShare.ts`) |
| **Base UI** | `Components/ui/` | shadcn-style Radix + CVA primitives (`button`, `card`, `dialog`, `sheet`, `alert`, `tabs`, `filter-chip`, `scroll-area`, `sonner`, …) |

---

## 4. OG & X-Card Pipeline

Social preview cards share the same brand tokens and icon catalogue so links on X, Telegram, WhatsApp, and Facebook stay visually consistent with the site:

1. **Static & dynamic OG cards (`scripts/og/` + `app/Support/Seo/Og/`)**:
   - `scripts/og/export-tokens.mjs` and `scripts/og/export-icons.tsx` export brand tokens and SVG icons from `resources/data/project-icons.json` for the Node renderer.
   - `scripts/og/build.mjs` generates static cards for routes in `resources/data/seo.json`; `app/Support/Seo/Og/NodeCardRenderer.php` renders per-record dynamic cards on demand with caching (`CardCache`, `CardImages`, `RecordCard`).
   - Covered by `scripts/og/og.test.ts` and `SeoMeta` (see [guidelines/seo.md](../guidelines/seo.md)).
2. **Answers & X automation cards (`scripts/answers-card/`)**:
   - `scripts/answers-card/render.mjs` renders branded Arabic PNG cards for `@SyrianZone` social posts, verified by `node --test scripts/answers-card/render.test.mjs` in `scripts/gate.sh`.
3. **In-browser share cards (`Components/share/`)**:
   - Interactive features (e.g. FakeNewsTest, Compass, Promises) wrap results in `BrandShareFrame` and export client-side PNGs via `ShareImageDialog` + `Lib/exportElementAsPng.ts`.
