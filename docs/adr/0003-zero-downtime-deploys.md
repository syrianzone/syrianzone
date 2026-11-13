---
status: accepted
date: 2026-11-13
decision-makers: [Syrian Zone maintainers]
consulted: []
informed: []
---

# ADR-0003: Zero-downtime deploys (blue/green behind Caddy health checks)

## Context and problem statement

Every production deploy took the site offline for a while. `deploy.sh` ran
`docker compose up -d --wait` on a single `app` service, which stopped the
running container and started the new one in its place. The new container
serves nothing until `docker/10-startup.sh` finishes, because the
serversideup image runs `/etc/entrypoint.d` scripts before nginx and PHP-FPM.
That script also did work no request needs: two R2 asset moves, the Guess Who
seed, the HalaSyria hotel sync (a third-party HTTP call), the promises research
import and a share-card renderer check. Caddy proxied to one upstream with no
retry, so every request in the gap failed (503 at Cloudflare).

Measured on the deploy of `803acc3c`: container created 13:56:23 UTC, PHP-FPM
ready 13:56:42, roughly 20–30 seconds offline including the stop of the old
container; longer when the hotel sync or a migration was slow (the healthcheck
grace allowed up to 180 seconds).

## Decision drivers

- No failed requests during a normal deploy.
- A release that never becomes healthy must not take the site down.
- No new infrastructure on the VPS (keep docker compose, the shared Caddy and
  the existing GitHub Actions flow).
- Rollback stays one command.
- Keep the change reversible from backups.

## Considered options

1. Keep one container; add `lb_try_duration` in Caddy so requests wait out the
   gap instead of failing.
2. Keep one container; move the optional startup work out of the boot path.
3. Two app containers (blue/green) behind Caddy with active health checks;
   start the release next to the running one and switch when it is healthy.
4. Swarm/Kubernetes-style rolling updates.

## Decision outcome

Chosen options 3 and 2 together. Option 1 only hides short gaps (and a held
request still times out on a slow boot); option 2 alone shortens the gap but
does not remove it; option 4 is new infrastructure for one app.

- `docker-compose.yml` defines `app_blue` and `app_green` (containers
  `syrianzone-app-blue` / `syrianzone-app-green`), each with its own image tag
  (`IMAGE_TAG_BLUE` / `IMAGE_TAG_GREEN` in `.env`). Normally one runs.
- Caddy's `syrian.zone` block proxies to both names with `lb_policy first`,
  active health checks on `/healthcheck` every 2 seconds, `fail_duration 10s`
  and `lb_try_duration 30s`, so traffic only goes to a container that answers.
- `deploy.sh <sha>` starts the release in the stopped colour and waits up to
  300 seconds for its healthcheck. On failure it stops that colour and exits
  non-zero; the old colour keeps serving. On success it creates
  `storage/framework/draining` in the old container (its `/healthcheck` then
  answers 503), waits 8 seconds so Caddy moves traffic and in-flight requests
  finish, stops the old colour, and records the serving container in
  `/opt/syrianzone/active-container`.
- `docker/10-startup.sh` keeps only migrations, the storage link, staging
  seeding and the Laravel caches. The other tasks run once per container in a
  `post-boot` s6 longrun (`docker/s6/post-boot-run`) after the site is serving.
- The sources of the compose file, `deploy.sh` and the Caddy block live in
  `deploy/production/`.

### Consequences

**Good:**

- Measured on the first deploy through it (`a26b0b26`): 535 requests at 2/s
  across the whole deploy, all 200, slowest 2.7 s. The cutover itself
  (introducing the second container and reloading Caddy) and a test deploy:
  956 requests, all 200.
- Boot to serving dropped from about 20 s to 9 s; the optional tasks finished
  14 s after the site was already live.
- A broken release no longer causes an outage; it is stopped before it takes
  traffic.

**Bad / obligations:**

- For a few seconds two releases run against one database. Migrations must be
  backward-compatible for one release (expand, then contract in a later
  release). Sessions, cache, queue and locks are database-backed, so the two
  colours share them; Reverb is not scaled, so a Guess Who client connected to
  the old colour reconnects after the switch.
- The scheduler and queue worker run in both colours during the overlap. Jobs
  and scheduled commands must tolerate that (the existing ones use database
  locks or are idempotent).
- The fixed container name `syrianzone-app` is gone. Anything that runs
  `docker exec` must read `/opt/syrianzone/active-container`.
- `deploy/production/` is not synced by CI; a change there has to be copied to
  the server by hand.
- Staging still runs the old single-container layout.

## Rollout record

2026-11-13: backups of `docker-compose.yml`, `deploy.sh` and
`/opt/caddy/Caddyfile` taken with the suffix `.bak-<timestamp>`; `app_blue`
started next to the old `syrianzone-app` with the same image; Caddy reloaded
to the two-colour block; the old container stopped and removed; a test deploy
switched to green; then `a26b0b26` deployed through GitHub Actions to blue.
An external probe hit the site twice a second throughout; no request failed.

## More information

Operations (manual deploy, rollback, running artisan, troubleshooting):
[docs/getting-started/deployment.md](../getting-started/deployment.md).
