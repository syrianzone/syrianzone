import './bootstrap';
import '../css/app.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { watchSystemTheme } from '@/lib/theme';
import { QueryProvider } from '@/Providers/QueryProvider';
import { DirectionProvider } from '@radix-ui/react-direction';
import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';

// errors + sampled tracing. no-op locally: the dsn is only injected in ci builds.
// rate comes from the VITE_SENTRY_TRACES_SAMPLE_RATE repo variable (baked at build).
// same-origin requests get trace headers by default, which is all inertia needs.
if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        release: import.meta.env.VITE_SENTRY_RELEASE,
        sendDefaultPii: false,
        integrations: [
            Sentry.browserTracingIntegration(),
            // forwards console.warn/error to sentry logs; plain console.log stays local
            Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
        ],
        tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE) || 0,
        enableLogs: true,
    });
}

// /ingest is a first-party caddy proxy to posthog cloud (adblockers drop the direct host).
// history_change defaults capture inertia spa navigations as pageviews. no-op locally.
if (import.meta.env.VITE_POSTHOG_KEY) {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || '/ingest',
        defaults: '2025-05-24',
    });
}

// keep data-theme in sync with the device scheme while the preference is 'system'
watchSystemTheme();

const appName = import.meta.env.VITE_APP_NAME || 'Syrian Zone';
const GA_ID = 'G-K4H98TC203';

createInertiaApp({
    title: (title) => title ? `${title} - ${appName}` : appName,
    resolve: (name) => resolvePageComponent(`./Pages/${name}.tsx`, import.meta.glob('./Pages/**/*.tsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);
        root.render(
            <DirectionProvider dir="rtl">
                <QueryProvider><App {...props} /></QueryProvider>
            </DirectionProvider>
        );
    },
    progress: {
        color: '#2563eb',
    },
});

// Track page views for every Inertia SPA navigation.
// The initial load is already tracked by the gtag snippet in app.blade.php.
router.on('navigate', (event) => {
    if (typeof window.gtag !== 'function') return;

    window.gtag('config', GA_ID, {
        page_path: event.detail.page.url,
    });
});
