# Developer Setup & Local Environment Guide

Welcome to the Syrian Zone development guide! This document outlines how to set up your local development environment, run database seeders, and work with application assets.

---

## 1. Prerequisites

- **PHP**: 8.2 or higher (with `pdo_sqlite` or `pdo_mysql`, `gd`, `zip`, `mbstring` extensions)
- **Composer**: 2.x
- **Node.js & Bun / NPM**: Node 18+ and `bun` (recommended) or `npm`
- **Database**: SQLite (default for dev) or MySQL/PostgreSQL

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
   ```

6. **Install & Start Frontend Dev Server**:
   ```bash
   bun install
   bun run dev
   ```

7. **Start Laravel Backend Server**:
   ```bash
   php artisan serve
   ```
   Open `http://localhost:8000` in your browser.

---

## 3. Working with Assets & Media

All static media assets (candidate avatars, official entity logos, GeoJSON maps, BrandKit downloads) are hosted externally on **Cloudflare R2 CDN**. 

- **No Local Media Download Needed**: When running the app locally, all image URLs resolve automatically to the public CDN.
- **Detailed Asset Architecture**: See [docs/asset-storage.md](file:///run/media/hadi/SSD2/Coding/syrianzone/docs/asset-storage.md) for R2 bucket layout, superadmin asset manager, and environment configuration options.

---

## 4. Useful Artisan Commands

- `php artisan cache:clear` — Clear Laravel application and database query caches.
- `php artisan db:seed --class=StagingSeeder` — Re-seed dev database with fresh test data.
- `php artisan geojson:upload-to-r2` — Upload master GeoJSON files to R2 bucket.
- `php artisan tierlist:migrate-to-r2` — Migrate tierlist candidate images to R2 storage.
