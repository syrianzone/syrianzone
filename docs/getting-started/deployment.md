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

Single multi-stage production image (see `Dockerfile`):

1. **Stage 1 (`frontend-builder`)**: Bun builds the client and SSR Vite bundles (`bun run build`) and then precompresses every `.js`, `.css`, and `.svg` asset ≥ 1 KB under `public/build/assets` with Brotli level 11 (`.br`) and Gzip level 9 (`.gz`) via `scripts/precompress-assets.mjs`.
2. **Stage 1b (`ssr-deps`)**: installs `--production` `node_modules` for the externalized dependencies imported by the SSR bundle (`bootstrap/ssr`).
3. **Stage 2 (`serversideup/php:8.4-fpm-nginx`)**: runs PHP-FPM + Nginx + Node.js 22 with s6-overlay longruns for:
   - `queue-worker`
   - `laravel-scheduler`
   - `reverb-server` (websockets, proxied at `/app/`)
   - `inertia-ssr` (`docker/s6/inertia-ssr-run`, Node.js SSR render server for `bootstrap/ssr`; active by default and idles only when `INERTIA_SSR_ENABLED=false`)
   - `post-boot` (`docker/s6/post-boot-run`, runs idempotent syncs once per container while the site serves: R2 asset moves, Guess Who seed, HalaSyria hotel sync, promises research import, share-card renderer check).

On boot `docker/10-startup.sh` runs `migrate --force` (fatal on failure by design), links storage and caches config/routes/views; Nginx and PHP-FPM start only after it, so keep it to what a request needs.

### Precompressed static assets

`docker/server-opts.d/assets-compression.conf` is injected into the Nginx `server {}` block and serves the build-time `.br` (Brotli-11) and `.gz` (`gzip_static on`, Gzip-9) files from `public/build/assets/` with zero runtime CPU, `Cache-Control: public, max-age=31536000, immutable`, and `Vary: Accept-Encoding`. Works both behind Cloudflare and direct-to-origin. See [architecture/performance.md](../architecture/performance.md).

### PHP CVE mitigations

`Dockerfile` hardens PHP INI (`/usr/local/etc/php/conf.d/zz-security-mitigations.ini`) and the PHP-FPM pool (`docker-php-serversideup-pool.conf`) using `php_admin_value`/`php_admin_flag` so runtime `ini_set()` or `.env` cannot override them:

- **CVE-2026-109618**: `memory_limit = -1` removes the controllable PHP memory-limit bailout path; the container's cgroup `mem_limit` (`4g`) acts as the hard memory boundary.
- **CVE-2026-109619**: `session.upload_progress.enabled = 0` (`off`) disables upload-progress session state initialization before request parsing.
- Request body caps are bounded at `PHP_UPLOAD_MAX_FILE_SIZE=52M`, `PHP_POST_MAX_SIZE=64M`, and `NGINX_CLIENT_MAX_BODY_SIZE=64M`.

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

A rollback is an ordinary deploy of an older image, so it is also
zero-downtime. `deploy.log` holds the sha history and the colour each release
went to. Migrations are not rolled back: keep them backward-compatible for one
release.

## Operating the blue/green pair

Which container is serving, and which image each colour holds:

    cat /opt/syrianzone/active-container
    docker ps -a --format '{{.Names}} {{.Image}} {{.Status}}' | grep syrianzone-app
    grep '^IMAGE_TAG_' /opt/syrianzone/.env

The stopped colour shows `Exited (137)`: s6 takes longer than Docker's 10 s
stop timeout, so the container is killed after the drain. That is expected;
the drain has already moved its traffic.

What a deploy printed, and the boot of the serving container (startup, then
the `post-boot:` lines from `docker/s6/post-boot-run`):

    tail /opt/syrianzone/deploy.log
    docker logs --timestamps "$(cat /opt/syrianzone/active-container)" | grep -E 'startup|post-boot|ready'

If a deploy fails, `deploy.sh` prints the last 80 log lines of the new colour
and leaves the old one serving; fix the release and push again.

Caddy logs failed health checks for the stopped colour's name (it does not
resolve while the container is stopped). They are noise, not an outage.

Changing the compose file, `deploy.sh` or the Caddy block: edit
`deploy/production/`, then copy the file to the server. For the Caddy block,
replace the `syrian.zone { … }` block in `/opt/caddy/Caddyfile` (the file
serves other sites too), then

    docker exec caddy-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
    docker exec caddy-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

A reload is atomic: an invalid file is rejected and the running config stays.

What the switch relies on, so it is not removed by accident: the
`/healthcheck` route and its `storage/framework/draining` branch
(`routes/web.php`, `tests/Feature/HealthcheckTest.php`), nginx starting only
after `docker/10-startup.sh`, and database-backed sessions, cache, queue and
locks. The decision and its trade-offs: [ADR-0003](../adr/0003-zero-downtime-deploys.md).

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
