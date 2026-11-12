import { useMemo, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import axios from '@/Lib/axios';
import MainLayout from '@/Layouts/MainLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { FilterChip } from '@/Components/ui/filter-chip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { EyeOff, ExternalLink, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { normalizeArabic } from '@/Lib/arabic';
import { notify } from '@/Lib/notify';
import { confirmDialog } from '@/Lib/confirm';
import { extractApiErrorMessage } from '@/Lib/apiError';
import StateBadge from '@/Domain/promises/StateBadge';
import { formatDate } from '@/Domain/promises/format';
import { PENDING_SPEAKER_LABEL } from '@/Domain/promises/status';
import AdminHeader from './_components/AdminHeader';
import { useCan } from '@/Lib/useCan';
import { ORIGIN_LABEL, REVIEW_STATUS_LABEL, type AdminPromiseRow, type ReviewStatus } from './_lib/types';

interface Props {
    promises: AdminPromiseRow[];
    queueCount: number;
}

type ReviewFilter = 'all' | ReviewStatus;

export default function PromisesAdminIndex({ promises, queueCount }: Props) {
    const can = useCan();
    const canCreate = can('promises.create');
    // The editor opens for anyone who edits, rules on or reviews promises.
    const canOpen = can('promises.edit') || can('promises.rule') || can('promises.review');
    const canReview = can('promises.review');
    const canDelete = can('promises.delete');

    const [filter, setFilter] = useState<ReviewFilter>('all');
    const [q, setQ] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);

    const counts = useMemo(() => ({
        all: promises.length,
        published: promises.filter((p) => p.reviewStatus === 'published').length,
        pending: promises.filter((p) => p.reviewStatus === 'pending').length,
        rejected: promises.filter((p) => p.reviewStatus === 'rejected').length,
    }), [promises]);

    const visible = useMemo(() => {
        const needle = normalizeArabic(q);
        return promises.filter((p) => {
            if (filter !== 'all' && p.reviewStatus !== filter) return false;
            if (needle && !normalizeArabic(`${p.title} ${p.speakerName ?? ''} ${p.number ?? ''}`).includes(needle)) return false;
            return true;
        });
    }, [promises, filter, q]);

    const run = async (p: AdminPromiseRow, action: () => Promise<unknown>, success: string) => {
        setBusyId(p.id);
        try {
            await action();
            notify.success(success);
            router.reload({ only: ['promises', 'queueCount'] });
        } catch (e) {
            notify.error(extractApiErrorMessage(e, 'تعذّر تنفيذ العملية'));
        } finally {
            setBusyId(null);
        }
    };

    const publish = (p: AdminPromiseRow) => run(p, () => axios.post(`/api/v1/admin/promises/${p.id}/publish`), 'نُشر الوعد');

    const unpublish = async (p: AdminPromiseRow) => {
        const ok = await confirmDialog({
            title: `إخفاء الوعد رقم ${p.number}؟`,
            description: 'سيختفي من الصفحة العامة ويحتفظ برقمه، ويمكن نشره من جديد لاحقاً.',
            confirmText: 'إخفاء',
        });
        if (ok) run(p, () => axios.post(`/api/v1/admin/promises/${p.id}/unpublish`), 'أُخفي الوعد');
    };

    const remove = async (p: AdminPromiseRow) => {
        const ok = await confirmDialog({
            title: `حذف «${p.title}»؟`,
            description: 'سيُحذف الوعد ومصادره وسجله. لا يمكن التراجع من لوحة التحكم.',
            destructive: true,
            confirmText: 'حذف',
        });
        if (ok) run(p, () => axios.delete(`/api/v1/admin/promises/${p.id}`), 'حُذف الوعد');
    };

    return (
        <MainLayout>
            <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8" dir="rtl">
                <AdminHeader
                    title="إدارة عداد الوعود"
                    current="promises"
                    queueCount={queueCount}
                    actions={canCreate && (
                        <Button asChild className="gap-2">
                            <Link href="/admin/promises/new"><Plus className="h-4 w-4" aria-hidden="true" />إضافة وعد</Link>
                        </Button>
                    )}
                />

                <Card>
                    <CardContent className="space-y-4 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-2" role="group" aria-label="تصفية حسب حالة النشر">
                                <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>الكل ({counts.all})</FilterChip>
                                {(['published', 'pending', 'rejected'] as const).map((k) => (
                                    <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)}>
                                        {REVIEW_STATUS_LABEL[k]} ({counts[k]})
                                    </FilterChip>
                                ))}
                            </div>
                            <div className="relative w-full sm:w-72">
                                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                                <Input aria-label="بحث" placeholder="العنوان أو الاسم أو الرقم..." value={q} onChange={(e) => setQ(e.target.value)} className="ps-9" />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-14">الرقم</TableHead>
                                        <TableHead>الوعد</TableHead>
                                        <TableHead>الحالة</TableHead>
                                        <TableHead>النشر</TableHead>
                                        <TableHead>الموعد</TableHead>
                                        <TableHead className="w-16">المصادر</TableHead>
                                        <TableHead className="w-40">إجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {visible.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">لا توجد وعود هنا بعد.</TableCell>
                                        </TableRow>
                                    )}
                                    {visible.map((p) => (
                                        <TableRow key={p.id}>
                                            <TableCell className="tabular-nums text-muted-foreground">{p.number ?? '—'}</TableCell>
                                            <TableCell>
                                                <p className="font-medium text-foreground">{p.title}</p>
                                                <div className="text-xs text-muted-foreground">
                                                    {p.speakerName}
                                                    {p.speakerPending && <Badge variant="outline" className="ms-1.5 text-[10px]">{PENDING_SPEAKER_LABEL}</Badge>}
                                                    {' · '}{ORIGIN_LABEL[p.origin] ?? p.origin}
                                                    {p.pendingReportsCount > 0 && (
                                                        <Badge variant="destructive" className="ms-1.5 text-[10px]">بلاغات: {p.pendingReportsCount}</Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell><StateBadge state={p.state} /></TableCell>
                                            <TableCell>
                                                <Badge variant={p.reviewStatus === 'published' ? 'secondary' : 'outline'}>{REVIEW_STATUS_LABEL[p.reviewStatus]}</Badge>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{p.deadlineDate ? formatDate(p.deadlineDate) : 'بلا موعد'}</TableCell>
                                            <TableCell className="tabular-nums">{p.sourcesCount}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    {p.reviewStatus === 'published' && p.number && (
                                                        <Button asChild variant="ghost" size="icon" aria-label={`عرض «${p.title}» في الصفحة العامة`}>
                                                            <a href={`/promises/${p.number}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
                                                        </Button>
                                                    )}
                                                    {canOpen && (
                                                        <Button asChild variant="ghost" size="icon" aria-label={`فتح «${p.title}»`}>
                                                            <Link href={`/admin/promises/${p.id}/edit`}><Pencil className="h-4 w-4" aria-hidden="true" /></Link>
                                                        </Button>
                                                    )}
                                                    {canReview && p.reviewStatus !== 'published' && (
                                                        <Button variant="ghost" size="icon" disabled={busyId === p.id} onClick={() => publish(p)} aria-label={`نشر «${p.title}»`}>
                                                            <Upload className="h-4 w-4" aria-hidden="true" />
                                                        </Button>
                                                    )}
                                                    {canReview && p.reviewStatus === 'published' && (
                                                        <Button variant="ghost" size="icon" disabled={busyId === p.id} onClick={() => unpublish(p)} aria-label={`إخفاء «${p.title}»`}>
                                                            <EyeOff className="h-4 w-4" aria-hidden="true" />
                                                        </Button>
                                                    )}
                                                    {canDelete && (
                                                        <Button variant="ghost" size="icon" className="text-destructive" disabled={busyId === p.id} onClick={() => remove(p)} aria-label={`حذف «${p.title}»`}>
                                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
