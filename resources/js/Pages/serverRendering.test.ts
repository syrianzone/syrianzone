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

    it('renders only the first 30 govtcvs cards on SSR while keeping every official link in the index', async () => {
        const officials = Array.from({ length: 45 }, (_, idx) => ({
            id: `off-${idx + 1}`,
            slug: `official-${idx + 1}`,
            full_name_ar: `المسؤول رقم ${idx + 1}`,
            display_name_ar: `المسؤول رقم ${idx + 1}`,
            full_name_en: null,
            honorific_ar: null,
            bio_summary_ar: null,
            birth_place_ar: null,
            office_status: 'in_office',
            highest_tier: 'minister',
            cv_completeness: 'full_cv',
            portrait_url: null,
            first_seen_in_office_at: '2025-03-29',
            tenures_count: 1,
            active_tenure: {
                institution_id: 'min-energy',
                institution_name_ar: 'وزارة الطاقة',
                role_title_ar: 'وزير الطاقة',
                tier: 'minister',
                government_phase: 'transitional_2025',
                started_at: '2025-03-29',
                start_date_precision: 'exact',
                ended_at: null,
                end_date_precision: null,
                is_acting: false,
            },
        }));

        const html = await renderOnServer(
            'GovtCvs/Index',
            {
                officials,
                stats: {
                    total: 45,
                    in_office: 45,
                    out_of_office: 0,
                    uncertain: 0,
                    full_cv: 45,
                    total_movements: 45,
                },
                institutions: [{ id: 'min-energy', name_ar: 'وزارة الطاقة' }],
            },
            '/govtcvs',
        );

        const cleanHtml = html.replace(/<!-- -->/g, '');
        expect(cleanHtml.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(cleanHtml.match(/<main[\s>]/g)).toHaveLength(1);
        expect(cleanHtml).toContain('عرض المزيد (تبقّى 15)');
        expect(cleanHtml).toContain('جميع المسؤولين');
        // 30 card headings + 1 directory index heading ("جميع المسؤولين")
        expect(cleanHtml.match(/<h2[\s>]/g)).toHaveLength(31);
        // Every official still has a real <a href> in SSR HTML
        for (const official of officials) {
            expect(cleanHtml).toContain(`href="/govtcvs/${official.slug}"`);
        }
    });

    it('renders the governorates hub with its SSR SVG map and all 14 governorate links', async () => {
        const html = await renderOnServer(
            'Governorates/Index',
            {
                governorates: [
                    {
                        id: 'damascus',
                        name_ar: 'دمشق',
                        name_en: 'Damascus',
                        pcode: 'SY01',
                        centre_ar: 'دمشق',
                        area_sqkm: 117,
                        icon_path: '/syid-assets/icons/governorates/with-frame/damascus-sword.svg',
                        landmark_ar: 'السيف الدمشقي',
                        population: { value: 2103000, year: '2021', source_url: 'https://www.geo-ref.net/en/syr.htm', note: 'Governorate populations' },
                    },
                    {
                        id: 'aleppo',
                        name_ar: 'حلب',
                        name_en: 'Aleppo',
                        pcode: 'SY02',
                        centre_ar: 'حلب',
                        area_sqkm: 19891,
                        icon_path: '/syid-assets/icons/governorates/with-frame/aleppo-citadel.svg',
                        landmark_ar: 'قلعة حلب',
                        population: { value: 4118000, year: '2021', source_url: 'https://www.geo-ref.net/en/syr.htm', note: 'Governorate populations' },
                    },
                ],
                populationMeta: { year: '2021', source_url: 'https://www.geo-ref.net/en/syr.htm', note: 'Governorate populations', total: 6221000 },
                svgMap: {
                    viewBox: '0 0 600 520',
                    width: 600,
                    height: 520,
                    shapes: [
                        { id: 'damascus', name_ar: 'دمشق', path: 'M10 10L20 10L20 20Z', label_x: 15, label_y: 15 },
                        { id: 'aleppo', name_ar: 'حلب', path: 'M30 10L50 10L50 30Z', label_x: 40, label_y: 20 },
                    ],
                },
                iconCredit: { name_ar: 'ولاء', x_url: 'https://x.com/walaa_akdesign', instagram_url: 'https://www.instagram.com/walaa_akdesign/' },
            },
            '/governorates',
        );

        const cleanHtml = html.replace(/<!-- -->/g, '');
        expect(cleanHtml.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(cleanHtml.match(/<main[\s>]/g)).toHaveLength(1);
        expect(cleanHtml).toContain('محافظات سوريا الأربع عشرة');
        expect(cleanHtml).toContain('href="/governorates/damascus"');
        expect(cleanHtml).toContain('href="/governorates/aleppo"');
        expect(cleanHtml).toContain('4,118,000');
        expect(cleanHtml).toContain('ولاء');
    });

    it('renders a governorate detail page with all populated sections and omits empty sections on SSR', async () => {
        const fullHtml = await renderOnServer(
            'Governorates/Show',
            {
                governorate: {
                    id: 'aleppo',
                    name_ar: 'حلب',
                    name_en: 'Aleppo',
                    pcode: 'SY02',
                    lat: 36.2021,
                    lng: 37.1343,
                    centre_ar: 'حلب',
                    area_sqkm: 19891,
                    icon_path: '/syid-assets/icons/governorates/with-frame/aleppo-citadel.svg',
                    landmark_ar: 'قلعة حلب',
                },
                population: { value: 4118000, year: '2021', source_url: 'https://www.geo-ref.net/en/syr.htm', note: 'Governorate populations' },
                officials: {
                    governor: {
                        name_ar: 'عزام محمد الغريب',
                        title_ar: 'محافظ حلب',
                        start_date: '2024-12-21',
                        decree: null,
                        notes_ar: null,
                        slug: 'azzam-al-gharib',
                        portrait_url: null,
                        source_label_ar: 'السير الذاتية للمسؤولين',
                        source_url: '/govtcvs/azzam-al-gharib',
                    },
                    deputies: [
                        { name_ar: 'فواز هلال', title_ar: 'نائب محافظ حلب', role_kind: 'نائب', slug: null, portrait_url: null, source_label_ar: 'جَرد', source_url: 'https://jard.chat/government/aleppo-governorate' },
                    ],
                    jard_credit: { name_ar: 'جَرد', url: 'https://jard.chat/government', as_of: '2026-11-24' },
                },
                prayer: {
                    timings: { Fajr: '05:15', Sunrise: '06:42', Dhuhr: '12:20', Asr: '15:25', Maghrib: '17:58', Isha: '19:20' },
                    hijri: { day: '15', month: 'جمادى الآخرة', year: '1448' },
                    today: { iso: '2026-11-26', gregorian_ar: 'الخميس، 26 تشرين الثاني 2026' },
                    prayer_url: '/muslim/prayer/aleppo',
                    ramadan_url: '/muslim/ramadan/aleppo',
                },
                transit: {
                    city_id: 'aleppo',
                    city_name_ar: 'حلب',
                    routes_count: 5,
                    map_url: '/transit/city/aleppo',
                    routes: [{ id: 'r1', name_ar: 'خط الجامعة', stops_count: 12, price_new: 15, url: '/transit/city/aleppo?route=r1' }],
                },
                crossings: [
                    { n: 2, slug: 'al-salama', name: 'منفذ السلامة الحدودي', category: 'crossing', country: 'تركيا', op_type: 'مسافرين وتجاري', opening_soon: false, url: '/crossings/al-salama' },
                ],
                places: {
                    total: 4,
                    categories: [{ key: 'historical', label: 'تاريخي', count: 2 }],
                    notable: [{ id: 8, name: 'قلعة حلب', category: 'historical', category_label: 'تاريخي', description: 'معلم أثري', url: '/mishwar?place=8' }],
                },
                phonebook: [
                    { id: '10', name_ar: 'إدارة الأمن العام (عمليات حلب)', category_ar: 'وزارة الداخلية', number: '2241300', is_whatsapp: false, source_url: null },
                ],
                otherGovernorates: [
                    { id: 'damascus', name_ar: 'دمشق', centre_ar: 'دمشق', icon_path: null },
                ],
                iconCredit: { name_ar: 'ولاء', x_url: 'https://x.com/walaa_akdesign', instagram_url: 'https://www.instagram.com/walaa_akdesign/' },
            },
            '/governorates/aleppo',
        );

        const cleanFull = fullHtml.replace(/<!-- -->/g, '');
        expect(cleanFull.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(cleanFull.match(/<main[\s>]/g)).toHaveLength(1);
        expect(cleanFull).toContain('محافظة حلب');
        expect(cleanFull).toContain('عزام محمد الغريب');
        expect(cleanFull).toContain('فواز هلال');
        expect(cleanFull).toContain('05:15');
        expect(cleanFull).toContain('/muslim/ramadan/aleppo');
        expect(cleanFull).toContain('خط الجامعة');
        expect(cleanFull).toContain('منفذ السلامة الحدودي');
        expect(cleanFull).toContain('قلعة حلب');
        expect(cleanFull).toContain('2241300');
        expect(cleanFull).toContain('href="/governorates/damascus"');

        // Sparse page: empty sections must be omitted, never rendered as empty placeholders
        const sparseHtml = await renderOnServer(
            'Governorates/Show',
            {
                governorate: {
                    id: 'quneitra',
                    name_ar: 'القنيطرة',
                    name_en: 'Quneitra',
                    pcode: 'SY14',
                    lat: 33.125,
                    lng: 35.825,
                    centre_ar: 'القنيطرة',
                    area_sqkm: 1718,
                    icon_path: null,
                    landmark_ar: null,
                },
                population: null,
                officials: { governor: null, deputies: [], jard_credit: null },
                prayer: null,
                transit: null,
                crossings: [],
                places: null,
                phonebook: [],
                otherGovernorates: [],
                iconCredit: { name_ar: 'ولاء', x_url: 'https://x.com/walaa_akdesign', instagram_url: 'https://www.instagram.com/walaa_akdesign/' },
            },
            '/governorates/quneitra',
        );

        const cleanSparse = sparseHtml.replace(/<!-- -->/g, '');
        expect(cleanSparse.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(cleanSparse).not.toContain('id="officials"');
        expect(cleanSparse).not.toContain('id="prayer"');
        expect(cleanSparse).not.toContain('id="transit"');
        expect(cleanSparse).not.toContain('id="crossings"');
        expect(cleanSparse).not.toContain('id="places"');
        expect(cleanSparse).not.toContain('id="phonebook"');
    });
});
