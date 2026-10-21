# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build Vite/React assets using Bun
# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:alpine AS frontend-builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# client-visible sentry/posthog config baked into the bundle; empty locally = sdks no-op
ARG VITE_SENTRY_DSN
ARG VITE_SENTRY_TRACES_SAMPLE_RATE
ARG VITE_POSTHOG_KEY
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG GIT_SHA=dev
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN} VITE_SENTRY_RELEASE=${GIT_SHA} \
    VITE_SENTRY_TRACES_SAMPLE_RATE=${VITE_SENTRY_TRACES_SAMPLE_RATE} \
    VITE_POSTHOG_KEY=${VITE_POSTHOG_KEY} \
    SENTRY_ORG=${SENTRY_ORG} SENTRY_PROJECT=${SENTRY_PROJECT}
# the upload token must never land in a layer (public image): secret mount, ci-only
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" bun run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1b: Production node_modules for the SSR runtime
# The SSR bundle externalizes its dependencies (react, react-dom, @inertiajs/react,
# the @radix-ui/* primitives, leaflet, maplibre-gl, recharts, ...) and imports
# them from node_modules at render time, so they must ship with the app. Only the
# inertia-ssr service uses them; with SSR off they sit unused.
# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:alpine AS ssr-deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production image — serversideup/php with S6 Overlay v3
# ─────────────────────────────────────────────────────────────────────────────
FROM serversideup/php:8.4-fpm-nginx

# Performance & Stability (PHP-FPM)
ENV PHP_FPM_REQUEST_TERMINATE_TIMEOUT=60s
ENV PHP_FPM_PM_MAX_CHILDREN=50
ENV PHP_FPM_PM=ondemand

# Security hardening against PHP RCE advisories CVE-2026-109618 & CVE-2026-109619
# (https://www.php.net/archive/2026.php#2026-10-21-5)
ENV PHP_MEMORY_LIMIT=-1
ENV PHP_POST_MAX_SIZE=64M
ENV PHP_UPLOAD_MAX_FILE_SIZE=52M
ENV NGINX_CLIENT_MAX_BODY_SIZE=64M

# Performance & Stability (Nginx)
ENV NGINX_FASTCGI_READ_TIMEOUT=65s

# Enable OPcache for production performance
ENV PHP_OPCACHE_ENABLE=1

# ties backend sentry events to the deployed image
ARG GIT_SHA=dev
ENV SENTRY_RELEASE=${GIT_SHA}

HEALTHCHECK --interval=1m --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8080/healthcheck || exit 1

USER root

# Upgrade PHP in-place to 8.4.27 (fixes CVE-2026-109618 & CVE-2026-109619) if the
# upstream serversideup/php:8.4-fpm-nginx base image still ships < 8.4.27.
# Once upstream publishes >= 8.4.27, dpkg --compare-versions skips this automatically.
ARG PHP_PATCH_VERSION=8.4.27
ARG PHP_PATCH_URL="https://www.php.net/distributions/php-8.4.27.tar.xz"
ARG PHP_PATCH_SHA256="dcf93923b0e38e0d5252b25b796520b5a47761a08b3488b6d0b5d1115764d3f0"
RUN set -eux; \
    if dpkg --compare-versions "$(php -r 'echo PHP_VERSION;')" lt "$PHP_PATCH_VERSION"; then \
        savedAptMark="$(apt-mark showmanual)"; \
        apt-get update; \
        apt-get install -y --no-install-recommends \
            libargon2-dev \
            libcurl4-openssl-dev \
            libonig-dev \
            libreadline-dev \
            libsodium-dev \
            libsqlite3-dev \
            libssl-dev \
            libxml2-dev \
            zlib1g-dev \
        ; \
        curl -fsSL -o /usr/src/php.tar.xz "$PHP_PATCH_URL"; \
        echo "$PHP_PATCH_SHA256 */usr/src/php.tar.xz" | sha256sum -c -; \
        docker-php-source extract; \
        cd /usr/src/php; \
        gnuArch="$(dpkg-architecture --query DEB_BUILD_GNU_TYPE)"; \
        debMultiarch="$(dpkg-architecture --query DEB_BUILD_MULTIARCH)"; \
        if [ ! -d /usr/include/curl ]; then \
            ln -sfT "/usr/include/$debMultiarch/curl" /usr/local/include/curl; \
        fi; \
        export CFLAGS="$PHP_CFLAGS" CPPFLAGS="$PHP_CPPFLAGS" LDFLAGS="$PHP_LDFLAGS" \
               PHP_BUILD_PROVIDER='https://github.com/docker-library/php' \
               PHP_UNAME='Linux - Docker'; \
        ./configure \
            --build="$gnuArch" \
            --sysconfdir=/usr/local/etc \
            --with-config-file-path="$PHP_INI_DIR" \
            --with-config-file-scan-dir="$PHP_INI_DIR/conf.d" \
            --enable-option-checking=fatal \
            --with-mhash \
            --with-pic \
            --enable-mbstring \
            --enable-mysqlnd \
            --with-password-argon2 \
            --with-sodium=shared \
            --with-pdo-sqlite=/usr \
            --with-sqlite3=/usr \
            --with-curl \
            --with-iconv \
            --with-openssl \
            --with-readline \
            --with-zlib \
            --disable-phpdbg \
            --with-pear \
            --with-libdir="lib/$debMultiarch" \
            --disable-cgi \
            --enable-fpm \
            --with-fpm-user=www-data \
            --with-fpm-group=www-data; \
        make -j"$(nproc)"; \
        find -type f -name '*.a' -delete; \
        make install; \
        find /usr/local -type f -perm '/0111' -exec sh -euxc 'strip --strip-all "$@" || : ' -- '{}' +; \
        make clean; \
        cd /; \
        docker-php-source delete; \
        apt-mark auto '.*' > /dev/null; \
        apt-mark manual $savedAptMark > /dev/null; \
        apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false; \
        rm -rf /var/lib/apt/lists/*; \
        php -v; \
    fi

# Enforce PHP advisory mitigations at PHP INI and FPM pool levels (cannot be
# overridden at runtime via ini_set() or .env PHP_MEMORY_LIMIT):
# - CVE-2026-109618: php_admin_value[memory_limit] = -1 removes the controllable
#   PHP memory limit bailout path; container mem_limit (4g) acts as cgroup boundary.
# - CVE-2026-109619: session.upload_progress.enabled = 0 disables upload progress
#   session state initialization before request parsing.
RUN printf "; CVE-2026-109618 & CVE-2026-109619 mitigations\nmemory_limit = -1\nsession.upload_progress.enabled = 0\n" \
        > /usr/local/etc/php/conf.d/zz-security-mitigations.ini \
    && printf "\n; CVE-2026-109618 & CVE-2026-109619 mitigations\nphp_admin_value[memory_limit] = -1\nphp_admin_flag[session.upload_progress.enabled] = off\n" \
        >> /usr/local/etc/php-fpm.d/docker-php-serversideup-pool.conf

# mariadb-client: spatie/laravel-backup shells out to mysqldump; without it the
# scheduled db backups fail silently. Debian ships no Oracle mysql-client; the
# mariadb dump works against MySQL 8 (hence no --set-gtid-purged in config/database.php).
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        mariadb-client \
    && rm -rf /var/lib/apt/lists/*

# gd: PlaceImageService encodes uploaded photos to webp; the base image ships without it.
# exif: without it intervention/image cannot read the orientation tag, so phone
# portrait photos come out rotated (it degrades silently, no error).
RUN install-php-extensions intl gd exif

# Node.js runs the Inertia SSR render server (docker/s6/inertia-ssr-run). The
# base image ships no Node. It is only used when INERTIA_SSR_ENABLED=true; with
# it off the app serves the server-rendered PHP meta instead and this is idle.
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

COPY --chown=www-data:www-data . .
COPY --from=frontend-builder --chown=www-data:www-data /app/public/build ./public/build
# SSR render bundle, produced by `bun run build` (vite build --ssr). Read by the
# inertia-ssr service when SSR is enabled. See docs/guidelines/seo.md.
COPY --from=frontend-builder --chown=www-data:www-data /app/bootstrap/ssr ./bootstrap/ssr
# The SSR bundle's externalized runtime dependencies (react, radix, leaflet, ...).
COPY --from=ssr-deps --chown=www-data:www-data /app/node_modules ./node_modules

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

RUN mkdir -p /etc/s6-overlay/s6-rc.d/laravel-scheduler/dependencies.d
RUN echo "longrun" > /etc/s6-overlay/s6-rc.d/laravel-scheduler/type
COPY docker/s6/laravel-scheduler-run /etc/s6-overlay/s6-rc.d/laravel-scheduler/run
RUN chmod +x /etc/s6-overlay/s6-rc.d/laravel-scheduler/run

RUN mkdir -p /etc/s6-overlay/s6-rc.d/reverb-server/dependencies.d
RUN echo "longrun" > /etc/s6-overlay/s6-rc.d/reverb-server/type
COPY docker/s6/reverb-server-run /etc/s6-overlay/s6-rc.d/reverb-server/run
RUN chmod +x /etc/s6-overlay/s6-rc.d/reverb-server/run

# Inertia SSR render server. Runs by default (SSR is on); idles only when
# INERTIA_SSR_ENABLED=false (see the run script).
RUN mkdir -p /etc/s6-overlay/s6-rc.d/inertia-ssr/dependencies.d
RUN echo "longrun" > /etc/s6-overlay/s6-rc.d/inertia-ssr/type
COPY docker/s6/inertia-ssr-run /etc/s6-overlay/s6-rc.d/inertia-ssr/run
RUN chmod +x /etc/s6-overlay/s6-rc.d/inertia-ssr/run

# S6 Overlay v3.2.3.2 moved the "user" bundle from /etc/s6-overlay/s6-rc.d to
# /etc/s6-overlay/user-bundles.d; the fallback keeps older base images working.
RUN S6_USER_BUNDLE=/etc/s6-overlay/user-bundles.d/user; \
    [ -d "$S6_USER_BUNDLE/contents.d" ] || S6_USER_BUNDLE=/etc/s6-overlay/s6-rc.d/user; \
    touch "$S6_USER_BUNDLE/contents.d/queue-worker" \
          "$S6_USER_BUNDLE/contents.d/laravel-scheduler" \
          "$S6_USER_BUNDLE/contents.d/reverb-server" \
          "$S6_USER_BUNDLE/contents.d/inertia-ssr"

USER www-data

EXPOSE 8080 6001
