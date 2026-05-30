#!/bin/sh
set -e

echo "🚀 Running production startup tasks..."

# Optimize configurations and cache
echo "⚡ Optimizing Laravel application..."
php /var/www/html/artisan optimize:clear
php /var/www/html/artisan config:cache
php /var/www/html/artisan route:cache
php /var/www/html/artisan view:cache

# Run database migrations safely
echo "🔄 Running database migrations..."
php /var/www/html/artisan migrate --force || echo "⚠️ Database migrations failed or skipped."
