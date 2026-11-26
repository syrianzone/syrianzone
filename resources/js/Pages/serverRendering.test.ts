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
        expect(cleanHouse).toContain('أعضاء مجلس الشعب السوري 2026 — الأسماء حسب المحافظة');
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
});
