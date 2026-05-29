# Syrian Zone: Laravel + Inertia.js Migration Handover Guide

Welcome to the **Syrian Zone** Inertia.js migration project. This document serves as a transition guide for incoming engineers tasked with implementing the consolidation of the decoupled Next.js 15 frontend and Laravel 11 API backend into a single, unified codebase.

---

## 1. Migration Overview & Current Status

The Syrian Zone portal currently runs as two separate applications:
1.  **Frontend**: Next.js 15 App Router (running in `/frontend`).
2.  **Backend**: Laravel 11 API with spatial (PostGIS) database adapters (running in `/backend`).

We have completed the planning, architectural audit, and file mapping for the migration. All blueprints, target directories, and step-by-step tasks are detailed in the [Laravel + InertiaJS Migration Plan](file:///run/media/hadi/SSD2/Coding/syrianzone/docs/inertia_migration_plan.md).

### The Migration Goal
To merge both environments so that:
*   Laravel serves as the single router, controller layer, and asset server.
*   React operates strictly as the client-side view layer compiled by Vite.
*   State is passed cleanly via Inertia.js props.
*   Cross-origin configurations (CORS) are completely removed.
*   Authentication is simplified into secure, cookie-based web session gates.

---

## 2. Quick Start Guide for Incoming Engineers

To begin working on this migration, follow these steps:

### Step 1: Checkout the Prepared Branch
All planning documentation has been committed to a dedicated branch. Ensure you are on this branch:
```bash
git checkout migration/inertia-prep
```

### Step 2: Study the Blueprints
Before touching any source code, read the following architectural documents inside `/docs`:
1.  [Inertia Migration Plan](file:///run/media/hadi/SSD2/Coding/syrianzone/docs/inertia_migration_plan.md): The master plan containing exact folder-to-folder mapping tables, controller blueprints, and transition phases.
2.  [Architecture Critique](file:///run/media/hadi/SSD2/Coding/syrianzone/docs/architecture_critique.md): Context on existing code issues (e.g. scattered API URLs, static SHA-256 local token admin auth) that must be refactored during the migration.
3.  [System Map](file:///run/media/hadi/SSD2/Coding/syrianzone/docs/system_map.md): High-level system structure, tech stack, and general data flows.
4.  [Transit Module Map](file:///run/media/hadi/SSD2/Coding/syrianzone/docs/transit_module_map.md): Deep dive into the spatial database schema and map wizard interactions.

### Step 3: Initialize the Project Task Tracker
We recommend copying the master checklist from the [Inertia Migration Plan](file:///run/media/hadi/SSD2/Coding/syrianzone/docs/inertia_migration_plan.md#6-master-task-list) into a localized `task.md` file in the repository root or project tracker to track implementation progress.
```bash
cp docs/inertia_migration_plan.md task.md
# Keep only the checklist section in task.md to track your completed, in-progress, and pending tasks.
```

---

## 3. High-Priority Execution Roadmap

The implementation is structured into 5 sequential phases. Focus on them one at a time:

### Phase 1: Environment Consolidation (The Setup)
*   **Action**: Move all files inside the `/backend` folder to the repository root directory. Remove or archive the `/backend` directory.
*   **Configuration**: Add the Inertia backend requirements to `composer.json` and install.
*   **JS Environment**: Merge package dependencies from `frontend/package.json` into the root `package.json`, then install NPM packages. Configure `vite.config.js` to enable the React plugin and specify the entrypoint `resources/js/app.tsx`.

### Phase 2: Global Shell & Layout
*   **Action**: Create the primary Blade container `resources/views/app.blade.php`.
*   **Styles**: Combine the Tailwind utilities and custom CSS definitions from `frontend/src/app/globals.css` into `resources/css/app.css`.
*   **Structure**: Relocate the persistent layouts (e.g., header, footer, navigation bar) to `resources/js/Layouts/`.

### Phase 3: Core Module Migrations (Iterative Page Merging)
*   **Migration order**:
    1.  **Home Page**: Simplest view to test Inertia rendering and markdown files reading.
    2.  **Verified Sites (`syofficial`)**: First database-dependent page migration.
    3.  **Opinion & Polling (`polls`, `tierlist`)**: Dynamic view migration with server-passed props.
    4.  **Spatial Mapping (`transit`, `population`)**: Heavy client-side map rendering (MapLibre and Leaflet) with local state hooks.

### Phase 4: Authentication Security Refactoring
*   **Action**: Remove stateless Sanctum token pipelines. Integrate standard web sessions.
*   **Admin Auth**: Eliminate the static token check and local storage. Move to a database-backed user role authenticated via stateful web guards.

---

## 4. Crucial Gotchas & Implementation Tips

Incoming developers must pay close attention to these three areas:

1.  **MapLibre GL Hydration Mismatches**:
    *   MapLibre GL relies heavily on browser-only API references (like `window` and `document`).
    *   Ensure that components importing MapLibre are initialized dynamically or rendered strictly inside client-side React lifecycle hooks (`useEffect`) to prevent compiler failures during SSR assembly.
2.  **Same-Origin Spatial Queries**:
    *   While page data should be supplied as Inertia props, interactive dynamic map operations (e.g., getting nearby stops via GPS coords, fetching the complete GeoJSON coordinate array for a city transit map) should remain async JSON endpoints.
    *   Do not trigger full Inertia page requests for these real-time queries. Query them using an same-origin Axios client pointing to standard API routes.
3.  **Third-Party Media Assets**:
    *   Next.js relative paths point to standard folders. Ensure all flag SVGs, download brand graphics, and static geo assets are consolidated inside the Laravel `/public` asset folders with correct file path names.

Good luck with the consolidation. This change will make the Syrian Zone platform significantly more secure, performant, and maintainable.
