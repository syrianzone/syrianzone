# Syrian Zone — Documentation Index

Canonical task-oriented router and complete index of all active documentation in `docs/`.
Start with [`AGENTS.md`](../AGENTS.md) for non-negotiable rules and `bash scripts/gate.sh` for the CI quality gate.

---

## Task-Oriented Quick Router

| I want to… | Start here |
|---|---|
| Run the app locally & seed dev data | [getting-started/development.md](getting-started/development.md) |
| Understand the codebase layout & modules | [architecture/system_map.md](architecture/system_map.md) |
| Build UI, use themes, tokens, or shared primitives | [guidelines/design-and-conventions.md](guidelines/design-and-conventions.md) · [architecture/brand-and-ui-system.md](architecture/brand-and-ui-system.md) |
| Check accessibility rules & run the axe gate | [guidelines/accessibility.md](guidelines/accessibility.md) |
| Add/update SEO metadata, JSON-LD, or OG cards | [guidelines/seo.md](guidelines/seo.md) |
| Work on bundle size, compression, or list perf | [architecture/performance.md](architecture/performance.md) |
| Call or add a `/api/v1` endpoint | [reference/api.md](reference/api.md) · [reference/routes-api-map.md](reference/routes-api-map.md) |
| Inspect database tables or R2 asset storage | [reference/database-schema.md](reference/database-schema.md) · [reference/asset-storage.md](reference/asset-storage.md) |
| Deploy to production or staging | [getting-started/deployment.md](getting-started/deployment.md) · [getting-started/staging.md](getting-started/staging.md) |
| Update official CVs from SANA / Al-Ikhbariya | [runbooks/govtcvs-official-updates.md](runbooks/govtcvs-official-updates.md) |

---

## Complete Active Documentation Index

### Getting Started
| Document | Description |
|---|---|
| [getting-started/development.md](getting-started/development.md) | Prerequisites, local quickstart, seeders, dev server, useful artisan commands |
| [getting-started/deployment.md](getting-started/deployment.md) | Production Docker image (`inertia-ssr`, Brotli-11/Gzip-9 precompression, PHP CVE mitigations), CI → ghcr.io, blue/green zero-downtime switch, backups, rollback |
| [getting-started/staging.md](getting-started/staging.md) | `staging.syrian.zone` sibling stack and operational caveats |

### Architecture
| Document | Description |
|---|---|
| [architecture/system_map.md](architecture/system_map.md) | High-level architecture diagram, tech stack, directory map, request flows, complete module index |
| [architecture/brand-and-ui-system.md](architecture/brand-and-ui-system.md) | Al-Madar tokens, 14 concrete themes + `system`, Beiruti + IBM Plex typography, `Components/brand\|layout\|directory\|share`, OG & X-card pipeline |
| [architecture/performance.md](architecture/performance.md) | Vite 8/Rolldown chunking, Docker Brotli-11/Gzip-9 precompression, `useProgressiveList`, font subsetting, Ramadan thumbnails |

### Guidelines & Standards
| Document | Description |
|---|---|
| [guidelines/design-and-conventions.md](guidelines/design-and-conventions.md) | Styling, 15-entry theme registry, RTL, layering (`Pages → Domain → shared`), shared primitives, backend conventions, testing & quality gate |
| [guidelines/accessibility.md](guidelines/accessibility.md) | WCAG A+AA standard: landmarks, labels, feedback, forms, tabs, RTL, contrast across 14 themes, 74+ route axe gate |
| [guidelines/seo.md](guidelines/seo.md) | Server-rendered meta (`SeoMeta`), canonical/OG/Twitter cards, JSON-LD, sitemap & robots |

### Modules
| Document | Description |
|---|---|
| [modules/agent-mcp.md](modules/agent-mcp.md) | Agent/MCP surface at `/mcp/admin` — tokens, permission ceiling, audit trail |
| [modules/board.md](modules/board.md) | "لوحتي" widget dashboard at `/board` — normative spec |
| [modules/directories.md](modules/directories.md) | SyOfficial, Phonebook, Gov Apps, and Hotels directories |
| [modules/games.md](modules/games.md) | Games hub at `/games`: 2048, Solitaire, Tarneeb, Trix, and FakeNewsTest (`/games/fakenews`) |
| [modules/guess-who.md](modules/guess-who.md) | Multiplayer Guess Who game relayed over Laravel Reverb |
| [modules/mishwar-places.md](modules/mishwar-places.md) | Hidden Places ("مشوار") at `/mishwar` — data model, image pipeline, API, moderation |
| [modules/muslim-corner.md](modules/muslim-corner.md) | Muslim Corner: prayer times, Quran reader, followed-recitation radio, Ramadan imsakiya |
| [modules/population-atlas.md](modules/population-atlas.md) | Population & climate atlas at `/atlas` (legacy `/population` redirects) |
| [modules/promises.md](modules/promises.md) | Promises tracker (`عداد الوعود`) at `/promises` — data model, pages, admin, wiring |
| [modules/settings-sync.md](modules/settings-sync.md) | Device ↔ account preference sync: conflict modal, location key families, single account writer |
| [modules/tierlist-x-automation.md](modules/tierlist-x-automation.md) | Requirements and acceptance criteria for `@SyrianZone` tierlist announcements on X |
| [modules/transit.md](modules/transit.md) | Transit maps, community Transit Studio, and moderation workflow |
| [modules/wildlife.md](modules/wildlife.md) | Syrian wildlife guide (`/wild`) — data model, sourcing rules, verification |

### Reference
| Document | Description |
|---|---|
| [reference/api.md](reference/api.md) | Central `/api/v1` reference — all public, search, transit, polls, places, promises, user, and admin JSON endpoints + error contract |
| [reference/asset-storage.md](reference/asset-storage.md) | Cloudflare R2 bucket layout, asset manager, and local dev fallback |
| [reference/database-schema.md](reference/database-schema.md) | ER-style schema chart of every table (from migrations) |
| [reference/routes-api-map.md](reference/routes-api-map.md) | Full web + API route map grouped by feature |

### Runbooks
| Document | Description |
|---|---|
| [runbooks/govtcvs-official-updates.md](runbooks/govtcvs-official-updates.md) | Editorial ops playbook (intentionally in Arabic) for tracking and applying official decree/cabinet updates to `/govtcvs` |

### Security & Threat Models
| Document | Description |
|---|---|
| [security/tierlist-x-automation-threat-model.md](security/tierlist-x-automation-threat-model.md) | Threat model for tierlist X announcements |
| [security/tierlist-x-automation-assessment.md](security/tierlist-x-automation-assessment.md) | Security assessment and verification evidence for tierlist X announcements |
| [security/threat-model-review-report.md](security/threat-model-review-report.md) | Scoped threat-model review for bounded answer discovery and X command diagnostics |

### Architecture Decision Records (ADRs)
| Document | Description |
|---|---|
| [adr/0001-architecture-decision-records.md](adr/0001-architecture-decision-records.md) | ADR policy and template |
| [adr/0002-durable-tierlist-social-outbox.md](adr/0002-durable-tierlist-social-outbox.md) | Durable outbox architecture for tierlist X delivery |
| [adr/0003-zero-downtime-deploys.md](adr/0003-zero-downtime-deploys.md) | Blue/green deploys behind Caddy health checks and slimmer boot |

### Platform & Ecosystem
| Document | Description |
|---|---|
| [platform/android-twa.md](platform/android-twa.md) | Bubblewrap TWA packaging of the PWA for Google Play |
| [ecosystem.md](ecosystem.md) | Satellite subdomain projects outside this repository |

### Archive (Historical)
- [archive/ui-ux-simplification-exploration.md](archive/ui-ux-simplification-exploration.md) — historical pre-redesign UI/UX exploration audit (retained for context; superseded by the Al-Madar redesign).
