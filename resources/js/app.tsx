import './bootstrap';
import '../css/app.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { watchSystemTheme } from '@/lib/theme';
import { QueryProvider } from '@/Providers/QueryProvider';
import { DirectionProvider } from '@radix-ui/react-direction';

// errors + sampled tracing. no-op locally: the dsn is only injected in ci builds.
// rate comes from the VITE_SENTRY_TRACES_SAMPLE_RATE repo variable (baked at build).
// same-origin requests get trace headers by default, which is all inertia needs.
if (import.meta.env.VITE_SENTRY_DSN) {
    import('@sentry/react').then((Sentry) => {
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
    });
}

// keep data-theme in sync with the device scheme while the preference is 'system'
watchSystemTheme();

const appName = import.meta.env.VITE_APP_NAME || 'Syrian Zone';
// set by the gtag snippet in app.blade.php, which only renders when the id is
// configured. undefined on staging, so the navigate handler below no-ops.
const GA_ID = (window as unknown as { GA_ID?: string }).GA_ID;

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
    if (!GA_ID || typeof window.gtag !== 'function') return;

    window.gtag('config', GA_ID, {
        page_path: event.detail.page.url,
    });
});
