import { type ComponentType } from 'react';
import ReactDOMServer from 'react-dom/server';
import { createInertiaApp } from '@inertiajs/react';
import createServer from '@inertiajs/react/server';
import { pageResolver } from '@/Lib/pages';
import { AppRoot } from '@/Providers/AppRoot';

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
            <AppRoot>
                <App {...props} />
            </AppRoot>
        ),
    })
);
