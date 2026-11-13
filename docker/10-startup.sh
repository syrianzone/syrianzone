#!/bin/sh
set -e

# Runs before nginx and PHP-FPM start, so the container serves nothing until
# this finishes. Keep it to what a request needs; idempotent syncs that can
# run while the site is already serving live in docker/s6/post-boot-run.

echo "🚀 Running production startup tasks..."

# A failed migration must kill the boot (set -e): the container stays
# unhealthy, compose up --wait fails, and deploy.sh keeps the previous
# container serving instead of switching to a half-migrated one.
echo "🔄 Running database migrations..."
php /var/www/html/artisan migrate --force

# Docker layers don't preserve symlinks.
php /var/www/html/artisan storage:link || true

# Staging demo data. Runs after storage:link so seeded image paths resolve.
# StagingSeeder refuses to run when APP_ENV=production, so the guard here is the
# second of two; a failure must not brick the boot, hence the || echo.
if [ "${APP_ENV}" = "staging" ]; then
  echo "🧪 Seeding staging demo data..."
  php /var/www/html/artisan db:seed --class=StagingSeeder --force || echo "⚠️ Staging seeding failed."
fi

echo "⚡ Optimizing Laravel application..."
php /var/www/html/artisan optimize:clear
php /var/www/html/artisan config:cache
php /var/www/html/artisan route:cache
php /var/www/html/artisan view:cache
