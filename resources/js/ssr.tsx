import React, { Suspense, type ComponentType } from 'react';
import ReactDOMServer from 'react-dom/server';
import { createInertiaApp } from '@inertiajs/react';
import createServer from '@inertiajs/react/server';
import { pageResolver } from '@/Lib/pages';
import { QueryProvider } from '@/Providers/QueryProvider';
import { DirectionProvider } from '@radix-ui/react-direction';

const pages = import.meta.glob<{ default: ComponentType }>('./Pages/**/*.tsx');

createServer((page) =>
    createInertiaApp({
        page,
        render: ReactDOMServer.renderToString,
        // The root Blade view prints the page title. Returning the title as
        // given (and nothing for an empty one) keeps the SSR head from adding
        // a second, generic <title> next to it.
        title: (title) => title,
        resolve: pageResolver(pages, { deferred: false }),
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
