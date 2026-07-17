# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build Vite/React assets using Bun
# ─────────────────────────────────────────────────────────────────────────────
ARG SKEW=local
FROM oven/bun:alpine AS frontend-builder
LABEL skew=${SKEW}
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production image — serversideup/php with S6 Overlay v3
# ─────────────────────────────────────────────────────────────────────────────
ARG SKEW=local
FROM serversideup/php:8.4-fpm-nginx

# Performance & Stability (PHP-FPM)
ENV PHP_FPM_REQUEST_TERMINATE_TIMEOUT=60s
ENV PHP_FPM_PM_MAX_CHILDREN=50
ENV PHP_FPM_PM=ondemand

# Performance & Stability (Nginx)
ENV NGINX_FASTCGI_READ_TIMEOUT=65s

# Enable OPcache for production performance
ENV PHP_OPCACHE_ENABLE=1

HEALTHCHECK --interval=1m --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8080/healthcheck || exit 1

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
    && rm -rf /var/lib/apt/lists/*

# gd: PlaceImageService encodes uploaded photos to webp; the base image ships without it.
# exif: without it intervention/image cannot read the orientation tag, so phone
# portrait photos come out rotated (it degrades silently, no error).
RUN install-php-extensions intl gd exif

WORKDIR /var/www/html

COPY --chown=www-data:www-data . .
COPY --from=frontend-builder --chown=www-data:www-data /app/public/build ./public/build

RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-scripts --ignore-platform-req=ext-iconv

RUN chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

COPY docker/10-startup.sh /etc/entrypoint.d/10-startup.sh
RUN chmod +x /etc/entrypoint.d/10-startup.sh

# server-opts.d: location blocks injected INSIDE the server {} block
COPY docker/server-opts.d/app-websocket.conf /etc/nginx/server-opts.d/app-websocket.conf

RUN mkdir -p /etc/s6-overlay/s6-rc.d/queue-worker/dependencies.d
RUN echo "longrun" > /etc/s6-overlay/s6-rc.d/queue-worker/type
COPY docker/s6/queue-worker-run /etc/s6-overlay/s6-rc.d/queue-worker/run
RUN chmod +x /etc/s6-overlay/s6-rc.d/queue-worker/run
RUN touch /etc/s6-overlay/s6-rc.d/user/contents.d/queue-worker

RUN mkdir -p /etc/s6-overlay/s6-rc.d/laravel-scheduler/dependencies.d
RUN echo "longrun" > /etc/s6-overlay/s6-rc.d/laravel-scheduler/type
COPY docker/s6/laravel-scheduler-run /etc/s6-overlay/s6-rc.d/laravel-scheduler/run
RUN chmod +x /etc/s6-overlay/s6-rc.d/laravel-scheduler/run
RUN touch /etc/s6-overlay/s6-rc.d/user/contents.d/laravel-scheduler

RUN mkdir -p /etc/s6-overlay/s6-rc.d/reverb-server/dependencies.d
RUN echo "longrun" > /etc/s6-overlay/s6-rc.d/reverb-server/type
COPY docker/s6/reverb-server-run /etc/s6-overlay/s6-rc.d/reverb-server/run
RUN chmod +x /etc/s6-overlay/s6-rc.d/reverb-server/run
RUN touch /etc/s6-overlay/s6-rc.d/user/contents.d/reverb-server

USER www-data

EXPOSE 8080 6001
