import '../css/app.css';

import { type ComponentType } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { createInertiaApp, router } from '@inertiajs/react';
import { pageResolver } from '@/Lib/pages';
import { watchSystemTheme } from '@/Lib/theme';
import { watchFontStorage } from '@/Lib/font';
import { loadAnalytics, trackPageView } from '@/Lib/analyticsConsent';
import { AppRoot } from '@/Providers/AppRoot';

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

// keep data-theme in sync with the device scheme while the preference is
// 'system', and theme/font with choices made in other tabs
watchSystemTheme();
watchFontStorage();

const appName = import.meta.env.VITE_APP_NAME || 'Syrian Zone';

// React reports a Suspense boundary the server could not finish (error #419)
// as a recoverable error, then renders that part in the browser. That is the
// expected path for the lazily loaded maps and board widgets: they never
// resolve during the server's renderToString. Every other recoverable error,
// a real hydration mismatch included, is still reported the way React does by
// default.
function reportRecoverableError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    if (/#419\b|could not finish this Suspense boundary/.test(message)) return;
    if (typeof window.reportError === 'function') window.reportError(error);
    else console.error(error);
}

// Page modules only. Folders starting with `_` (`_components`, `_lib`, …) hold
// a page's private parts, never an Inertia page: listing them here would put
// ~130 more lazy entries (with their preload lists) in this entry chunk and
// force each into its own chunk. Keep in sync with ssr.tsx.
const pages = import.meta.glob<{ default: ComponentType }>(['./Pages/**/*.tsx', '!./Pages/**/_*/**']);

createInertiaApp({
    // SeoHead supplies the full title (already carrying the brand), so the
    // callback is identity rather than appending the app name again.
    title: (title) => title || appName,
    resolve: pageResolver(pages),
    setup({ el, App, props }) {
        const tree = (
            <AppRoot>
                <App {...props} />
            </AppRoot>
        );
        // Hydrate the server-rendered markup instead of discarding it. When the
        // SSR server was unavailable the container is empty (Inertia falls back
        // to client rendering), and there is nothing to hydrate.
        if (el.hasChildNodes()) {
            hydrateRoot(el, tree, { onRecoverableError: reportRecoverableError });
        } else {
            createRoot(el).render(tree);
        }
    },
    progress: {
        // the active theme's primary, not a fixed blue that no theme uses
        color: 'hsl(var(--primary))',
    },
});

// Analytics. Lib/analyticsConsent.ts owns the decision and the loading:
// loadAnalytics() is a no-op unless the visitor already agreed, and the
// Inertia handler below sends nothing until then (the initial page view is
// queued by the module when it loads gtag.js).
loadAnalytics();

router.on('navigate', (event) => {
    trackPageView(event.detail.page.url);
});
