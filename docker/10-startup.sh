#!/bin/sh
set -e

echo "🚀 Running production startup tasks..."

# 1. Run database migrations first. A failed migration must kill the boot (set -e):
# the container stays unhealthy, compose up --wait fails, and the deploy goes red
# instead of silently serving a half-migrated schema.
echo "🔄 Running database migrations..."
php /var/www/html/artisan migrate --force

# 1b. Migrate local tierlist images to Cloudflare R2 if present
echo "📦 Migrating TierList assets to R2..."
php /var/www/html/artisan tierlist:migrate-to-r2 || echo "⚠️ Tierlist asset migration skipped or failed."

# 2. Seed the database (runs each seeder independently to avoid DatabaseSeeder factory dependency on dev-only Faker)
# Skipped on staging: without the real best-ministers poll this seeder falls back
# to 12 dummy characters whose image files do not exist, which just fills the
# staging lobby with broken cards. StagingGuessWhoSeeder covers it properly.
if [ "${APP_ENV}" != "staging" ]; then
  echo "🌱 Seeding database..."
  php /var/www/html/artisan db:seed --class=GuessWhoSeeder --force || echo "⚠️ GuessWho seeding failed."
fi

# 3. Ensure storage symlink exists (Docker layers don't preserve symlinks)
php /var/www/html/artisan storage:link || true

# 3b. Staging demo data. Runs after storage:link so seeded image paths resolve.
# StagingSeeder refuses to run when APP_ENV=production, so the guard here is the
# second of two; a failure must not brick the boot, hence the || echo.
if [ "${APP_ENV}" = "staging" ]; then
  echo "🧪 Seeding staging demo data..."
  php /var/www/html/artisan db:seed --class=StagingSeeder --force || echo "⚠️ Staging seeding failed."
fi

# 4. Optimize configurations and cache
echo "⚡ Optimizing Laravel application..."
php /var/www/html/artisan optimize:clear
php /var/www/html/artisan config:cache
php /var/www/html/artisan route:cache
php /var/www/html/artisan view:cache
