import React, { useState } from 'react';
import { Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import {
    ArrowRight,
    Building2,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    Download,
    ExternalLink,
    Globe,
    HelpCircle,
    Info,
    ListChecks,
    MessageSquarePlus,
    Pencil,
    ShieldCheck,
    Smartphone,
} from 'lucide-react';
import { DEFAULT_GOVAPP_ICON } from '@/Domain/govapps/media';
import type {
    GovApp,
    GovAppAndroidSource,
    GovAppAppleSource,
    GovAppDetail,
} from '@/Domain/govapps/types';
import { formatEntityImage } from '@/Lib/entityImage';
import { formatGregorianSyrianShort } from '@/Lib/syrian-date';
import { useCanAny } from '@/Lib/useCan';
import DirectorySuggestionDialog from '@/Domain/suggestions/DirectorySuggestionDialog';

interface GovAppShowProps {
    app: GovAppDetail;
    relatedApps: GovApp[];
}

function AndroidGlyph({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden="true">
            <path d="M32 25.333H0a18.1 18.1 0 0 1 2.948-8.094a14.95 14.95 0 0 1 4.88-4.708l.547-.302l-2.693-4.547a.683.683 0 0 1 .224-.938a.673.673 0 0 1 .922.24l2.771 4.667a16.9 16.9 0 0 1 6.453-1.198c2.172-.026 4.323.38 6.333 1.198l2.76-4.667a.67.67 0 0 1 .932-.224a.676.676 0 0 1 .214.932l-2.693 4.562l.667.37a15.2 15.2 0 0 1 4.839 4.828A19.3 19.3 0 0 1 32 25.332zm-10-5.974a1.332 1.332 0 1 0 2.664.002A1.332 1.332 0 0 0 22 19.36m-14.667 0a1.332 1.332 0 1 0 2.664.002a1.332 1.332 0 0 0-2.664-.002" />
        </svg>
    );
}

function AppleGlyph({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
            <path d="M19.665 16.811a10.3 10.3 0 0 1-1.021 1.837q-.807 1.15-1.316 1.592q-.787.723-1.692.744q-.649.001-1.562-.373q-.914-.372-1.683-.371q-.805-.001-1.73.371q-.924.375-1.495.393q-.866.038-1.729-.764q-.55-.48-1.377-1.648q-.885-1.245-1.455-2.891q-.61-1.78-.611-3.447q0-1.91.826-3.292a4.86 4.86 0 0 1 1.73-1.751a4.65 4.65 0 0 1 2.34-.662q.69.001 1.81.422c1.12.421 1.227.422 1.436.422q.237 0 1.593-.498q1.279-.46 2.163-.384q2.4.192 3.6 1.895q-2.145 1.301-2.123 3.637q.02 1.82 1.317 3.023a4.3 4.3 0 0 0 1.315.863q-.159.46-.336.882M15.998 2.38q-.001 1.426-1.039 2.659c-.836.976-1.846 1.541-2.941 1.452a3 3 0 0 1-.021-.36c0-.913.396-1.889 1.103-2.688q.528-.606 1.343-1.009q.813-.397 1.536-.435q.02.192.019.381" />
        </svg>
    );
}

function TelegramGlyph({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 12 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472c-.18 1.898-.962 6.502-1.36 8.627c-.168.9-.499 1.201-.82 1.23c-.696.065-1.225-.46-1.9-.902c-1.056-.693-1.653-1.124-2.678-1.8c-1.185-.78-.417-1.21.258-1.91c.177-.184 3.247-2.977 3.307-3.23c.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345c-.48.33-.913.49-1.302.48c-.428-.008-1.252-.241-1.865-.44c-.752-.245-1.349-.374-1.297-.789c.027-.216.325-.437.893-.663c3.498-1.524 5.83-2.529 6.998-3.014c3.332-1.386 4.025-1.627 4.476-1.635" />
        </svg>
    );
}

const ANDROID_CTA_LABELS: Record<GovAppAndroidSource, string> = {
    google_play: 'تحميل من Google Play',
    direct_apk: 'تحميل ملف APK الرسمي (أندرويد)',
    telegram: 'تحميل لأندرويد عبر تيليجرام',
    huawei_appgallery: 'تحميل من AppGallery',
    website: 'تحميل لأندرويد من الموقع الرسمي',
};

const ANDROID_SOURCE_LABELS: Record<GovAppAndroidSource, string> = {
    google_play: 'متجر Google Play',
    direct_apk: 'ملف APK مباشر من الموقع الرسمي',
    telegram: 'قناة تيليجرام الرسمية',
    huawei_appgallery: 'متجر Huawei AppGallery',
    website: 'صفحة التحميل على الموقع الرسمي',
};

const APPLE_CTA_LABELS: Record<GovAppAppleSource, string> = {
    app_store: 'تحميل من App Store',
    testflight: 'تحميل عبر TestFlight (آيفون)',
    telegram: 'تحميل لآيفون عبر تيليجرام',
    website: 'تحميل لآيفون من الموقع الرسمي',
};

function getAndroidButtonLabel(source: GovAppAndroidSource | null, isDirectApk: boolean): string {
    if (source) {
        return ANDROID_CTA_LABELS[source];
    }
    return isDirectApk ? ANDROID_CTA_LABELS.direct_apk : 'تحميل لأندرويد';
}

function getAppleButtonLabel(source: GovAppAppleSource | null): string {
    if (source) {
        return APPLE_CTA_LABELS[source];
    }
    return 'تحميل لآيفون';
}

/**
 * The presenter sends `YYYY-MM-DD` calendar dates: format them with the shared
 * Syrian month names so server and browser render the same text in any zone/ICU.
 */
function formatArabicDate(isoDate?: string | null): string | null {
    if (!isoDate) return null;
    return formatGregorianSyrianShort(isoDate);
}

export default function GovAppShow({ app, relatedApps }: GovAppShowProps) {
    const canAny = useCanAny();
    const canEdit = canAny('govapps.edit');
    const [suggestionOpen, setSuggestionOpen] = useState(false);

    const androidLink = app.links?.android?.trim() || null;
    const appleLink = app.links?.apple?.trim() || null;
    const officialLink = app.links?.official?.trim() || null;
    const ids = app.store_identifiers;

    const overviewParagraphs = (app.overview_ar || app.description || '')
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);

    const verifiedLabel = formatArabicDate(app.verified_at || app.updated_at);
    const hasIdentifiers = Boolean(
        ids.android_package
        || ids.android_source
        || ids.apple_id
        || ids.apple_source
        || ids.official_host
        || ids.is_direct_apk,
    );
    const androidButtonLabel = getAndroidButtonLabel(ids.android_source, ids.is_direct_apk);
    const appleButtonLabel = getAppleButtonLabel(ids.apple_source);

    return (
        <MainLayout>
            <div className="min-h-screen bg-background pb-16" dir="rtl">
                {/* Breadcrumb & Hero */}
                <section className="bg-card border-b border-border">
                    <div className="container mx-auto px-4 py-6 max-w-6xl">
                        <nav aria-label="مسار التنقل" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mb-6">
                            <Link href="/" className="hover:text-foreground transition-colors">
                                الرئيسية
                            </Link>
                            <ChevronLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <Link href="/govapps" className="hover:text-foreground transition-colors">
                                تطبيقات حكومية
                            </Link>
                            <ChevronLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span className="text-foreground font-medium truncate">{app.name}</span>
                        </nav>

                        <div className="flex flex-col md:flex-row items-start gap-6">
                            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden bg-muted border border-border shadow-sm shrink-0">
                                <img
                                    src={app.icon || DEFAULT_GOVAPP_ICON}
                                    alt={app.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = DEFAULT_GOVAPP_ICON;
                                    }}
                                />
                            </div>

                            <div className="flex-1 min-w-0 space-y-3">
                                <div>
                                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                                        {app.name}
                                    </h1>
                                    {app.name_en && app.name_en !== app.name && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            <span dir="ltr" className="inline-block">{app.name_en}</span>
                                        </p>
                                    )}
                                </div>

                                {app.description && (
                                    <p className="text-base text-muted-foreground leading-relaxed max-w-3xl">
                                        {app.description}
                                    </p>
                                )}

                                {/* Primary Official Download Actions */}
                                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                                    {androidLink && (
                                        <Button asChild size="default" className="gap-2 font-bold rounded-xl shadow-xs">
                                            <a href={androidLink} target="_blank" rel="noopener noreferrer">
                                                {ids.android_source === 'telegram' ? (
                                                    <TelegramGlyph className="w-4 h-4" />
                                                ) : (
                                                    <AndroidGlyph className="w-4 h-4" />
                                                )}
                                                <span>{androidButtonLabel}</span>
                                                <ExternalLink className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
                                            </a>
                                        </Button>
                                    )}
                                    {appleLink && (
                                        <Button asChild variant={androidLink ? 'secondary' : 'default'} size="default" className="gap-2 font-bold rounded-xl shadow-xs">
                                            <a href={appleLink} target="_blank" rel="noopener noreferrer">
                                                {ids.apple_source === 'telegram' ? (
                                                    <TelegramGlyph className="w-4 h-4" />
                                                ) : (
                                                    <AppleGlyph className="w-4 h-4" />
                                                )}
                                                <span>{appleButtonLabel}</span>
                                                <ExternalLink className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
                                            </a>
                                        </Button>
                                    )}
                                    {officialLink && (
                                        <Button asChild variant="outline" size="default" className="gap-2 font-semibold rounded-xl">
                                            <a href={officialLink} target="_blank" rel="noopener noreferrer">
                                                <Globe className="w-4 h-4" aria-hidden="true" />
                                                <span>الموقع الرسمي</span>
                                                <ExternalLink className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
                                            </a>
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSuggestionOpen(true)}
                                        className="gap-1.5 text-muted-foreground hover:text-primary rounded-xl"
                                    >
                                        <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
                                        <span>الإبلاغ عن رابط معطّل أو تحديث</span>
                                    </Button>
                                    {canEdit && (
                                        <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-xl">
                                            <a href={`/admin/govapps?edit=${app.id}`}>
                                                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                                                <span>تعديل في اللوحة</span>
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Main Content Grid */}
                <div className="container mx-auto px-4 py-8 max-w-6xl">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                        {/* Primary Column */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Overview */}
                            {overviewParagraphs.length > 0 && (
                                <Card className="border-border/70">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                                            <Info className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
                                            <span>نظرة عامة على التطبيق</span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3.5 text-sm sm:text-base text-foreground/90 leading-relaxed">
                                        {overviewParagraphs.map((paragraph, index) => (
                                            <p key={index}>{paragraph}</p>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Features / Services */}
                            {app.features.length > 0 && (
                                <Card className="border-border/70">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                                            <ListChecks className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
                                            <span>الخدمات والميزات الرئيسية</span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {app.features.map((feature, index) => (
                                                <li
                                                    key={index}
                                                    className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/50 text-sm text-foreground leading-relaxed"
                                                >
                                                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                                                    <span>{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Requirements & Getting Started */}
                            {app.requirements.length > 0 && (
                                <Card className="border-border/70">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                                            <Download className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
                                            <span>المتطلبات وخطوات البدء</span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ol className="space-y-3">
                                            {app.requirements.map((req, index) => (
                                                <li key={index} className="flex items-start gap-3 text-sm text-foreground/90 leading-relaxed">
                                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5 tabular-nums">
                                                        {index + 1}
                                                    </span>
                                                    <span>{req}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Screenshots Gallery (when available) */}
                            {app.images && app.images.length > 0 && (
                                <Card className="border-border/70">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                                            <Smartphone className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
                                            <span>لقطات من داخل التطبيق</span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {app.images.map((src, idx) => (
                                                <div key={idx} className="rounded-xl overflow-hidden border border-border bg-muted/30">
                                                    <img
                                                        src={src}
                                                        alt={`لقطة شاشة ${idx + 1} من ${app.name}`}
                                                        loading="lazy"
                                                        className="w-full h-auto object-cover"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* FAQs */}
                            {app.faqs.length > 0 && (
                                <Card className="border-border/70">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                                            <HelpCircle className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
                                            <span>الأسئلة الشائعة</span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="divide-y divide-border/60">
                                        {app.faqs.map((faq, index) => (
                                            <details key={index} className="group py-3 first:pt-0 last:pb-0" open={index === 0}>
                                                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none font-semibold text-sm sm:text-base text-foreground hover:text-primary transition-colors">
                                                    <span>{faq.q}</span>
                                                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                                                </summary>
                                                <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed pe-6">
                                                    {faq.a}
                                                </p>
                                            </details>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Sidebar */}
                        <aside className="space-y-6">
                            {/* Issuing Entity */}
                            {app.publisher && (
                                <Card className="border-border/70">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base font-bold flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                                            <span>الجهة المُصدِرة</span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Link
                                            href={`/syofficial?q=${encodeURIComponent(app.publisher.name_ar)}`}
                                            className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/60 hover:border-primary/40 hover:bg-muted/70 transition-colors"
                                        >
                                            <div className="w-11 h-11 rounded-lg overflow-hidden bg-background border border-border shrink-0">
                                                <img
                                                    src={formatEntityImage(app.publisher.image)}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="font-bold text-sm text-foreground truncate">
                                                    {app.publisher.name_ar}
                                                </div>
                                                <div className="text-xs text-primary mt-0.5">
                                                    عرض الحسابات الرسمية في SyOfficial
                                                </div>
                                            </div>
                                        </Link>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Verification & Technical Identifiers */}
                            <Card className="border-border/70">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base font-bold flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                                        <span>التحقق من التطبيق الرسمي</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-xs">
                                    <p className="text-muted-foreground leading-relaxed">
                                        تأكّد من مطابقة المعرّفات التالية قبل التثبيت لتجنّب التطبيقات المقلّدة أو غير الرسمية:
                                    </p>

                                    <dl className="space-y-2.5 pt-1">
                                        <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50">
                                            <dt className="text-muted-foreground">الأنظمة المدعومة</dt>
                                            <dd className="font-semibold text-foreground">
                                                {[
                                                    androidLink ? 'أندرويد' : null,
                                                    appleLink ? 'آيفون (iOS)' : null,
                                                    officialLink ? 'ويب' : null,
                                                ].filter(Boolean).join(' · ') || '—'}
                                            </dd>
                                        </div>

                                        {ids.android_source && (
                                            <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50">
                                                <dt className="text-muted-foreground">مصدر تحميل أندرويد</dt>
                                                <dd className="font-semibold text-foreground">
                                                    {ANDROID_SOURCE_LABELS[ids.android_source]}
                                                </dd>
                                            </div>
                                        )}

                                        {ids.android_package && (
                                            <div className="py-1.5 border-b border-border/50 space-y-1">
                                                <dt className="text-muted-foreground">معرّف حزمة أندرويد (Package ID)</dt>
                                                <dd className="font-mono text-[11px] bg-muted/60 px-2 py-1 rounded-md text-foreground break-all" dir="ltr">
                                                    {ids.android_package}
                                                </dd>
                                            </div>
                                        )}

                                        {ids.apple_id && (
                                            <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50">
                                                <dt className="text-muted-foreground">معرّف App Store</dt>
                                                <dd className="font-mono text-[11px] bg-muted/60 px-2 py-0.5 rounded-md text-foreground" dir="ltr">
                                                    {ids.apple_id}
                                                </dd>
                                            </div>
                                        )}

                                        {ids.official_host && (
                                            <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50">
                                                <dt className="text-muted-foreground">النطاق الرسمي</dt>
                                                <dd className="font-mono text-[11px] text-foreground" dir="ltr">
                                                    {ids.official_host}
                                                </dd>
                                            </div>
                                        )}

                                        {hasIdentifiers && verifiedLabel && (
                                            <div className="flex items-center justify-between gap-2 pt-1">
                                                <dt className="text-muted-foreground">تاريخ التحقق</dt>
                                                <dd className="font-medium text-foreground">{verifiedLabel}</dd>
                                            </div>
                                        )}
                                    </dl>
                                </CardContent>
                            </Card>

                            {/* Related Apps */}
                            {relatedApps.length > 0 && (
                                <Card className="border-border/70">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base font-bold">تطبيقات حكومية أخرى</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2.5">
                                        {relatedApps.map((rel) => (
                                            <Link
                                                key={rel.id}
                                                href={`/govapps/${rel.id}`}
                                                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/60 border border-transparent hover:border-border/60 transition-colors"
                                            >
                                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted border border-border/60 shrink-0">
                                                    <img
                                                        src={rel.icon || DEFAULT_GOVAPP_ICON}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = DEFAULT_GOVAPP_ICON;
                                                        }}
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-semibold text-sm text-foreground truncate">
                                                        {rel.name}
                                                    </div>
                                                    {rel.description && (
                                                        <div className="text-xs text-muted-foreground truncate">
                                                            {rel.description}
                                                        </div>
                                                    )}
                                                </div>
                                            </Link>
                                        ))}

                                        <Button asChild variant="outline" size="sm" className="w-full mt-2 gap-1.5 rounded-xl">
                                            <Link href="/govapps">
                                                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                                                <span>عرض جميع التطبيقات الحكومية</span>
                                            </Link>
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}
                        </aside>
                    </div>
                </div>
            </div>

            <DirectorySuggestionDialog
                module="govapps"
                open={suggestionOpen}
                onOpenChange={setSuggestionOpen}
                defaultKind="edit"
                fixedTarget={{
                    id: app.id,
                    label: app.name,
                    subtitle: app.description ?? null,
                }}
            />
        </MainLayout>
    );
}
