import { useState } from 'react';
import { Link, router } from '@inertiajs/react';
import axios from '@/Lib/axios';
import MainLayout from '@/Layouts/MainLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/Components/ui/card';
import { Check, ExternalLink, Pencil, Upload, X } from 'lucide-react';
import { notify } from '@/Lib/notify';
import { confirmDialog } from '@/Lib/confirm';
import { extractApiErrorMessage } from '@/Lib/apiError';
import SpeakerAvatar from '@/Domain/promises/SpeakerAvatar';
import { formatDate, safeHref } from '@/Domain/promises/format';
import { PENDING_SPEAKER_LABEL } from '@/Domain/promises/status';
import AdminHeader from './_components/AdminHeader';
import { useCan } from '@/Lib/useCan';
import { ORIGIN_LABEL, type AdminPromiseRow, type AdminSpeaker } from './_lib/types';

interface ReportRow {
    id: number;
    kind: 'progress' | 'error';
    body: string;
    sourceUrl: string | null;
    /** Submission date in Syrian time (YYYY-MM-DD). */
    createdOn: string | null;
    userName: string | null;
    promise: { id: string; number: number | null; title: string };
}

interface Props {
    promises: AdminPromiseRow[];
    speakers: AdminSpeaker[];
    reports: ReportRow[];
    queueCount: number;
}

export default function PromisesReview({ promises, speakers, reports, queueCount }: Props) {
    const can = useCan();
    const canReview = can('promises.review');
    const canOpen = can('promises.edit') || can('promises.rule') || can('promises.review');
    const [busy, setBusy] = useState<string | null>(null);

    const act = async (key: string, url: string, success: string) => {
        setBusy(key);
        try {
            await axios.post(url);
            notify.success(success);
            router.reload();
        } catch (e) {
            notify.error(extractApiErrorMessage(e, 'تعذّر تنفيذ العملية'));
        } finally {
            setBusy(null);
        }
    };

    const confirmThen = async (title: string, run: () => void) => {
        if (await confirmDialog({ title, destructive: true, confirmText: 'تأكيد' })) run();
    };

    const empty = promises.length + speakers.length + reports.length === 0;

    return (
        <MainLayout>
            <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8" dir="rtl">
                <AdminHeader title="مراجعة عداد الوعود" current="review" queueCount={queueCount} />

                {empty && (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">لا شيء بانتظار المراجعة الآن.</CardContent>
                    </Card>
                )}

                {promises.length > 0 && (
                    <section aria-labelledby="pending-promises" className="space-y-3">
                        <h2 id="pending-promises" className="text-lg font-bold text-foreground">وعود بانتظار النشر ({promises.length})</h2>
                        <p className="text-sm text-muted-foreground">افتح كل وعد، وتحقّق من مصادره، وحدّد الموعد المعتمد والقطاع قبل النشر.</p>
                        <div className="grid gap-3">
                            {promises.map((p) => (
                                <Card key={p.id}>
                                    <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                                        <div className="min-w-0 space-y-1">
                                            <h3 className="font-semibold text-foreground">{p.title}</h3>
                                            <div className="text-sm text-muted-foreground">
                                                {p.speakerName}
                                                {p.speakerPending && <Badge variant="outline" className="ms-1.5 text-[10px]">{PENDING_SPEAKER_LABEL}</Badge>}
                                                {' · '}{formatDate(p.statementDate)} · {ORIGIN_LABEL[p.origin]} · المصادر: {p.sourcesCount}
                                            </div>
                                            {p.submitterName && <p className="text-xs text-muted-foreground">اقترحه: {p.submitterName}</p>}
                                            {p.submitterNote && <p className="line-clamp-3 whitespace-pre-line rounded-md bg-muted p-2 text-sm text-muted-foreground">{p.submitterNote}</p>}
                                        </div>
                                        <div className="flex shrink-0 flex-wrap gap-2">
                                            {canOpen && (
                                                <Button asChild size="sm" variant="outline" className="gap-1">
                                                    <Link href={`/admin/promises/${p.id}/edit`}><Pencil className="h-4 w-4" aria-hidden="true" />فتح للمراجعة</Link>
                                                </Button>
                                            )}
                                            {canReview && (
                                                <>
                                                    <Button size="sm" className="gap-1" disabled={busy === p.id} onClick={() => act(p.id, `/api/v1/admin/promises/${p.id}/publish`, 'نُشر الوعد')}>
                                                        <Upload className="h-4 w-4" aria-hidden="true" />نشر
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="gap-1" disabled={busy === p.id} onClick={() => confirmThen(`رفض «${p.title}»؟`, () => act(p.id, `/api/v1/admin/promises/${p.id}/reject`, 'رُفض الاقتراح'))}>
                                                        <X className="h-4 w-4 text-destructive" aria-hidden="true" />رفض
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </section>
                )}

                {speakers.length > 0 && (
                    <Card>
                        <CardHeader>
                            <h2 className="text-base font-semibold leading-none">أشخاص مقترحون ({speakers.length})</h2>
                            <CardDescription>أسماء أضافها الزوار لأنهم لم يجدوها في القائمة. تأكد من الاسم والمنصب، وأنه غير موجود بصيغة أخرى.</CardDescription>
                        </CardHeader>
                        <CardContent className="divide-y divide-border">
                            {speakers.map((s) => (
                                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                    <div className="flex items-center gap-2.5">
                                        <SpeakerAvatar name={s.name} image={s.image} size={36} />
                                        <div>
                                            <p className="font-medium text-foreground">{s.name}</p>
                                            <p className="text-xs text-muted-foreground">{s.title ?? 'بلا منصب'} · الوعود: {s.promisesCount}</p>
                                        </div>
                                    </div>
                                    {canReview && (
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" className="gap-1" disabled={busy === s.id} onClick={() => act(s.id, `/api/v1/admin/promises/speakers/${s.id}/approve`, 'اعتُمد الشخص')}>
                                                <Check className="h-4 w-4" aria-hidden="true" />اعتماد
                                            </Button>
                                            <Button size="sm" variant="ghost" className="gap-1" disabled={busy === s.id} onClick={() => confirmThen(`رفض «${s.name}»؟`, () => act(s.id, `/api/v1/admin/promises/speakers/${s.id}/reject`, 'رُفض الشخص'))}>
                                                <X className="h-4 w-4 text-destructive" aria-hidden="true" />رفض
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {reports.length > 0 && (
                    <Card>
                        <CardHeader>
                            <h2 className="text-base font-semibold leading-none">تحديثات وبلاغات من الزوار ({reports.length})</h2>
                            <CardDescription>قبول تحديث يضيفه إلى سجل الوعد العام مع مصدره. قبول بلاغ خطأ يغلقه فقط؛ صحّح الوعد نفسه من صفحة التعديل.</CardDescription>
                        </CardHeader>
                        <CardContent className="divide-y divide-border">
                            {reports.map((r) => {
                                const key = `report-${r.id}`;
                                const source = safeHref(r.sourceUrl);
                                return (
                                    <div key={r.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                                        <div className="flex flex-wrap items-center gap-2 text-sm">
                                            <Badge variant={r.kind === 'error' ? 'destructive' : 'secondary'}>{r.kind === 'error' ? 'بلاغ خطأ' : 'تحديث'}</Badge>
                                            {canOpen ? (
                                                <Link href={`/admin/promises/${r.promise.id}/edit`} className="font-medium text-foreground hover:underline">
                                                    #{r.promise.number} — {r.promise.title}
                                                </Link>
                                            ) : (
                                                <span className="font-medium text-foreground">#{r.promise.number} — {r.promise.title}</span>
                                            )}
                                            <span className="text-xs text-muted-foreground">{r.userName} · {formatDate(r.createdOn)}</span>
                                        </div>
                                        <p className="whitespace-pre-line text-sm text-foreground">{r.body}</p>
                                        {source && (
                                            <a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-xs text-primary hover:underline" dir="ltr">
                                                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{source}
                                            </a>
                                        )}
                                        {canReview && (
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" className="gap-1" disabled={busy === key} onClick={() => act(key, `/api/v1/admin/promises/reports/${r.id}/accept`, r.kind === 'progress' ? 'أُضيف التحديث إلى السجل' : 'أُغلق البلاغ')}>
                                                    <Check className="h-4 w-4" aria-hidden="true" />{r.kind === 'progress' ? 'قبول وإضافة إلى السجل' : 'تمت المعالجة'}
                                                </Button>
                                                <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" disabled={busy === key} onClick={() => act(key, `/api/v1/admin/promises/reports/${r.id}/dismiss`, 'أُهمل')}>
                                                    <X className="h-4 w-4" aria-hidden="true" />إهمال
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                )}
            </div>
        </MainLayout>
    );
}
