# Syrian Zone: Production Deployment Guide

This document is a comprehensive guide to deploying the unified **Syrian Zone** application on a production server using a **Self-Hosted GitHub Runner** and the built-in deployment script (`deploy.sh`).

With the migration from Next.js + Laravel API to a unified same-origin **Laravel + Inertia.js + React** monolith complete, you only need to manage a single pipeline.

---

## 1. Pipeline Overview

The deployment uses a local compilation strategy where assets are built inside the runner's isolated workspace (`$SRC_DIR`) and then synced to the live production server directory (`$TARGET_DIR`, e.g., `/var/www/syrianzone`).

```mermaid
graph TD
    Push[1. git push to main] --> Workflow[2. GitHub Actions Triggers]
    Workflow --> Runner[3. Runner Workspace checkout]
    
    subgraph Build Phase (Runner Workspace)
        Runner --> Bun[4. Install Bun deps & Build Vite Assets]
    end
    
    subgraph Sync Phase
        Bun --> Sync[5. rsync to /var/www/syrianzone]
        style Sync fill:#f9f,stroke:#333,stroke-width:2px
    end
    
    subgraph Production Prep (Target Directory)
        Sync --> Composer[6. composer install --no-dev]
        Composer --> Migrate[7. php artisan migrate --force]
        Migrate --> Cache[8. Clear & Cache Configurations]
        Cache --> Reload[9. Restart PM2 Server]
    end
```

### Key Advantages of This Architecture:
1.  **CPU Isolation**: Compiling Vite assets (`bun run build`) is highly CPU and memory intensive. Building in the runner's workspace directory keeps the active production directory safe from CPU spikes or temporary downtime.
2.  **Clean File Syncing**: `rsync` ensures that only compiled production code is moved over. Development tools, `.git` histories, and `node_modules` (or Bun's node modules) are completely excluded, keeping the server lean and secure.
3.  **Immutable Production `.env`**: The production configuration file is excluded from the file sync, ensuring your production secrets are never accidentally modified or exposed.

---

## 2. Server Prerequisites

Ensure the following tools are installed on your production server:
*   **Operating System**: Linux (Ubuntu 22.04 LTS or newer recommended)
*   **PHP**: Version 8.2+ with extension dependencies (`php-mysql`, `php-xml`, `php-curl`, `php-mbstring`, `php-zip`, `php-bcmath`)
*   **Bun**: Bun 1.0+ (used as the primary package installer and fast JS runtime)
*   **Composer**: Global PHP package manager
*   **Web Server**: Nginx (configured as a reverse proxy)
*   **Process Manager**: PM2 (globally installed: `bun install -g pm2` or `npm install -g pm2`)
*   **File Sync Utility**: `rsync`

---

## 3. Step-by-Step Deployment Setup

### Step 1: Register the Self-Hosted GitHub Runner
1. Navigate to your GitHub Repository -> **Settings** -> **Actions** -> **Runners**.
2. Click **New self-hosted runner** and select **Linux**.
3. Log in to your production server and execute the commands provided under the **Download** and **Configure** sections.
4. It is recommended to register the runner as a background system service so it remains running indefinitely:
   ```bash
   sudo ./svc.sh install
   sudo ./svc.sh start
   ```

---

### Step 2: Establish the Production Web Directory
Create the target application directory if it doesn't already exist:
```bash
sudo mkdir -p /var/www/syrianzone
```

---

### Step 3: Configure Users, Groups & Permissions (CRITICAL)

Permissions are the most common failure point for self-hosted runners. The runner agent runs under a dedicated system user (e.g. `runner` or `github-runner`), whereas Nginx and PHP-FPM run under `www-data` (or `nginx`).

To prevent conflicts where the runner cannot write code updates, and the web server cannot write caches:

1.  **Add the Runner User to the Web Server Group**:
    ```bash
    # Replace 'runner' with the actual username running your GitHub agent
    sudo usermod -aG www-data runner
    ```

2.  **Assign Directory Ownership**:
    Set the directory owner to the runner user, and the group to `www-data`:
    ```bash
    sudo chown -R runner:www-data /var/www/syrianzone
    ```

3.  **Establish Correct File and Folder Permissions**:
    Set folder permissions to `775` (read/write/execute for owner and group) and file permissions to `664`:
    ```bash
    sudo find /var/www/syrianzone -type d -exec chmod 775 {} \;
    sudo find /var/www/syrianzone -type f -exec chmod 664 {} \;
    ```

4.  **Enforce Group Sticky Bit (SetGID)**:
    Force new subdirectories and files created by the application (like user uploads or cache entries) to inherit the `www-data` group:
    ```bash
    sudo chmod -R g+s /var/www/syrianzone/storage
    sudo chmod -R g+s /var/www/syrianzone/bootstrap/cache
    ```

---

### Step 4: Set up the Production `.env` File
Create a stable `.env` file directly inside `/var/www/syrianzone`. Because `rsync` is configured to exclude the `.env` file, it will never be overwritten by the repository:

```bash
cp /var/www/syrianzone/.env.example /var/www/syrianzone/.env
nano /var/www/syrianzone/.env
```

Ensure the database settings, app URL, and key variables are set:
```ini
APP_ENV=production
APP_DEBUG=false
APP_URL=https://syrianzone.org   # Update with your active domain

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=syrianzone
DB_USERNAME=production_user
DB_PASSWORD=your_secure_password
```

---

## 4. How the GitHub Actions Workflow Triggers

The pipeline configuration in [.github/workflows/deploy.yml](file:///run/media/hadi/SSD2/Coding/syrianzone/.github/workflows/deploy.yml) automatically listens for pushes to the `main` branch.

```yaml
name: Production Deployment

on:
  push:
    branches:
      - main # Trigger deployment on pushes to the main branch

jobs:
  deploy:
    name: Deploy Laravel + Inertia.js Monolith
    runs-on: self-hosted # Execute on your self-hosted GitHub runner
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Verify PHP Installation
        run: php -v

      - name: Set up Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Verify Bun Installation
        run: bun -v

      - name: Execute Monolithic Deploy Script
        run: |
          chmod +x deploy.sh
          ./deploy.sh /var/www/syrianzone
```

---

## 5. Script Breakdown (`deploy.sh`)

When triggered, the deployment script executes the following stages:

1.  **Frontend Asset Compilation (Runner Workspace)**:
    ```bash
    cd "$SRC_DIR"
    bun install --frozen-lockfile
    bun run build
    ```
    This generates clean, compiled frontend static assets in `$SRC_DIR/public/build`.
    
2.  **File Synchronization via Rsync**:
    ```bash
    rsync -av --delete \
        --exclude='.git/' \
        --exclude='node_modules/' \
        --exclude='.env' \
        --exclude='storage/framework/cache/data/*' \
        --exclude='storage/framework/sessions/*' \
        --exclude='storage/framework/views/*' \
        --exclude='storage/logs/*' \
        "$SRC_DIR/" "$TARGET_DIR/"
    ```
    Synchronizes the repository to `/var/www/syrianzone`, removing files deleted in git, but safeguarding node files and server-side configurations.

3.  **Backend Cache Optimization**:
    ```bash
    composer install --no-dev --optimize-autoloader
    php artisan migrate --force
    php artisan optimize:clear
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
    ```
    Caches config, routes, and views directly into files so the application runs at peak speed.

4.  **Process Management (PM2)**:
    ```bash
    pm2 restart syrianzone-backend --update-env 2>/dev/null || pm2 start ecosystem.config.js
    pm2 save
    ```
    Keeps the backend runtime serving traffic reliably.

---

## 6. Nginx Web Server Configuration

To serve the application to the web, configure Nginx as a reverse proxy pointing to the application served by PM2 on port `8000`.

Create `/etc/nginx/sites-available/syrianzone` and paste the following config:

```nginx
server {
    listen 80;
    server_name syrianzone.org www.syrianzone.org; # Replace with your domains

    root /var/www/syrianzone/public;
    index index.php;

    charset utf-8;

    # Dynamic static file caching
    location /build/ {
        expires max;
        access_log off;
        add_header Cache-Control "public, must-revalidate, proxy-revalidate";
    }

    # Pass all standard traffic to the PM2/PHP process running on port 8000
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

Enable the site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/syrianzone /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. Troubleshooting Setup Errors

### Issue: "Permission denied" during rsync
*   **Cause**: The runner user does not have write access to `/var/www/syrianzone`.
*   **Solution**: Ensure that `/var/www/syrianzone` is owned by the group `www-data` and write permissions (`775`) are granted to it. Run the permission commands in **Step 3** again.

### Issue: "Vite build fails / Out of Memory"
*   **Cause**: Bun/Vite might consume too much memory during the Vite build on small virtual private servers (VPS) with limited RAM.
*   **Solution**: Since the build is run inside the runner workspace on the server, you can increase host swap space or restrict memory footprints by passing environment bounds before executing `bun run build`.

### Issue: Database migration errors
*   **Cause**: The production database has not been created or the credentials in `/var/www/syrianzone/.env` are incorrect.
*   **Solution**: Log in to mysql (`mysql -u root -p`), create the database `CREATE DATABASE syrianzone;`, and double-check credentials using `php artisan db:monitor` locally on the host.

---

## 8. Production Docker Image Build (Cranl Setup)

For platforms like **Cranl** that operate using standardized containers, the application includes a production-ready, highly optimized multi-stage [Dockerfile](file:///run/media/hadi/SSD2/Coding/syrianzone/Dockerfile) in the repository root.

### Multi-Stage Architecture:
1.  **Stage 1: Frontend Asset Builder (`oven/bun:alpine`)**:
    *   Uses **Bun** for ultra-fast, frozen-lockfile package installation.
    *   Runs `bun run build` to compile the Vite/React monolithic production assets into `public/build`.
2.  **Stage 2: Compression Module Compiler (`ngx_brotli`)**:
    *   Dynamically compiles Google's Brotli module (`ngx_http_brotli_filter_module.so`) against the exact Nginx ABI configuration of the production base image.
3.  **Stage 3: Production Server (`serversideup/php:8.4-fpm-nginx`)**:
    *   Secured, production-hardened PHP 8.4-FPM + Nginx base running as a non-root user (`www-data`).
    *   Exposes HTTP traffic on port `8080`.
    *   Integrates **S6 Overlay v3** process supervisor to automatically launch auxiliary daemons.

### Supervised Daemons (S6 Overlay):
*   **One-Shot Startup Script (`docker/10-startup.sh`)**: Runs once on container startup. Clears and rebuilds application caches (`artisan config:cache`, `route:cache`, `view:cache`) and executes database schema migrations (`artisan migrate --force`) dynamically.
*   **Queue Worker Daemon (`docker/s6/queue-worker-run`)**: Keeps the standard Laravel queue processor running in the background.
*   **Scheduler Daemon (`docker/s6/laravel-scheduler-run`)**: Executes the cron scheduler loops every 60 seconds.

### How to Build & Run Locally
To verify the Docker configuration locally before uploading to Cranl:

```bash
# 1. Build the production Docker image
docker build -t syrianzone:latest .

# 2. Run the container locally, exposing it on port 8080
docker run -d \
  -p 8080:8080 \
  --name syrianzone-app \
  -e APP_KEY=base64:your_generated_app_key_here \
  -e APP_ENV=production \
  -e APP_DEBUG=false \
  -e DB_HOST=172.17.0.1 \
  -e DB_DATABASE=syrianzone \
  -e DB_USERNAME=root \
  -e DB_PASSWORD=secret \
  syrianzone:latest
```

