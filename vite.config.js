import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { fileURLToPath, URL } from 'node:url';

// source-map upload runs only in ci builds (token present); local builds are untouched
const sentryUpload = !!process.env.SENTRY_AUTH_TOKEN;

export default defineConfig({
    define: {
        'process.env': {},
    },
    server: {
        // Listen on all interfaces (IPv4 + IPv6) so `localhost` resolving to
        // ::1 and 127.0.0.1 both reach the dev server, and pin the HMR
        // websocket to the same host the browser used to load the page.
        host: true,
        port: 5173,
        strictPort: true,
        hmr: {
            host: 'localhost',
            protocol: 'ws',
        },
        // Inertia SSR in dev: while Vite is "hot", Inertia POSTs the page to
        // <hot-url>/__inertia_ssr. laravel-vite-plugin does not serve that, so
        // forward it to the SSR render server started by `bun run dev`
        // (php artisan inertia:start-ssr). Without this, dev SSR silently falls
        // back to client rendering.
        proxy: {
            '/__inertia_ssr': {
                target: 'http://127.0.0.1:13714',
                rewrite: () => '/render',
                changeOrigin: true,
            },
        },
    },
    build: {
        // hidden: maps are written for the upload but not referenced from the bundles
        sourcemap: sentryUpload ? 'hidden' : false,
    },
    plugins: [
        laravel({
            input: ['resources/js/app.tsx'],
            ssr: 'resources/js/ssr.tsx',
            refresh: true,
        }),
        react(),
        sentryVitePlugin({
            disable: !sentryUpload,
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            release: { name: process.env.VITE_SENTRY_RELEASE },
            sourcemaps: { filesToDeleteAfterUpload: 'public/build/**/*.map' },
            telemetry: false,
        }),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
        },
    },
});
