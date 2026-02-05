#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting Deployment..."

# 1. Environment Setup
echo "🔑 Checking environment files..."
if [ ! -f "backend/.env" ]; then
    echo "Creating backend/.env from .env.example..."
    cp backend/.env.example backend/.env
    echo "⚠️  Action Required: Update backend/.env with production database credentials!"
fi

if [ ! -f "frontend/.env" ]; then
    # Create frontend .env if it doesn't exist
    # Note: frontend example might be .env.local or .env.example
    if [ -f "frontend/.env.example" ]; then
        cp frontend/.env.example frontend/.env
    elif [ -f "frontend/.env.local.example" ]; then
        cp frontend/.env.local.example frontend/.env
    else
        touch frontend/.env
    fi
    echo "⚠️  Action Required: Update frontend/.env with production API URLs!"
fi

# 3. Backend Deployment (Laravel)
echo "🐘 Deploying Backend (Laravel)..."
cd backend

# Fix ownership and clear old cache files that may have wrong permissions
echo "🔧 Fixing file ownership..."
chown -R syrian:syrian storage bootstrap/cache 2>/dev/null || true
rm -rf storage/framework/views/*.php 2>/dev/null || true
rm -rf bootstrap/cache/*.php 2>/dev/null || true

# Ensure permissions are correct
chmod -R 775 storage bootstrap/cache

# Install PHP dependencies
composer install --no-dev --optimize-autoloader

# Run migrations (only if DB is configured)
if grep -q "DB_DATABASE=laravel" .env; then
    echo "⚠️  Skipping migrations: Default database name detected. Please update .env"
else
    php artisan migrate --force
fi

# Clear old caches and optimize
php artisan route:clear
php artisan config:clear
php artisan optimize

# Set correct ownership for web server
echo "🔧 Setting web server ownership..."
chown -R syrian:syrian storage bootstrap/cache

cd ..

# 4. Frontend Deployment (Next.js)
echo "⚛️  Deploying Frontend (Next.js)..."
cd frontend

# Fix ownership of .next build folder
echo "🔧 Clearing old build folder..."
sudo rm -rf .next 2>/dev/null || rm -rf .next 2>/dev/null || true
sudo chown -R syrian:syrian node_modules 2>/dev/null || true

# Install Node dependencies
npm install

# Build the Next.js application
npm run build

# Restart PM2 process
echo "🔄 Reloading PM2..."
pm2 startOrReload ../ecosystem.config.js

cd ..

echo "✅ Deployment Finished Successfully!"
