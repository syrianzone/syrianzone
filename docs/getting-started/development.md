# Developer Setup & Local Environment Guide

Welcome to the Syrian Zone development guide! This document outlines how to set up your local development environment, run database seeders, and work with application assets.

---

## 1. Prerequisites

- **PHP**: 8.3 or higher (with `pdo_sqlite` or `pdo_mysql`, `gd`, `zip`, `mbstring`, `intl`, `exif` extensions)
- **Composer**: 2.x
- **Node.js & Bun / NPM**: Node 20.19+ or 22.12+ (Vite 8's engine floor) and `bun` (recommended) or `npm`
- **Database**: SQLite (default for dev) or MySQL/MariaDB (production; spatial columns need it)

---

## 2. Quickstart Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/syrianzone/syrianzone.git
   cd syrianzone
   ```

2. **Install PHP Dependencies**:
   ```bash
   composer install
   ```

3. **Configure Environment File**:
   ```bash
   cp .env.example .env
   php artisan key:generate
   ```

4. **Run Migrations**:
   ```bash
   php artisan migrate
   ```
5. **Seed Initial / Staging Data**:
   ```bash
   # Seed essential tierlists, maps, and official entities with R2 CDN links:
   php artisan db:seed --class="Database\Seeders\Staging\StagingPollsSeeder"
   php artisan db:seed --class=SyOfficialSeeder

   # Or run full staging seeder suite:
   php artisan db:seed --class=StagingSeeder

   # Population & Climate Atlas (not part of StagingSeeder), see docs/modules/population-atlas.md:
   php artisan db:seed --class=PopulationAtlasSeeder
   ```

6. **Install & Start the Dev Stack**:
   ```bash
   bun install
   bun run dev
   ```
   `bun run dev` is the whole stack: it builds the SSR bundle once, then runs
   `php artisan serve`, `php artisan reverb:start`, Vite (with an SSR rebuild
   watcher) and the SSR server together. Open `http://localhost:8000` in your
   browser. Do not also start `php artisan serve` by hand: the port is taken.

---

## 3. Working with Assets & Media

All static media assets (candidate avatars, official entity logos, GeoJSON maps, BrandKit downloads) are hosted externally on **Cloudflare R2 CDN**. 

- **No Local Media Download Needed**: When running the app locally, all image URLs resolve automatically to the public CDN.
- **Detailed Asset Architecture**: See [Asset Storage Guide](../reference/asset-storage.md) for R2 bucket layout, superadmin asset manager, and environment configuration options.

---

## 4. Useful Artisan Commands

- `php artisan cache:clear` — Clear Laravel application and database query caches.
- `php artisan db:seed --class=StagingSeeder` — Re-seed dev database with fresh test data.
- `php artisan geojson:upload-to-r2` — Upload master GeoJSON files to R2 bucket.
- `php artisan tierlist:migrate-to-r2` — Migrate tierlist candidate images to R2 storage.

---

## 5. Testing

- PHP (Pest): `vendor/bin/pest` · **Lint**: `vendor/bin/pint`
- JS (Vitest): `bun run test:js` (or `bun run test:js:watch`) — runs the pure `*.test.ts` engine suites (games rules, Quran alignment, etc.)
- `phpunit.xml` forces `AUTO_LOGIN_DEV=false` (with `force="true"`), so a stray `AUTO_LOGIN_DEV=true` in `.env` cannot leak through `AutoLoginDevUser` and override `actingAs()` identities during tests.
