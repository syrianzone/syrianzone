import './bootstrap';
import '../css/app.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';

const appName = import.meta.env.VITE_APP_NAME || 'Syrian Zone';
const GA_ID = 'G-K4H98TC203';

createInertiaApp({
    title: (title) => title ? `${title} - ${appName}` : appName,
    resolve: (name) => resolvePageComponent(`./Pages/${name}.tsx`, import.meta.glob('./Pages/**/*.tsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);
        root.render(<App {...props} />);
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
