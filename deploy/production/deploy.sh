#!/usr/bin/env bash
# Installed at /opt/syrianzone/deploy.sh on the production VPS.
# deploy.sh <image-sha|tag> : start the release next to the running one, switch
# when it is healthy, stop the old one, prune.
# Invoked by GitHub Actions on push to main; run by hand to roll back to an
# older sha (history in deploy.log).
#
# Two app containers exist (docker-compose.yml): syrianzone-app-blue and
# syrianzone-app-green. Caddy proxies to both and sends traffic only to one
# that passes /healthcheck. A release always starts in the colour that is not
# serving, so the running container keeps answering until the new one is
# ready. If the new one never becomes healthy it is stopped and the old one
# keeps serving: a failed deploy is not an outage.
#
# The name of the serving container is written to active-container, for
# scripts that need `docker exec` (the deploy workflow reads it).
set -euo pipefail
cd /opt/syrianzone

TAG="${1:?usage: deploy.sh <image tag>}"

running() {
  [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" = "true" ]
}

# The single-container layout this replaced; stopped once the first
# blue/green container is serving.
LEGACY=syrianzone-app

if running syrianzone-app-blue; then
  ACTIVE=blue
elif running syrianzone-app-green; then
  ACTIVE=green
else
  ACTIVE=
fi
if [ "$ACTIVE" = blue ]; then IDLE=green; else IDLE=blue; fi

PREV_CONTAINER="${LEGACY}"
[ -n "$ACTIVE" ] && PREV_CONTAINER="syrianzone-app-${ACTIVE}"
PREV_TAG="$(docker inspect --format '{{.Config.Image}}' "$PREV_CONTAINER" 2>/dev/null | sed 's|^ghcr.io/syrianzone/syrianzone:||' || true)"

# Persist the tag per colour: a restart or a manual compose command keeps
# using exactly the image each colour was deployed with.
VAR="IMAGE_TAG_$(echo "$IDLE" | tr '[:lower:]' '[:upper:]')"
if grep -q "^${VAR}=" .env; then
  sed -i "s|^${VAR}=.*|${VAR}=${TAG}|" .env
else
  printf '%s=%s\n' "$VAR" "$TAG" >> .env
fi

echo "serving: ${ACTIVE:-${LEGACY}} (${PREV_TAG:-none}); starting ${IDLE} with ${TAG}"
docker compose pull -q "app_${IDLE}"
if ! docker compose up -d --no-deps --wait --wait-timeout 300 "app_${IDLE}"; then
  echo "app_${IDLE} did not become healthy; it is stopped and the previous release keeps serving" >&2
  docker compose logs --tail 80 "app_${IDLE}" >&2 || true
  docker compose stop "app_${IDLE}" || true
  exit 1
fi

# Caddy probes /healthcheck every 2s; give it time to mark the new container
# healthy before the old one goes away.
sleep 6

if [ -n "$ACTIVE" ]; then
  # Drain: the old container's /healthcheck now answers 503, so Caddy stops
  # sending it new requests within one probe (2s); the rest of the wait lets
  # requests already in flight finish before it is stopped.
  docker exec "syrianzone-app-${ACTIVE}" touch /var/www/html/storage/framework/draining || true
  sleep 8
  docker compose stop "app_${ACTIVE}"
elif running "$LEGACY"; then
  docker stop "$LEGACY" >/dev/null && docker rm "$LEGACY" >/dev/null
fi
echo "syrianzone-app-${IDLE}" > active-container

# Keep only the two colours' tags and staging-* tags; remove older sha-tagged
# production images so disk never fills.
KEEP_OTHER="$(grep -E '^IMAGE_TAG_(BLUE|GREEN)=' .env | grep -v "^${VAR}=" | cut -d= -f2 || true)"
docker images "ghcr.io/syrianzone/syrianzone" --format "{{.Repository}}:{{.Tag}}" \
  | while read -r img; do
      t="${img##*:}"
      case "$t" in
        "$TAG"|"$PREV_TAG"|"$KEEP_OTHER"|staging-*|latest|"<none>") ;;
        *) docker rmi "$img" >/dev/null 2>&1 || true ;;
      esac
    done
docker image prune -f >/dev/null
echo "$(date -Is) deployed ${TAG} (${IDLE})" >> deploy.log
echo "deployed ${TAG} to ${IDLE}"
