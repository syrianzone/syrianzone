# Cloudflare R2 Asset Storage & CDN Guide

This document explains how static assets (Candidate avatars, user avatars, Guess Who character images, GeoJSON map datasets, brand kits, and uploaded files) are stored, served, and managed in the Syrian Zone platform.

---

## 1. Architecture Overview

To maintain a lightweight Git repository and ensure lightning-fast global delivery, large static assets and media files are stored externally in a **Cloudflare R2 Bucket** and served via Cloudflare's global CDN network.

* **Primary CDN Endpoint**: `https://pub-1d51b625c56e4fd085c58a79672e1b15.r2.dev`)
* **Laravel Disk Name**: `r2` (configured in `config/filesystems.php`)
* **Local Fallback**: In local development (`APP_ENV=local`), if R2 credentials are not set, the application automatically falls back to serving public R2 CDN URLs directly over HTTPS.

---

## 2. Directory Structure on R2

The Cloudflare R2 bucket follows a clean, organized directory layout:

| Bucket Folder | Description | Example File Path |
| :--- | :--- | :--- |
| `tierlist/candidates/` | Candidate profile pictures for tierlist evaluation polls | `tierlist/candidates/gov01.jpg` |
| `syofficial/entities/` | Official entity logos, minister photos, and embassy flags | `syofficial/entities/gov-damascus.webp` |
| `avatars/{userId}/` | User avatars via `AvatarService` (256×256 WebP, fresh UUID per upload for CDN busting) | `avatars/42/9f3c….webp` |
| `guesswho/characters/` | Guess Who character images (public disk, rendered via `/storage/…`) | `guesswho/characters/abc.webp` |
| `downloads/` | Large downloadable archives (BrandKit zip, master GeoJSON files) | `downloads/brandkit.zip` |
| `uploads/` | General superadmin uploaded assets | `uploads/sample-asset.png` |

---

## 3. Local Development Seeding

When setting up local development, developers do **not** need to manually download or host image files. The database seeders automatically format candidate and entity image paths to point to the live R2 CDN endpoints:

### Seeding Tierlist Polls
```bash
php artisan db:seed --class="Database\Seeders\Staging\StagingPollsSeeder"
```
Seeds demo tierlist polls (`best-ministers`, `staging-mayors`) with candidates, scores, and candidate avatar URLs pointing to Cloudflare R2.

### Seeding SyOfficial Entities
```bash
php artisan db:seed --class=SyOfficialSeeder
```
Seeds official government entities, ministries, and embassies with normalized R2 CDN image URLs.

### Seeding Full Staging Environment
```bash
php artisan db:seed --class=StagingSeeder
```
Executes all staging seeders (Users, Places, Tierlists, Transit, Guess Who, and Contributors).

---

## 4. SuperAdmin R2 Asset Manager (`/admin/assets`)

SuperAdmin users can inspect, upload, and download R2 assets directly from the web application dashboard:

- **Route**: `GET /admin/assets` (accessible via Dashboard -> "إدارة ومستكشف أصول R2 CDN").
- **Features**:
  - **File Explorer**: Browse and search all R2 objects filtered by folder badges.
  - **URL Copy & Preview**: Copy direct R2 CDN URLs to clipboard or preview image thumbnails.
  - **Upload New Asset**: Upload files up to 50MB directly to R2 bucket folders.
  - **Download All (ZIP)**: Download a single `.zip` archive containing all stored R2 assets for backups or offline inspection.

---

## 5. User Avatars (`AvatarService`)

- Upload endpoint `POST /api/account/avatar` (throttle 10/min) → `AvatarService::update()` → 256×256 WebP at `avatars/{userId}/{uuid}.webp`, stored on `filesystems.media_disk`, `users.avatar_url` updated.
- **URL contract**: local disks return a root-relative `/storage/…` path (not `Storage::url()`, which prefixes `APP_URL` and breaks when `APP_URL` carries a path suffix/trailing slash); S3/R2 disks return their absolute URL.
- Old files are deleted only when the old URL path contains `/avatars/{userId}/`, so Google `lh3` URLs and pre-`MEDIA_DISK`-switch files are handled safely (disk uses `throw=false`, failed deletes never bubble).
