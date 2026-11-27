import { createElement, Suspense } from 'react';
import ReactDOMServer from 'react-dom/server';
import { createInertiaApp } from '@inertiajs/react';
import { DirectionProvider } from '@radix-ui/react-direction';
import { describe, expect, it } from 'vitest';
import { QueryProvider } from '@/Providers/QueryProvider';
import { GOVERNORATES } from '@/Domain/geography/governorates';

async function renderOnServer(component: string, props: Record<string, unknown>, url: string): Promise<string> {
    const page = {
        component,
        url,
        version: '',
        props: {
            errors: {},
            auth: { user: null },
            dev: { enabled: false, roles: [], currentRole: null },
            sitePopup: null,
            siteNavigation: null,
            ...props,
        },
    };

    const rendered = await createInertiaApp({
        page: page as never,
        render: ReactDOMServer.renderToString,
        resolve: (name: string) => import(`./${name}.tsx`),
        setup: ({ App, props: appProps }) =>
            createElement(
                DirectionProvider,
                { dir: 'rtl' },
                createElement(QueryProvider, null, createElement(Suspense, { fallback: null }, createElement(App, appProps))),
            ),
    });

    return (rendered as unknown as { body: string }).body.replace(/ data-page="[^"]*"/, '');
}

describe('atlas and mishwar SSR content & crawlability', () => {
    it('renders /atlas with real population figures, 14 governorate links, and exactly one h1 and main', async () => {
        const html = await renderOnServer(
            'Population/Index',
            {
                initialSummary: {
                    source_id: 4,
                    note: 'Governorate populations',
                    date: '2021-01-01',
                    source_url: 'https://www.geo-ref.net/en/syr.htm',
                    total: 6221000,
                    governorates: [
                        { id: 'damascus', name_ar: 'دمشق', dataset_name_en: 'Damascus', value: 2103000, url: '/governorates/damascus' },
                        { id: 'aleppo', name_ar: 'حلب', dataset_name_en: 'Aleppo', value: 4118000, url: '/governorates/aleppo' },
                    ],
                },
            },
            '/atlas',
        );

        const cleanHtml = html.replace(/<!-- -->/g, '');
        expect(cleanHtml.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(cleanHtml.match(/<main[\s>]/g)).toHaveLength(1);

        // Real demographic figures and metadata are present on SSR (not an empty spinner shell)
        expect(cleanHtml).not.toContain('جاري تحميل بيانات الأطلس');
        expect(cleanHtml).toContain('6,221,000');
        expect(cleanHtml).toContain('2,103,000');
        expect(cleanHtml).toContain('4,118,000');
        expect(cleanHtml).toContain('Governorate populations');
        expect(cleanHtml).toContain('2021-01-01');
        expect(cleanHtml).toContain('https://www.geo-ref.net/en/syr.htm');

        // Crawlable internal links to all 14 governorate profile pages
        for (const gov of GOVERNORATES) {
            expect(cleanHtml).toContain(`href="/governorates/${gov.id}"`);
        }
    });

    it('keeps exactly one h1 and one main on /atlas when initialSummary is null', async () => {
        const html = await renderOnServer('Population/Index', { initialSummary: null }, '/atlas');

        const cleanHtml = html.replace(/<!-- -->/g, '');
        expect(cleanHtml.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(cleanHtml.match(/<main[\s>]/g)).toHaveLength(1);
        expect(cleanHtml).toContain('أطلس سوريا التفاعلي');
    });

    it('renders /mishwar with approved place links, governorate hub links, and no empty-state text on SSR', async () => {
        const html = await renderOnServer(
            'Places/Index',
            {
                initialPlaces: {
                    data: [
                        {
                            id: 12,
                            name: 'قلعة حلب',
                            category: 'historical',
                            description: 'معلم تاريخي في قلب حلب.',
                            lat: 36.1992,
                            lng: 37.1626,
                            thumb_url: null,
                            saves_count: 14,
                            url: '/mishwar/12-%D9%82%D9%84%D8%B9%D8%A9-%D8%AD%D9%84%D8%A8',
                        },
                        {
                            id: 34,
                            name: 'نواعير حماة',
                            category: 'historical',
                            description: 'نواعير تاريخية على نهر العاصي.',
                            lat: 35.1318,
                            lng: 36.7578,
                            thumb_url: null,
                            saves_count: 9,
                            url: '/mishwar/34-%D9%86%D9%88%D8%A7%D8%B9%D9%8A%D8%B1-%D8%AD%D9%85%D8%A7%D8%A9',
                        },
                    ],
                    current_page: 1,
                    last_page: 2,
                    total: 25,
                },
                governorateHubs: [
                    { id: 'aleppo', name_ar: 'حلب', count: 12, url: '/mishwar/aleppo' },
                    { id: 'hama', name_ar: 'حماة', count: 8, url: '/mishwar/hama' },
                ],
            },
            '/mishwar',
        );

        const cleanHtml = html.replace(/<!-- -->/g, '');
        expect(cleanHtml.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(cleanHtml.match(/<main[\s>]/g)).toHaveLength(1);

        // Places and crawlable detail links are rendered on SSR
        expect(cleanHtml).toContain('قلعة حلب');
        expect(cleanHtml).toContain('نواعير حماة');
        expect(cleanHtml).toContain('href="/mishwar/12-%D9%82%D9%84%D8%B9%D8%A9-%D8%AD%D9%84%D8%A8"');
        expect(cleanHtml).toContain('href="/mishwar/34-%D9%86%D9%88%D8%A7%D8%B9%D9%8A%D8%B1-%D8%AD%D9%85%D8%A7%D8%A9"');

        // Crawlable governorate hub links are rendered on SSR
        expect(cleanHtml).toContain('href="/mishwar/aleppo"');
        expect(cleanHtml).toContain('href="/mishwar/hama"');

        // Must NOT show empty state or loading spinner
        expect(cleanHtml).not.toContain('لا توجد أماكن');
        expect(cleanHtml).not.toContain('animate-spin');
    });
});
