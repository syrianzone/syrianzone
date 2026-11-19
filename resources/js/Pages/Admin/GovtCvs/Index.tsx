import { useEffect, useMemo, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import SuggestionsReviewPanel from '@/Domain/suggestions/SuggestionsReviewPanel';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { FilterChip } from '@/Components/ui/filter-chip';
import { Input } from '@/Components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import {
    Archive,
    ExternalLink,
    MessageSquarePlus,
    Pencil,
    Plus,
    Search,
    Trash2,
    Upload,
} from 'lucide-react';
import { normalizeArabic } from '@/Lib/arabic';
import { notify } from '@/Lib/notify';
import { confirmDialog } from '@/Lib/confirm';
import { apiErrorMessage } from '@/Lib/api';
import { useCan } from '@/Lib/useCan';
import { govtCvsApi } from '@/Domain/govtcvs/api';
import OfficialAvatar from '@/Domain/govtcvs/OfficialAvatar';
import {
    CvCompletenessBadge,
    OfficeStatusBadge,
    PublishStatusBadge,
    TierBadge,
} from '@/Domain/govtcvs/StatusBadges';
import {
    CV_COMPLETENESS_META,
    OFFICE_STATUS_META,
    PUBLISH_STATUS_META,
    TIER_LABELS,
    TIER_META,
} from '@/Domain/govtcvs/constants';
import type { GovtOfficialSummary } from '@/Domain/govtcvs/types';
import AdminHeader from './_components/AdminHeader';

const ALL = 'all';

interface Props {
    officials: GovtOfficialSummary[];
    pendingSuggestionsCount?: number;
}

export default function GovtCvsAdminIndex({
    officials = [],
    pendingSuggestionsCount: initialPendingSuggestionsCount = 0,
}: Props) {
    const can = useCan() as (cap: string) => boolean;
    const canCreate = can('govtcvs.create');
    const canEdit = can('govtcvs.edit');
    const canPublish = can('govtcvs.publish');
    const canDelete = can('govtcvs.delete');

    const [activeTab, setActiveTab] = useState<'officials' | 'suggestions'>('officials');
    const [pendingSuggestionsCount, setPendingSuggestionsCount] = useState<number>(
        initialPendingSuggestionsCount,
    );
    const [q, setQ] = useState('');
    const [publishFilter, setPublishFilter] = useState<string>(ALL);
    const [officeFilter, setOfficeFilter] = useState<string>(ALL);
    const [tierFilter, setTierFilter] = useState<string>(ALL);
    const [completenessFilter, setCompletenessFilter] = useState<string>(ALL);
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => {
        setPendingSuggestionsCount(initialPendingSuggestionsCount);
    }, [initialPendingSuggestionsCount]);

    const publishCounts = useMemo(
        () => ({
            all: officials.length,
            published: officials.filter((o) => o.publish_status === 'published').length,
            draft: officials.filter((o) => o.publish_status === 'draft').length,
            archived: officials.filter((o) => o.publish_status === 'archived').length,
        }),
        [officials],
    );

    const visible = useMemo(() => {
        const needle = normalizeArabic(q);
        return officials.filter((o) => {
            if (publishFilter !== ALL && o.publish_status !== publishFilter) return false;
            if (officeFilter !== ALL && o.office_status !== officeFilter) return false;
            if (tierFilter !== ALL && o.highest_tier !== tierFilter) return false;
            if (completenessFilter !== ALL && o.cv_completeness !== completenessFilter) {
                return false;
            }
            if (needle) {
                const activeTenure = o.current_tenure ?? o.latest_tenure;
                const haystack = normalizeArabic(
                    [
                        o.full_name_ar,
                        o.display_name_ar,
                        o.full_name_en,
                        o.slug,
                        activeTenure?.role_title_ar,
                        activeTenure?.institution_name_ar,
                    ]
                        .filter(Boolean)
                        .join(' '),
                );
                if (!haystack.includes(needle)) return false;
            }
            return true;
        });
    }, [officials, q, publishFilter, officeFilter, tierFilter, completenessFilter]);

    const runAction = async (
        official: GovtOfficialSummary,
        action: () => Promise<unknown>,
        successMessage: string,
    ) => {
        setBusyId(official.id);
        try {
            await action();
            notify.success(successMessage);
            router.reload({ only: ['officials'] });
        } catch (err) {
            notify.error(apiErrorMessage(err, 'تعذّر تنفيذ العملية'));
        } finally {
            setBusyId(null);
        }
    };

    const togglePublish = async (official: GovtOfficialSummary) => {
        const nextStatus = official.publish_status === 'published' ? 'archived' : 'published';
        if (nextStatus === 'archived') {
            const ok = await confirmDialog({
                title: `أرشفة ملف «${official.display_name_ar || official.full_name_ar}»؟`,
                description: 'سيختفي الملف من الدليل العام ويمكن إعادة نشره في أي وقت.',
                confirmText: 'أرشفة',
            });
            if (!ok) return;
        }
        await runAction(
            official,
            () => govtCvsApi.publishOfficial(official.id, nextStatus),
            nextStatus === 'published' ? 'نُشر ملف المسؤول' : 'أُرشف ملف المسؤول',
        );
    };

    const removeOfficial = async (official: GovtOfficialSummary) => {
        const ok = await confirmDialog({
            title: `حذف ملف «${official.display_name_ar || official.full_name_ar}» نهائياً؟`,
            description:
                'سيُحذف المسؤول وجميع مناصبه وبنود سيرته الذاتية ومصادره المرتبطة. لا يمكن التراجع عن هذا الإجراء.',
            destructive: true,
            confirmText: 'حذف نهائي',
        });
        if (!ok) return;
        await runAction(official, () => govtCvsApi.deleteOfficial(official.id), 'حُذف ملف المسؤول');
    };

    return (
        <MainLayout>
            <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8" dir="rtl">
                <AdminHeader
                    title="إدارة السير الذاتية للمسؤولين"
                    current="officials"
                    actions={
                        canCreate && (
                            <Button asChild className="gap-2">
                                <Link href="/admin/govtcvs/new">
                                    <Plus className="h-4 w-4" aria-hidden="true" />
                                    إضافة مسؤول
                                </Link>
                            </Button>
                        )
                    }
                />

                <Tabs
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as 'officials' | 'suggestions')}
                    dir="rtl"
                    className="space-y-4"
                >
                    <TabsList>
                        <TabsTrigger value="officials" className="gap-1.5">
                            المسؤولون
                            <Badge
                                variant="secondary"
                                className="px-1.5 py-0 text-[11px] tabular-nums"
                                dir="ltr"
                            >
                                {officials.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="suggestions" className="gap-1.5">
                            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
                            الاقتراحات
                            {pendingSuggestionsCount > 0 && (
                                <Badge className="px-1.5 py-0 text-[11px] tabular-nums" dir="ltr">
                                    {pendingSuggestionsCount}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="officials" className="mt-0">
                        <Card>
                    <CardContent className="space-y-4 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div
                                className="flex flex-wrap gap-2"
                                role="group"
                                aria-label="تصفية حسب حالة النشر"
                            >
                                <FilterChip
                                    active={publishFilter === ALL}
                                    onClick={() => setPublishFilter(ALL)}
                                >
                                    الكل (<span dir="ltr" className="tabular-nums">{publishCounts.all}</span>)
                                </FilterChip>
                                {(['published', 'draft', 'archived'] as const).map((key) => (
                                    <FilterChip
                                        key={key}
                                        active={publishFilter === key}
                                        onClick={() => setPublishFilter(key)}
                                    >
                                        {PUBLISH_STATUS_META[key].label} (
                                        <span dir="ltr" className="tabular-nums">
                                            {publishCounts[key]}
                                        </span>
                                        )
                                    </FilterChip>
                                ))}
                            </div>

                            <div className="relative w-full sm:w-72">
                                <Search
                                    className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <Input
                                    aria-label="بحث في المسؤولين"
                                    placeholder="الاسم أو المنصب أو المعرّف..."
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    className="ps-9"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                            <Select value={officeFilter} onValueChange={setOfficeFilter}>
                                <SelectTrigger
                                    aria-label="تصفية حسب حالة المنصب"
                                    className="h-9 w-full sm:w-44"
                                >
                                    <SelectValue placeholder="حالة المنصب" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>كل حالات المنصب</SelectItem>
                                    {Object.values(OFFICE_STATUS_META).map((item) => (
                                        <SelectItem key={item.key} value={item.key}>
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={tierFilter} onValueChange={setTierFilter}>
                                <SelectTrigger
                                    aria-label="تصفية حسب المستوى الوظيفي"
                                    className="h-9 w-full sm:w-48"
                                >
                                    <SelectValue placeholder="المستوى الوظيفي" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>كل المستويات الوظيفية</SelectItem>
                                    {Object.values(TIER_META).map((item) => (
                                        <SelectItem key={item.key} value={item.key}>
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select
                                value={completenessFilter}
                                onValueChange={setCompletenessFilter}
                            >
                                <SelectTrigger
                                    aria-label="تصفية حسب اكتمال السيرة"
                                    className="h-9 w-full sm:w-44"
                                >
                                    <SelectValue placeholder="اكتمال السيرة" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>كل مستويات التوثيق</SelectItem>
                                    {Object.values(CV_COMPLETENESS_META).map((item) => (
                                        <SelectItem key={item.key} value={item.key}>
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>المسؤول</TableHead>
                                        <TableHead>المنصب الحالي / الأخير</TableHead>
                                        <TableHead>المستوى</TableHead>
                                        <TableHead>الحالة</TableHead>
                                        <TableHead>السيرة</TableHead>
                                        <TableHead>النشر</TableHead>
                                        <TableHead className="w-28 whitespace-nowrap">المناصب / السيرة</TableHead>
                                        <TableHead className="w-36">إجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {visible.length === 0 && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={8}
                                                className="py-10 text-center text-muted-foreground"
                                            >
                                                لا توجد سجلات تطابق التصفية الحالية.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {visible.map((official) => {
                                        const activeTenure =
                                            official.current_tenure ?? official.latest_tenure;
                                        const roleTitle =
                                            activeTenure?.role_title_ar ??
                                            TIER_LABELS[official.highest_tier] ??
                                            '—';
                                        const displayName =
                                            official.display_name_ar || official.full_name_ar;

                                        return (
                                            <TableRow key={official.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2.5">
                                                        <OfficialAvatar
                                                            name={displayName}
                                                            portraitUrl={official.portrait_url}
                                                            resolvedPortraitUrl={
                                                                official.resolved_portrait_url
                                                            }
                                                            size={36}
                                                        />
                                                        <div>
                                                            <p className="font-semibold text-foreground">
                                                                {[official.honorific_ar, displayName]
                                                                    .filter(Boolean)
                                                                    .join(' ')}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                <span dir="ltr">{official.slug}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <p className="text-sm font-medium text-foreground">
                                                        {roleTitle}
                                                    </p>
                                                    {activeTenure?.institution_name_ar && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {activeTenure.institution_name_ar}
                                                        </p>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <TierBadge tier={official.highest_tier} short />
                                                </TableCell>
                                                <TableCell>
                                                    <OfficeStatusBadge
                                                        status={official.office_status}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <CvCompletenessBadge
                                                        completeness={official.cv_completeness}
                                                        short
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <PublishStatusBadge
                                                        status={official.publish_status}
                                                    />
                                                </TableCell>
                                                <TableCell className="tabular-nums text-xs text-muted-foreground">
                                                    <span dir="ltr">
                                                        {official.tenures_count} / {official.cv_entries_count}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        {official.publish_status === 'published' && (
                                                            <Button
                                                                asChild
                                                                variant="ghost"
                                                                size="icon"
                                                                aria-label={`عرض ملف «${displayName}» في الصفحة العامة`}
                                                                title="عرض في الصفحة العامة"
                                                            >
                                                                <a
                                                                    href={`/govtcvs/${official.slug}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                >
                                                                    <ExternalLink
                                                                        className="h-4 w-4"
                                                                        aria-hidden="true"
                                                                    />
                                                                </a>
                                                            </Button>
                                                        )}

                                                        {canEdit && (
                                                            <Button
                                                                asChild
                                                                variant="ghost"
                                                                size="icon"
                                                                aria-label={`تعديل ملف «${displayName}»`}
                                                                title="تعديل"
                                                            >
                                                                <Link
                                                                    href={`/admin/govtcvs/officials/${official.id}`}
                                                                >
                                                                    <Pencil
                                                                        className="h-4 w-4"
                                                                        aria-hidden="true"
                                                                    />
                                                                </Link>
                                                            </Button>
                                                        )}

                                                        {canPublish && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                disabled={busyId === official.id}
                                                                onClick={() => togglePublish(official)}
                                                                aria-label={
                                                                    official.publish_status ===
                                                                    'published'
                                                                        ? `أرشفة ملف «${displayName}»`
                                                                        : `نشر ملف «${displayName}»`
                                                                }
                                                                title={
                                                                    official.publish_status ===
                                                                    'published'
                                                                        ? 'أرشفة'
                                                                        : 'نشر'
                                                                }
                                                            >
                                                                {official.publish_status ===
                                                                'published' ? (
                                                                    <Archive
                                                                        className="h-4 w-4"
                                                                        aria-hidden="true"
                                                                    />
                                                                ) : (
                                                                    <Upload
                                                                        className="h-4 w-4"
                                                                        aria-hidden="true"
                                                                    />
                                                                )}
                                                            </Button>
                                                        )}

                                                        {canDelete && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-destructive"
                                                                disabled={busyId === official.id}
                                                                onClick={() => removeOfficial(official)}
                                                                aria-label={`حذف ملف «${displayName}»`}
                                                                title="حذف"
                                                            >
                                                                <Trash2
                                                                    className="h-4 w-4"
                                                                    aria-hidden="true"
                                                                />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="suggestions" className="mt-0">
                        <SuggestionsReviewPanel
                            module="govtcvs"
                            canReview={canEdit}
                            onPendingCountChange={setPendingSuggestionsCount}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </MainLayout>
    );
}
