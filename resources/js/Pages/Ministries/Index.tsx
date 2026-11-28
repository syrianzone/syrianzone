import { useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';
import {
    Archive,
    ArrowLeft,
    ExternalLink,
    GitBranch,
    History,
    IdCard,
    Landmark,
    Search,
    Shield,
} from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { PageBody, PageHeader } from '@/Components/layout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { formatGovtDate } from '@/Domain/govtcvs/constants';
import {
    MINISTRY_STATUS_LABELS,
    RESTRUCTURING_KIND_LABELS,
    type MinistriesIndexProps,
} from '@/Domain/ministries/types';
import { CabinetCard } from './_components/CabinetCard';
import { GovernmentTimeline } from './_components/GovernmentTimeline';

function normalizeArabic(text: string): string {
    return text
        .replace(/[إأآا]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .toLowerCase()
        .trim();
}

export default function MinistriesIndex({
    meta,
    eras = [],
    restructurings = [],
    all_ministries = [],
    stats,
}: MinistriesIndexProps) {
    // The server sends each entry once; these mirror the service's filters.
    const current_cabinet = useMemo(
        () => all_ministries.filter((m) => m.kind === 'ministry' && m.status === 'current'),
        [all_ministries],
    );
    const historical_ministries = useMemo(
        () => all_ministries.filter((m) => m.kind === 'ministry' && m.status !== 'current'),
        [all_ministries],
    );
    const sovereign_bodies = useMemo(
        () => all_ministries.filter((m) => m.kind === 'sovereign'),
        [all_ministries],
    );
    const [searchQuery, setSearchQuery] = useState('');

    const normalizedQuery = useMemo(() => normalizeArabic(searchQuery), [searchQuery]);

    const matchesQuery = (ministry: (typeof current_cabinet)[number]) => {
        if (!normalizedQuery) return true;
        const haystack = normalizeArabic(
            [
                ministry.name_ar,
                ministry.name_en,
                ministry.current_holder?.name ?? '',
                ministry.current_holder?.title ?? '',
                ...ministry.holders.map((h) => h.name),
            ].join(' '),
        );
        return haystack.includes(normalizedQuery);
    };

    const visibleCabinetCount = useMemo(
        () => current_cabinet.filter(matchesQuery).length,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [current_cabinet, normalizedQuery],
    );

    return (
        <MainLayout>
            <PageBody className="pb-2 space-y-6">
                <PageHeader
                    title="وزارات سوريا والحكومة السورية"
                    description="دليل موثّق للتشكيل الوزاري السوري الحالي والهيئات السيادية، والخط الزمني لتعاقب الوزراء ومسارات الدمج والفصل الوزاري عبر أربع مراحل حكومية (2024–2026)، مع ربط مباشر بالسير الذاتية والحسابات والتطبيقات الرسمية."
                    divider
                    actions={
                        <div className="flex flex-wrap items-center gap-2">
                            <Button asChild size="sm" className="h-9 gap-1.5">
                                <a href="#government-timeline">
                                    <History className="h-4 w-4" aria-hidden="true" />
                                    <span>الخط الزمني</span>
                                </a>
                            </Button>
                            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
                                <Link href="/govtcvs">
                                    <IdCard className="h-4 w-4" aria-hidden="true" />
                                    <span>السير الذاتية</span>
                                </Link>
                            </Button>
                            <Button asChild variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground">
                                <a href={meta.source_url} target="_blank" rel="noopener noreferrer">
                                    <span>مصدر جَرد</span>
                                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                </a>
                            </Button>
                        </div>
                    }
                />

                {/* Quick stats */}
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-border bg-card p-4 text-center">
                        <dt className="text-xs font-medium text-muted-foreground">الوزارات الحالية</dt>
                        <dd className="mt-1 text-2xl font-black tabular-nums text-foreground">
                            {stats?.current_ministries ?? current_cabinet.length}
                        </dd>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4 text-center">
                        <dt className="text-xs font-medium text-muted-foreground">الهيئات السيادية</dt>
                        <dd className="mt-1 text-2xl font-black tabular-nums text-foreground">
                            {stats?.sovereign_bodies ?? sovereign_bodies.length}
                        </dd>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4 text-center">
                        <dt className="text-xs font-medium text-muted-foreground">وزارات مدمجة أو سابقة</dt>
                        <dd className="mt-1 text-2xl font-black tabular-nums text-foreground">
                            {stats?.historical_ministries ?? historical_ministries.length}
                        </dd>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4 text-center">
                        <dt className="text-xs font-medium text-muted-foreground">المراحل الحكومية</dt>
                        <dd className="mt-1 text-2xl font-black tabular-nums text-foreground">
                            {stats?.eras_count ?? eras.length}
                        </dd>
                    </div>
                </dl>
            </PageBody>

            <div className="container mx-auto max-w-6xl space-y-12 px-4 py-8 md:py-10">
                {/* 1. Current Cabinet */}
                <section aria-labelledby="current-cabinet-heading" className="space-y-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="space-y-1">
                            <h2
                                id="current-cabinet-heading"
                                className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl"
                            >
                                <Landmark className="h-5 w-5 text-primary" aria-hidden="true" />
                                <span>التشكيل الوزاري الحالي</span>
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                الوزراء الـ{' '}
                                <span className="tabular-nums font-medium text-foreground">
                                    {current_cabinet.length}
                                </span>{' '}
                                في الحكومة السورية القائمة مع تاريخ تولي المنصب وروابط السيرة الذاتية والحسابات الرسمية.
                            </p>
                        </div>

                        <div className="w-full sm:w-72">
                            <Label htmlFor="ministries-search" className="sr-only">
                                ابحث باسم الوزارة أو الوزير
                            </Label>
                            <div className="relative">
                                <Search
                                    className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <Input
                                    id="ministries-search"
                                    type="search"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="ابحث باسم الوزارة أو الوزير..."
                                    className="ps-9"
                                />
                            </div>
                        </div>
                    </div>

                    {normalizedQuery && visibleCabinetCount === 0 && (
                        <p className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                            لا توجد وزارة تطابق «{searchQuery}».
                        </p>
                    )}

                    {/* All cards stay in SSR HTML; search hides non-matches cleanly */}
                    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" role="list">
                        {current_cabinet.map((ministry, idx) => (
                            <li
                                key={ministry.slug}
                                className={matchesQuery(ministry) ? undefined : 'hidden'}
                            >
                                <CabinetCard ministry={ministry} priority={idx < 6} />
                            </li>
                        ))}
                    </ul>
                </section>

                {/* 2. Four-Era Timeline */}
                <section
                    id="government-timeline"
                    aria-labelledby="timeline-heading"
                    className="scroll-mt-20 space-y-5"
                >
                    <div className="space-y-1">
                        <h2
                            id="timeline-heading"
                            className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl"
                        >
                            <History className="h-5 w-5 text-primary" aria-hidden="true" />
                            <span>الخط الزمني للحكومة السورية عبر المراحل الأربع</span>
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            تتبّع التعيينات والتعديلات الحكومية والدمج والفصل منذ أيلول{' '}
                            <span dir="ltr" className="tabular-nums">2024</span> حتى التشكيل الحالي.
                        </p>
                    </div>

                    <GovernmentTimeline
                        eras={eras}
                        ministries={all_ministries}
                        restructurings={restructurings}
                    />
                </section>

                {/* 3. Mergers, Splits & Structural Changes */}
                <section aria-labelledby="restructurings-heading" className="space-y-5">
                    <div className="space-y-1">
                        <h2
                            id="restructurings-heading"
                            className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl"
                        >
                            <GitBranch className="h-5 w-5 text-primary" aria-hidden="true" />
                            <span>مسارات الدمج والفصل والتعديلات الهيكلية</span>
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            أبرز التحوّلات في هيكلية الوزارات والسلطة التنفيذية وفق المراسيم الرسمية.
                        </p>
                    </div>

                    <ol className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {restructurings.map((item) => (
                            <li key={item.id}>
                                <Card className="h-full border-border/80 bg-card">
                                    <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
                                        <div className="space-y-2.5">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <Badge variant="secondary" className="text-xs">
                                                    {RESTRUCTURING_KIND_LABELS[item.kind] ?? item.kind}
                                                </Badge>
                                                <time
                                                    dateTime={item.date}
                                                    className="text-xs tabular-nums text-muted-foreground"
                                                >
                                                    {formatGovtDate(item.date)}
                                                </time>
                                            </div>

                                            <h3 className="text-base font-bold text-foreground">
                                                {item.title_ar}
                                            </h3>

                                            <p className="text-sm leading-relaxed text-muted-foreground">
                                                {item.summary_ar}
                                            </p>

                                            {item.decree && (
                                                <p className="text-xs font-semibold text-primary">
                                                    {item.decree}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2 border-t border-border/70 pt-3">
                                            {(item.from_ministries.length > 0 || item.to_ministries.length > 0) && (
                                                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                                    {item.from_ministries.map((ref) => (
                                                        <Link
                                                            key={`from-${ref.slug}`}
                                                            href={`/ministries/${ref.slug}`}
                                                            className="inline-flex min-h-8 items-center rounded-md border border-border bg-muted/40 px-2.5 py-1 font-medium text-foreground hover:border-primary/40 hover:text-primary"
                                                        >
                                                            {ref.name_ar}
                                                        </Link>
                                                    ))}
                                                    {item.from_ministries.length > 0 && item.to_ministries.length > 0 && (
                                                        <ArrowLeft
                                                            className="h-3.5 w-3.5 shrink-0 text-primary"
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                    {item.to_ministries.map((ref) => (
                                                        <Link
                                                            key={`to-${ref.slug}`}
                                                            href={`/ministries/${ref.slug}`}
                                                            className="inline-flex min-h-8 items-center rounded-md border border-primary/40 bg-background px-2.5 py-1 font-semibold text-primary hover:bg-primary/5"
                                                        >
                                                            {ref.name_ar}
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}

                                            <a
                                                href={item.source_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary hover:underline"
                                            >
                                                <span>المصدر المرجعي</span>
                                                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                            </a>
                                        </div>
                                    </CardContent>
                                </Card>
                            </li>
                        ))}
                    </ol>
                </section>

                {/* 4. Sovereign Bodies */}
                <section aria-labelledby="sovereign-heading" className="space-y-5">
                    <div className="space-y-1">
                        <h2
                            id="sovereign-heading"
                            className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl"
                        >
                            <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
                            <span>الرئاسة والهيئات السيادية والمصرف المركزي</span>
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            رئاسة الجمهورية والأمانة العامة ومصرف سورية المركزي والهيئات السيادية المرتبطة بالإدارة المركزية.
                        </p>
                    </div>

                    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" role="list">
                        {sovereign_bodies.map((body) => (
                            <li key={body.slug}>
                                <CabinetCard ministry={body} />
                            </li>
                        ))}
                    </ul>
                </section>

                {/* 5. Historical / Merged / Split / Abolished Portfolios */}
                <section aria-labelledby="historical-heading" className="space-y-5">
                    <div className="space-y-1">
                        <h2
                            id="historical-heading"
                            className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl"
                        >
                            <Archive className="h-5 w-5 text-primary" aria-hidden="true" />
                            <span>الوزارات والمناصب التاريخية (مُدمجة أو مُقسّمة أو مُلغاة)</span>
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            حافظات وزارية ومناصب تنفيذية أُعيد هيكلتها خلال عامي{' '}
                            <span dir="ltr" className="tabular-nums">2025–2026</span> مع توثيق شاغليها والوزارات التي خلفتها.
                        </p>
                    </div>

                    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" role="list">
                        {historical_ministries.map((m) => (
                            <li key={m.slug}>
                                <Card className="flex h-full flex-col justify-between border-border/80 bg-card hover:border-primary/40 transition-colors">
                                    <CardContent className="flex flex-1 flex-col justify-between gap-3 p-5">
                                        <div className="space-y-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <h3 className="text-base font-bold text-foreground">
                                                    <Link
                                                        href={`/ministries/${m.slug}`}
                                                        className="hover:text-primary hover:underline"
                                                    >
                                                        {m.name_ar}
                                                    </Link>
                                                </h3>
                                                <Badge variant="outline" className="shrink-0 text-xs">
                                                    {MINISTRY_STATUS_LABELS[m.status]}
                                                </Badge>
                                            </div>
                                            {m.lineage_summary_ar && (
                                                <p className="text-xs leading-relaxed text-muted-foreground">
                                                    {m.lineage_summary_ar}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2 border-t border-border/70 pt-3 text-xs">
                                            {m.successors.length > 0 && (
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="text-muted-foreground">خلفتها:</span>
                                                    {m.successors.map((succ) => (
                                                        <Link
                                                            key={succ.slug}
                                                            href={`/ministries/${succ.slug}`}
                                                            className="font-semibold text-primary hover:underline"
                                                        >
                                                            {succ.name_ar}
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                            <Link
                                                href={`/ministries/${m.slug}`}
                                                className="inline-flex min-h-9 items-center gap-1 font-semibold text-primary hover:underline"
                                            >
                                                <span>عرض سجل الوزراء والتاريخ</span>
                                                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                            </Link>
                                        </div>
                                    </CardContent>
                                </Card>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Attribution Footer */}
                <footer className="rounded-xl border border-border bg-muted/25 p-5 text-xs text-muted-foreground space-y-2">
                    <p className="font-semibold text-foreground">المصادر والتوثيق</p>
                    <p className="leading-relaxed">
                        يستند سجل التشكيلات الوزارية والخط الزمني والمراسيم إلى بيانات{' '}
                        <a
                            href={meta.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2 hover:no-underline"
                        >
                            <span>{meta.source_name_ar}</span>
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>{' '}
                        المتكاملة مع قاعدة السير الذاتية للمسؤولين ودليل الحسابات والتطبيقات الرسمية في المساحة السورية.
                    </p>
                    {meta.updated_at && (
                        <p>
                            آخر تحديث لبيانات المرجع:{' '}
                            <time dateTime={meta.updated_at} className="tabular-nums font-medium text-foreground">
                                {formatGovtDate(meta.updated_at)}
                            </time>
                        </p>
                    )}
                </footer>
            </div>
        </MainLayout>
    );
}
