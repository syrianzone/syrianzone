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
            '@/lib': fileURLToPath(new URL('./resources/js/Lib', import.meta.url)),
            '@/components': fileURLToPath(new URL('./resources/js/Components', import.meta.url)),
            '@/context': fileURLToPath(new URL('./resources/js/Contexts', import.meta.url)),
            '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
        },
    },
});
