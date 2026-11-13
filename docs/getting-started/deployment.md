# Deployment

Production is a docker compose stack on the VPS (173.249.60.70), behind the shared
Caddy at /opt/caddy and Cloudflare. Every push to `main` deploys automatically:

    push to main
      -> github actions (.github/workflows/deploy.yml)
      -> buildx builds the Dockerfile (linux/amd64, gha layer cache)
      -> image pushed to ghcr.io/syrianzone/syrianzone:<sha> (+ :latest)
      -> ssh to the vps, /opt/syrianzone/deploy.sh <sha>
      -> start the release in the idle colour (blue/green), wait until healthy
      -> drain the old colour, stop it

Deploys have no downtime: the running container keeps serving until the new
one passes its healthcheck, and Caddy only routes to a healthy one.

Warm end-to-end time is about 3 minutes.

## The image

Single production image (see `Dockerfile`): bun builds the Vite assets, then
serversideup/php:8.4-fpm-nginx runs php-fpm + nginx with s6 longruns for the
queue worker, the scheduler, and reverb (websockets, proxied at `/app/`).
On boot `docker/10-startup.sh` runs `migrate --force` (fatal on failure by
design), links storage and caches config/routes/views; nginx and PHP-FPM
start only after it, so keep it to what a request needs. The idempotent syncs
that can run while the site serves (R2 asset moves, the Guess Who seed, the
HalaSyria hotel sync, the promises research import, the share-card renderer
check) run once per container in the `post-boot` s6 service
(`docker/s6/post-boot-run`).

## Server layout

    /opt/syrianzone/
    ├── docker-compose.yml   # app_blue + app_green (ghcr image) + db (mysql:8.4)
    ├── .env                 # production env (IMAGE_TAG_BLUE/GREEN = each colour's sha); secrets mirrored in 1password "Syrian Zone VPS"
    ├── deploy.sh            # blue/green swap + prune; writes deploy.log
    ├── active-container     # name of the serving container (syrianzone-app-blue|green)
    └── backups/             # spatie/laravel-backup local zips (also copied to r2)

The source of `docker-compose.yml`, `deploy.sh` and the `syrian.zone` block of
`/opt/caddy/Caddyfile` is `deploy/production/` in this repo; after changing one,
copy it to the server (they are not synced by the workflow).

## Zero-downtime switch

Two app containers exist, `syrianzone-app-blue` and `syrianzone-app-green`;
normally one runs. `deploy.sh` starts the release in the stopped colour and
waits for its healthcheck (migrations run there while the old colour keeps
serving). It then creates `storage/framework/draining` in the old container,
which makes its `/healthcheck` answer 503, so Caddy (active health checks every
2s, `lb_policy first`, `lb_try_duration 30s`) moves traffic to the new one;
after 8 seconds for in-flight requests the old container is stopped. If the new
container never becomes healthy it is stopped and the old one keeps serving.

Because old and new code run against the same database for a few seconds,
migrations must be backward-compatible for one release (add columns, backfill,
drop in a later release). Sessions, cache, queue and locks are database-backed,
so both colours share them.

To run an artisan command in production:

    docker exec "$(cat /opt/syrianzone/active-container)" php artisan <command>

## Rollback

    ssh root@<vps> /opt/syrianzone/deploy.sh <previous-sha>

`deploy.log` holds the sha history. Migrations are not rolled back: keep them
backward-compatible for one release.

## Backups

`backup:run --only-db` runs every 6h via the scheduler, writing to
`/opt/syrianzone/backups` and to the private `syrianzone-backups` R2 bucket.
Manual dump: `docker exec "$(cat /opt/syrianzone/active-container)" php artisan backup:run --only-db`.

## CI credentials

Repo secrets: `VPS_HOST`, `VPS_SSH_KEY`, `VPS_HOST_FINGERPRINT` (ecdsa),
`SENTRY_AUTH_TOKEN`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, and
`X_ACCESS_TOKEN_SECRET`. Repo variables: `VITE_SENTRY_DSN`,
`VITE_SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_ORG`, `SENTRY_PROJECT`.
The X automation also uses the `X_TIERLIST_ENABLED` and `X_EXPECTED_USER_ID`
repository variables. Ghcr push uses the workflow's `GITHUB_TOKEN`; no other
build credentials.

## Tierlist announcements on X

Production samples the `best-ministers` ranking every five minutes. It records
the first snapshot silently, then queues one Arabic post after a changed order
stays stable for fifteen minutes. Posting remains off unless
`X_TIERLIST_ENABLED=true`.

Store `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, and
`X_ACCESS_TOKEN_SECRET` as GitHub repository secrets. Store
`X_EXPECTED_USER_ID` and `X_TIERLIST_ENABLED` as repository variables. The
deployment workflow mirrors the managed values into `/opt/syrianzone/.env` before
starting the new image. It replaces the managed X values atomically, forces the
file to owner-only mode, and treats a missing enable variable as `false`.
Removing a credential clears its production value and leaves the automation
inert. Keep a recovery copy in the matching 1Password item.

When all credentials are present, each production deployment runs
`tierlist:x-status` in the new image before it replaces the live container. The
check is advisory: a failure emits a GitHub warning and deployment continues.
An enabled deployment also runs the detector once after the swap. A successful
deployment therefore proves neither X authentication nor public delivery.

The access token must belong to `@SyrianZone`, and the developer app must have
read and write permission. Before every post, the application asks X which user
owns the token and compares that ID with `X_EXPECTED_USER_ID`. A delegate's
personal token therefore fails closed instead of posting from the wrong account.
The defaults allow no more than one new announcement activity per twelve hours and two
prepared or delivered announcements per day. Override them with
`X_TIERLIST_MIN_POST_INTERVAL_MINUTES` and
`X_TIERLIST_DAILY_POST_LIMIT` only after reviewing expected API spend.

Check the configured account without publishing or changing automation state:

    docker exec "$(cat /opt/syrianzone/active-container)" php artisan tierlist:x-status

The `answers ops` workflow also exposes this check through `action=x-status`.
Failures print a fixed local summary and the numeric HTTP status when known.
They never print X response bodies, authorization headers, or credential values.
A 401 identifies authentication rejection; it doesn't prove which credential
or app setting caused it. `answers:card-status` shows recorded answer outcomes.

To run detection immediately:

    docker exec "$(cat /opt/syrianzone/active-container)" php artisan tierlist:detect-rank-changes

This command writes automation state and can queue a public post. Only a new
installation's first enabled run records a silent baseline. Delivery outcomes live in
`tierlist_social_posts`. The scheduler relays any pending outbox row on every
run, so a process stop between preparation and queueing does not lose it. A
`needs_review` row means X may have accepted a request before the connection
ended or returned an ambiguous response. Check the account before any manual
retry.

The `answers card` workflow runs every six hours and reads new answers from
`answers.syrian.zone`. Pagination stops at the reported count or an empty page;
an unexpected HTTP error still fails the run. Run its regression tests with
`node --test scripts/answers-card/render.test.mjs`. Repairing discovery doesn't
repair X authentication, and existing failed answer rows still require review
before release.
