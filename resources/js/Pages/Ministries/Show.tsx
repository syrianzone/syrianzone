import { Link } from '@inertiajs/react';
import {
    ArrowLeft,
    BookOpen,
    Building2,
    Calendar,
    ChevronLeft,
    ExternalLink,
    FileText,
    GitBranch,
    Globe,
    History,
    Hourglass,
    Landmark,
    Smartphone,
    Users,
} from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader } from '@/Components/ui/card';
import OfficialAvatar from '@/Domain/govtcvs/OfficialAvatar';
import { formatGovtDate, safeHref } from '@/Domain/govtcvs/constants';
import {
    MINISTRY_KIND_LABELS,
    MINISTRY_STATUS_LABELS,
    PROMISE_STATE_LABELS,
    RESTRUCTURING_KIND_LABELS,
    eraLabelById,
    type MinistryShowProps,
} from '@/Domain/ministries/types';
import { socialPlatformLabel, socialVisual } from '@/Domain/syofficial/social';
import { cn } from '@/Lib/utils';

export default function MinistriesShow({
    meta,
    eras = [],
    ministry,
    official_accounts,
    gov_apps = [],
    promises = [],
    sources = [],
    siblings = [],
}: MinistryShowProps) {
    const current = ministry.current_holder;
    const primaryAccount = official_accounts?.primary ?? null;
    const affiliatedAccounts = official_accounts?.affiliated ?? [];

    const hasLineage =
        Boolean(ministry.lineage_summary_ar) ||
        ministry.predecessors.length > 0 ||
        ministry.successors.length > 0 ||
        (ministry.lineage_events?.length ?? 0) > 0;

    const primarySocialEntries = Object.entries(primaryAccount?.socials ?? {}).filter(
        ([, url]) => safeHref(url) !== null,
    );
    const officialWebsite = primaryAccount?.socials?.website
        ? safeHref(primaryAccount.socials.website)
        : null;

    return (
        <MainLayout>
            <div className="container mx-auto max-w-5xl space-y-8 px-4 py-8">
                {/* Breadcrumb */}
                <nav
                    aria-label="مسار التنقل"
                    className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
                >
                    <Link href="/" className="hover:text-foreground">
                        الرئيسية
                    </Link>
                    <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <Link href="/ministries" className="hover:text-foreground">
                        وزارات سوريا
                    </Link>
                    <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="font-medium text-foreground" aria-current="page">
                        {ministry.name_ar}
                    </span>
                </nav>

                {/* Header & Current Minister / Head */}
                <Card className="border-border/80 bg-card">
                    <CardContent className="space-y-6 p-6 sm:p-8">
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">
                                    {MINISTRY_KIND_LABELS[ministry.kind]}
                                </Badge>
                                <Badge variant={ministry.status === 'current' ? 'default' : 'outline'}>
                                    {MINISTRY_STATUS_LABELS[ministry.status]}
                                </Badge>
                            </div>

                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl md:text-4xl">
                                    {ministry.name_ar}
                                </h1>
                                {ministry.name_en && (
                                    <p className="mt-1 text-sm font-medium text-muted-foreground">
                                        <span dir="ltr">{ministry.name_en}</span>
                                    </p>
                                )}
                            </div>

                            {(ministry.entity_description_ar || ministry.lineage_summary_ar) && (
                                <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                                    {ministry.lineage_summary_ar ?? ministry.entity_description_ar}
                                </p>
                            )}
                        </div>

                        {/* Current Minister / Head Spotlight */}
                        {current && (
                            <section
                                aria-labelledby="current-holder-heading"
                                className="rounded-xl border border-primary/25 bg-primary/5 p-5"
                            >
                                <h2
                                    id="current-holder-heading"
                                    className="mb-4 text-xs font-bold text-primary"
                                >
                                    {ministry.kind === 'sovereign' ? 'المسؤول الحالي' : 'الوزير الحالي'}
                                </h2>

                                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-start gap-4">
                                        <OfficialAvatar
                                            name={current.name}
                                            resolvedPortraitUrl={current.portrait_url}
                                            size={84}
                                            priority
                                            className="ring-4 ring-background"
                                        />
                                        <div className="space-y-1.5">
                                            <p className="text-xl font-black text-foreground">
                                                {current.name}
                                            </p>
                                            <p className="text-sm font-semibold text-primary">
                                                {current.title}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                {current.start_date && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                        <span>منذ</span>
                                                        <time
                                                            dateTime={current.start_date}
                                                            className="tabular-nums font-semibold text-foreground"
                                                        >
                                                            {formatGovtDate(current.start_date)}
                                                        </time>
                                                    </span>
                                                )}
                                                {current.decree && (
                                                    <Badge variant="outline" className="bg-background text-xs">
                                                        {current.decree}
                                                    </Badge>
                                                )}
                                            </div>
                                            {current.notes && (
                                                <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
                                                    {current.notes}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                                        {current.govtcvs_url && (
                                            <Button asChild size="sm" className="min-h-10 gap-2">
                                                <Link href={current.govtcvs_url}>
                                                    <FileText className="h-4 w-4" aria-hidden="true" />
                                                    <span>السيرة الذاتية الكاملة</span>
                                                </Link>
                                            </Button>
                                        )}
                                        {officialWebsite && (
                                            <Button asChild variant="outline" size="sm" className="min-h-10 gap-2">
                                                <a
                                                    href={officialWebsite}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <Globe className="h-4 w-4" aria-hidden="true" />
                                                    <span>الموقع الرسمي</span>
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Documented Deputies (e.g. Central Bank First Deputy, Ports Customs Deputy) */}
                        {ministry.deputies.length > 0 && (
                            <section aria-labelledby="deputies-heading" className="space-y-3">
                                <h2
                                    id="deputies-heading"
                                    className="flex items-center gap-2 text-sm font-bold text-foreground"
                                >
                                    <Users className="h-4 w-4 text-primary" aria-hidden="true" />
                                    <span>النواب والمعاونون الموثّقون</span>
                                </h2>
                                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="list">
                                    {ministry.deputies.map((dep) => (
                                        <li
                                            key={`${dep.name}-${dep.start_date ?? ''}`}
                                            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3.5"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <OfficialAvatar
                                                    name={dep.name}
                                                    resolvedPortraitUrl={dep.portrait_url}
                                                    size={52}
                                                />
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-bold text-foreground">
                                                        {dep.name}
                                                    </p>
                                                    <p className="line-clamp-1 text-xs text-muted-foreground">
                                                        {dep.title}
                                                    </p>
                                                    {dep.start_date && (
                                                        <p className="text-xs text-muted-foreground">
                                                            منذ{' '}
                                                            <time dateTime={dep.start_date} className="tabular-nums">
                                                                {formatGovtDate(dep.start_date)}
                                                            </time>
                                                            {dep.decree ? ` · ${dep.decree}` : ''}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            {dep.govtcvs_url && (
                                                <Link
                                                    href={dep.govtcvs_url}
                                                    className="shrink-0 text-xs font-semibold text-primary hover:underline"
                                                >
                                                    السيرة
                                                </Link>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </CardContent>
                </Card>

                {/* 2. Timeline of Holders */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                                <History className="h-5 w-5 text-primary" aria-hidden="true" />
                                <span>التسلسل الزمني لشاغلي المنصب</span>
                            </h2>
                            <Badge variant="outline" className="tabular-nums">
                                {ministry.holders.length} سجل
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ol className="space-y-4 border-s-2 border-border ps-5">
                            {ministry.holders.map((holder) => (
                                <li
                                    key={`${holder.name}-${holder.start_date ?? ''}-${holder.title}`}
                                    className="relative rounded-xl border border-border/80 bg-card p-4"
                                >
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            'absolute -start-[27px] top-5 h-3 w-3 rounded-full border-2 border-background',
                                            holder.is_current ? 'bg-primary' : 'bg-muted-foreground/60',
                                        )}
                                    />

                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="flex items-start gap-3">
                                            <OfficialAvatar
                                                name={holder.name}
                                                resolvedPortraitUrl={holder.portrait_url}
                                                size={52}
                                            />
                                            <div className="space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-base font-bold text-foreground">
                                                        {holder.govtcvs_url ? (
                                                            <Link
                                                                href={holder.govtcvs_url}
                                                                className="hover:text-primary hover:underline"
                                                            >
                                                                {holder.name}
                                                            </Link>
                                                        ) : (
                                                            holder.name
                                                        )}
                                                    </h3>
                                                    {holder.is_current ? (
                                                        <Badge variant="default" className="text-xs">
                                                            حالي
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="text-xs">
                                                            سابق
                                                        </Badge>
                                                    )}
                                                    <Badge variant="outline" className="text-xs">
                                                        {eraLabelById(eras, holder.era)}
                                                    </Badge>
                                                </div>

                                                <p className="text-sm font-medium text-muted-foreground">
                                                    {holder.title}
                                                </p>

                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                    {holder.start_date && (
                                                        <span className="inline-flex items-center gap-1">
                                                            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                            <time
                                                                dateTime={holder.start_date}
                                                                className="tabular-nums font-medium text-foreground"
                                                            >
                                                                {formatGovtDate(holder.start_date)}
                                                            </time>
                                                            <span>←</span>
                                                            {holder.end_date ? (
                                                                <time
                                                                    dateTime={holder.end_date}
                                                                    className="tabular-nums font-medium text-foreground"
                                                                >
                                                                    {formatGovtDate(holder.end_date)}
                                                                </time>
                                                            ) : (
                                                                <span className="font-medium text-primary">
                                                                    حتى الآن
                                                                </span>
                                                            )}
                                                        </span>
                                                    )}
                                                    {holder.decree && (
                                                        <span className="rounded-md bg-muted px-2 py-0.5 font-medium text-foreground">
                                                            {holder.decree}
                                                        </span>
                                                    )}
                                                </div>

                                                {holder.notes && (
                                                    <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
                                                        {holder.notes}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                                            {holder.govtcvs_url && (
                                                <Button asChild variant="outline" size="sm" className="min-h-9 gap-1.5 text-xs">
                                                    <Link href={holder.govtcvs_url}>
                                                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                                                        <span>السيرة الذاتية</span>
                                                    </Link>
                                                </Button>
                                            )}
                                            <a
                                                href={holder.source_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                                            >
                                                <span>المصدر</span>
                                                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                            </a>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>

                {/* 3. Merger / Split History */}
                {hasLineage && (
                    <Card>
                        <CardHeader className="pb-3">
                            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                                <GitBranch className="h-5 w-5 text-primary" aria-hidden="true" />
                                <span>تاريخ الدمج والفصل الهيكلي</span>
                            </h2>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {ministry.lineage_summary_ar && (
                                <p className="rounded-xl border border-border bg-muted/30 p-4 text-sm leading-relaxed text-foreground">
                                    {ministry.lineage_summary_ar}
                                </p>
                            )}

                            {(ministry.predecessors.length > 0 || ministry.successors.length > 0) && (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {ministry.predecessors.length > 0 && (
                                        <div className="rounded-xl border border-border p-4 space-y-2">
                                            <h3 className="text-xs font-bold text-muted-foreground">
                                                الوزارات والمناصب السابقة (سبقتها)
                                            </h3>
                                            <ul className="flex flex-wrap gap-2" role="list">
                                                {ministry.predecessors.map((pred) => (
                                                    <li key={pred.slug}>
                                                        <Link
                                                            href={`/ministries/${pred.slug}`}
                                                            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/40 hover:text-primary"
                                                        >
                                                            <span>{pred.name_ar}</span>
                                                            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {ministry.successors.length > 0 && (
                                        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-2">
                                            <h3 className="text-xs font-bold text-primary">
                                                الوزارات والمناصب اللاحقة (خلفتها)
                                            </h3>
                                            <ul className="flex flex-wrap gap-2" role="list">
                                                {ministry.successors.map((succ) => (
                                                    <li key={succ.slug}>
                                                        <Link
                                                            href={`/ministries/${succ.slug}`}
                                                            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-primary/30 bg-background px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                                                        >
                                                            <span>{succ.name_ar}</span>
                                                            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            {(ministry.lineage_events?.length ?? 0) > 0 && (
                                <ol className="space-y-3 border-s-2 border-primary/30 ps-4">
                                    {ministry.lineage_events!.map((ev, i) => (
                                        <li key={`${ev.date}-${i}`} className="rounded-lg border border-border p-3.5 text-sm">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant="secondary" className="text-xs">
                                                        {RESTRUCTURING_KIND_LABELS[ev.kind] ?? ev.kind}
                                                    </Badge>
                                                    {ev.decree && (
                                                        <Badge variant="outline" className="text-xs">
                                                            {ev.decree}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <time
                                                    dateTime={ev.date}
                                                    className="text-xs tabular-nums text-muted-foreground"
                                                >
                                                    {formatGovtDate(ev.date)}
                                                </time>
                                            </div>
                                            <p className="mt-2 text-sm text-foreground">{ev.label_ar}</p>
                                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                                                {(ev.related_ministries ?? []).map((rel) => (
                                                    <Link
                                                        key={rel.slug}
                                                        href={`/ministries/${rel.slug}`}
                                                        className="font-semibold text-primary hover:underline"
                                                    >
                                                        {rel.name_ar}
                                                    </Link>
                                                ))}
                                                <a
                                                    href={ev.source_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary hover:underline"
                                                >
                                                    <span>المصدر</span>
                                                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                                </a>
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* 4. Official Accounts & Website */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                                <Globe className="h-5 w-5 text-primary" aria-hidden="true" />
                                <span>الحسابات الرسمية والموقع الإلكتروني</span>
                            </h2>
                            <Link
                                href={primaryAccount?.syofficial_url ?? '/syofficial'}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                                <span>عرض في دليل الحسابات الرسمية</span>
                                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {primaryAccount && primarySocialEntries.length > 0 ? (
                            <div className="space-y-3">
                                <p className="text-sm font-semibold text-foreground">
                                    {primaryAccount.name_ar}
                                </p>
                                <ul className="flex flex-wrap gap-2.5" role="list">
                                    {primarySocialEntries.map(([platform, url]) => {
                                        const href = safeHref(url);
                                        if (!href) return null;
                                        const { Icon, iconClass, hoverClass } = socialVisual(platform);
                                        const label = socialPlatformLabel(platform, 'ar');
                                        return (
                                            <li key={platform}>
                                                <a
                                                    href={href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={cn(
                                                        'inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground transition-colors',
                                                        hoverClass,
                                                    )}
                                                >
                                                    <Icon className={cn('h-4 w-4 shrink-0', iconClass)} aria-hidden="true" />
                                                    <span>{label}</span>
                                                    <ExternalLink className="h-3 w-3 opacity-70" aria-hidden="true" />
                                                </a>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ) : (
                            <p className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                                لم تُسجَّل حسابات رسمية مستقلة لهذه الجهة في{' '}
                                <Link href="/syofficial" className="font-semibold text-primary hover:underline">
                                    دليل الحسابات الرسمية
                                </Link>{' '}
                                حتى الآن.
                            </p>
                        )}

                        {affiliatedAccounts.length > 0 && (
                            <div className="space-y-3 border-t border-border/70 pt-4">
                                <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                                    <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
                                    <span>هيئات ومؤسسات تابعة ومرتبطة</span>
                                </h3>
                                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="list">
                                    {affiliatedAccounts.map((aff) => {
                                        const affSocials = Object.entries(aff.socials ?? {}).filter(
                                            ([, url]) => safeHref(url) !== null,
                                        );
                                        return (
                                            <li
                                                key={aff.id}
                                                className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2"
                                            >
                                                <p className="text-sm font-bold text-foreground">
                                                    {aff.name_ar}
                                                </p>
                                                {aff.description_ar && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {aff.description_ar}
                                                    </p>
                                                )}
                                                <div className="flex flex-wrap gap-1.5">
                                                    {affSocials.map(([plat, url]) => {
                                                        const href = safeHref(url);
                                                        if (!href) return null;
                                                        const { Icon, iconClass } = socialVisual(plat);
                                                        const label = socialPlatformLabel(plat, 'ar');
                                                        return (
                                                            <a
                                                                key={plat}
                                                                href={href}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                aria-label={`${label} — ${aff.name_ar}`}
                                                                className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary"
                                                            >
                                                                <Icon className={cn('h-3.5 w-3.5', iconClass)} aria-hidden="true" />
                                                                <span>{label}</span>
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 5. Related Gov Apps */}
                {gov_apps.length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                                    <Smartphone className="h-5 w-5 text-primary" aria-hidden="true" />
                                    <span>التطبيقات والخدمات الإلكترونية التابعة</span>
                                </h2>
                                <Link
                                    href="/govapps"
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                                >
                                    <span>جميع التطبيقات الحكومية</span>
                                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                </Link>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="list">
                                {gov_apps.map((app) => (
                                    <li key={app.id}>
                                        <Link
                                            href={app.url}
                                            className="flex h-full items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                                        >
                                            {app.icon && (
                                                <img
                                                    src={app.icon}
                                                    alt=""
                                                    loading="lazy"
                                                    decoding="async"
                                                    className="h-12 w-12 shrink-0 rounded-xl border border-border object-cover"
                                                />
                                            )}
                                            <div className="min-w-0 space-y-1">
                                                <p className="text-sm font-bold text-foreground">
                                                    {app.name_ar}
                                                </p>
                                                {app.description_ar && (
                                                    <p className="line-clamp-2 text-xs text-muted-foreground">
                                                        {app.description_ar}
                                                    </p>
                                                )}
                                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                                                    <span>{app.has_guide ? 'فتح دليل التطبيق' : 'عرض في دليل التطبيقات'}</span>
                                                    <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                                                </span>
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                )}

                {/* 6. Related Promises */}
                {promises.length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                                    <Hourglass className="h-5 w-5 text-primary" aria-hidden="true" />
                                    <span>وعود مسجّلة في عداد الوعود</span>
                                </h2>
                                <Link
                                    href="/promises"
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                                >
                                    <span>عداد الوعود</span>
                                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                </Link>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ol className="divide-y divide-border">
                                {promises.map((promise) => (
                                    <li key={promise.number} className="py-3 first:pt-0 last:pb-0">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="space-y-1">
                                                <Link
                                                    href={promise.url}
                                                    className="text-sm font-bold text-foreground hover:text-primary hover:underline"
                                                >
                                                    <span
                                                        dir="ltr"
                                                        className="me-1.5 text-xs tabular-nums text-muted-foreground"
                                                    >
                                                        #{promise.number}
                                                    </span>
                                                    {promise.title}
                                                </Link>
                                                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                                                    <span>المتحدث: {promise.speaker_name}</span>
                                                    {promise.statement_date && (
                                                        <time
                                                            dateTime={promise.statement_date}
                                                            className="tabular-nums"
                                                        >
                                                            {formatGovtDate(promise.statement_date)}
                                                        </time>
                                                    )}
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="shrink-0 text-xs">
                                                {PROMISE_STATE_LABELS[promise.display_state] ??
                                                    PROMISE_STATE_LABELS[promise.status] ??
                                                    promise.display_state}
                                            </Badge>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </CardContent>
                    </Card>
                )}

                {/* 7. Sources */}
                <Card>
                    <CardHeader className="pb-3">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                            <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
                            <span>المصادر والتوثيق</span>
                        </h2>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <ul className="space-y-2 text-sm" role="list">
                            {sources.map((src) => (
                                <li key={src.url}>
                                    <a
                                        href={src.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                                    >
                                        <span>{src.label_ar}</span>
                                        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    </a>
                                </li>
                            ))}
                        </ul>
                        {meta.updated_at && (
                            <p className="text-xs text-muted-foreground">
                                آخر تحديث مرجعي:{' '}
                                <time dateTime={meta.updated_at} className="tabular-nums font-medium text-foreground">
                                    {formatGovtDate(meta.updated_at)}
                                </time>
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Other Ministries Navigation */}
                {siblings.length > 0 && (
                    <section aria-labelledby="other-ministries-heading" className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <h2
                                id="other-ministries-heading"
                                className="flex items-center gap-2 text-base font-bold text-foreground"
                            >
                                <Landmark className="h-4 w-4 text-primary" aria-hidden="true" />
                                <span>
                                    {ministry.kind === 'sovereign'
                                        ? 'هيئات سيادية أخرى'
                                        : 'وزارات سورية أخرى'}
                                </span>
                            </h2>
                            <Link
                                href="/ministries"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                                <span>العودة إلى دليل الوزارات</span>
                                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                            </Link>
                        </div>
                        <ul className="flex flex-wrap gap-2" role="list">
                            {siblings.map((sib) => (
                                <li key={sib.slug}>
                                    <Link
                                        href={`/ministries/${sib.slug}`}
                                        className="inline-flex min-h-9 items-center rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                                    >
                                        {sib.name_ar}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </MainLayout>
    );
}
