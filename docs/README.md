# Syrian Zone — Documentation

Documentation for [syrian.zone](https://syrian.zone) — a civic/community portal monolith built with **Laravel 13 + Inertia.js + React 19**.

👉 **See [`docs/INDEX.md`](INDEX.md)** for the canonical task-oriented router and complete index of every active document (enforced by `tests/Feature/Tooling/DocsIndexCoverageTest.php`).

## Project at a Glance

- **Agent & contributor rules**: [`AGENTS.md`](../AGENTS.md) · [`CONTRIBUTING.md`](../CONTRIBUTING.md)
- **Shared facts (`resources/data/`)**: [`resources/data/README.md`](../resources/data/README.md)
- **Stack**: Laravel 13 (PHP 8.3+, runtime image PHP 8.4), Filament v5, Inertia v3 (with `inertia-ssr`), React 19, TypeScript, Vite 8 (Rolldown), Tailwind CSS v4, MySQL/MariaDB (+ spatial), Reverb websockets, Cloudflare R2 storage
- **Dev**: `bun install && bun run dev`
- **Quality gate**: `bash scripts/gate.sh` (`tsc`, ESLint, Vitest, Vite client + SSR build, answer-card tests, Pest, advisory Pint)
- **License**: MIT — see root `README.md` (Arabic) for project mission and contributors
