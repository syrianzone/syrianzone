import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
                current_cabinet: currentCabinet,
                historical_ministries: historical,
                sovereign_bodies: sovereign,
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
});
