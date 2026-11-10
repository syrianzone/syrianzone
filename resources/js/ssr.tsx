import React, { Suspense } from 'react';
import ReactDOMServer from 'react-dom/server';
import { createInertiaApp } from '@inertiajs/react';
import createServer from '@inertiajs/react/server';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { QueryProvider } from '@/Providers/QueryProvider';
import { DirectionProvider } from '@radix-ui/react-direction';

createServer((page) =>
    createInertiaApp({
        page,
        render: ReactDOMServer.renderToString,
        // The root Blade view prints the page title. Returning the title as
        // given (and nothing for an empty one) keeps the SSR head from adding
        // a second, generic <title> next to it.
        title: (title) => title,
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
