import { useEffect, useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';
import {
    ArrowRight,
    ChevronDown,
    ChevronLeft,
    Clock,
    Compass,
    ExternalLink,
    Globe2,
    HelpCircle,
    MapPin,
    Phone,
    Share2,
    Ship,
} from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { cn } from '@/Lib/utils';
import { StatusDot, StatusPill } from './_components/StatusPill';
import { WhatsAppIcon } from './_components/WhatsAppIcon';
import {
    DIRECTION_LABELS,
    SOURCE_PAGE_URL,
    crossings,
    formatIntl,
    isWindowOpen,
    meta,
    shareCrossing,
    statusOf,
    syriaMinutes,
    syriaOffsetLabel,
    windowLabel,
    type Crossing,
} from '@/Domain/crossings/crossings';

interface CrossingShowProps {
    slug: string;
    governorate?: {
        id: string;
        nameAr: string;
    } | null;
}

function buildCrossingFaqs(crossing: Crossing): Array<{ q: string; a: string }> {
    const isPort = crossing.category === 'port';
    const kind = isPort ? 'المرفأ البحري' : 'المنفذ الحدودي';
    const hoursAnswer = crossing.openingSoon
        ? `${crossing.name} حالياً قيد الافتتاح، وسيتم تحديث ساعات العمل فور بدء التشغيل الرسمي.`
        : crossing.windows.length > 0
            ? crossing.windows
                .map((w) => `${w.label ? `${w.label}: ` : ''}${windowLabel(w)}`)
                .join(' — ') + ' (بتوقيت دمشق).'
            : 'يُرجى التواصل عبر رقم الواتساب الرسمي للتحقق من ساعات الدوام المحدّثة.';

    const faqs: Array<{ q: string; a: string }> = [
        {
            q: `ما هي ساعات عمل ${crossing.name}؟`,
            a: hoursAnswer,
        },
        {
            q: `ما هو رقم التواصل والواتساب الرسمي لـ ${crossing.name}؟`,
            a: `رقم الواتساب الرسمي المعتمد لدى الهيئة العامة للمنافذ البرية والبحرية هو ${formatIntl(crossing.intl)}، ويمكنك مراسلته مباشرة من زر واتساب في هذه الصفحة.`,
        },
        {
            q: `ما نوع الحركة المسموحة عبر ${crossing.name}؟`,
            a: crossing.opType
                ? `نوع الحركة المعتمد حالياً في ${kind}: ${crossing.opType}.`
                : `${crossing.name} حالياً قيد الافتتاح ولم يُعلن بعد عن تفاصيل الحركة التشغيلية.`,
        },
    ];

    if (crossing.country) {
        faqs.push({
            q: `مع أي دولة يربط ${crossing.name} سوريا؟`,
            a: `يربط ${crossing.name} الجمهورية العربية السورية مع ${crossing.country} ضمن ${DIRECTION_LABELS[crossing.direction]}.`,
        });
    }

    return faqs;
}

export default function CrossingShow({ slug, governorate = null }: CrossingShowProps) {
    const crossing = useMemo(
        () => crossings.find((c) => c.slug === slug) ?? crossings[0],
        [slug],
    );

    const [nowMin, setNowMin] = useState<number | null>(null);
    const [tzOffset, setTzOffset] = useState<string>('GMT+3');

    useEffect(() => {
        const update = () => {
            setNowMin(syriaMinutes());
            setTzOffset(syriaOffsetLabel());
        };
        // A hidden tab skips the refresh and catches up the moment it is shown.
        const updateIfVisible = () => {
            if (!document.hidden) update();
        };
        update();
        const id = window.setInterval(updateIfVisible, 30_000);
        document.addEventListener('visibilitychange', updateIfVisible);
        return () => {
            window.clearInterval(id);
            document.removeEventListener('visibilitychange', updateIfVisible);
        };
    }, []);

    const status = statusOf(crossing, nowMin);
    const isPort = crossing.category === 'port';
    const faqs = useMemo(() => buildCrossingFaqs(crossing), [crossing]);

    const related = useMemo(() => {
        const sameDir = crossings.filter((c) => c.direction === crossing.direction && c.n !== crossing.n);
        if (sameDir.length >= 4) return sameDir.slice(0, 6);
        const others = crossings.filter((c) => c.direction !== crossing.direction && c.n !== crossing.n);
        return [...sameDir, ...others].slice(0, 6);
    }, [crossing]);

    return (
        <MainLayout>
            <div className="min-h-screen bg-background pb-16" dir="rtl">
                {/* Breadcrumb & Hero */}
                <section className="border-b border-border bg-card">
                    <div className="container mx-auto max-w-5xl px-4 py-6">
                        <nav aria-label="مسار التنقل" className="mb-5 text-xs text-muted-foreground">
                            <ol className="flex flex-wrap items-center gap-1.5">
                                <li className="flex items-center gap-1.5">
                                    <Link href="/" className="transition-colors hover:text-foreground">
                                        الرئيسية
                                    </Link>
                                    <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <Link href="/crossings" className="transition-colors hover:text-foreground">
                                        المنافذ الحدودية
                                    </Link>
                                    <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                </li>
                                <li className="min-w-0">
                                    <span aria-current="page" className="block truncate font-medium text-foreground">{crossing.name}</span>
                                </li>
                            </ol>
                        </nav>

                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <StatusPill status={status} />
                                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                        {isPort ? (
                                            <Ship className="h-3.5 w-3.5" aria-hidden="true" />
                                        ) : (
                                            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                                        )}
                                        {DIRECTION_LABELS[crossing.direction]}
                                    </span>
                                    {crossing.country && (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                            <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
                                            مع {crossing.country}
                                        </span>
                                    )}
                                </div>

                                <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                                    {crossing.name}
                                </h1>

                                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                                    {isPort ? 'مرفأ بحري سوري رسمي' : `منفذ حدودي برّي سوري${crossing.country ? ` مع ${crossing.country}` : ''}`}
                                    {crossing.opType ? ` — نوع الحركة: ${crossing.opType}.` : '.'}{' '}
                                    تُحسب حالة التشغيل الآنية تلقائياً وفق توقيت دمشق ({tzOffset}).
                                </p>

                                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                                    <Button asChild className="gap-2 bg-emerald-600 font-bold text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500">
                                        <a href={`https://wa.me/${crossing.intl}`} target="_blank" rel="noopener noreferrer">
                                            <WhatsAppIcon className="h-4 w-4" />
                                            <span>تواصل عبر واتساب</span>
                                        </a>
                                    </Button>
                                    <Button variant="outline" asChild className="gap-2">
                                        <a href={crossing.mapsUrl} target="_blank" rel="noopener noreferrer">
                                            <MapPin className="h-4 w-4" aria-hidden="true" />
                                            <span>الموقع على خرائط Google</span>
                                            <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                                        </a>
                                    </Button>
                                    <Button variant="outline" asChild className="gap-2">
                                        <Link href={`/crossings?c=${crossing.n}`}>
                                            <Compass className="h-4 w-4" aria-hidden="true" />
                                            <span>عرض على الخريطة</span>
                                        </Link>
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => void shareCrossing(crossing)} className="gap-1.5 text-muted-foreground">
                                        <Share2 className="h-4 w-4" aria-hidden="true" />
                                        <span>مشاركة</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Main Content */}
                <div className="container mx-auto max-w-5xl px-4 pt-8">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {/* Primary Column */}
                        <div className="space-y-6 lg:col-span-2">
                            {/* Operating Hours */}
                            <Card className="border-border/70">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-lg font-bold">
                                        <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
                                        <span>ساعات العمل وحالة التشغيل</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {crossing.override?.message && (
                                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-700 dark:text-amber-400">
                                            {crossing.override.message}
                                        </div>
                                    )}

                                    {crossing.openingSoon ? (
                                        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
                                            هذا المنفذ حالياً قيد الافتتاح، ولم تُحدَّد ساعات عمل رسمية بعد. يُنصح بمتابعة الإعلانات الرسمية أو التواصل عبر رقم الواتساب المعتمد.
                                        </p>
                                    ) : (
                                        <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-muted/20">
                                            {crossing.windows.map((win, idx) => {
                                                const open = nowMin === null ? null : isWindowOpen(win, nowMin);
                                                return (
                                                    <div key={idx} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 text-sm">
                                                        <div className="flex items-center gap-2.5">
                                                            <span
                                                                aria-hidden="true"
                                                                className={cn(
                                                                    'h-2 w-2 shrink-0 rounded-full',
                                                                    open === null
                                                                        ? 'bg-muted-foreground/40'
                                                                        : open
                                                                            ? 'bg-emerald-500'
                                                                            : 'bg-red-500',
                                                                )}
                                                            />
                                                            {open !== null && <span className="sr-only">{open ? 'مفتوح الآن' : 'مغلق الآن'}، </span>}
                                                            <span className="font-semibold text-foreground">
                                                                {win.label ? `حركة ${win.label}` : 'ساعات العمل اليومية'}
                                                            </span>
                                                        </div>
                                                        <span className="font-bold text-foreground">
                                                            {windowLabel(win)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {crossing.opType && (
                                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-4 py-3 text-sm">
                                            <span className="text-muted-foreground">نوع الحركة المعتمدة</span>
                                            <span className="font-semibold text-foreground">{crossing.opType}</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* FAQs */}
                            <Card className="border-border/70">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-lg font-bold">
                                        <HelpCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                                        <span>أسئلة شائعة حول {crossing.name}</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {faqs.map((faq, idx) => (
                                        <details
                                            key={idx}
                                            open={idx === 0}
                                            className="group rounded-xl border border-border/70 bg-muted/20 px-4 py-3"
                                        >
                                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-foreground">
                                                <span>{faq.q}</span>
                                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                                            </summary>
                                            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                                                {faq.a}
                                            </p>
                                        </details>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Sidebar */}
                        <aside className="space-y-6">
                            {/* Contact & Technical Card */}
                            <Card className="border-border/70">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base font-bold">
                                        <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
                                        <span>بيانات التواصل والموقع</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-xs">
                                    <dl className="space-y-2.5">
                                        <div className="flex items-center justify-between gap-2 border-b border-border/50 py-1.5">
                                            <dt className="text-muted-foreground">رقم الواتساب</dt>
                                            <dd className="font-mono font-semibold text-foreground" dir="ltr">
                                                <a href={`https://wa.me/${crossing.intl}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                                                    {formatIntl(crossing.intl)}
                                                </a>
                                            </dd>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 border-b border-border/50 py-1.5">
                                            <dt className="text-muted-foreground">التصنيف</dt>
                                            <dd className="font-semibold text-foreground">{isPort ? 'مرفأ بحري' : 'منفذ حدودي برّي'}</dd>
                                        </div>
                                        {crossing.country && (
                                            <div className="flex items-center justify-between gap-2 border-b border-border/50 py-1.5">
                                                <dt className="text-muted-foreground">الدولة المقابلة</dt>
                                                <dd className="font-semibold text-foreground">{crossing.country}</dd>
                                            </div>
                                        )}
                                        {governorate && (
                                            <div className="flex items-center justify-between gap-2 border-b border-border/50 py-1.5">
                                                <dt className="text-muted-foreground">المحافظة</dt>
                                                <dd className="font-semibold text-foreground">
                                                    <Link href={`/governorates/${governorate.id}`} className="text-primary underline decoration-dotted hover:underline">
                                                        عن محافظة {governorate.nameAr}
                                                    </Link>
                                                </dd>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between gap-2 border-b border-border/50 py-1.5">
                                            <dt className="text-muted-foreground">الإحداثيات</dt>
                                            <dd className="font-mono text-[11px] text-foreground" dir="ltr">
                                                {crossing.lat.toFixed(4)}, {crossing.lon.toFixed(4)}
                                            </dd>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 pt-1">
                                            <dt className="text-muted-foreground">المصدر</dt>
                                            <dd className="text-end font-medium text-foreground">
                                                <a href={SOURCE_PAGE_URL} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted hover:text-primary">
                                                    {meta.source}
                                                </a>
                                            </dd>
                                        </div>
                                    </dl>
                                </CardContent>
                            </Card>

                            {/* Related Crossings */}
                            <Card className="border-border/70">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base font-bold">منافذ ومرافئ أخرى</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {related.map((other) => (
                                        <Link
                                            key={other.n}
                                            href={`/crossings/${other.slug}`}
                                            className="flex items-center justify-between gap-2 rounded-xl border border-transparent p-2.5 text-sm transition-colors hover:border-border/60 hover:bg-muted/60"
                                        >
                                            <div className="flex min-w-0 items-center gap-2">
                                                <StatusDot status={statusOf(other, nowMin)} />
                                                <span className="truncate font-semibold text-foreground">{other.name}</span>
                                            </div>
                                            {other.country && (
                                                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                    {other.country}
                                                </span>
                                            )}
                                        </Link>
                                    ))}
                                    <div className="pt-2">
                                        <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
                                            <Link href="/crossings">
                                                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                                                <span>عرض جميع المنافذ والخريطة</span>
                                            </Link>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </aside>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
