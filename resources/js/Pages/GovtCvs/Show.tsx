import { useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import DirectorySuggestionDialog from '@/Domain/suggestions/DirectorySuggestionDialog';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader } from '@/Components/ui/card';
import {
    Building2,
    Calendar,
    ChevronLeft,
    ExternalLink,
    FileText,
    Globe,
    History,
    MapPin,
    MessageSquarePlus,
    Pencil,
    Sparkles,
    Star,
} from 'lucide-react';
import { useCan } from '@/Lib/useCan';
import { cn } from '@/Lib/utils';
import { socialPlatformLabel, socialVisual } from '@/Domain/syofficial/social';
import CareerTimeline from '@/Domain/govtcvs/CareerTimeline';
import OfficialAvatar from '@/Domain/govtcvs/OfficialAvatar';
import { OfficeStatusBadge } from '@/Domain/govtcvs/StatusBadges';
import {
    CV_SECTION_META,
    formatGovtDate,
    safeHref,
    TIER_LABELS,
} from '@/Domain/govtcvs/constants';
import {
    GOVT_CV_SECTION_KEYS,
    type GovtHouseLink,
    type GovtOfficialDetail,
    type GovtOfficialEntityLink,
} from '@/Domain/govtcvs/types';

interface RelatedPromiseItem {
    number: number;
    title: string;
    status: string;
    display_state: string;
}

interface Props {
    official: GovtOfficialDetail;
    related_promises?: RelatedPromiseItem[];
    tierlist_link?: {
        href: string;
        label: string;
    } | null;
    official_entity_link?: GovtOfficialEntityLink | null;
    house_link?: GovtHouseLink | null;
}

const PROMISE_STATE_AR: Record<string, string> = {
    pending: 'قيد المتابعة',
    in_progress: 'قيد التنفيذ',
    fulfilled: 'تحقق',
    partially_fulfilled: 'تحقق جزئياً',
    broken: 'لم يتحقق',
    overdue: 'متأخر',
    postponed: 'مؤجّل',
    retracted: 'مسحوب',
};

export default function GovtCvsShow({
    official,
    related_promises = [],
    tierlist_link = null,
    official_entity_link = null,
    house_link = null,
}: Props) {
    const can = useCan();
    const canEdit = (can as (c: string) => boolean)('govtcvs.edit');
    const [suggestOpen, setSuggestOpen] = useState(false);

    const activeTenure = official.current_tenure ?? official.latest_tenure;
    const roleTitle =
        activeTenure?.role_title_ar ??
        TIER_LABELS[official.highest_tier] ??
        'مسؤول حكومي';
    const displayName = official.display_name_ar || official.full_name_ar;
    const fullTitle = [official.honorific_ar, official.full_name_ar || official.display_name_ar]
        .filter(Boolean)
        .join(' ');

    const suggestionTarget = useMemo(
        () => ({
            id: official.id,
            label: displayName,
            subtitle: roleTitle,
        }),
        [official.id, displayName, roleTitle],
    );

    const nonEmptySocials = Object.entries(official.socials ?? {}).filter(
        ([, url]) => typeof url === 'string' && safeHref(url) !== null,
    );

    const groupedCvEntries = GOVT_CV_SECTION_KEYS.map((sectionKey) => {
        const meta = CV_SECTION_META[sectionKey];
        const items = (official.cv_entries ?? [])
            .filter((entry) => entry.section === sectionKey)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        return {
            key: sectionKey,
            meta,
            items,
        };
    }).filter((group) => group.items.length > 0);

    const uncategorizedEntries = (official.cv_entries ?? []).filter(
        (entry) => !(GOVT_CV_SECTION_KEYS as readonly string[]).includes(entry.section),
    );

    const resolvedOfficialEntityLink: GovtOfficialEntityLink | null =
        official_entity_link ??
        official.official_entity_link ??
        (official.official_entity_id || official.links?.official_entity_id
            ? {
                  href: official.links?.syofficial_url || '/syofficial',
                  label: `الحسابات الرسمية لـ ${displayName} في دليل الحسابات الرسمية`,
              }
            : null);

    const resolvedHouseLink: GovtHouseLink | null =
        house_link ??
        official.house_link ??
        (official.house_member_id || official.links?.house_member_id
            ? {
                  href: official.links?.house_url || '/house',
                  label: `ملف ${displayName} في مجلس الشعب`,
              }
            : null);

    const hasCrossLinks =
        related_promises.length > 0 ||
        Boolean(resolvedOfficialEntityLink) ||
        Boolean(resolvedHouseLink);

    return (
        <MainLayout>
            <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
                {/* Breadcrumb */}
                <nav
                    aria-label="مسار التنقل"
                    className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
                >
                    <Link href="/" className="hover:text-foreground">
                        الرئيسية
                    </Link>
                    <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <Link href="/govtcvs" className="hover:text-foreground">
                        السير الذاتية للمسؤولين
                    </Link>
                    <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="font-medium text-foreground" aria-current="page">
                        {displayName}
                    </span>
                </nav>

                {/* Rich Official Profile Header Card */}
                <Card>
                    <CardContent className="p-6 sm:p-8">
                        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                                <OfficialAvatar
                                    name={displayName}
                                    portraitUrl={official.portrait_url}
                                    resolvedPortraitUrl={official.resolved_portrait_url}
                                    size={96}
                                    className="ring-4 ring-primary/10"
                                    priority
                                />
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <OfficeStatusBadge status={official.office_status} />
                                    </div>

                                    <div>
                                        <h1 className="text-2xl font-black leading-tight text-foreground md:text-4xl">
                                            {fullTitle}
                                        </h1>
                                        {official.full_name_en && (
                                            <p className="mt-1 text-sm font-medium text-muted-foreground">
                                                <span dir="ltr">{official.full_name_en}</span>
                                            </p>
                                        )}
                                    </div>

                                    {/* Current or Last Position Highlight */}
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base font-semibold text-primary">
                                        <span>{roleTitle}</span>
                                        {activeTenure?.is_acting && (
                                            <Badge variant="outline" className="text-xs">
                                                بالتكليف
                                            </Badge>
                                        )}
                                        {activeTenure?.institution_name_ar && (
                                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                                                <span>·</span>
                                                <Building2
                                                    className="h-4 w-4 shrink-0"
                                                    aria-hidden="true"
                                                />
                                                <span>{activeTenure.institution_name_ar}</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Actions & Verified Socials */}
                            <div className="flex flex-wrap items-center gap-2 self-start md:justify-end">
                                {nonEmptySocials.map(([key, url]) => {
                                    const href = safeHref(url);
                                    if (!href) return null;
                                    const { Icon, iconClass, hoverClass } = socialVisual(key);
                                    const label = socialPlatformLabel(key, 'ar');
                                    return (
                                        <a
                                            key={key}
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={`${label} — ${displayName}`}
                                            title={label}
                                            className={cn(
                                                'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background transition-colors',
                                                hoverClass,
                                            )}
                                        >
                                            <Icon
                                                className={cn('h-4 w-4', iconClass)}
                                                aria-hidden="true"
                                            />
                                        </a>
                                    );
                                })}

                                {tierlist_link && (
                                    <Button asChild size="sm" className="gap-1.5">
                                        <Link href={tierlist_link.href}>
                                            <Star className="h-3.5 w-3.5" aria-hidden="true" />
                                            قيّم الأداء
                                        </Link>
                                    </Button>
                                )}

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={() => setSuggestOpen(true)}
                                >
                                    <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
                                    اقتراح تعديل
                                </Button>

                                {canEdit && (
                                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                                        <Link href={`/admin/govtcvs/officials/${official.id}`}>
                                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                            تعديل الملف
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Quick Facts Row */}
                        {(official.birth_year ||
                            official.birth_place_ar ||
                            (official.languages?.length ?? 0) > 0 ||
                            official.first_seen_in_office_at) && (
                            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
                                {(official.birth_year || official.birth_place_ar) && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                        <span>الميلاد:</span>
                                        <strong className="font-medium text-foreground">
                                            {[
                                                official.birth_place_ar,
                                                official.birth_year ? String(official.birth_year) : null,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </strong>
                                    </span>
                                )}

                                {(official.languages?.length ?? 0) > 0 && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                        <span>اللغات:</span>
                                        <strong className="font-medium text-foreground">
                                            {official.languages.join('، ')}
                                        </strong>
                                    </span>
                                )}

                                {official.first_seen_in_office_at && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                        <span>أول رصد في المنصب:</span>
                                        <strong className="font-medium text-foreground tabular-nums">
                                            {formatGovtDate(official.first_seen_in_office_at)}
                                        </strong>
                                    </span>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Desktop Layout: Full width if no cross-links, two-column if cross-links exist */}
                <div
                    className={cn(
                        'grid gap-6',
                        hasCrossLinks && 'lg:grid-cols-[minmax(0,1fr)_360px]',
                    )}
                >
                    {/* Main Column */}
                    <div className="space-y-6">
                        {/* 1. Structured CV */}
                        <Card>
                            <CardHeader className="pb-3">
                                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                                    <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
                                    <span>السيرة الذاتية</span>
                                </h2>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {official.bio_summary_ar && (
                                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                                        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                                            {official.bio_summary_ar}
                                        </p>
                                    </div>
                                )}

                                {groupedCvEntries.length > 0 || uncategorizedEntries.length > 0 ? (
                                    <div className="space-y-6">
                                        {groupedCvEntries.map(({ key, meta, items }) => {
                                            const SectionIcon = meta.icon;
                                            return (
                                                <section key={key} className="space-y-3">
                                                    <h3 className="flex items-center gap-2 border-b border-border pb-2 text-base font-bold text-foreground">
                                                        <SectionIcon
                                                            className="h-4 w-4 text-primary"
                                                            aria-hidden="true"
                                                        />
                                                        <span>{meta.label}</span>
                                                    </h3>
                                                    <ul className="space-y-3" role="list">
                                                        {items.map((item) => (
                                                            <li
                                                                key={item.id}
                                                                className="rounded-lg border border-border bg-card p-3.5"
                                                            >
                                                                <div className="flex flex-wrap items-start justify-between gap-2">
                                                                    <div>
                                                                        <p className="font-semibold text-foreground">
                                                                            {item.title_ar}
                                                                        </p>
                                                                        {(item.organization_ar ||
                                                                            item.location_ar) && (
                                                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                                                {[
                                                                                    item.organization_ar,
                                                                                    item.location_ar,
                                                                                ]
                                                                                    .filter(Boolean)
                                                                                    .join(' · ')}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    {(item.start_year ||
                                                                        item.end_year ||
                                                                        item.is_ongoing) && (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="tabular-nums text-xs font-normal whitespace-nowrap"
                                                                            dir={item.is_ongoing ? undefined : 'ltr'}
                                                                        >
                                                                            {(() => {
                                                                                if (item.start_year && item.is_ongoing) {
                                                                                    return `${item.start_year} – الآن`;
                                                                                }
                                                                                if (
                                                                                    item.start_year &&
                                                                                    item.end_year &&
                                                                                    item.start_year !== item.end_year
                                                                                ) {
                                                                                    return `${item.start_year} – ${item.end_year}`;
                                                                                }
                                                                                if (item.start_year || item.end_year) {
                                                                                    return String(item.start_year ?? item.end_year);
                                                                                }
                                                                                return 'الآن';
                                                                            })()}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                {item.details_ar && (
                                                                    <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                                                                        {item.details_ar}
                                                                    </p>
                                                                )}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </section>
                                            );
                                        })}

                                        {uncategorizedEntries.length > 0 && (
                                            <section className="space-y-3">
                                                <h3 className="border-b border-border pb-2 text-base font-bold text-foreground">
                                                    محطات أخرى
                                                </h3>
                                                <ul className="space-y-3" role="list">
                                                    {uncategorizedEntries.map((item) => (
                                                        <li
                                                            key={item.id}
                                                            className="rounded-lg border border-border bg-card p-3.5"
                                                        >
                                                            <p className="font-semibold text-foreground">
                                                                {item.title_ar}
                                                            </p>
                                                            {item.details_ar && (
                                                                <p className="mt-1 text-xs text-muted-foreground">
                                                                    {item.details_ar}
                                                                </p>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </section>
                                        )}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
                                        <p className="text-sm font-medium text-foreground">
                                            {official.bio_summary_ar
                                                ? 'تتوفر نبذة تعريفية عامة، ولم تُنشر بعد بطاقة تفصيلية للمؤهلات العلمية أو الخبرات السابقة في المصادر الرسمية.'
                                                : 'تقتصر البيانات الرسمية المتوفرة لهذا المسؤول حتى الآن على مناصبه الحكومية المرصودة منذ 8 كانون الأول 2024.'}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            يُحدَّث هذا السجل فور صدور بطاقة سيرة ذاتية رسمية أو تصريح موثّق.
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* 2. Career Timeline */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between gap-2">
                                    <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                                        <History className="h-5 w-5 text-primary" aria-hidden="true" />
                                        <span>
                                            المسيرة الحكومية منذ{' '}
                                            <span dir="ltr" className="tabular-nums">8</span> كانون الأول{' '}
                                            <span dir="ltr" className="tabular-nums">2024</span>
                                        </span>
                                    </h2>
                                    <Badge variant="outline" className="tabular-nums" dir="ltr">
                                        {official.tenures?.length ?? 0}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CareerTimeline tenures={official.tenures ?? []} />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Side Column (only rendered when cross-module links exist) */}
                    {hasCrossLinks && (
                        <aside className="space-y-6" aria-label="روابط المسؤول في أقسام الموقع الأخرى">
                            <Card>
                                <CardHeader className="pb-3">
                                    <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                                        <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                                        <span>في أقسام موقع المساحة السورية الأخرى</span>
                                    </h2>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {resolvedOfficialEntityLink && (
                                        <div className="rounded-xl border border-border bg-muted/30 p-3.5">
                                            <p className="text-xs text-muted-foreground">
                                                {resolvedOfficialEntityLink.category || 'دليل الحسابات الرسمية'}
                                            </p>
                                            <Link
                                                href={resolvedOfficialEntityLink.href}
                                                className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
                                            >
                                                <span>{resolvedOfficialEntityLink.label}</span>
                                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                            </Link>
                                        </div>
                                    )}

                                    {resolvedHouseLink && (
                                        <div className="rounded-xl border border-border bg-muted/30 p-3.5">
                                            <p className="text-xs text-muted-foreground">
                                                مجلس الشعب السوري
                                            </p>
                                            <Link
                                                href={resolvedHouseLink.href}
                                                className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
                                            >
                                                <span>{resolvedHouseLink.label}</span>
                                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                            </Link>
                                        </div>
                                    )}

                                    {related_promises.length > 0 && (
                                        <div className="space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold text-foreground">
                                                    عداد الوعود
                                                </h3>
                                                <Badge
                                                    variant="secondary"
                                                    className="tabular-nums text-xs"
                                                    dir="ltr"
                                                >
                                                    {related_promises.length}
                                                </Badge>
                                            </div>
                                            <ul className="divide-y divide-border" role="list">
                                                {related_promises.map((promise) => (
                                                    <li
                                                        key={promise.number}
                                                        className="py-2.5 first:pt-0 last:pb-0"
                                                    >
                                                        <Link
                                                            href={`/promises/${promise.number}`}
                                                            className="block text-sm font-medium text-foreground hover:text-primary hover:underline"
                                                        >
                                                            <span
                                                                dir="ltr"
                                                                className="me-1.5 text-xs tabular-nums text-muted-foreground"
                                                            >
                                                                #{promise.number}
                                                            </span>
                                                            {promise.title}
                                                        </Link>
                                                        <span className="mt-1 inline-block text-xs text-muted-foreground">
                                                            الحالة:{' '}
                                                            {PROMISE_STATE_AR[promise.display_state] ??
                                                                PROMISE_STATE_AR[promise.status] ??
                                                                promise.display_state}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </aside>
                    )}
                </div>
            </div>

            <DirectorySuggestionDialog
                module="govtcvs"
                open={suggestOpen}
                onOpenChange={setSuggestOpen}
                defaultKind="edit"
                fixedTarget={suggestionTarget}
            />
        </MainLayout>
    );
}
