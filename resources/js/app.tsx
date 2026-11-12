import './bootstrap';
import '../css/app.css';

import React, { Suspense, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { watchSystemTheme } from '@/lib/theme';
import { loadAnalytics, trackPageView } from '@/Lib/analyticsConsent';
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

const pages = import.meta.glob<{ default: ComponentType }>('./Pages/**/*.tsx');

createInertiaApp({
    // SeoHead supplies the full title (already carrying the brand), so the
    // callback is identity rather than appending the app name again.
    title: (title) => title || appName,
    resolve: (name) => {
        const path = `./Pages/${name}.tsx`;
        const page = pages[path];
        if (!page) throw new Error(`Page not found: ${name}`);

        if (name.startsWith('Transit/admin')) {
            return {
                default: React.lazy(page),
            };
        }

        return resolvePageComponent(path, pages);
    },
    setup({ el, App, props }) {
        const root = createRoot(el);
        root.render(
            <DirectionProvider dir="rtl">
                <QueryProvider>
                    <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center text-muted-foreground">جاري التحميل...</div>}>
                        <App {...props} />
                    </Suspense>
                </QueryProvider>
            </DirectionProvider>
        );
    },
    progress: {
        color: '#2563eb',
    },
});

// Analytics. Lib/analyticsConsent.ts owns the decision and the loading:
// loadAnalytics() is a no-op unless the visitor already agreed, and the
// Inertia handler below sends nothing until then (the initial page view is
// queued by the module when it loads gtag.js).
loadAnalytics();

// Track page views for every Inertia SPA navigation.
router.on('navigate', (event) => {
    trackPageView(event.detail.page.url);
});
