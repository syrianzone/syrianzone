import { useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader } from '@/Components/ui/card';
import { Alert, AlertDescription } from '@/Components/ui/alert';
import { ArrowRight, Flag, Image as ImageIcon, Link2, MapPin, MessageSquarePlus, Quote, Share2 } from 'lucide-react';
import { Twitter } from '@/Components/ui/icons';
import { notify } from '@/Lib/notify';
import { isShareCancelled, useCanShare } from '@/Lib/webShare';
import Countdown from './_components/Countdown';
import ReportDialog, { type ReportKind } from './_components/ReportDialog';
import ShareCardDialog from './_components/ShareCardDialog';
import SourceList from './_components/SourceList';
import SpeakerAvatar from './_components/SpeakerAvatar';
import StateBadge from './_components/StateBadge';
import TargetProgress from './_components/TargetProgress';
import Timeline from './_components/Timeline';
import VotePanel from './_components/VotePanel';
import { formatDate } from './_lib/format';
import { STATE_META, VENUE_LABEL, sectorIcon } from './_lib/status';
import { canReturnToPromiseList, PROMISE_LIST_VISIT_KEY, promiseReturnUrl } from './_lib/filters';
import type { PromiseDetailData } from './_lib/types';

interface Props {
    promise: PromiseDetailData;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <h2 className="text-base font-semibold leading-none text-foreground">{children}</h2>;
}

export default function PromiseShow({ promise }: Props) {
    const page = usePage();
    const { auth, seo } = page.props as { auth?: { user?: { id: number } | null }; seo?: { canonical?: string } };
    const returnUrl = promiseReturnUrl(page.url);
    const user = auth?.user ?? null;
    const [reportKind, setReportKind] = useState<ReportKind | null>(null);
    const [shareOpen, setShareOpen] = useState(false);
    const [sharing, setSharing] = useState(false);
    const coSpeakers = promise.coSpeakers ?? [];
    const allSpeakers = [
        { ...promise.speaker, xHandle: promise.speakerXHandle, institutionName: promise.institution?.name ?? null },
        ...coSpeakers.map((s) => ({ ...s, xHandle: s.xHandle ?? null, institutionName: null })),
    ];
    const speakerNames = allSpeakers.map((s) => s.name).filter(Boolean).join(' و');
    const shareData: ShareData = {
        title: promise.title,
        text: `«${promise.title}»${speakerNames ? ` — ${speakerNames}` : ''}\nتابع حالة الوعد وآخر تحديثاته على عداد الوعود:`,
        url: seo?.canonical ?? `/promises/${promise.number}`,
    };
    const canShare = useCanShare(() => shareData);
    const SectorIcon = sectorIcon(promise.sector?.icon);
    const loginHref = `/auth/google?redirect=${encodeURIComponent(`/promises/${promise.number}`)}`;

    const share = async () => {
        setSharing(true);
        try {
            await navigator.share(shareData);
        } catch (error) {
            if (!isShareCancelled(error)) notify.error('تعذّرت مشاركة الوعد');
        } finally {
            setSharing(false);
        }
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}/promises/${promise.number}`);
            notify.success('نُسخ الرابط');
        } catch {
            notify.error('تعذّر نسخ الرابط');
        }
    };

    const openReport = (kind: ReportKind) => {
        if (!user) {
            window.location.href = loginHref;
            return;
        }
        setReportKind(kind);
    };

    return (
        <MainLayout>
            <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
                <nav aria-label="مسار التنقل">
                    <Link href={returnUrl} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                        onBefore={() => {
                            if (window.history.length > 1 && canReturnToPromiseList(router.restore(PROMISE_LIST_VISIT_KEY), page.url)) {
                                window.history.back();
                                return false;
                            }
                        }}>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />عداد الوعود
                    </Link>
                </nav>

                <header className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <StateBadge state={promise.state} keptLate={promise.keptLate} />
                        <Badge variant="outline" className="tabular-nums" dir="ltr">#{promise.number}</Badge>
                        {promise.sector && (
                            <Badge variant="outline" className="gap-1">
                                <SectorIcon className="h-3.5 w-3.5" aria-hidden="true" />{promise.sector.label}
                            </Badge>
                        )}
                        <Badge variant="outline" className="gap-1">
                            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                            {promise.isNational ? 'على مستوى البلاد' : promise.governorateNames.join('، ')}
                        </Badge>
                    </div>
                    <h1 className="text-2xl font-black leading-tight text-foreground md:text-4xl">{promise.title}</h1>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                        {allSpeakers.map((s, idx) => (
                            <div key={s.id ?? idx} className="flex flex-wrap items-center gap-3">
                                <SpeakerAvatar name={s.name} image={s.image} size={48} />
                                <div>
                                    <p className="font-bold text-foreground">{s.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {[s.title, s.institutionName].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                                {s.xHandle && (
                                    <a
                                        href={`https://x.com/${encodeURIComponent(s.xHandle)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                                    >
                                        <Twitter className="h-4 w-4" aria-hidden="true" />
                                        <span className="sr-only">حسابه على إكس: </span>
                                        <span dir="ltr">@{s.xHandle}</span>
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                    {promise.tags.length > 0 && (
                        <ul className="flex flex-wrap gap-1.5" aria-label="الوسوم">
                            {promise.tags.map((t) => (
                                <li key={t}>
                                    <Link href={`/promises?tag=${encodeURIComponent(t)}`} className="text-xs text-primary hover:underline">#{t}</Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </header>

                {promise.restatedBy && (
                    <Alert>
                        <AlertDescription>
                            أُعيد إطلاق هذا الوعد بموعد جديد:{' '}
                            <Link href={`/promises/${promise.restatedBy.number}`} className="font-semibold text-primary hover:underline">
                                الوعد رقم {promise.restatedBy.number} — {promise.restatedBy.title}
                            </Link>
                        </AlertDescription>
                    </Alert>
                )}
                {promise.restates && (
                    <Alert>
                        <AlertDescription>
                            هذا الوعد إعادة لوعد سابق بموعد مختلف:{' '}
                            <Link href={`/promises/${promise.restates.number}`} className="font-semibold text-primary hover:underline">
                                الوعد رقم {promise.restates.number} — {promise.restates.title}
                            </Link>
                            {' '}({STATE_META[promise.restates.state].label})
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="space-y-6">
                        <Card>
                            <CardContent className="space-y-4 p-6">
                                <h2 className="sr-only">نص الوعد</h2>
                                <figure className="space-y-3">
                                    <blockquote dir="auto" className="relative ps-4 text-lg leading-relaxed text-foreground">
                                        <Quote className="absolute -start-1 -top-3 h-5 w-5 -scale-x-100 text-primary/40" aria-hidden="true" />
                                        «{promise.quote}»
                                    </blockquote>
                                    <figcaption className="text-sm text-muted-foreground">
                                        {speakerNames} · {VENUE_LABEL[promise.statementVenue] ?? ''} · {formatDate(promise.statementDate)}
                                        {!promise.quoteIsVerbatim && ' · (بتصرّف)'}
                                    </figcaption>
                                </figure>
                                {promise.summary && <p className="leading-relaxed text-muted-foreground">{promise.summary}</p>}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3"><SectionTitle>الموعد</SectionTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <dl className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <dt className="text-muted-foreground">{coSpeakers.length > 0 ? 'كما ورد على لسانهم' : 'كما ورد على لسانه'}</dt>
                                        <dd className="mt-0.5 font-semibold text-foreground">{promise.deadlineWording ? `«${promise.deadlineWording}»` : 'لم يُذكر موعد'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-muted-foreground">التاريخ المعتمد في العداد</dt>
                                        <dd className="mt-0.5 font-semibold text-foreground">{promise.deadlineDate ? formatDate(promise.deadlineDate) : 'لا يوجد — نعدّ الأيام منذ إطلاقه'}</dd>
                                    </div>
                                    {(promise.postponedCount ?? 0) > 0 && promise.originalDeadlineDate && (
                                        <div className="sm:col-span-2">
                                            <dt className="text-muted-foreground">الموعد الأصلي قبل التأجيل</dt>
                                            <dd className="mt-0.5 font-semibold text-muted-foreground">
                                                <span className="line-through">{formatDate(promise.originalDeadlineDate)}</span>{promise.originalDeadlineWording ? ` («${promise.originalDeadlineWording}»)` : ''} · <span className="text-amber-600 dark:text-amber-400">تأجّل {promise.postponedCount === 1 ? 'مرة واحدة' : `${promise.postponedCount} مرات`}</span>
                                            </dd>
                                        </div>
                                    )}
                                    {promise.resolvedAt && (
                                        <div>
                                            <dt className="text-muted-foreground">تاريخ الحكم</dt>
                                            <dd className="mt-0.5 font-semibold text-foreground">{formatDate(promise.resolvedAt)}</dd>
                                        </div>
                                    )}
                                </dl>
                                {promise.deadlineReasoning && (
                                    <p className="rounded-md bg-muted p-3 leading-relaxed text-muted-foreground">{promise.deadlineReasoning}</p>
                                )}
                                {promise.target && (
                                    <div className="space-y-2 pt-1">
                                        <h3 className="font-semibold text-foreground">الهدف المعلن</h3>
                                        <TargetProgress target={promise.target} detailed />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3"><SectionTitle>سجل الوعد</SectionTitle></CardHeader>
                            <CardContent>
                                <Timeline
                                    statementDate={promise.statementDate}
                                    statementVenue={promise.statementVenue}
                                    updates={promise.updates}
                                    unit={promise.target?.unit}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3"><SectionTitle>المصادر ({promise.sources.length})</SectionTitle></CardHeader>
                            <CardContent>
                                <SourceList sources={promise.sources} />
                            </CardContent>
                        </Card>

                        {(promise.relatedPromises?.length ?? 0) > 0 && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <SectionTitle>وعود مرتبطة بهذا الملف ({promise.relatedPromises!.length})</SectionTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="divide-y divide-border" role="list">
                                        {promise.relatedPromises!.map((r) => {
                                            const subtitle = [
                                                r.speakerName,
                                                r.deadlineDate ? `الموعد ${formatDate(r.deadlineDate)}` : (r.statementDate ? formatDate(r.statementDate) : ''),
                                            ].filter(Boolean).join(' · ');

                                            return (
                                                <li key={r.number} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                                    <div className="min-w-0">
                                                        <Link
                                                            href={`/promises/${r.number}`}
                                                            className="font-medium text-foreground hover:text-primary hover:underline line-clamp-1"
                                                        >
                                                            الوعد رقم {r.number} — {r.title}
                                                        </Link>
                                                        {subtitle && (
                                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                                {subtitle}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="shrink-0">
                                                        <StateBadge state={r.state} />
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <aside className="space-y-6" aria-label="العداد والتفاعل">
                        <Card>
                            <CardContent className="flex flex-col items-center gap-3 p-6">
                                <Countdown
                                    state={promise.state}
                                    counter={promise.counter}
                                    deadlineDate={promise.deadlineDate}
                                    statementDate={promise.statementDate}
                                    size="lg"
                                    live
                                />
                                <p className="text-center text-xs text-muted-foreground">
                                    أُطلق في {formatDate(promise.statementDate)}
                                    {promise.deadlineDate && <> · الموعد {formatDate(promise.deadlineDate)}</>}
                                </p>
                            </CardContent>
                        </Card>

                        <VotePanel number={promise.number} votes={promise.votes} open={promise.votingOpen} />

                        <Card>
                            <CardContent className="grid gap-2 p-4">
                                <Button variant="outline" className="justify-start gap-2" onClick={() => setShareOpen(true)}>
                                    <ImageIcon className="h-4 w-4" aria-hidden="true" />صورة للمشاركة
                                </Button>
                                {canShare && (
                                    <Button variant="outline" className="justify-start gap-2" onClick={share} disabled={sharing}>
                                        <Share2 className="h-4 w-4" aria-hidden="true" />مشاركة الوعد
                                    </Button>
                                )}
                                <Button variant="outline" className="justify-start gap-2" onClick={copyLink}>
                                    <Link2 className="h-4 w-4" aria-hidden="true" />نسخ الرابط
                                </Button>
                                <Button variant="outline" className="justify-start gap-2" onClick={() => openReport('progress')}>
                                    <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />أرسل تحديثاً
                                </Button>
                                <Button variant="ghost" className="justify-start gap-2 text-muted-foreground" onClick={() => openReport('error')}>
                                    <Flag className="h-4 w-4" aria-hidden="true" />أبلغ عن خطأ
                                </Button>
                                {!user && <p className="text-xs text-muted-foreground">إرسال التحديثات والبلاغات يتطلب تسجيل الدخول.</p>}
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </div>

            {reportKind && (
                <ReportDialog
                    number={promise.number}
                    kind={reportKind}
                    open={reportKind !== null}
                    onOpenChange={(o) => !o && setReportKind(null)}
                />
            )}
            <ShareCardDialog promise={promise} open={shareOpen} onOpenChange={setShareOpen} />
        </MainLayout>
    );
}
