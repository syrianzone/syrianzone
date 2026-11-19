import { useCallback, useEffect, useState } from 'react';
import { Link } from '@inertiajs/react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import {
    Check,
    ExternalLink,
    Inbox,
    Loader2,
    Pencil,
    RefreshCw,
    X,
} from 'lucide-react';
import { apiErrorMessage } from '@/Lib/api';
import { notify } from '@/Lib/notify';
import { cn } from '@/Lib/utils';
import { suggestionsApi } from '@/Domain/suggestions/api';
import type {
    DirectorySuggestionCounts,
    DirectorySuggestionItem,
    SuggestionModule,
    SuggestionStatus,
} from '@/Domain/suggestions/types';

type FilterStatus = SuggestionStatus | 'all';

const STATUS_TABS: ReadonlyArray<{ value: FilterStatus; label: string }> = [
    { value: 'pending', label: 'بانتظار المراجعة' },
    { value: 'accepted', label: 'تمت المعالجة' },
    { value: 'dismissed', label: 'مهمل' },
    { value: 'all', label: 'الكل' },
];

const PAYLOAD_LABELS: Record<string, string> = {
    role_title_ar: 'المنصب',
    institution_name_ar: 'الجهة',
    decree_ref: 'المرسوم / القرار',
    category_id: 'التصنيف',
    name_en: 'الاسم بالإنكليزية',
    account_url: 'رابط الحساب',
    official_url: 'الموقع الرسمي',
    android_url: 'Google Play',
    apple_url: 'App Store',
    number: 'الرقم',
    is_whatsapp: 'واتساب',
};

function safeExternalUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
    } catch {
        return null;
    }
}

function formatTimestamp(iso: string | null): string {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString('ar-SY', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

export interface SuggestionsReviewPanelProps {
    module: SuggestionModule;
    canReview: boolean;
    onPendingCountChange?: (count: number) => void;
    onEditTarget?: (targetId: string) => void;
}

export default function SuggestionsReviewPanel({
    module,
    canReview,
    onPendingCountChange,
    onEditTarget,
}: SuggestionsReviewPanelProps) {
    const [status, setStatus] = useState<FilterStatus>('pending');
    const [items, setItems] = useState<DirectorySuggestionItem[]>([]);
    const [counts, setCounts] = useState<DirectorySuggestionCounts>({
        pending: 0,
        accepted: 0,
        dismissed: 0,
        total: 0,
    });
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [notes, setNotes] = useState<Record<number, string>>({});

    const load = useCallback(
        async (targetStatus: FilterStatus = status) => {
            setLoading(true);
            try {
                const res = await suggestionsApi.list(module, targetStatus);
                setItems(res.suggestions);
                setCounts(res.counts);
                onPendingCountChange?.(res.counts.pending);
            } catch (err) {
                notify.error(apiErrorMessage(err, 'تعذّر تحميل الاقتراحات'));
            } finally {
                setLoading(false);
            }
        },
        [module, status, onPendingCountChange],
    );

    useEffect(() => {
        void load(status);
    }, [load, status]);

    const handleDecision = async (item: DirectorySuggestionItem, action: 'accept' | 'dismiss') => {
        setBusyId(item.id);
        try {
            const res = await suggestionsApi.review(module, item.id, action, notes[item.id]);
            notify.success(res.message);
            await load(status);
        } catch (err) {
            notify.error(apiErrorMessage(err, 'تعذّر تحديث حالة الاقتراح'));
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="space-y-4" dir="rtl">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="تصفية الاقتراحات حسب الحالة">
                    {STATUS_TABS.map((tab) => {
                        const count =
                            tab.value === 'all'
                                ? counts.total
                                : counts[tab.value];
                        const active = status === tab.value;
                        return (
                            <Button
                                key={tab.value}
                                type="button"
                                size="sm"
                                variant={active ? 'default' : 'outline'}
                                onClick={() => setStatus(tab.value)}
                                className="gap-1.5"
                            >
                                <span>{tab.label}</span>
                                <span
                                    dir="ltr"
                                    className={cn(
                                        'rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
                                        active
                                            ? 'bg-primary-foreground/20 text-primary-foreground'
                                            : 'bg-muted text-muted-foreground',
                                    )}
                                >
                                    {count}
                                </span>
                            </Button>
                        );
                    })}
                </div>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void load(status)}
                    disabled={loading}
                    className="gap-1.5"
                >
                    <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
                    تحديث
                </Button>
            </div>

            {loading ? (
                <Card>
                    <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        جاري تحميل الاقتراحات...
                    </CardContent>
                </Card>
            ) : items.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                        <Inbox className="h-9 w-9 text-muted-foreground/70" aria-hidden="true" />
                        <p className="font-semibold text-foreground">
                            لا توجد اقتراحات في هذه القائمة
                        </p>
                        <p className="text-xs text-muted-foreground">
                            ستظهر هنا إضافات واقتراحات التعديل المرسلة من الزوار لمراجعتها.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {items.map((item) => {
                        const sourceHref = safeExternalUrl(item.source_url);
                        const payloadEntries = Object.entries(item.payload ?? {}).filter(
                            ([, val]) => val !== null && val !== undefined && val !== '',
                        );
                        const isBusy = busyId === item.id;

                        return (
                            <Card key={item.id}>
                                <CardContent className="space-y-3 p-4 sm:p-5">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <Badge
                                                    variant={
                                                        item.kind === 'add'
                                                            ? 'default'
                                                            : 'secondary'
                                                    }
                                                >
                                                    {item.kind === 'add'
                                                        ? 'إضافة جديدة'
                                                        : 'اقتراح تعديل'}
                                                </Badge>
                                                {item.status === 'accepted' && (
                                                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                                                        تمت المعالجة
                                                    </Badge>
                                                )}
                                                {item.status === 'dismissed' && (
                                                    <Badge variant="outline">مهمل</Badge>
                                                )}
                                                <span className="text-xs text-muted-foreground">
                                                    بواسطة <strong className="font-medium text-foreground">{item.submitter_name}</strong>
                                                    {item.created_at && ` · ${formatTimestamp(item.created_at)}`}
                                                </span>
                                            </div>
                                            <h3 className="text-base font-bold text-foreground">
                                                {item.title}
                                            </h3>
                                            {item.target_label && (
                                                <p className="text-xs text-muted-foreground">
                                                    العنصر المرتبط:{' '}
                                                    <span className="font-semibold text-foreground">
                                                        {item.target_label}
                                                    </span>
                                                </p>
                                            )}
                                        </div>

                                        {item.target_id && (
                                            onEditTarget ? (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1.5"
                                                    onClick={() => onEditTarget(item.target_id!)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                                    فتح للتعديل
                                                </Button>
                                            ) : item.target_edit_url ? (
                                                <Button asChild variant="outline" size="sm" className="gap-1.5">
                                                    <Link href={item.target_edit_url}>
                                                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                                        فتح للتعديل
                                                    </Link>
                                                </Button>
                                            ) : null
                                        )}
                                    </div>

                                    {payloadEntries.length > 0 && (
                                        <div className="flex flex-wrap gap-2 rounded-lg border border-border/70 bg-muted/30 p-3 text-xs">
                                            {payloadEntries.map(([key, val]) => {
                                                const label = PAYLOAD_LABELS[key] ?? key;
                                                const displayVal =
                                                    typeof val === 'boolean'
                                                        ? val
                                                            ? 'نعم'
                                                            : 'لا'
                                                        : String(val);
                                                const href =
                                                    typeof val === 'string' && key.endsWith('_url')
                                                        ? safeExternalUrl(val)
                                                        : null;
                                                return (
                                                    <span
                                                        key={key}
                                                        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1"
                                                    >
                                                        <span className="text-muted-foreground">
                                                            {label}:
                                                        </span>
                                                        {href ? (
                                                            <a
                                                                href={href}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                dir="ltr"
                                                                className="max-w-[220px] truncate font-medium text-primary hover:underline"
                                                            >
                                                                {displayVal}
                                                            </a>
                                                        ) : (
                                                            <span
                                                                dir={key === 'number' || key === 'name_en' ? 'ltr' : undefined}
                                                                className="font-medium text-foreground"
                                                            >
                                                                {displayVal}
                                                            </span>
                                                        )}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                                        {item.details}
                                    </p>

                                    {sourceHref && (
                                        <div>
                                            <a
                                                href={sourceHref}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                                <span dir="ltr" className="max-w-md truncate">
                                                    {sourceHref}
                                                </span>
                                            </a>
                                        </div>
                                    )}

                                    {item.status === 'pending' && canReview ? (
                                        <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center">
                                            <Input
                                                value={notes[item.id] ?? ''}
                                                onChange={(e) =>
                                                    setNotes((prev) => ({
                                                        ...prev,
                                                        [item.id]: e.target.value,
                                                    }))
                                                }
                                                placeholder="ملاحظة تحريرية داخلية (اختياري)..."
                                                className="h-9 flex-1 text-xs"
                                                maxLength={1000}
                                            />
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    disabled={isBusy}
                                                    onClick={() => void handleDecision(item, 'accept')}
                                                    className="gap-1.5"
                                                >
                                                    {isBusy ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                                    ) : (
                                                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                                    )}
                                                    تمت المعالجة
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={isBusy}
                                                    onClick={() => void handleDecision(item, 'dismiss')}
                                                    className="gap-1.5"
                                                >
                                                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                                                    إهمال
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        item.reviewer_name && (
                                            <div className="border-t border-border pt-2.5 text-xs text-muted-foreground">
                                                راجعه <strong className="font-medium text-foreground">{item.reviewer_name}</strong>
                                                {item.reviewed_at && ` · ${formatTimestamp(item.reviewed_at)}`}
                                                {item.resolution_note && ` — ${item.resolution_note}`}
                                            </div>
                                        )
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
