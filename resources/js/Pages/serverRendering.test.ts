import { createElement, Suspense } from 'react';
import ReactDOMServer from 'react-dom/server';
import { createInertiaApp } from '@inertiajs/react';
import { DirectionProvider } from '@radix-ui/react-direction';
import { describe, expect, it } from 'vitest';
import { QueryProvider } from '@/Providers/QueryProvider';

/**
 * Renders a page the way the SSR server does (resources/js/ssr.tsx) and returns
 * the markup a crawler, or a visitor before JavaScript loads, receives.
 */
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

    // The body also carries the page props as a `data-page` attribute; drop it
    // so the assertions look at rendered markup only, not at the raw data.
    return (rendered as unknown as { body: string }).body.replace(/ data-page="[^"]*"/, '');
}

const entry = (id: string, name: string, number: string) => ({
    id,
    category_ar: 'الطوارئ',
    category_en: 'Emergency',
    name_ar: name,
    name_en: '',
    number,
    is_whatsapp: false,
    source_url: '',
});

const contributor = (username: string, total: number) => ({
    username,
    daily_contributions: 1,
    monthly_contributions: 10,
    yearly_contributions: 100,
    total_contributions: total,
    avatar_url: '',
});

describe('pages render their content on the server', () => {
    it('renders the phonebook with its heading and every entry', async () => {
        const html = await renderOnServer(
            'Phonebook/Index',
            { initialData: [entry('1', 'الإسعاف', '110'), entry('2', 'الإطفاء', '113'), entry('3', 'شرطة النجدة', '112')] },
            '/phonebook',
        );

        expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(html.match(/<main[\s>]/g)).toHaveLength(1);
        expect(html).toContain('دليل الهاتف والواتساب');
        expect(html).toContain('الإسعاف');
        expect(html).toContain('شرطة النجدة');
    });

    it('applies a shared ?q= search on the server, so the first frame is already filtered', async () => {
        const html = await renderOnServer(
            'Phonebook/Index',
            { initialData: [entry('1', 'الإسعاف', '110'), entry('2', 'الإطفاء', '113')] },
            '/phonebook?q=113',
        );

        expect(html).toContain('الإطفاء');
        expect(html).not.toContain('الإسعاف');
        expect(html).toContain('value="113"');
    });

    it('renders the contributors leaderboard from the list sent with the page', async () => {
        const html = await renderOnServer(
            'SyrianContributors/Index',
            { contributors: [contributor('alpha', 900), contributor('beta', 500), contributor('gamma', 300), contributor('delta', 100)] },
            '/syrian-contributors',
        );

        expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(html.match(/<main[\s>]/g)).toHaveLength(1);
        expect(html).toContain('أفضل المساهمين في GitHub');
        for (const name of ['alpha', 'beta', 'gamma', 'delta']) expect(html).toContain(`https://github.com/${name}`);
        // The list is already in the first frame, so the loading message is not.
        expect(html).not.toContain('جاري تحميل البيانات');
    });

    it('still gives the contributors page a heading and a landmark when it has no list yet', async () => {
        const html = await renderOnServer('SyrianContributors/Index', { contributors: [] }, '/syrian-contributors');

        expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(html.match(/<main[\s>]/g)).toHaveLength(1);
        // With nothing to send, the server render shows the loading state in words.
        expect(html).toContain('جاري تحميل البيانات...');
    });

    it('renders prayer city monthly timetable, qibla, FAQ, and links on the server', async () => {
        const html = await renderOnServer(
            'Muslim/Prayer/Index',
            {
                initialCity: 'aleppo',
                initialCityName: 'حلب',
                initialPrayer: {
                    governorate: 'aleppo',
                    method: 3,
                    timings: { Fajr: '05:49', Sunrise: '07:19', Dhuhr: '12:19', Asr: '15:00', Maghrib: '17:18', Isha: '18:43' },
                    hijri: { day: '16', month: 'جمادى الآخرة', year: '1448' },
                },
                monthlyCalendar: {
                    year: 2026,
                    month: 11,
                    month_ar: 'تشرين الثاني',
                    days: [
                        {
                            date: '2026-11-26',
                            gregorian_day: 26,
                            weekday_ar: 'الخميس',
                            hijri_day: '16',
                            hijri_month: 'جمادى الآخرة',
                            hijri_year: '1448',
                            timings: { Fajr: '05:49', Sunrise: '07:19', Dhuhr: '12:19', Asr: '15:00', Maghrib: '17:18', Isha: '18:43' },
                        },
                    ],
                },
                qibla: {
                    degrees: 173.4,
                    direction_ar: 'الجنوب',
                    description_ar: 'يتجه القبلة في حلب بزاوية 173.4° من الشمال الحقيقي باتجاه الجنوب نحو الكعبة المشرفة.',
                },
                todayInfo: { iso: '2026-11-26', gregorian_ar: 'الخميس، 26 تشرين الثاني 2026' },
            },
            '/muslim/prayer/aleppo',
        );

        expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(html.match(/<main[\s>]/g)).toHaveLength(1);
        expect(html).toContain('مواقيت الصلاة في حلب');
        expect(html).toContain('aria-current="date"');
        expect(html).toContain('173.4°');
        expect(html).toContain('/muslim/ramadan/aleppo');
        expect(html).toContain('مواقيت الصلاة في محافظات أخرى');
    });
});
