#!/bin/bash

# Exit on error
set -e

# Define source (runner/app) directory
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
echo "🚀 Starting Deployment pipeline..."
echo "📂 Source Directory: $SRC_DIR"

# Define target deployment directory (optional first parameter, falls back to source directory)
TARGET_DIR="${1:-$SRC_DIR}"
echo "🎯 Target Directory: $TARGET_DIR"

# 1. Monolithic Frontend Assets Build (Vite) - in Source Directory
# Building assets first inside the source/runner directory avoids high CPU loads in production during npm install/build
echo "⚛️  Building Frontend Assets in Source Directory (Vite)..."
cd "$SRC_DIR"
bun install --frozen-lockfile
bun run build


# 2. Sync Files to Target Directory (if different)
if [ "$SRC_DIR" != "$TARGET_DIR" ]; then
    echo "🔄 Syncing files to Target Directory..."
    # Ensure target directory exists
    mkdir -p "$TARGET_DIR"
    
    # Sync using rsync, preserving permissions but excluding .git, node_modules, and active production .env
    rsync -av --delete \
        --exclude='.git/' \
        --exclude='node_modules/' \
        --exclude='.env' \
        --exclude='storage/framework/cache/data/*' \
        --exclude='storage/framework/sessions/*' \
        --exclude='storage/framework/views/*' \
        --exclude='storage/logs/*' \
        "$SRC_DIR/" "$TARGET_DIR/"
fi

# Switch to target directory for application execution
cd "$TARGET_DIR"

# 3. Environment Setup
echo "🔑 Checking target environment files..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "Creating .env from .env.example..."
        cp .env.example .env
        echo "⚠️  Action Required: Update $TARGET_DIR/.env with production details!"
    else
        echo "❌ Error: .env file missing in target directory and no .env.example exists."
        exit 1
    fi
fi

# 4. Monolithic Backend Deployment (Laravel)
echo "🐘 Deploying Laravel in Target Directory..."

# Clear old compiled files directly to avoid permission conflicts on rebuild
echo "🔧 Cleaning Laravel cache files..."
rm -rf storage/framework/views/*.php 2>/dev/null || true
rm -rf bootstrap/cache/*.php 2>/dev/null || true

# Just ensure the directory has write access for the web server/runner
chmod -R 775 storage bootstrap/cache 2>/dev/null || true

# Install PHP dependencies without dev packages
php -d error_reporting="E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED" "$(which composer)" install --no-dev --optimize-autoloader --quiet --ignore-platform-req=ext-iconv

# Database migrations
echo "🔄 Running migrations..."
php -d error_reporting="E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED" artisan migrate --force || echo "⚠️  Migrations failed or skipped."

# Optimize application
echo "⚡ Optimizing Laravel..."
php -d error_reporting="E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED" artisan optimize:clear
php -d error_reporting="E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED" artisan config:cache
php -d error_reporting="E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED" artisan route:cache
php -d error_reporting="E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED" artisan view:cache

# 5. Process Management (PM2)
# Ensure PM2 reloads the server process
echo "🔄 Restarting PM2 process..."
# Check if pm2 command exists
if command -v pm2 &> /dev/null; then
    pm2 restart syrianzone-backend --update-env 2>/dev/null || pm2 start ecosystem.config.js
    pm2 save
else
    echo "⚠️  PM2 not found in PATH. Process reload skipped."
fi

echo "✅ Monolithic Deployment Finished Successfully!"
