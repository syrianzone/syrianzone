import React, { Suspense } from 'react';
import ReactDOMServer from 'react-dom/server';
import { createInertiaApp } from '@inertiajs/react';
import createServer from '@inertiajs/react/server';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { QueryProvider } from '@/Providers/QueryProvider';
import { DirectionProvider } from '@radix-ui/react-direction';

const appName = import.meta.env.VITE_APP_NAME || 'Syrian Zone';

createServer((page) =>
    createInertiaApp({
        page,
        render: ReactDOMServer.renderToString,
        title: (title) => (title ? `${title} - ${appName}` : appName),
        resolve: (name) =>
            resolvePageComponent(
                `./Pages/${name}.tsx`,
                import.meta.glob('./Pages/**/*.tsx')
            ),
        setup: ({ App, props }) => (
            <DirectionProvider dir="rtl">
                <QueryProvider>
                    <Suspense fallback={null}>
                        <App {...props} />
                    </Suspense>
                </QueryProvider>
            </DirectionProvider>
        ),
    })
);
