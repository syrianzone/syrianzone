# Staging

`https://staging.syrian.zone` is a full copy of the stack running beside production
on the same VPS, filled with generated demo data. It exists so a change can be
looked at in a real browser, against a real database, before it reaches anyone.

    push to staging branch (or workflow_dispatch)
      -> .github/workflows/deploy-staging.yml
      -> image pushed to ghcr.io/syrianzone/syrianzone:staging-<sha>
      -> ssh to the vps, /opt/syrianzone-staging/deploy.sh staging-<sha>
      -> docker compose pull + up -d --wait

Credentials (basic auth, db, app key) live in the 1password item
**"Syrian Zone VPS"** under a `staging` section. None of them are in this repo.

## Deploying

Push to the `staging` branch:

    git push origin HEAD:staging

Or deploy any ref by hand:

    gh workflow run deploy-staging.yml -f ref=my-feature-branch

Rollback is the same as production, with a staging tag:

    ssh root@<vps> /opt/syrianzone-staging/deploy.sh staging-<previous-sha>

## Why it is a separate image

`VITE_SENTRY_DSN` and `VITE_POSTHOG_KEY` are baked into the JS bundle at build
time, not read at runtime. Running the production image on staging would send
browser errors and product analytics into the production Sentry and PostHog
projects no matter what the staging `.env` said. So the staging workflow builds
its own image with those build-args omitted; both SDKs are guarded on the env var
and no-op when it is empty.

Google Analytics used to be a hardcoded measurement id in `app.blade.php`. It is
now `GA_MEASUREMENT_ID` (`config/services.php`), read at runtime, so staging turns
it off by leaving it blank. **Production must keep that var set** or analytics
goes quiet.

`deploy.sh` refuses any tag not prefixed `staging-`, and refuses to run at all if
the local `.env` is not `APP_ENV=staging`.

## What is disconnected from production

| Concern | Production | Staging |
|---|---|---|
| Database | `syrianzone_db`, own container | `syrianzone_staging`, own container and volume |
| Uploads | R2 bucket (`MEDIA_DISK=r2`) | local public disk, R2 creds blank |
| DB backups | local + R2 bucket, every 6h | schedule gated off entirely |
| Sentry / PostHog | live | no DSN, backend and browser |
| Google Analytics | `GA_MEASUREMENT_ID` set | blank, snippet does not render |
| Google OAuth | live client | none, login is `AUTO_LOGIN_DEV` |
| Mail | `log` | `log` |
| Reverb | own app credentials | separate app credentials, self-hosted |

`routes/console.php` gates the whole schedule on `production`. That matters most
for `backup:clean`, which applies its retention policy to *every* configured
destination disk: a staging box that ever picked up `R2_BACKUP_BUCKET` would
prune production's archives. The env is blank and the schedule is gated, so it
takes two mistakes rather than one.

## Logging in

Staging has no Google OAuth client, so `AUTO_LOGIN_DEV=true` is on. **Every
visitor is silently logged in as a superadmin**, and `/dev/impersonate/{role}`
switches between `user`, `transit_admin`, `admin` and `superadmin`.

That is only acceptable because Caddy basic auth sits in front of the entire
host. If you ever remove the basic auth block, turn `AUTO_LOGIN_DEV` off in the
same change.

The seeded accounts (`*@staging.syrian.zone`) also exist with a shared password
if you want to test a real session instead. See the 1password item.

## The demo data

`StagingSeeder` runs on every container boot, but only when `APP_ENV=staging`;
it also throws if it ever finds itself in production. Modules live in
`database/seeders/Staging/`: users, places, polls, transit, guesswho,
contributors.

Two constraints shape all of them, and both are easy to trip over:

- **No Faker.** It is a `require-dev` package and the image is built with
  `composer install --no-dev`, so `Model::factory()` fatals inside the container.
  Staging runs the production image on purpose, so the data is hand-rolled from
  literal arrays instead.
- **Deterministic.** Each module seeds a small LCG from a fixed string
  (`StagingSeed::seedRandom`), so the random stream is identical on every run and
  a reseed adds no rows. Every write is an `updateOrCreate` (or an equivalent
  upsert) on a stable natural key. The one thing that is *not* frozen is
  `pastDate()`, which is relative to boot time so the demo data does not read as
  stale months from now.

A module that throws is reported and stepped over rather than failing the boot:
a half-seeded staging box is still usable, a boot loop is not.

Reseed by hand:

    docker exec syrianzone-staging-app php artisan db:seed --class=StagingSeeder --force

Start over from an empty database:

    docker exec syrianzone-staging-app php artisan migrate:fresh --seed --seeder=StagingSeeder --force

## Server layout

    /opt/syrianzone-staging/
    ├── docker-compose.yml   # app (staging-* tag) + db (mysql:8.4), smaller limits
    ├── .env                 # APP_ENV=staging, every prod resource blanked
    ├── deploy.sh            # tag-prefix guarded, health-gated swap
    └── backups/             # empty; the backup schedule does not run here

Caddy routes `staging.syrian.zone` to `syrianzone-staging-app:8080` with basic
auth and `X-Robots-Tag: noindex`. The block is at the bottom of
`/opt/caddy/Caddyfile`.
