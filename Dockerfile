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
# Stage 2: Compile ngx_brotli dynamic modules against the exact nginx version
#          in the base image. We use the same base image so the ABI matches.
# ─────────────────────────────────────────────────────────────────────────────
FROM serversideup/php:8.4-fpm-nginx AS brotli-builder
USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpcre2-dev \
        libssl-dev \
        zlib1g-dev \
        git \
        cmake \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Clone ngx_brotli with its brotli submodule
RUN git clone --recurse-submodules --depth 1 \
        https://github.com/google/ngx_brotli.git /tmp/ngx_brotli

# Build libbrotli first (cmake)
RUN cd /tmp/ngx_brotli/deps/brotli \
    && cmake -DCMAKE_BUILD_TYPE=Release -B ./out . \
    && cmake --build ./out --config Release -j$(nproc)

# Fetch nginx source matching the exact installed version
RUN NGINX_VER=$(nginx -v 2>&1 | grep -oP '[\d.]+') \
    && echo "Building ngx_brotli against nginx ${NGINX_VER}" \
    && curl -fsSL https://nginx.org/download/nginx-${NGINX_VER}.tar.gz \
       | tar -xz -C /tmp

# Compile the dynamic modules only.
RUN NGINX_VER=$(nginx -v 2>&1 | grep -oP '[\d.]+') \
    && cd /tmp/nginx-${NGINX_VER} \
    && ./configure \
        --with-compat \
        --add-dynamic-module=/tmp/ngx_brotli \
    && make -j$(nproc) modules \
    && mkdir -p /tmp/brotli-modules \
    && cp objs/ngx_http_brotli_filter_module.so /tmp/brotli-modules/ \
    && cp objs/ngx_http_brotli_static_module.so /tmp/brotli-modules/

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: Production image — serversideup/php with S6 Overlay v3
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

# Copy compiled Brotli .so modules from the build stage
COPY --from=brotli-builder /tmp/brotli-modules/ /usr/lib/nginx/modules/

WORKDIR /var/www/html

# Copy codebase
COPY --chown=www-data:www-data . .

# Copy compiled frontend assets from Stage 1
COPY --from=frontend-builder --chown=www-data:www-data /app/public/build ./public/build

# Install PHP dependencies (ignoring missing iconv plugin platform requirement if needed)
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-scripts --ignore-platform-req=ext-iconv

# Set correct permissions on Laravel writable dirs
RUN chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# ── Nginx: Brotli module loader integration ─────────────────────────────────
RUN mkdir -p /etc/nginx/main.d && printf "load_module /usr/lib/nginx/modules/ngx_http_brotli_filter_module.so;\nload_module /usr/lib/nginx/modules/ngx_http_brotli_static_module.so;\n" > /etc/nginx/main.d/brotli-loader.conf

# ── Nginx: Replace default site with our Laravel server block ─────────────────
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# ── Nginx: Brotli http-context directives (brotli on, brotli_static on, etc.) ─
COPY docker/nginx-brotli.conf /etc/nginx/conf.d/brotli.conf

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
