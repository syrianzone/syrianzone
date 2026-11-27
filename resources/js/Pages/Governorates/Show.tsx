import React from 'react';
import { Link } from '@inertiajs/react';
import {
    Building2,
    Bus,
    ChevronLeft,
    Clock,
    Compass,
    ExternalLink,
    Globe2,
    Landmark,
    MapPin,
    MoonStar,
    PawPrint,
    Phone,
    Ship,
    UserCheck,
    Users,
} from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardHeader } from '@/Components/ui/card';
import { PRAYER_KEYS, PRAYER_LABELS } from '@/Domain/prayer/methods';
import { GROUP_LABEL_ONE, STATUS_LABELS } from '@/Domain/wildlife/wildlife';
import type { GovernorateShowProps } from './_types';

function formatNumber(n: number): string {
    return n.toLocaleString('en-US');
}

function cleanPhoneHref(phone: string, isWhatsapp: boolean): string {
    const digits = phone.replace(/[^\d+]/g, '');
    if (isWhatsapp) {
        const waDigits = digits.replace(/^\+/, '').replace(/^00/, '');
        const normalized = waDigits.startsWith('0') ? `963${waDigits.slice(1)}` : waDigits;
        return `https://wa.me/${normalized}`;
    }
    return `tel:${digits}`;
}

export default function GovernorateShow({
    governorate,
    population,
    officials,
    prayer,
    transit,
    crossings,
    places,
    wildlife = [],
    phonebook,
    otherGovernorates,
    iconCredit,
}: GovernorateShowProps) {
    const hasOfficials = officials.governor !== null || officials.deputies.length > 0;
    const hasCrossings = crossings.length > 0;
    const hasPhonebook = phonebook.length > 0;

    const quickNav: Array<{ id: string; label: string }> = [
        { id: 'overview', label: 'نظرة عامة' },
        ...(hasOfficials ? [{ id: 'officials', label: 'المحافظ والنواب' }] : []),
        ...(prayer ? [{ id: 'prayer', label: 'مواقيت الصلاة' }] : []),
        ...(transit ? [{ id: 'transit', label: 'المواصلات' }] : []),
        ...(hasCrossings ? [{ id: 'crossings', label: 'المعابر والمرافئ' }] : []),
        ...(places ? [{ id: 'places', label: 'الأماكن' }] : []),
        ...(wildlife.length > 0 ? [{ id: 'wildlife', label: 'الحياة البرية' }] : []),
        ...(hasPhonebook ? [{ id: 'phonebook', label: 'أرقام مهمة' }] : []),
    ];

    return (
        <MainLayout>
            <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
                {/* Breadcrumb */}
                <nav aria-label="مسار التنقل" className="text-xs text-muted-foreground">
                    <ol className="flex flex-wrap items-center gap-1.5">
                        <li className="flex items-center gap-1.5">
                            <Link href="/" className="transition-colors hover:text-foreground">
                                الرئيسية
                            </Link>
                            <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        </li>
                        <li className="flex items-center gap-1.5">
                            <Link href="/governorates" className="transition-colors hover:text-foreground">
                                محافظات سوريا
                            </Link>
                            <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        </li>
                        <li>
                            <span aria-current="page" className="font-medium text-foreground">
                                محافظة {governorate.name_ar}
                            </span>
                        </li>
                    </ol>
                </nav>

                {/* Hero */}
                <header className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                        {governorate.icon_path && (
                            <div className="flex h-28 w-22 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background p-2 shadow-xs">
                                <img
                                    src={governorate.icon_path}
                                    alt={`أيقونة محافظة ${governorate.name_ar}${governorate.landmark_ar ? ` — ${governorate.landmark_ar}` : ''}`}
                                    loading="eager"
                                    width={88}
                                    height={112}
                                    className="h-full w-full object-contain"
                                />
                            </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                    محافظة سورية
                                </Badge>
                                <Badge variant="outline" dir="ltr" className="font-mono text-xs">
                                    {governorate.pcode}
                                </Badge>
                                {governorate.landmark_ar && (
                                    <span className="text-xs text-muted-foreground">
                                        المَعلم الرمزي: {governorate.landmark_ar}
                                    </span>
                                )}
                            </div>

                            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                                محافظة {governorate.name_ar}
                            </h1>

                            <p className="text-sm leading-relaxed text-muted-foreground">
                                المركز الإداري: <strong className="text-foreground">{governorate.centre_ar}</strong>
                                {population ? (
                                    <>
                                        {' · '}السكان:{' '}
                                        <strong dir="ltr" className="font-mono tabular-nums text-foreground">
                                            {formatNumber(population.value)}
                                        </strong>{' '}
                                        نسمة{population.year ? ` (${population.year})` : ''}
                                    </>
                                ) : null}
                                {governorate.area_sqkm !== null ? (
                                    <>
                                        {' · '}المساحة:{' '}
                                        <strong dir="ltr" className="font-mono tabular-nums text-foreground">
                                            {formatNumber(governorate.area_sqkm)}
                                        </strong>{' '}
                                        كم²
                                    </>
                                ) : null}
                            </p>

                            {quickNav.length > 1 && (
                                <nav aria-label="أقسام الصفحة" className="flex flex-wrap gap-1.5 pt-1">
                                    {quickNav.map((item) => (
                                        <a
                                            key={item.id}
                                            href={`#${item.id}`}
                                            className="rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                                        >
                                            {item.label}
                                        </a>
                                    ))}
                                </nav>
                            )}
                        </div>
                    </div>
                </header>

                {/* 1. Overview */}
                <section id="overview" aria-labelledby="overview-heading">
                    <Card className="border-border bg-card/70">
                        <CardHeader className="pb-3">
                            <h2 id="overview-heading" className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
                                <Landmark className="h-5 w-5 text-primary" aria-hidden="true" />
                                <span>نظرة عامة عن محافظة {governorate.name_ar}</span>
                            </h2>
                        </CardHeader>
                        <CardContent>
                            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="rounded-xl border border-border/60 bg-background/60 p-3.5">
                                    <dt className="text-xs text-muted-foreground">المركز الإداري</dt>
                                    <dd className="mt-1 text-base font-bold text-foreground">{governorate.centre_ar}</dd>
                                </div>

                                {population && (
                                    <div className="rounded-xl border border-border/60 bg-background/60 p-3.5">
                                        <dt className="text-xs text-muted-foreground">
                                            عدد السكان{population.year ? ` (تقدير ${population.year})` : ''}
                                        </dt>
                                        <dd className="mt-1 text-base font-bold text-foreground">
                                            <span dir="ltr" className="font-mono tabular-nums">
                                                {formatNumber(population.value)}
                                            </span>{' '}
                                            <span className="text-xs font-normal text-muted-foreground">نسمة</span>
                                        </dd>
                                        {population.source_url && (
                                            <dd className="mt-1 text-[11px]">
                                                <a
                                                    href={population.source_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:no-underline"
                                                >
                                                    <span>المصدر</span>
                                                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                                </a>
                                            </dd>
                                        )}
                                    </div>
                                )}

                                {governorate.area_sqkm !== null && (
                                    <div className="rounded-xl border border-border/60 bg-background/60 p-3.5">
                                        <dt className="text-xs text-muted-foreground">المساحة التقريبية (OCHA)</dt>
                                        <dd className="mt-1 text-base font-bold text-foreground">
                                            <span dir="ltr" className="font-mono tabular-nums">
                                                {formatNumber(governorate.area_sqkm)}
                                            </span>{' '}
                                            <span className="text-xs font-normal text-muted-foreground">كم²</span>
                                        </dd>
                                    </div>
                                )}

                                <div className="rounded-xl border border-border/60 bg-background/60 p-3.5">
                                    <dt className="text-xs text-muted-foreground">إحداثيات المركز</dt>
                                    <dd dir="ltr" className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">
                                        {governorate.lat.toFixed(4)}, {governorate.lng.toFixed(4)}
                                    </dd>
                                    <dd className="mt-1 text-[11px] text-muted-foreground">
                                        <Link href="/atlas" className="text-primary underline underline-offset-2 hover:no-underline">
                                            عرض في أطلس سوريا
                                        </Link>
                                    </dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>
                </section>

                {/* 2. Governor & Deputies */}
                {hasOfficials && (
                    <section id="officials" aria-labelledby="officials-heading">
                        <Card className="border-border bg-card/70">
                            <CardHeader className="pb-3">
                                <h2 id="officials-heading" className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
                                    <UserCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                                    <span>المحافظ والنواب والمعاونون</span>
                                </h2>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {officials.governor && (
                                    <div className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center">
                                        {officials.governor.portrait_url && (
                                            <img
                                                src={officials.governor.portrait_url}
                                                alt={`صورة ${officials.governor.name_ar}`}
                                                loading="lazy"
                                                decoding="async"
                                                width={72}
                                                height={72}
                                                className="h-18 w-18 shrink-0 rounded-full border border-border object-cover"
                                            />
                                        )}

                                        <div className="min-w-0 flex-1 space-y-1.5">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-base font-bold text-foreground">
                                                    {officials.governor.name_ar}
                                                </h3>
                                                <Badge variant="secondary" className="text-xs">
                                                    {officials.governor.title_ar}
                                                </Badge>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                {officials.governor.start_date && (
                                                    <span>
                                                        تاريخ التعيين:{' '}
                                                        <span dir="ltr" className="font-mono tabular-nums text-foreground">
                                                            {officials.governor.start_date}
                                                        </span>
                                                    </span>
                                                )}
                                                {officials.governor.decree && (
                                                    <span>{officials.governor.decree}</span>
                                                )}
                                                {officials.governor.notes_ar && (
                                                    <span>{officials.governor.notes_ar}</span>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                                                {officials.governor.slug && (
                                                    <Link
                                                        href={`/govtcvs/${officials.governor.slug}`}
                                                        className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-4 hover:no-underline"
                                                    >
                                                        <span>السيرة الذاتية للمحافظ</span>
                                                        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                                    </Link>
                                                )}
                                                {officials.governor.source_url && officials.governor.source_url.startsWith('http') && (
                                                    <a
                                                        href={officials.governor.source_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-4 hover:text-primary"
                                                    >
                                                        <span>المصدر ({officials.governor.source_label_ar})</span>
                                                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {officials.deputies.length > 0 && (
                                    <div className="space-y-2.5">
                                        <h3 className="text-sm font-bold text-foreground">النواب والمعاونون</h3>
                                        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            {officials.deputies.map((dep) => (
                                                <li
                                                    key={`${dep.name_ar}-${dep.title_ar}`}
                                                    className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/60 p-3"
                                                >
                                                    <div className="min-w-0 space-y-0.5">
                                                        <p className="font-semibold text-foreground">{dep.name_ar}</p>
                                                        <p className="text-xs text-muted-foreground">{dep.title_ar}</p>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-2">
                                                        <Badge variant="outline" className="text-[11px]">
                                                            {dep.role_kind}
                                                        </Badge>
                                                        {dep.slug && (
                                                            <Link
                                                                href={`/govtcvs/${dep.slug}`}
                                                                className="text-xs font-semibold text-primary hover:underline"
                                                            >
                                                                السيرة
                                                            </Link>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {officials.jard_credit && (
                                    <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
                                        بيانات التعيينات والنواب مستندة إلى سجل{' '}
                                        <a
                                            href={officials.jard_credit.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-4 hover:no-underline"
                                        >
                                            <span>{officials.jard_credit.name_ar}</span>
                                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                        </a>
                                        {' '}(تحديث{' '}
                                        <span dir="ltr" className="font-mono tabular-nums">
                                            {officials.jard_credit.as_of}
                                        </span>
                                        ).
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </section>
                )}

                {/* 3. Prayer Times & Ramadan Imsakiya */}
                {prayer && (
                    <section id="prayer" aria-labelledby="prayer-heading">
                        <Card className="border-border bg-card/70">
                            <CardHeader className="pb-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h2 id="prayer-heading" className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
                                        <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
                                        <span>مواقيت الصلاة اليوم في {governorate.name_ar}</span>
                                    </h2>
                                    <span className="text-xs text-muted-foreground">
                                        {prayer.today.gregorian_ar}
                                        {prayer.hijri
                                            ? ` · ${prayer.hijri.day} ${prayer.hijri.month} ${prayer.hijri.year} هـ`
                                            : ''}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                                    {PRAYER_KEYS.map((key) => {
                                        const time = prayer.timings[key];
                                        if (!time) return null;
                                        return (
                                            <div
                                                key={key}
                                                className="rounded-xl border border-border/60 bg-background/60 p-3 text-center"
                                            >
                                                <dt className="text-xs font-medium text-muted-foreground">
                                                    {PRAYER_LABELS[key]}
                                                </dt>
                                                <dd
                                                    dir="ltr"
                                                    className="mt-1 font-mono text-base font-bold tabular-nums text-foreground"
                                                >
                                                    {time}
                                                </dd>
                                            </div>
                                        );
                                    })}
                                </dl>

                                <div className="flex flex-wrap items-center gap-2.5">
                                    <Link
                                        href={prayer.prayer_url}
                                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                                    >
                                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                                        <span>الجدول الشهري واتجاه القبلة في {governorate.name_ar}</span>
                                        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                    </Link>

                                    {prayer.ramadan_url && (
                                        <Link
                                            href={prayer.ramadan_url}
                                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                                        >
                                            <MoonStar className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                            <span>إمساكية رمضان 1448 هـ في {governorate.name_ar}</span>
                                            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                        </Link>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                )}

                {/* 4. Transit */}
                {transit && (
                    <section id="transit" aria-labelledby="transit-heading">
                        <Card className="border-border bg-card/70">
                            <CardHeader className="pb-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h2 id="transit-heading" className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
                                        <Bus className="h-5 w-5 text-primary" aria-hidden="true" />
                                        <span>المواصلات العامة في {transit.city_name_ar}</span>
                                    </h2>
                                    <Badge variant="secondary" className="text-xs">
                                        <span dir="ltr" className="me-1 font-mono tabular-nums">
                                            {transit.routes_count}
                                        </span>
                                        <span>خط منشور</span>
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                                    {transit.routes.map((route) => (
                                        <li key={route.id}>
                                            <Link
                                                href={route.url}
                                                className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/60 px-3.5 py-2.5 text-sm transition-colors hover:border-primary/40 hover:text-primary"
                                            >
                                                <span className="truncate font-semibold text-foreground">
                                                    {route.name_ar}
                                                </span>
                                                <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>

                                <div>
                                    <Link
                                        href={transit.map_url}
                                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                                    >
                                        <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                                        <span>فتح خريطة مواصلات {transit.city_name_ar} التفاعلية</span>
                                        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                )}

                {/* 5. Border Crossings & Maritime Ports */}
                {hasCrossings && (
                    <section id="crossings" aria-labelledby="crossings-heading">
                        <Card className="border-border bg-card/70">
                            <CardHeader className="pb-3">
                                <h2 id="crossings-heading" className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
                                    <Globe2 className="h-5 w-5 text-primary" aria-hidden="true" />
                                    <span>المعابر الحدودية والمرافئ في محافظة {governorate.name_ar}</span>
                                </h2>
                            </CardHeader>
                            <CardContent>
                                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {crossings.map((crossing) => (
                                        <li key={crossing.slug}>
                                            <Link
                                                href={crossing.url}
                                                className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background/60 p-3.5 transition-colors hover:border-primary/40"
                                            >
                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        {crossing.category === 'port' ? (
                                                            <Ship className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                                        ) : (
                                                            <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                                        )}
                                                        <span className="font-bold text-foreground">{crossing.name}</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        {crossing.category === 'port' ? 'مرفأ بحري' : 'منفذ برّي'}
                                                        {crossing.country ? ` مع ${crossing.country}` : ''}
                                                        {crossing.op_type ? ` · ${crossing.op_type}` : ''}
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-1.5">
                                                    {crossing.opening_soon && (
                                                        <Badge variant="outline" className="text-[11px]">
                                                            قيد الافتتاح
                                                        </Badge>
                                                    )}
                                                    <ChevronLeft className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                                </div>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </section>
                )}

                {/* 6. Mishwar Places */}
                {places && (
                    <section id="places" aria-labelledby="places-heading">
                        <Card className="border-border bg-card/70">
                            <CardHeader className="pb-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h2 id="places-heading" className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
                                        <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
                                        <span>أماكن ومعالم في {governorate.name_ar} (مشوار)</span>
                                    </h2>
                                    <Badge variant="secondary" className="text-xs">
                                        <span dir="ltr" className="me-1 font-mono tabular-nums">
                                            {places.total}
                                        </span>
                                        <span>مكان</span>
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex flex-wrap gap-2">
                                    {places.categories.map((cat) => (
                                        <Badge key={cat.key} variant="outline" className="gap-1.5 px-2.5 py-1 text-xs">
                                            <span>{cat.label}</span>
                                            <span dir="ltr" className="font-mono tabular-nums text-muted-foreground">
                                                ({cat.count})
                                            </span>
                                        </Badge>
                                    ))}
                                </div>

                                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {places.notable.map((place) => (
                                        <li key={place.id}>
                                            <Link
                                                href={place.url}
                                                className="flex h-full flex-col justify-between gap-2 rounded-xl border border-border/70 bg-background/60 p-3.5 transition-colors hover:border-primary/40"
                                            >
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-bold text-foreground">{place.name}</span>
                                                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                                                            {place.category_label}
                                                        </Badge>
                                                    </div>
                                                    {place.description && (
                                                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                                            {place.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                                                    <span>صفحة المكان</span>
                                                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>

                                <div>
                                    <Link
                                        href={places.hub_url ?? '/mishwar'}
                                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                                    >
                                        <span>
                                            {places.hub_url
                                                ? `عرض جميع الأماكن في ${governorate.name_ar}`
                                                : 'استكشاف خريطة مشوار كاملة'}
                                        </span>
                                        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                )}

                {/* 7. Wildlife recorded here */}
                {wildlife.length > 0 && (
                    <section id="wildlife" aria-labelledby="wildlife-heading">
                        <Card className="border-border bg-card/70">
                            <CardHeader className="pb-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h2 id="wildlife-heading" className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
                                        <PawPrint className="h-5 w-5 text-primary" aria-hidden="true" />
                                        <span>الحياة البرية المسجّلة في محافظة {governorate.name_ar}</span>
                                    </h2>
                                    <Link href="/wild" className="text-sm text-primary hover:underline">
                                        دليل الحياة البرية
                                    </Link>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {wildlife.map((s) => (
                                        <li key={s.slug}>
                                            <Link
                                                href={s.url}
                                                className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background/60 p-3.5 transition-colors hover:border-primary/40"
                                            >
                                                <div className="min-w-0 space-y-1">
                                                    <span className="font-bold text-foreground">{s.nameAr}</span>
                                                    <p className="text-xs text-muted-foreground">
                                                        {GROUP_LABEL_ONE[s.group]} · {STATUS_LABELS[s.syriaStatus]}
                                                        {s.historical ? ' · سجل سابق' : ''}
                                                    </p>
                                                </div>
                                                <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </section>
                )}

                {/* 8. Important Phone Numbers */}
                {hasPhonebook && (
                    <section id="phonebook" aria-labelledby="phonebook-heading">
                        <Card className="border-border bg-card/70">
                            <CardHeader className="pb-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h2 id="phonebook-heading" className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
                                        <Phone className="h-5 w-5 text-primary" aria-hidden="true" />
                                        <span>أرقام خدمية وطوارئ في محافظة {governorate.name_ar}</span>
                                    </h2>
                                    <Link
                                        href={`/phonebook?q=${encodeURIComponent(governorate.name_ar)}`}
                                        className="text-xs font-semibold text-primary hover:underline"
                                    >
                                        عرض في دليل الهاتف
                                    </Link>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <ul className="divide-y divide-border/60 rounded-xl border border-border/70 bg-background/60">
                                    {phonebook.map((item) => (
                                        <li
                                            key={item.id}
                                            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                                        >
                                            <div className="min-w-0 space-y-0.5">
                                                <p className="font-semibold text-foreground">{item.name_ar}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {item.category_ar}
                                                    {item.is_whatsapp ? ' · واتساب' : ''}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-3">
                                                <a
                                                    href={cleanPhoneHref(item.number, item.is_whatsapp)}
                                                    target={item.is_whatsapp ? '_blank' : undefined}
                                                    rel={item.is_whatsapp ? 'noopener noreferrer' : undefined}
                                                    dir="ltr"
                                                    className="inline-flex min-h-9 items-center rounded-lg border border-primary/25 bg-primary/5 px-3 py-1 font-mono text-xs font-bold tabular-nums text-primary transition-colors hover:bg-primary/10"
                                                >
                                                    {item.number}
                                                </a>
                                                {item.source_url && (
                                                    <a
                                                        href={item.source_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        aria-label={`مصدر رقم ${item.name_ar}`}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:text-primary"
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                                    </a>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </section>
                )}

                {/* 8. Links to the 13 Other Governorates */}
                <nav
                    aria-label="محافظات سورية أخرى"
                    className="rounded-2xl border border-border bg-card/60 p-5"
                >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                            <Users className="h-4 w-4 text-primary" aria-hidden="true" />
                            <span>محافظات سورية أخرى</span>
                        </h2>
                        <Link
                            href="/governorates"
                            className="text-xs font-semibold text-primary hover:underline"
                        >
                            عرض جميع المحافظات الـ 14
                        </Link>
                    </div>
                    <ul className="flex flex-wrap gap-2">
                        {otherGovernorates.map((other) => (
                            <li key={other.id}>
                                <Link
                                    href={`/governorates/${other.id}`}
                                    className="inline-flex min-h-9 items-center rounded-lg border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                                >
                                    محافظة {other.name_ar}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Attribution Footer */}
                <footer className="border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
                    <p>
                        أيقونة محافظة {governorate.name_ar} من إعداد وتصميم{' '}
                        <span className="font-semibold text-foreground">{iconCredit.name_ar}</span>{' '}
                        (
                        <a
                            href={iconCredit.x_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary underline underline-offset-4 hover:no-underline"
                        >
                            X / Twitter
                        </a>
                        {' · '}
                        <a
                            href={iconCredit.instagram_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary underline underline-offset-4 hover:no-underline"
                        >
                            Instagram
                        </a>
                        ).
                    </p>
                </footer>
            </div>
        </MainLayout>
    );
}
