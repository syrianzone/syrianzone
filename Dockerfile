# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build Vite/React assets using Bun
# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:alpine AS frontend-builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production image — serversideup/php with S6 Overlay v3
# ─────────────────────────────────────────────────────────────────────────────
FROM serversideup/php:8.4-fpm-nginx

# Performance & Stability (PHP-FPM)
ENV PHP_FPM_REQUEST_TERMINATE_TIMEOUT=60s
ENV PHP_FPM_PM_MAX_CHILDREN=50
ENV PHP_FPM_PM=ondemand

# Performance & Stability (Nginx)
ENV NGINX_FASTCGI_READ_TIMEOUT=65s

# Enable OPcache for production performance (recommended by serversideup image logs)
ENV PHP_OPCACHE_ENABLE=1

HEALTHCHECK --interval=1m --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8080/healthcheck || exit 1

USER root

# Install runtime-only dependencies (including curl for health checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
        default-mysql-client \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

# Copy codebase
COPY --chown=www-data:www-data . .

# Copy compiled frontend assets from Stage 1
COPY --from=frontend-builder --chown=www-data:www-data /app/public/build ./public/build

# Install PHP dependencies
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-scripts --ignore-platform-req=ext-iconv

# Set correct permissions on Laravel writable dirs
RUN chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache



# ── S6 Overlay: One-shot startup entrypoint (migrations, cache, optimizations) ───
COPY docker/10-startup.sh /etc/entrypoint.d/10-startup.sh
RUN chmod +x /etc/entrypoint.d/10-startup.sh

# ── S6 Overlay: queue-worker longrun daemon ───────────────────────────────────
RUN mkdir -p /etc/s6-overlay/s6-rc.d/queue-worker/dependencies.d
RUN echo "longrun" > /etc/s6-overlay/s6-rc.d/queue-worker/type
COPY docker/s6/queue-worker-run /etc/s6-overlay/s6-rc.d/queue-worker/run
RUN chmod +x /etc/s6-overlay/s6-rc.d/queue-worker/run
RUN touch /etc/s6-overlay/s6-rc.d/user/contents.d/queue-worker

# ── S6 Overlay: laravel-scheduler longrun daemon ──────────────────────────────
RUN mkdir -p /etc/s6-overlay/s6-rc.d/laravel-scheduler/dependencies.d
RUN echo "longrun" > /etc/s6-overlay/s6-rc.d/laravel-scheduler/type
COPY docker/s6/laravel-scheduler-run /etc/s6-overlay/s6-rc.d/laravel-scheduler/run
RUN chmod +x /etc/s6-overlay/s6-rc.d/laravel-scheduler/run
RUN touch /etc/s6-overlay/s6-rc.d/user/contents.d/laravel-scheduler

# Drop back to www-data for runtime security
USER www-data

EXPOSE 8080
