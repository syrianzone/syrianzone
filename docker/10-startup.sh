#!/bin/sh
set -e

echo "🚀 Running production startup tasks..."

# 1. Run database migrations safely first
echo "🔄 Running database migrations..."
php /var/www/html/artisan migrate --force || echo "⚠️ Database migrations failed or skipped."

# 2. Seed the database (runs each seeder independently to avoid DatabaseSeeder factory dependency on dev-only Faker)
echo "🌱 Seeding database..."
php /var/www/html/artisan db:seed --class=GuessWhoSeeder --force || echo "⚠️ GuessWho seeding failed."

# 3. Ensure storage symlink exists (Docker layers don't preserve symlinks)
php /var/www/html/artisan storage:link || true

# 4. Optimize configurations and cache
echo "⚡ Optimizing Laravel application..."
php /var/www/html/artisan optimize:clear
php /var/www/html/artisan config:cache
php /var/www/html/artisan route:cache
php /var/www/html/artisan view:cache
