# Deployment

Production is a docker compose stack on the VPS (173.249.60.70), behind the shared
Caddy at /opt/caddy and Cloudflare. Every push to `main` deploys automatically:

    push to main
      -> github actions (.github/workflows/deploy.yml)
      -> buildx builds the Dockerfile (linux/amd64, gha layer cache)
      -> image pushed to ghcr.io/syrianzone/syrianzone:<sha> (+ :latest)
      -> ssh to the vps, /opt/syrianzone/deploy.sh <sha>
      -> docker compose pull + up -d --wait (healthcheck-gated)

Warm end-to-end time is about 3 minutes.

## The image

Single production image (see `Dockerfile`): bun builds the Vite assets, then
serversideup/php:8.4-fpm-nginx runs php-fpm + nginx with s6 longruns for the
queue worker, the scheduler, and reverb (websockets, proxied at `/app/`).
On boot `docker/10-startup.sh` runs `migrate --force` (fatal on failure by
design), seeds GuessWho, links storage, and caches config/routes/views.

## Server layout

    /opt/syrianzone/
    ├── docker-compose.yml   # app (ghcr image) + db (mysql:8.4)
    ├── .env                 # production env; secrets mirrored in 1password "Syrian Zone VPS"
    ├── deploy.sh            # pull + health-gated swap + prune; writes deploy.log
    └── backups/             # spatie/laravel-backup local zips (also copied to r2)

## Rollback

    ssh root@<vps> /opt/syrianzone/deploy.sh <previous-sha>

`deploy.log` holds the sha history. Migrations are not rolled back: keep them
backward-compatible for one release.

## Backups

`backup:run --only-db` runs every 6h via the scheduler, writing to
`/opt/syrianzone/backups` and to the private `syrianzone-backups` R2 bucket.
Manual dump: `docker exec syrianzone-app php artisan backup:run --only-db`.

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

    docker exec syrianzone-app php artisan tierlist:x-status

The `answers ops` workflow also exposes this check through `action=x-status`.
Failures print a fixed local summary and the numeric HTTP status when known.
They never print X response bodies, authorization headers, or credential values.
A 401 identifies authentication rejection; it doesn't prove which credential
or app setting caused it. `answers:card-status` shows recorded answer outcomes.

To run detection immediately:

    docker exec syrianzone-app php artisan tierlist:detect-rank-changes

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
