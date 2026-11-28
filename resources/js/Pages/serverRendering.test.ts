import { createElement, Suspense } from 'react';
import ReactDOMServer from 'react-dom/server';
import { createInertiaApp } from '@inertiajs/react';
import { DirectionProvider } from '@radix-ui/react-direction';
import { describe, expect, it } from 'vitest';
import { QueryProvider } from '@/Providers/QueryProvider';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CURRENCY_FACTS } from '@/Domain/currency/facts';

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

    it('renders roznama lead with Gregorian/Hijri dates, next holiday, Ramadan countdown, and calendar keywords', async () => {
        const html = await renderOnServer(
            'Roznama/Index',
            {
                serverYear: 2026,
                serverToday: {
                    iso: '2026-11-26',
                    gregorianAr: 'الخميس، 26 تشرين الثاني 2026',
                    hijriAr: '16 جمادى الآخرة 1448 هـ',
                },
                ramadan: {
                    hijriYear: 1448,
                    expectedStartDate: '2027-02-08',
                    expectedEndDate: '2027-03-08',
                    daysLeft: 74,
                    status: 'upcoming',
                },
            },
            '/roznama',
        );

        const cleanHtml = html.replace(/<!-- -->/g, '');
        expect(cleanHtml.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(cleanHtml.match(/<main[\s>]/g)).toHaveLength(1);
        expect(cleanHtml).toContain('الروزنامة السورية 2026');
        expect(cleanHtml).toContain('التقويم');
        expect(cleanHtml).toContain('روزناما');
        expect(cleanHtml).toContain('الخميس، 26 تشرين الثاني 2026');
        expect(cleanHtml).toContain('16 جمادى الآخرة 1448 هـ');
        expect(cleanHtml).toContain('عيد التحرير الوطني');
        expect(cleanHtml).toContain('كم باقي على رمضان 1448؟');
        expect(cleanHtml).toContain('متبقٍ 74 يوماً');
        expect(cleanHtml).toContain('href="/muslim/ramadan"');
    });

    it('renders transit city H1, intro with route count/last update, and crawlable route links with fares', async () => {
        const city = {
            id: 'damascus',
            nameAr: 'دمشق',
            nameEn: 'Damascus',
            status: 'active',
            zoom: 12,
            center: [36.29, 33.51],
            bounds: [[36.2, 33.45], [36.38, 33.57]],
            routeCount: 2,
            mapGroup: ['damascus', 'rif-dimashq'],
            mapGroupLabel: 'دمشق الكبرى',
        };
        const rifCity = {
            ...city,
            id: 'rif-dimashq',
            nameAr: 'ريف دمشق',
            nameEn: 'Rif Dimashq',
            routeCount: 1,
        };
        const routes = [
            { id: 'damascus-001', cityId: 'damascus', nameAr: 'برزة البلد - شارع الثورة', nameEn: null, colorIndex: 0, priceOld: 2500, priceNew: 25, stopsCount: 12 },
            { id: 'rif-001', cityId: 'rif-dimashq', nameAr: 'جرمانا - البرامكة', nameEn: null, colorIndex: 1, priceOld: 3000, priceNew: 30, stopsCount: 9 },
        ];

        const html = await renderOnServer(
            'Transit/city/[id]/Index',
            { id: 'damascus', city, cities: [city, rifCity], routes, lastUpdated: '2026-07-24' },
            '/transit/city/damascus',
        );

        const cleanHtml = html.replace(/<!-- -->/g, '');
        expect(cleanHtml.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(cleanHtml.match(/<main[\s>]/g)).toHaveLength(1);
        expect(cleanHtml).toContain('خطوط السرافيس في دمشق — خريطة ومسارات وأجرة');
        expect(cleanHtml).toContain('2 خط سيرفيس');
        expect(cleanHtml).toContain('آخر تحديث:');
        expect(cleanHtml).toContain('اختر خطاً من القائمة أو ابحث في الخريطة');
        expect(cleanHtml).toContain('href="/transit/city/damascus?route=damascus-001"');
        expect(cleanHtml).toContain('href="/transit/city/damascus?route=rif-001"');
        expect(cleanHtml).toContain('برزة البلد - شارع الثورة');
        expect(cleanHtml).toContain('٢٥ ل.س');
    });

    it('renders house members grouped by governorate with member page links and member detail page without raw gender codes', async () => {
        const houseHtml = await renderOnServer('House/Index', { members2026: [] }, '/house');
        const cleanHouse = houseHtml.replace(/<!-- -->/g, '');
        expect(cleanHouse.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(cleanHouse.match(/<main[\s>]/g)).toHaveLength(1);
        expect(cleanHouse).toContain('أعضاء مجلس الشعب السوري 2026: الأسماء حسب المحافظة');
        expect(cleanHouse).toContain('أسماء أعضاء مجلس الشعب السوري حسب المحافظة');
        expect(cleanHouse).toContain('href="/house/members/73"');
        expect(cleanHouse).toContain('مصطفى عبدالوهاب موسى');

        const memberHtml = await renderOnServer(
            'House/Show',
            {
                member: {
                    name_ar: 'فاطمة عبد اللطيف اليوسف',
                    governorate_ar: 'ادلب',
                    governorate_display_ar: 'إدلب',
                    district: '',
                    town: '',
                    gender: 'F',
                    birth_year: '1991',
                    age: '34',
                    selection_method: 'تعيين',
                    category: '',
                    status: 'active',
                    member_number: '176',
                    management_position: '',
                    facebook_url: '',
                    twitter_url: '',
                },
                sameGovernorateMembers: [
                    { member_number: '73', name_ar: 'مصطفى عبدالوهاب موسى', district: 'جسر الشغور', management_position: 'نائب أول لرئيس المجلس', selection_method: 'انتخابات' },
                ],
                sourceUrl: 'https://omrandirasat.org/test',
            },
            '/house/members/176',
        );

        const cleanMember = memberHtml.replace(/<!-- -->/g, '');
        expect(cleanMember.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(cleanMember.match(/<main[\s>]/g)).toHaveLength(1);
        expect(cleanMember).toContain('عضوة مجلس الشعب السوري عن محافظة إدلب');
        expect(cleanMember).toContain('أنثى');
        expect(cleanMember).not.toContain('>F<');
        expect(cleanMember).toContain('href="/house"');
        expect(cleanMember).toContain('href="/house/members/73"');
        expect(cleanMember).toContain('https://omrandirasat.org/test');
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

    it('renders /syid/logo with H1, emblem image, 4K/SVG/PDF downloads, variants, symbolism and usage rules', async () => {
        const html = await renderOnServer('SyId/Logo', {}, '/syid/logo');

        expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(html.match(/<main[\s>]/g)).toHaveLength(1);
        expect(html).toContain('شعار الجمهورية العربية السورية الجديد');
        expect(html).toContain('/syid-assets/downloads/syrian-arab-republic-eagle-emblem-4k.png');
        expect(html).toContain('/syid-assets/downloads/syrian-arab-republic-eagle-emblem.pdf');
        expect(html).toContain('/syid-assets/materials/logo.ai.svg');
        expect(html).toContain('download="شعار-الجمهورية-العربية-السورية-4K.png"');
        expect(html).toContain('النسخة السوداء الأحادية');
        expect(html).toContain('النسخة البيضاء الأحادية');
        expect(html).toContain('دلالات الشعار ورمزية العقاب الذهبي');
        expect(html).toContain('ضوابط الاستخدام الرسمي للشعار');
        expect(html).toContain('href="/syid"');
        expect(html).toContain('href="/syid/flag"');
    });

    it('renders /syid/flag with H1, copy emoji button, all download sizes, proportions, wallpapers, guide and FAQ', async () => {
        const html = await renderOnServer('SyId/Flag', {}, '/syid/flag');

        expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(html.match(/<main[\s>]/g)).toHaveLength(1);
        expect(html).toContain('علم الجمهورية العربية السورية الجديد');
        expect(html).toContain('نسخ 🇸🇾');
        expect(html).toContain('aria-live="polite"');
        expect(html).toContain('/syid-assets/downloads/syrian-flag.svg');
        expect(html).toContain('/syid-assets/downloads/syrian-flag-640.png');
        expect(html).toContain('/syid-assets/downloads/syrian-flag-1280.png');
        expect(html).toContain('/syid-assets/downloads/syrian-flag-1920.png');
        expect(html).toContain('/syid-assets/downloads/syrian-flag-3840.png');
        expect(html).toContain('download="علم-سوريا-الجديد-4K-3840.png"');
        expect(html).toContain('/syid-assets/materials/syrian-identity-wallpaper-desktop.png');
        expect(html).toContain('/syid-assets/materials/syrian-identity-wallpaper-mobile.png');
        expect(html).toContain('الدليل الإرشادي للعلم السوري');
        expect(html).toContain('الأسئلة الشائعة');
        expect(html).toContain('href="/syid/logo"');
    });

    it('keeps /syid as a complete hub with all existing sections plus links to /syid/logo and /syid/flag', async () => {
        const html = await renderOnServer('SyId/Index', {}, '/syid');

        expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(html.match(/<main[\s>]/g)).toHaveLength(1);
        // New hub cards & deep links
        expect(html).toContain('href="/syid/logo"');
        expect(html).toContain('href="/syid/flag"');
        expect(html).toContain('صفحة العلم الكاملة');
        expect(html).toContain('صفحة الشعار الكاملة');
        // Every existing hub section and asset remains intact
        for (const section of [
            'عناصر الهوية البصرية السورية',
            'لوحة الألوان',
            'الخطوط',
            'خط قمرة',
            'خط حيّاكم الله',
            'العلم السوري ونسبه',
            'المواد والدليل الإرشادي',
            'الدليل الإرشادي للعلم السوري',
            'شعار الهوية والمواد الرسمية',
            'أيقونات المحافظات السورية',
            'خريطة سوريا الرقمية',
            'https://syrianidentity.sy',
            '/syid-assets/materials/syrian-flag.dwg',
            '/syid-assets/materials/logo.ai.svg',
        ]) {
            expect(html).toContain(section);
        }
    });

    it('renders the ministries hub with the current cabinet and four-era timeline in SSR markup', async () => {
        const raw = JSON.parse(
            readFileSync(resolve(process.cwd(), 'resources/data/government/ministries.json'), 'utf8'),
        );
        const bySlug = Object.fromEntries(raw.ministries.map((m: { slug: string }) => [m.slug, m]));
        const toSummary = (m: Record<string, unknown>) => ({
            ...m,
            entity_image: null,
            entity_description_ar: null,
            predecessors: ((m.predecessors as string[]) ?? []).map((s) => ({
                slug: s,
                name_ar: bySlug[s]?.name_ar ?? s,
                status: bySlug[s]?.status ?? 'current',
                kind: bySlug[s]?.kind ?? 'ministry',
            })),
            successors: ((m.successors as string[]) ?? []).map((s) => ({
                slug: s,
                name_ar: bySlug[s]?.name_ar ?? s,
                status: bySlug[s]?.status ?? 'current',
                kind: bySlug[s]?.kind ?? 'ministry',
            })),
            holders: (m.holders as Array<Record<string, unknown>>).map((h) => ({
                ...h,
                govtcvs_url: h.govtcvs_slug ? `/govtcvs/${h.govtcvs_slug}` : null,
                portrait_url: null,
                bio_summary_ar: null,
                office_status: null,
                cv_completeness: null,
            })),
            deputies: [],
            current_holder:
                (m.holders as Array<Record<string, unknown>>).find((h) => h.is_current)
                    ? {
                          ...(m.holders as Array<Record<string, unknown>>).find((h) => h.is_current),
                          govtcvs_url: (m.holders as Array<Record<string, unknown>>).find((h) => h.is_current)
                              ?.govtcvs_slug
                              ? `/govtcvs/${
                                    (m.holders as Array<Record<string, unknown>>).find((h) => h.is_current)
                                        ?.govtcvs_slug
                                }`
                              : null,
                          portrait_url: null,
                          bio_summary_ar: null,
                          office_status: null,
                          cv_completeness: null,
                      }
                    : null,
        });

        const all = raw.ministries.map(toSummary);
        const currentCabinet = all.filter(
            (m: { kind: string; status: string }) => m.kind === 'ministry' && m.status === 'current',
        );
        const historical = all.filter(
            (m: { kind: string; status: string }) => m.kind === 'ministry' && m.status !== 'current',
        );
        const sovereign = all.filter((m: { kind: string }) => m.kind === 'sovereign');

        const html = await renderOnServer(
            'Ministries/Index',
            {
                meta: raw.meta,
                eras: raw.eras,
                restructurings: raw.restructurings.map((r: Record<string, unknown>) => ({
                    ...r,
                    from_ministries: ((r.from_slugs as string[]) ?? []).map((s) => ({
                        slug: s,
                        name_ar: bySlug[s]?.name_ar ?? s,
                        status: bySlug[s]?.status ?? 'merged',
                        kind: bySlug[s]?.kind ?? 'ministry',
                    })),
                    to_ministries: ((r.to_slugs as string[]) ?? []).map((s) => ({
                        slug: s,
                        name_ar: bySlug[s]?.name_ar ?? s,
                        status: bySlug[s]?.status ?? 'current',
                        kind: bySlug[s]?.kind ?? 'ministry',
                    })),
                })),
                all_ministries: all,
                stats: {
                    current_ministries: currentCabinet.length,
                    historical_ministries: historical.length,
                    sovereign_bodies: sovereign.length,
                    eras_count: raw.eras.length,
                },
            },
            '/ministries',
        );

        const cleanHtml = html.replace(/<!-- -->/g, '');
        expect(cleanHtml.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(cleanHtml.match(/<main[\s>]/g)).toHaveLength(1);
        expect(cleanHtml).toContain('وزارات سوريا والحكومة السورية');
        expect(cleanHtml).toContain('التشكيل الوزاري الحالي');
        expect(cleanHtml).toContain('الخط الزمني للحكومة السورية عبر المراحل الأربع');
        expect(cleanHtml).toContain('<ol');
        expect(cleanHtml).toContain('<time dateTime="2025-03-29"');
        for (const era of raw.eras) {
            expect(cleanHtml).toContain(era.label_ar);
        }
        expect(cleanHtml).toContain('href="/ministries/energy"');
        expect(cleanHtml).toContain('href="/ministries/foreign-affairs"');
        expect(cleanHtml).toContain('href="/ministries/economy"');
        expect(cleanHtml).toContain('href="/ministries/industry-and-internal-trade"');
        expect(cleanHtml).toContain('محمد البشير');
        expect(cleanHtml).toContain('أسعد حسن الشيباني');
    });

    it('renders a ministry detail page with holder timeline, merger history, accounts, apps, and promises in SSR markup', async () => {
        const html = await renderOnServer(
            'Ministries/Show',
            {
                meta: {
                    updated_at: '2026-11-24T17:47:38+00:00',
                    source_name_ar: 'جَرد — هيكلية الحكومة السورية',
                    source_url: 'https://jard.chat/government',
                    source_json_url: 'https://jard.chat/government.json',
                },
                eras: [
                    {
                        id: 'al_bashir',
                        label_ar: 'حكومة تسيير الأعمال (محمد البشير)',
                        short_label_ar: 'تسيير الأعمال (البشير)',
                        period_ar: 'كانون الأول 2024 – آذار 2025',
                        start_date: '2024-12-10',
                        end_date: '2025-03-29',
                        summary_ar: '',
                        source_url: 'https://jard.chat/government',
                    },
                    {
                        id: 'transitional_2025',
                        label_ar: 'الحكومة الانتقالية المباشرة',
                        short_label_ar: 'الحكومة الانتقالية',
                        period_ar: 'آذار 2025 – أيار 2026',
                        start_date: '2025-03-29',
                        end_date: '2026-05-09',
                        summary_ar: '',
                        source_url: 'https://jard.chat/government',
                    },
                ],
                ministry: {
                    slug: 'energy',
                    kind: 'ministry',
                    name_ar: 'وزارة الطاقة',
                    name_en: 'Ministry of Energy',
                    status: 'current',
                    sort_order: 4,
                    official_entity_id: 'min-energy',
                    entity_image: null,
                    entity_description_ar: null,
                    predecessors: [
                        { slug: 'electricity', name_ar: 'وزارة الكهرباء', status: 'merged', kind: 'ministry' },
                    ],
                    successors: [],
                    lineage_summary_ar: 'استُحدثت بدمج ثلاث وزارات بتاريخ 29 آذار 2025.',
                    lineage_events: [
                        {
                            date: '2025-03-29',
                            kind: 'merge',
                            label_ar: 'دمج وزارات الكهرباء والنفط والموارد المائية في وزارة الطاقة',
                            related_ministries: [
                                { slug: 'electricity', name_ar: 'وزارة الكهرباء', status: 'merged', kind: 'ministry' },
                            ],
                            source_url: 'https://jard.chat/government/ministry-of-energy',
                        },
                    ],
                    jard_url: 'https://jard.chat/government/ministry-of-energy',
                    current_holder: {
                        name: 'محمد البشير',
                        title: 'وزير الطاقة',
                        era: 'transitional_2025',
                        start_date: '2025-03-29',
                        end_date: null,
                        is_current: true,
                        decree: null,
                        notes: 'وزارة مُستحدثة',
                        source_url: 'https://jard.chat/government/ministry-of-energy',
                        source_label: 'جَرد — وزارة الطاقة',
                        govtcvs_slug: 'mohammed-al-bashir',
                        govtcvs_url: '/govtcvs/mohammed-al-bashir',
                        portrait_url: null,
                        bio_summary_ar: null,
                        office_status: 'in_office',
                        cv_completeness: 'full_cv',
                    },
                    holders: [
                        {
                            name: 'محمد البشير',
                            title: 'وزير الطاقة',
                            era: 'transitional_2025',
                            start_date: '2025-03-29',
                            end_date: null,
                            is_current: true,
                            decree: null,
                            notes: 'وزارة مُستحدثة',
                            source_url: 'https://jard.chat/government/ministry-of-energy',
                            source_label: 'جَرد — وزارة الطاقة',
                            govtcvs_slug: 'mohammed-al-bashir',
                            govtcvs_url: '/govtcvs/mohammed-al-bashir',
                            portrait_url: null,
                            bio_summary_ar: null,
                            office_status: 'in_office',
                            cv_completeness: 'full_cv',
                        },
                    ],
                    deputies: [],
                },
                official_accounts: {
                    primary: {
                        id: 'min-energy',
                        name_ar: 'وزارة الطاقة السورية',
                        name_en: 'Ministry of Energy',
                        description_ar: null,
                        image: null,
                        socials: { website: 'https://moe.gov.sy' },
                        syofficial_url: '/syofficial',
                    },
                    affiliated: [],
                },
                gov_apps: [
                    {
                        id: 'seg',
                        name_ar: 'بوابة الطاقة السورية',
                        description_ar: 'خدمات الطاقة',
                        icon: null,
                        has_guide: true,
                        url: '/govapps/seg',
                        website: null,
                    },
                ],
                promises: [
                    {
                        id: 'p1',
                        number: 12,
                        title: 'تحسين التغذية الكهربائية',
                        status: 'in_progress',
                        display_state: 'in_progress',
                        statement_date: '2025-06-01',
                        deadline_date: null,
                        speaker_name: 'محمد البشير',
                        speaker_slug: 'mohammed-al-bashir',
                        is_current_minister: true,
                        url: '/promises/12',
                    },
                ],
                sources: [
                    { label_ar: 'جَرد — وزارة الطاقة', url: 'https://jard.chat/government/ministry-of-energy' },
                ],
                siblings: [{ slug: 'finance', name_ar: 'وزارة المالية', status: 'current', kind: 'ministry' }],
            },
            '/ministries/energy',
        );

        const cleanHtml = html.replace(/<!-- -->/g, '');
        expect(cleanHtml.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(cleanHtml.match(/<main[\s>]/g)).toHaveLength(1);
        expect(cleanHtml).toContain('وزارة الطاقة');
        expect(cleanHtml).toContain('محمد البشير');
        expect(cleanHtml).toContain('href="/govtcvs/mohammed-al-bashir"');
        expect(cleanHtml).toContain('href="/ministries/electricity"');
        expect(cleanHtml).toContain('https://moe.gov.sy');
        expect(cleanHtml).toContain('href="/govapps/seg"');
        expect(cleanHtml).toContain('href="/promises/12"');
        expect(cleanHtml).toContain('<time dateTime="2025-03-29"');
    });

    it('renders /currency with Western digits only and updated former-regime wording', async () => {
        const html = await renderOnServer(
            'Currency/Index',
            { currency: CURRENCY_FACTS },
            '/currency',
        );

        const cleanHtml = html.replace(/<!-- -->/g, '');
        expect(cleanHtml.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(cleanHtml.match(/<main[\s>]/g)).toHaveLength(1);
        expect(cleanHtml).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
        expect(cleanHtml).toContain('10,000');
        expect(cleanHtml).toContain('يظهر عليها الهارب المخلوع بشار الأسد');
        expect(cleanHtml).toContain('علم النظام المخلوع');
        expect(cleanHtml).toContain('دار الأوبرا في دمشق');
        expect(cleanHtml).not.toContain('دار الأسد للثقافة والفنون');
        expect(cleanHtml).not.toContain('العلم السوري السابق');
    });

    it('renders a Mishwar place page with H1, breadcrumb, photo alts, nearby list, locator, and map CTA on SSR', async () => {
        const html = await renderOnServer(
            'Places/Show',
            {
                place: {
                    id: 1,
                    name: 'الجامع الأموي الكبير',
                    category: 'religious',
                    description: 'الجامع الأموي الكبير في قلب دمشق القديمة من أقدم وأعرق المساجد التاريخية في العالم الإسلامي.',
                    lat: 33.5119,
                    lng: 36.3065,
                    thumb_url: 'https://media.syrian.zone/places/1/a_thumb.webp?v=1',
                    saves_count: 12,
                    url: '/mishwar/1-%D8%A7%D9%84%D8%AC%D8%A7%D9%85%D8%B9-%D8%A7%D9%84%D8%A3%D9%85%D9%88%D9%8A-%D8%A7%D9%84%D9%83%D8%A8%D9%8A%D8%B1',
                    status: 'approved',
                    user: {
                        id: 7,
                        name: 'سامي الدمشقي',
                        avatar_url: null,
                        level: 5,
                        points: 520,
                    },
                    photos: [
                        {
                            id: 101,
                            thumb_url: 'https://media.syrian.zone/places/1/a_thumb.webp?v=1',
                            display_url: 'https://media.syrian.zone/places/1/a_display.webp?v=1',
                            sort: 0,
                        },
                        {
                            id: 102,
                            thumb_url: 'https://media.syrian.zone/places/1/b_thumb.webp?v=1',
                            display_url: 'https://media.syrian.zone/places/1/b_display.webp?v=1',
                            sort: 1,
                        },
                    ],
                    saved_by_me: false,
                    created_at: '2026-01-01T00:00:00Z',
                },
                governorate: { id: 'damascus', name_ar: 'دمشق' },
                isThin: false,
                isOwner: false,
                locator: {
                    viewBox: '23.5 368.6 96 72',
                    fullViewBox: '0 0 600 544',
                    width: 600,
                    height: 544,
                    shapes: [
                        { id: 'damascus', name_ar: 'دمشق', path: 'M65 399L78 399L78 410Z', label_x: 71.3, label_y: 404.6 },
                        { id: 'quneitra', name_ar: 'القنيطرة', path: 'M20 420L48 420L48 450Z', label_x: 36, label_y: 418 },
                        { id: 'rural-damascus', name_ar: 'ريف دمشق', path: 'M0 350L200 350L200 450Z', label_x: 72, label_y: 405 },
                    ],
                    pin: { x: 71.5, y: 404.5 },
                },
                nearby: [
                    {
                        id: 2,
                        name: 'سوق الحميدية',
                        category: 'market',
                        description: 'سوق تاريخي مسقوف.',
                        lat: 33.511,
                        lng: 36.302,
                        thumb_url: 'https://media.syrian.zone/places/2/cover_thumb.webp?v=1',
                        saves_count: 8,
                        url: '/mishwar/2-%D8%B3%D9%88%D9%82-%D8%A7%D9%84%D8%AD%D9%85%D9%8A%D8%AF%D9%8A%D8%A9',
                        distance_m: 450,
                    },
                ],
            },
            '/mishwar/1-%D8%A7%D9%84%D8%AC%D8%A7%D9%85%D8%B9-%D8%A7%D9%84%D8%A3%D9%85%D9%88%D9%8A-%D8%A7%D9%84%D9%83%D8%A8%D9%8A%D8%B1',
        );

        const cleanHtml = html.replace(/<!-- -->/g, '');
        expect(cleanHtml.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(cleanHtml.match(/<main[\s>]/g)).toHaveLength(1);
        expect(cleanHtml).toContain('الجامع الأموي الكبير');
        expect(cleanHtml).toContain('href="/mishwar"');
        expect(cleanHtml).toContain('href="/mishwar/damascus"');
        expect(cleanHtml).toContain('href="/governorates/damascus"');
        expect(cleanHtml).toContain('href="/mishwar?place=1"');
        expect(cleanHtml).toContain('افتحه على خريطة مشوار');
        expect(cleanHtml).toContain('الاتجاهات في خرائط Google');
        expect(cleanHtml).toContain('>الاتجاهات<');
        expect(cleanHtml).toContain('إبلاغ عن المكان');
        expect(cleanHtml).toContain('aria-roledescription="carousel"');
        expect(cleanHtml).toContain('1 / 2');
        expect(cleanHtml).toContain('صورة 1 من 2');
        expect(cleanHtml).toContain('صورة 2 من 2');
        expect(cleanHtml).toContain('alt="الجامع الأموي الكبير في دمشق — صورة 1"');
        expect(cleanHtml).toContain('alt="الجامع الأموي الكبير في دمشق — صورة 2"');
        expect(cleanHtml).toContain('loading="eager"');
        expect(cleanHtml).toContain('fetchPriority="high"');
        expect(cleanHtml).toContain('loading="lazy"');
        expect(cleanHtml).toContain('vector-effect="non-scaling-stroke"');
        expect(cleanHtml).toContain('القنيطرة');
        // Rural Damascus label placed right on top of the pin is dropped to avoid overlap
        expect(cleanHtml).not.toContain('ريف دمشق');
        expect(cleanHtml).toContain('33.51190, 36.30650');
        expect(cleanHtml).toContain('href="/mishwar?guide=7"');
        expect(cleanHtml).toContain('أماكن قريبة');
        expect(cleanHtml).toContain('سوق الحميدية');
        expect(cleanHtml).toContain('href="/mishwar/2-%D8%B3%D9%88%D9%82-%D8%A7%D9%84%D8%AD%D9%85%D9%8A%D8%AF%D9%8A%D8%A9"');
        expect(cleanHtml).toContain('0.5');
        expect(cleanHtml).toContain('المزيد في دمشق');
        expect(cleanHtml).not.toContain('ما تزال مختصرة');

        // Multi-photo (7 photos) renders all 7 images on SSR, hides 4..7 on md+, and shows +4 صور overlay
        const sevenPhotosHtml = await renderOnServer(
            'Places/Show',
            {
                place: {
                    id: 1,
                    name: 'الجامع الأموي الكبير',
                    category: 'religious',
                    description: 'الجامع الأموي الكبير في قلب دمشق القديمة.',
                    lat: 33.5119,
                    lng: 36.3065,
                    thumb_url: 'https://media.syrian.zone/places/1/0_thumb.webp?v=1',
                    saves_count: 12,
                    url: '/mishwar/1',
                    status: 'approved',
                    user: { id: 7, name: 'سامي', avatar_url: null, level: 5, points: 520 },
                    photos: Array.from({ length: 7 }, (_, i) => ({
                        id: 200 + i,
                        thumb_url: `https://media.syrian.zone/places/1/${i}_thumb.webp?v=1`,
                        display_url: `https://media.syrian.zone/places/1/${i}_display.webp?v=1`,
                        sort: i,
                    })),
                    saved_by_me: false,
                    created_at: '2026-01-01T00:00:00Z',
                },
                governorate: { id: 'damascus', name_ar: 'دمشق' },
                isThin: false,
                isOwner: false,
                locator: null,
                nearby: [],
            },
            '/mishwar/1',
        );
        const cleanSeven = sevenPhotosHtml.replace(/<!-- -->/g, '');
        expect(cleanSeven).toContain('1 / 7');
        expect(cleanSeven).toContain('>+4</span><span>صور<');
        expect(cleanSeven).toContain('md:hidden');
        for (let i = 0; i < 7; i++) {
            expect(cleanSeven).toContain(`0_display.webp`);
            expect(cleanSeven).toContain(`${i}_display.webp`);
            expect(cleanSeven).toContain(`صورة ${i + 1} من 7`);
        }

        // Thin place page renders the muted helper note
        const thinHtml = await renderOnServer(
            'Places/Show',
            {
                place: {
                    id: 6,
                    name: 'التكية السليمانية',
                    category: 'historical',
                    description: 'معلم تاريخي في دمشق.',
                    lat: 33.512,
                    lng: 36.292,
                    thumb_url: null,
                    saves_count: 1,
                    url: '/mishwar/6-%D8%A7%D9%84%D8%AA%D9%83%D9%8A%D8%A9-%D8%A7%D9%84%D8%B3%D9%84%D9%8A%D9%85%D8%A7%D9%86%D9%8A%D8%A9',
                    status: 'approved',
                    user: { id: 7, name: 'سامي', avatar_url: null, level: 2, points: 20 },
                    photos: [],
                    saved_by_me: false,
                    created_at: '2026-01-01T00:00:00Z',
                },
                governorate: { id: 'damascus', name_ar: 'دمشق' },
                isThin: true,
                isOwner: false,
                locator: null,
                nearby: [],
            },
            '/mishwar/6-%D8%A7%D9%84%D8%AA%D9%83%D9%8A%D8%A9-%D8%A7%D9%84%D8%B3%D9%84%D9%8A%D9%85%D8%A7%D9%86%D9%8A%D8%A9',
        );
        expect(thinHtml.replace(/<!-- -->/g, '')).toContain('ما تزال مختصرة');
    });

    it('renders Mishwar governorate and category hubs with H1, chips, place links, lazy thumbs and CTA in SSR markup', async () => {
        const places = Array.from({ length: 4 }, (_, idx) => ({
            id: idx + 1,
            name: `معلم حماة ${idx + 1}`,
            category: 'historical',
            category_label: 'تاريخي',
            description: `وصف مختصر للمعلم رقم ${idx + 1}`,
            thumb_url: `/storage/places/${idx + 1}/cover_thumb.webp?v=1`,
            photos_count: idx + 1,
            saves_count: 10 - idx,
            url: `/mishwar/${idx + 1}-place`,
        }));

        const govHtml = await renderOnServer(
            'Places/Hub',
            {
                governorate: { id: 'hama', name_ar: 'حماة' },
                category: null,
                h1: 'أماكن سياحية في حماة',
                intro: '4 أماكن في حماة أضافها زوار مشوار، مع الصور والموقع.',
                total: 4,
                mapUrl: '/mishwar?gov=hama',
                governorateUrl: '/governorates/hama',
                hubUrl: '/mishwar/hama',
                categories: [
                    { key: 'historical', label: 'تاريخي', count: 5, url: '/mishwar/hama/historical' },
                    { key: 'natural', label: 'طبيعي', count: 2, url: null },
                ],
                places,
                otherHubs: [{ id: 'aleppo', name_ar: 'حلب', count: 6, url: '/mishwar/aleppo' }],
            },
            '/mishwar/hama',
        );

        const cleanGov = govHtml.replace(/<!-- -->/g, '');
        expect(cleanGov.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(cleanGov.match(/<main[\s>]/g)).toHaveLength(1);
        expect(cleanGov).toContain('أماكن سياحية في حماة');
        expect(cleanGov).toContain('4 أماكن في حماة أضافها زوار مشوار، مع الصور والموقع.');
        expect(cleanGov).toContain('افتح حماة على خريطة مشوار');
        expect(cleanGov).toContain('href="/mishwar?gov=hama"');
        expect(cleanGov).toContain('href="/mishwar/hama/historical"');
        expect(cleanGov).not.toContain('href="/mishwar/hama/natural"');
        expect(cleanGov).toContain('طبيعي');
        expect(cleanGov).toContain('href="/mishwar/1-place"');
        expect(cleanGov).toContain('href="/mishwar/4-place"');
        const gridHtml = (cleanGov.split('id="places-grid-heading"')[1] ?? '').split('crosslinks-heading')[0] ?? '';
        expect(gridHtml.match(/loading="eager"/g)).toHaveLength(2);
        expect(gridHtml.match(/loading="lazy"/g)).toHaveLength(2);
        expect(gridHtml).toContain('width="96"');
        expect(gridHtml).toContain('height="96"');
        expect(cleanGov).toContain('href="/governorates/hama"');
        expect(cleanGov).toContain('href="/mishwar/aleppo"');

        const catHtml = await renderOnServer(
            'Places/Hub',
            {
                governorate: { id: 'hama', name_ar: 'حماة' },
                category: { key: 'historical', label: 'تاريخي', hub_title: 'أماكن أثرية وتاريخية' },
                h1: 'أماكن أثرية وتاريخية في حماة',
                intro: '4 أماكن من فئة تاريخي في حماة أضافها زوار مشوار، مع الصور والموقع.',
                total: 4,
                mapUrl: '/mishwar?gov=hama',
                governorateUrl: '/governorates/hama',
                hubUrl: '/mishwar/hama',
                categories: [],
                places,
                otherHubs: [],
            },
            '/mishwar/hama/historical',
        );

        const cleanCat = catHtml.replace(/<!-- -->/g, '');
        expect(cleanCat.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(cleanCat.match(/<main[\s>]/g)).toHaveLength(1);
        expect(cleanCat).toContain('أماكن أثرية وتاريخية في حماة');
        expect(cleanCat).toContain('href="/mishwar/hama"');
        expect(cleanCat).toContain('href="/mishwar/1-place"');
    });

    it('renders the wildlife guide and a species page with headings, crawlable links, citations and sources', async () => {
        // The props WildlifeData builds on the server; full records satisfy the card type.
        const wildlife = JSON.parse(readFileSync(resolve(process.cwd(), 'resources/data/wildlife.json'), 'utf8')) as {
            meta: { sources: Array<{ title: string; url: string }> };
            species: Array<{ slug: string; iucn: { category: string } }>;
        };
        const all = wildlife.species;
        const hub = await renderOnServer(
            'Wild/Index',
            {
                species: all,
                stats: {
                    total: all.length,
                    threatened: all.filter((s) => ['CR', 'EN', 'VU'].includes(s.iucn.category)).length,
                    sources: 1,
                },
                sources: wildlife.meta.sources,
            },
            '/wild',
        );
        expect(hub.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(hub.match(/<main[\s>]/g)).toHaveLength(1);
        expect(hub).toContain('الحياة البرية في سوريا');
        expect(hub).toContain('href="/wild/golden-hamster"');
        expect(hub).toContain('href="/wild/northern-bald-ibis"');

        const ibis = all.find((s) => s.slug === 'northern-bald-ibis');
        const page = await renderOnServer(
            'Wild/Show',
            { species: ibis, related: all.filter((s) => s.slug !== 'northern-bald-ibis').slice(0, 3) },
            '/wild/northern-bald-ibis',
        );
        expect(page.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(page.match(/<main[\s>]/g)).toHaveLength(1);
        expect(page).toContain('أبو منجل الأصلع الشمالي');
        expect(page).toContain('href="#src-1"');
        expect(page).toContain('id="src-1"');
        expect(page).toContain('https://doi.org/10.1017/S003060530400016X');
        expect(page).toContain('href="/governorates/homs"');
        expect(page).toContain('Charles J. Sharp');
    });
});
