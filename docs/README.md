# Syrian Zone — Documentation

Documentation for [syrian.zone](https://syrian.zone) — a civic/community portal monolith built with **Laravel 13 + Inertia.js + React 19**.

## Documentation Map

The docs folder mirrors the project structure: `getting-started/` for running the app, `architecture/` for how it fits together, `modules/` per feature area (matching `app/Http/Controllers` groupings), `reference/` for schemas/routes/assets/APIs, and `guidelines/` for conventions.

| Path | Contents |
|---|---|
| **Getting started** | |
| [getting-started/development.md](getting-started/development.md) | Prereqs, quickstart, seeders, dev commands, useful artisan commands |
| [getting-started/deployment.md](getting-started/deployment.md) | Production Docker stack on the VPS, CI → ghcr.io flow, backups, rollback |
| [getting-started/staging.md](getting-started/staging.md) | staging.syrian.zone sibling stack and its traps |
| **Architecture** | |
| [architecture/system_map.md](architecture/system_map.md) | High-level architecture diagram, tech stack, directory map, module index, request flows |
| [adr/0001-architecture-decision-records.md](adr/0001-architecture-decision-records.md) | Architecture decision record policy |
| [adr/0002-durable-tierlist-social-outbox.md](adr/0002-durable-tierlist-social-outbox.md) | Tierlist X delivery architecture |
| [specs/tierlist-x-automation.md](specs/tierlist-x-automation.md) | Requirements and acceptance criteria for tierlist announcements |
| [threat-models/tierlist-x-automation.md](threat-models/tierlist-x-automation.md) | Security analysis for tierlist announcements |
| [security/tierlist-x-automation-assessment.md](security/tierlist-x-automation-assessment.md) | Security assessment and verification evidence for tierlist announcements |
| **Modules** (one doc per feature area) | |
| [modules/board.md](modules/board.md) | "لوحتي" widget dashboard at `/board` — normative spec |
| [modules/mishwar-places.md](modules/mishwar-places.md) | Hidden Places ("مشوار") at `/mishwar` — largest spec; §2 doubles as repo-wide code conventions |
| [modules/agent-mcp.md](modules/agent-mcp.md) | Agent/MCP surface at `/mcp/admin` — tokens, the permission ceiling, audit trail |
| [modules/transit.md](modules/transit.md) | Transit maps + community Transit Studio + moderation workflow |
| [modules/guess-who.md](modules/guess-who.md) | Multiplayer Guess Who game (state relayed over Reverb) |
| [modules/directories.md](modules/directories.md) | SyOfficial, Phonebook, Gov Apps, Hotels directories |
| [modules/muslim-corner.md](modules/muslim-corner.md) | Muslim Corner: prayer times, Quran reader, followed-recitation radio |
| [modules/games.md](modules/games.md) | Games hub at `/games`: 2048, solitaire, tarneeb, trix (plus Guess Who / president), one real route per game |
| [modules/population-atlas.md](modules/population-atlas.md) | Population & climate atlas at `/atlas` (legacy `/population` redirects) |
| **Reference** | |
| [reference/api.md](reference/api.md) | **Central API Reference (`/api/v1`)** — all public, search, transit, polls, places, user, and admin JSON endpoints + error contract + legacy aliases |
| [reference/routes-api-map.md](reference/routes-api-map.md) | Full web + API route map grouped by feature |
| [reference/database-schema.md](reference/database-schema.md) | ER-style schema chart of every table (from migrations) |
| [reference/asset-storage.md](reference/asset-storage.md) | Cloudflare R2 bucket layout, asset manager, local dev fallback |
| **Guidelines** | |
| [guidelines/design-and-conventions.md](guidelines/design-and-conventions.md) | Styling/design tokens, RTL rules, language/i18n, theming, shadcn patterns, backend/frontend conventions |
| [guidelines/accessibility.md](guidelines/accessibility.md) | Accessibility standard: landmarks, labels, feedback, forms, tabs, RTL, contrast, the axe gate |
| [guidelines/seo.md](guidelines/seo.md) | SEO: server-rendered meta (SeoMeta), canonical/OG/Twitter, JSON-LD, sitemap/robots, per-page audit |
| **Platform** | |
| [platform/android-twa.md](platform/android-twa.md) | Bubblewrap TWA packaging of the PWA for Play Store |
| [ecosystem.md](ecosystem.md) | Satellite subdomain projects outside this repo |

## Project at a Glance

- **Stack**: Laravel 13 (PHP 8.3+), Filament v5, Inertia v3, React 19, TypeScript, Vite 8, Tailwind CSS v4, MySQL/MariaDB (+ spatial), Reverb websockets, Cloudflare R2 storage
- **Dev**: `bun install && bun run dev` (or `composer dev` / `npm run dev`)
- **Tests**: `vendor/bin/pest` · **Lint**: `vendor/bin/pint`
- **License**: MIT — see root `README.md` (Arabic) for project mission and contributors
