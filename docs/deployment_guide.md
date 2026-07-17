# Deployment

Production is a docker compose stack on the VPS (173.249.60.70), behind the shared
Caddy at /opt/caddy and Cloudflare. Every push to `main` deploys automatically:

    push to main
      -> github actions (.github/workflows/deploy.yml)
      -> depot builds the Dockerfile (linux/amd64)
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
`SENTRY_AUTH_TOKEN`. Repo variables: `DEPOT_PROJECT_ID`, `VITE_SENTRY_DSN`,
`SENTRY_ORG`, `SENTRY_PROJECT`. Depot auth is oidc (trust relationship on the
depot project), ghcr push uses the workflow's `GITHUB_TOKEN`.
