#!/bin/bash

# Exit on error
set -e

# Define root directory to ensure script runs correctly regardless of where it's called
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
echo "🚀 Starting Deployment in $APP_DIR..."
cd "$APP_DIR"

# 1. Environment Setup
echo "🔑 Checking environment files..."
if [ ! -f "backend/.env" ]; then
    echo "Creating backend/.env from .env.example..."
    cp backend/.env.example backend/.env
    echo "⚠️  Action Required: Update backend/.env with production details!"
fi

if [ ! -f "frontend/.env" ]; then
    if [ -f "frontend/.env.example" ]; then
        cp frontend/.env.example frontend/.env
    elif [ -f "frontend/.env.local.example" ]; then
        cp frontend/.env.local.example frontend/.env
    else
        touch frontend/.env
    fi
    echo "⚠️  Action Required: Update frontend/.env with production API URLs!"
fi

# 2. Backend Deployment (Laravel)
echo "🐘 Deploying Backend (Laravel)..."
cd backend

# Clear old compiled files directly to avoid permission conflicts on rebuild
echo "🔧 Cleaning Laravel cache files..."
rm -rf storage/framework/views/*.php 2>/dev/null || true
rm -rf bootstrap/cache/*.php 2>/dev/null || true

# Just ensure the directory has write access for the web server/runner
chmod -R 775 storage bootstrap/cache 2>/dev/null || true

# Install PHP dependencies without dev packages
composer install --no-dev --optimize-autoloader --quiet

# Database migrations
if grep -q "DB_DATABASE=laravel" .env || grep -q "DB_DATABASE=syrianzone" .env.example; then
    # Modify this logic if your default db name is different
    echo "🔄 Running migrations..."
    php artisan migrate --force || echo "⚠️  Migrations failed or skipped."
fi

# Optimize application
echo "⚡ Optimizing Laravel..."
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

cd ..

# 3. Frontend Deployment (Next.js)
echo "⚛️  Deploying Frontend (Next.js)..."
cd frontend

echo "🔧 Cleaning previous Next.js build..."
rm -rf .next 2>/dev/null || true

echo "📦 Installing Node dependencies..."
# npm ci is faster and more reliable for deployments, but fall back to install if needed
npm ci || npm install

echo "🏗️  Building Next.js application..."
npm run build

# 4. Process Management (PM2)
echo "🔄 Restarting PM2..."
cd ..

# For Next.js in fork mode, restart is much safer than reload. 
# It prevents the old server and its chunks map from hanging in memory.
pm2 restart syrianzone-frontend --update-env 2>/dev/null || pm2 start ecosystem.config.js
pm2 save

echo "✅ Deployment Finished Successfully!"
