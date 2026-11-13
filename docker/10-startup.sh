#!/bin/sh
set -e

echo "🚀 Running production startup tasks..."

# 1. Run database migrations first. A failed migration must kill the boot (set -e):
# the container stays unhealthy, compose up --wait fails, and the deploy goes red
# instead of silently serving a half-migrated schema.
echo "🔄 Running database migrations..."
php /var/www/html/artisan migrate --force

echo "📦 Migrating TierList assets to R2..."
php /var/www/html/artisan tierlist:migrate-to-r2 || echo "⚠️ Tierlist asset migration skipped or failed."
echo "🗺️ Migrating GeoJSON master downloads to R2..."
php /var/www/html/artisan geojson:upload-to-r2 || echo "⚠️ GeoJSON asset migration skipped or failed."

# Seed the database, running each seeder independently to avoid DatabaseSeeder's
# factory dependency on dev-only Faker.
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

# 4. Sync hotel data from HalaSyria (idempotent: updateOrCreate, safe to run on every boot)
echo "🏨 Syncing HalaSyria hotels..."
php /var/www/html/artisan hotels:sync || echo "⚠️ HalaSyria hotel sync skipped or failed."

# 4b. Import researched promises & sync Tierlist/Official speakers (idempotent)
echo "📜 Syncing promises research & speakers..."
php /var/www/html/artisan promises:import-research || echo "⚠️ Promises research import skipped or failed."

# 4c. Share cards of single records are drawn on demand by Node. A failure there
# is quiet by design (the visitor gets the section card), so check it loudly here.
echo "🖼️ Checking the share card renderer..."
php /var/www/html/artisan og:doctor || echo "⚠️ Share cards cannot be drawn; record pages will use their section card."

echo "⚡ Optimizing Laravel application..."
php /var/www/html/artisan optimize:clear
php /var/www/html/artisan config:cache
php /var/www/html/artisan route:cache
php /var/www/html/artisan view:cache
