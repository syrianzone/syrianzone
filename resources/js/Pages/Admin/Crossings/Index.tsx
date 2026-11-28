import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Edit, MapPin, Plus, RotateCcw, Trash2 } from 'lucide-react';
import AdminLayout from '@/Components/admin/AdminLayout';
import DirectoryEmptyState from '@/Components/directory/DirectoryEmptyState';
import DirectoryResultCount from '@/Components/directory/DirectoryResultCount';
import { DirectorySearch } from '@/Components/directory/DirectorySearch';
import { ResponsiveTable } from '@/Components/directory/ResponsiveTable';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import FieldError, { fieldA11y } from '@/Components/ui/field-error';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/Components/ui/select';
import { Switch } from '@/Components/ui/switch';
import { TableCell, TableHead, TableRow } from '@/Components/ui/table';
import { Textarea } from '@/Components/ui/textarea';
import {
    crossingsAdminApi,
    type AdminCrossing,
    type CrossingPayload,
    type CrossingStatus,
    type CrossingType,
} from '@/Domain/civicAdmin/api';
import { apiErrorMessage, apiFieldErrors } from '@/Lib/api';
import { confirmDialog } from '@/Lib/confirm';
import { notify } from '@/Lib/notify';

interface CrossingsAdminIndexProps {
    crossings: AdminCrossing[];
}

interface CrossingFormState {
    name_ar: string;
    name_en: string;
    slug: string;
    country: string;
    governorate: string;
    type: CrossingType;
    status: CrossingStatus;
    hours_ar: string;
    notes_ar: string;
    phone: string;
    lat: string;
    lng: string;
    sort_order: string;
    is_active: boolean;
}

const TYPE_LABELS: Record<CrossingType, string> = {
    crossing: 'معبر حدودي',
    port: 'ميناء / منفذ',
};

const STATUS_LABELS: Record<CrossingStatus, string> = {
    open: 'مفتوح',
    closed: 'مغلق',
    opening_soon: 'يُفتح قريباً',
    unknown: 'غير محدد',
};

const STATUS_VARIANTS: Record<CrossingStatus, 'success' | 'destructive' | 'warning' | 'secondary'> = {
    open: 'success',
    closed: 'destructive',
    opening_soon: 'warning',
    unknown: 'secondary',
};

const EMPTY_FORM: CrossingFormState = {
    name_ar: '',
    name_en: '',
    slug: '',
    country: '',
    governorate: '',
    type: 'crossing',
    status: 'open',
    hours_ar: '',
    notes_ar: '',
    phone: '',
    lat: '',
    lng: '',
    sort_order: '',
    is_active: true,
};

function sortCrossings(items: AdminCrossing[]): AdminCrossing[] {
    return [...items].sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id));
}

export default function CrossingsAdminIndex({ crossings: initialCrossings }: CrossingsAdminIndexProps) {
    const [crossings, setCrossings] = useState<AdminCrossing[]>(() => sortCrossings(initialCrossings));
    const [query, setQuery] = useState('');
    const [countryFilter, setCountryFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState<'all' | CrossingType>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | CrossingStatus>('all');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<AdminCrossing | null>(null);
    const [form, setForm] = useState<CrossingFormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        setCrossings(sortCrossings(initialCrossings));
    }, [initialCrossings]);

    useEffect(() => {
        if (Object.keys(errors).length === 0) return;
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }, [errors]);

    const countries = useMemo(() => {
        const unique = new Set<string>();
        for (const item of crossings) {
            if (item.country?.trim()) unique.add(item.country.trim());
        }
        return Array.from(unique).sort((a, b) => a.localeCompare(b, 'ar'));
    }, [crossings]);

    const isFiltered = query.trim() !== '' || countryFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all';

    const filteredCrossings = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return crossings.filter((item) => {
            if (countryFilter !== 'all' && (item.country?.trim() ?? '') !== countryFilter) return false;
            if (typeFilter !== 'all' && item.type !== typeFilter) return false;
            if (statusFilter !== 'all' && item.status !== statusFilter) return false;
            if (!needle) return true;
            const haystack = [
                item.name_ar,
                item.name_en,
                item.slug,
                item.country,
                item.governorate,
                item.phone,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(needle);
        });
    }, [crossings, query, countryFilter, typeFilter, statusFilter]);

    const clearFilters = () => {
        setQuery('');
        setCountryFilter('all');
        setTypeFilter('all');
        setStatusFilter('all');
    };

    const openCreate = () => {
        setEditing(null);
        setErrors({});
        const nextSort = crossings.reduce((max, item) => Math.max(max, item.sort_order), 0) + 1;
        setForm({ ...EMPTY_FORM, sort_order: String(nextSort) });
        setDialogOpen(true);
    };

    const openEdit = (item: AdminCrossing) => {
        setEditing(item);
        setErrors({});
        setForm({
            name_ar: item.name_ar,
            name_en: item.name_en ?? '',
            slug: item.slug,
            country: item.country ?? '',
            governorate: item.governorate ?? '',
            type: item.type,
            status: item.status,
            hours_ar: item.hours_ar ?? '',
            notes_ar: item.notes_ar ?? '',
            phone: item.phone ?? '',
            lat: item.lat !== null && item.lat !== undefined ? String(item.lat) : '',
            lng: item.lng !== null && item.lng !== undefined ? String(item.lng) : '',
            sort_order: String(item.sort_order),
            is_active: item.is_active,
        });
        setDialogOpen(true);
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const clientErrors: Record<string, string> = {};

        const trimmedName = form.name_ar.trim();
        if (!trimmedName) {
            clientErrors.name_ar = 'الاسم بالعربية مطلوب';
        }

        const trimmedSlug = form.slug.trim();
        if (trimmedSlug && !/^[a-z0-9-]+$/.test(trimmedSlug)) {
            clientErrors.slug = 'المعرف يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط';
        }

        let lat: number | null = null;
        if (form.lat.trim() !== '') {
            const parsed = Number(form.lat.trim());
            if (!Number.isFinite(parsed) || parsed < -90 || parsed > 90) {
                clientErrors.lat = 'خط العرض يجب أن يكون رقماً بين -90 و 90';
            } else {
                lat = parsed;
            }
        }

        let lng: number | null = null;
        if (form.lng.trim() !== '') {
            const parsed = Number(form.lng.trim());
            if (!Number.isFinite(parsed) || parsed < -180 || parsed > 180) {
                clientErrors.lng = 'خط الطول يجب أن يكون رقماً بين -180 و 180';
            } else {
                lng = parsed;
            }
        }

        let sortOrder: number | undefined;
        if (form.sort_order.trim() !== '') {
            const parsed = Number(form.sort_order.trim());
            if (!Number.isInteger(parsed) || parsed < 0) {
                clientErrors.sort_order = 'الترتيب يجب أن يكون عدداً صحيحاً غير سالب';
            } else {
                sortOrder = parsed;
            }
        }

        if (Object.keys(clientErrors).length > 0) {
            setErrors(clientErrors);
            return;
        }

        const payload: CrossingPayload = {
            name_ar: trimmedName,
            name_en: form.name_en.trim() || null,
            country: form.country.trim() || null,
            governorate: form.governorate.trim() || null,
            type: form.type,
            status: form.status,
            hours_ar: form.hours_ar.trim() || null,
            notes_ar: form.notes_ar.trim() || null,
            phone: form.phone.trim() || null,
            lat,
            lng,
            is_active: form.is_active,
        };

        if (trimmedSlug) {
            payload.slug = trimmedSlug;
        }
        if (sortOrder !== undefined) {
            payload.sort_order = sortOrder;
        }

        setSaving(true);
        setErrors({});
        try {
            if (editing) {
                const { crossing } = await crossingsAdminApi.update(editing.id, payload);
                setCrossings((prev) => sortCrossings(prev.map((c) => (c.id === crossing.id ? crossing : c))));
                notify.success('تم تحديث المعبر بنجاح');
            } else {
                const { crossing } = await crossingsAdminApi.create(payload);
                setCrossings((prev) => sortCrossings([...prev, crossing]));
                notify.success('تمت إضافة المعبر بنجاح');
            }
            setDialogOpen(false);
        } catch (err) {
            const fieldErrors = apiFieldErrors(err, { arabicOnly: true });
            if (Object.keys(fieldErrors).length > 0) {
                setErrors(fieldErrors);
            }
            notify.error(apiErrorMessage(err, 'تعذّر حفظ بيانات المعبر'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item: AdminCrossing) => {
        const confirmed = await confirmDialog({
            title: `حذف المعبر «${item.name_ar}»؟`,
            description: 'سيتم حذف هذا المعبر نهائياً من قاعدة البيانات وإزالته من الصفحة العامة.',
            confirmText: 'حذف',
            cancelText: 'إلغاء',
            destructive: true,
        });
        if (!confirmed) return;

        setDeletingId(item.id);
        try {
            await crossingsAdminApi.remove(item.id);
            setCrossings((prev) => prev.filter((c) => c.id !== item.id));
            notify.success('تم حذف المعبر');
        } catch (err) {
            notify.error(apiErrorMessage(err, 'تعذّر حذف المعبر'));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <AdminLayout
            title="إدارة المعابر والمنافذ"
            subtitle="إضافة وتعديل المعابر الحدودية والموانئ وحالتها وساعات العمل."
            activeSection="crossings"
            publicHref="/crossings"
            publicLabel="عرض الصفحة العامة"
            actions={(
                <Button type="button" onClick={openCreate}>
                    <Plus className="h-4 w-4 me-1.5" aria-hidden="true" />
                    إضافة معبر
                </Button>
            )}
        >
            <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="flex-1">
                        <DirectorySearch
                            value={query}
                            onChange={setQuery}
                            placeholder="ابحث بالاسم أو الدولة أو المحافظة أو المعرّف..."
                            ariaLabel="بحث في المعابر"
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:items-center">
                        <Select value={countryFilter} onValueChange={setCountryFilter}>
                            <SelectTrigger className="w-full lg:w-40" aria-label="تصفية حسب الدولة">
                                <SelectValue placeholder="كل الدول" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الدول</SelectItem>
                                {countries.map((country) => (
                                    <SelectItem key={country} value={country}>
                                        {country}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={typeFilter}
                            onValueChange={(value) => setTypeFilter(value as 'all' | CrossingType)}
                        >
                            <SelectTrigger className="w-full lg:w-36" aria-label="تصفية حسب النوع">
                                <SelectValue placeholder="كل الأنواع" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الأنواع</SelectItem>
                                <SelectItem value="crossing">{TYPE_LABELS.crossing}</SelectItem>
                                <SelectItem value="port">{TYPE_LABELS.port}</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select
                            value={statusFilter}
                            onValueChange={(value) => setStatusFilter(value as 'all' | CrossingStatus)}
                        >
                            <SelectTrigger className="w-full lg:w-36" aria-label="تصفية حسب الحالة">
                                <SelectValue placeholder="كل الحالات" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الحالات</SelectItem>
                                <SelectItem value="open">{STATUS_LABELS.open}</SelectItem>
                                <SelectItem value="closed">{STATUS_LABELS.closed}</SelectItem>
                                <SelectItem value="opening_soon">{STATUS_LABELS.opening_soon}</SelectItem>
                                <SelectItem value="unknown">{STATUS_LABELS.unknown}</SelectItem>
                            </SelectContent>
                        </Select>

                        {isFiltered && (
                            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                                <RotateCcw className="h-3.5 w-3.5 me-1.5" aria-hidden="true" />
                                مسح التصفية
                            </Button>
                        )}
                    </div>
                </div>

                <DirectoryResultCount>
                    عرض {filteredCrossings.length} من أصل {crossings.length} معبر
                </DirectoryResultCount>

                {filteredCrossings.length === 0 ? (
                    <DirectoryEmptyState
                        icon={MapPin}
                        title={isFiltered ? 'لا توجد معابر مطابقة للتصفية' : 'لا توجد معابر مسجّلة بعد'}
                        description={
                            isFiltered
                                ? 'جرّب تعديل كلمات البحث أو إزالة بعض الفلاتر.'
                                : 'ابدأ بإضافة أول معبر حدودي أو منفذ ليظهر في الدليل العام.'
                        }
                        directory={{ isFiltered, clear: clearFilters }}
                    />
                ) : (
                    <ResponsiveTable
                        items={filteredCrossings}
                        getKey={(item) => item.id}
                        mobileLabel="قائمة المعابر"
                        desktopHeader={(
                            <TableRow>
                                <TableHead>المعبر</TableHead>
                                <TableHead>الدولة / المحافظة</TableHead>
                                <TableHead>النوع</TableHead>
                                <TableHead>الحالة</TableHead>
                                <TableHead>التفعيل</TableHead>
                                <TableHead>الترتيب</TableHead>
                                <TableHead className="text-end">إجراءات</TableHead>
                            </TableRow>
                        )}
                        renderDesktopRow={(item) => (
                            <TableRow key={item.id}>
                                <TableCell>
                                    <div className="font-medium text-foreground">{item.name_ar}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {item.name_en ? `${item.name_en} · ` : ''}
                                        <span dir="ltr" className="font-mono">{item.slug}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {[item.country, item.governorate].filter(Boolean).join(' — ') || '—'}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">{TYPE_LABELS[item.type] ?? item.type}</Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={STATUS_VARIANTS[item.status] ?? 'secondary'}>
                                        {STATUS_LABELS[item.status] ?? item.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={item.is_active ? 'secondary' : 'outline'}>
                                        {item.is_active ? 'مفعّل' : 'مخفي'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-sm tabular-nums text-muted-foreground">
                                    {item.sort_order}
                                </TableCell>
                                <TableCell className="text-end">
                                    <div className="inline-flex items-center justify-end gap-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEdit(item)}
                                            aria-label={`تعديل ${item.name_ar}`}
                                            title="تعديل"
                                        >
                                            <Edit className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            disabled={deletingId === item.id}
                                            onClick={() => handleDelete(item)}
                                            aria-label={`حذف ${item.name_ar}`}
                                            title="حذف"
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        renderMobileItem={(item) => (
                            <>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="font-medium text-foreground truncate">{item.name_ar}</div>
                                        <div className="text-xs text-muted-foreground truncate">
                                            {[item.country, item.governorate].filter(Boolean).join(' — ') || item.slug}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEdit(item)}
                                            aria-label={`تعديل ${item.name_ar}`}
                                            title="تعديل"
                                        >
                                            <Edit className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            disabled={deletingId === item.id}
                                            onClick={() => handleDelete(item)}
                                            aria-label={`حذف ${item.name_ar}`}
                                            title="حذف"
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge variant={STATUS_VARIANTS[item.status] ?? 'secondary'}>
                                        {STATUS_LABELS[item.status] ?? item.status}
                                    </Badge>
                                    <Badge variant="outline">{TYPE_LABELS[item.type] ?? item.type}</Badge>
                                    <Badge variant={item.is_active ? 'secondary' : 'outline'}>
                                        {item.is_active ? 'مفعّل' : 'مخفي'}
                                    </Badge>
                                </div>
                            </>
                        )}
                    />
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'تعديل معبر' : 'إضافة معبر جديد'}</DialogTitle>
                        <DialogDescription>
                            أدخل تفاصيل المعبر الحدودي أو المنفذ وحدد حالته وإحداثياته وساعات عمله.
                        </DialogDescription>
                    </DialogHeader>

                    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="crossing-name-ar">الاسم بالعربية *</Label>
                                <Input
                                    id="crossing-name-ar"
                                    value={form.name_ar}
                                    onChange={(e) => setForm((prev) => ({ ...prev, name_ar: e.target.value }))}
                                    placeholder="مثال: معبر نصيب"
                                    {...fieldA11y('crossing-name-ar-error', errors.name_ar)}
                                />
                                <FieldError id="crossing-name-ar-error" message={errors.name_ar} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="crossing-name-en">الاسم بالإنجليزية</Label>
                                <Input
                                    id="crossing-name-en"
                                    dir="ltr"
                                    value={form.name_en}
                                    onChange={(e) => setForm((prev) => ({ ...prev, name_en: e.target.value }))}
                                    placeholder="Nasib Crossing"
                                    {...fieldA11y('crossing-name-en-error', errors.name_en)}
                                />
                                <FieldError id="crossing-name-en-error" message={errors.name_en} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="crossing-slug">المعرّف (Slug)</Label>
                                <Input
                                    id="crossing-slug"
                                    dir="ltr"
                                    value={form.slug}
                                    onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                                    placeholder="nasib-crossing"
                                    {...fieldA11y('crossing-slug-error', errors.slug)}
                                />
                                <FieldError id="crossing-slug-error" message={errors.slug} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="crossing-phone">رقم الهاتف / الدولي</Label>
                                <Input
                                    id="crossing-phone"
                                    dir="ltr"
                                    value={form.phone}
                                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                                    placeholder="+963 ..."
                                    {...fieldA11y('crossing-phone-error', errors.phone)}
                                />
                                <FieldError id="crossing-phone-error" message={errors.phone} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="crossing-country">الدولة المجاورة</Label>
                                <Input
                                    id="crossing-country"
                                    value={form.country}
                                    onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
                                    placeholder="مثال: الأردن"
                                    {...fieldA11y('crossing-country-error', errors.country)}
                                />
                                <FieldError id="crossing-country-error" message={errors.country} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="crossing-governorate">المحافظة</Label>
                                <Input
                                    id="crossing-governorate"
                                    value={form.governorate}
                                    onChange={(e) => setForm((prev) => ({ ...prev, governorate: e.target.value }))}
                                    placeholder="مثال: درعا"
                                    {...fieldA11y('crossing-governorate-error', errors.governorate)}
                                />
                                <FieldError id="crossing-governorate-error" message={errors.governorate} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="crossing-type">النوع</Label>
                                <Select
                                    value={form.type}
                                    onValueChange={(value) => setForm((prev) => ({ ...prev, type: value as CrossingType }))}
                                >
                                    <SelectTrigger id="crossing-type" aria-label="نوع المعبر">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="crossing">{TYPE_LABELS.crossing}</SelectItem>
                                        <SelectItem value="port">{TYPE_LABELS.port}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FieldError id="crossing-type-error" message={errors.type} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="crossing-status">الحالة</Label>
                                <Select
                                    value={form.status}
                                    onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as CrossingStatus }))}
                                >
                                    <SelectTrigger id="crossing-status" aria-label="حالة المعبر">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="open">{STATUS_LABELS.open}</SelectItem>
                                        <SelectItem value="closed">{STATUS_LABELS.closed}</SelectItem>
                                        <SelectItem value="opening_soon">{STATUS_LABELS.opening_soon}</SelectItem>
                                        <SelectItem value="unknown">{STATUS_LABELS.unknown}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FieldError id="crossing-status-error" message={errors.status} />
                            </div>

                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="crossing-hours">ساعات العمل</Label>
                                <Input
                                    id="crossing-hours"
                                    value={form.hours_ar}
                                    onChange={(e) => setForm((prev) => ({ ...prev, hours_ar: e.target.value }))}
                                    placeholder="مثال: يومياً 08:00 - 18:00 أو على مدار الساعة"
                                    {...fieldA11y('crossing-hours-error', errors.hours_ar)}
                                />
                                <FieldError id="crossing-hours-error" message={errors.hours_ar} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="crossing-lat">خط العرض (Latitude)</Label>
                                <Input
                                    id="crossing-lat"
                                    dir="ltr"
                                    inputMode="decimal"
                                    value={form.lat}
                                    onChange={(e) => setForm((prev) => ({ ...prev, lat: e.target.value }))}
                                    placeholder="32.5789"
                                    {...fieldA11y('crossing-lat-error', errors.lat)}
                                />
                                <FieldError id="crossing-lat-error" message={errors.lat} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="crossing-lng">خط الطول (Longitude)</Label>
                                <Input
                                    id="crossing-lng"
                                    dir="ltr"
                                    inputMode="decimal"
                                    value={form.lng}
                                    onChange={(e) => setForm((prev) => ({ ...prev, lng: e.target.value }))}
                                    placeholder="36.2014"
                                    {...fieldA11y('crossing-lng-error', errors.lng)}
                                />
                                <FieldError id="crossing-lng-error" message={errors.lng} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="crossing-sort-order">الترتيب</Label>
                                <Input
                                    id="crossing-sort-order"
                                    dir="ltr"
                                    type="number"
                                    min={0}
                                    value={form.sort_order}
                                    onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                                    {...fieldA11y('crossing-sort-order-error', errors.sort_order)}
                                />
                                <FieldError id="crossing-sort-order-error" message={errors.sort_order} />
                            </div>

                            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                                <Label htmlFor="crossing-active" className="cursor-pointer">
                                    مفعّل في الصفحة العامة
                                </Label>
                                <Switch
                                    id="crossing-active"
                                    checked={form.is_active}
                                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
                                />
                            </div>

                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="crossing-notes">ملاحظات</Label>
                                <Textarea
                                    id="crossing-notes"
                                    rows={3}
                                    value={form.notes_ar}
                                    onChange={(e) => setForm((prev) => ({ ...prev, notes_ar: e.target.value }))}
                                    placeholder="تفاصيل إضافية حول حركة المسافرين أو الشحن..."
                                    {...fieldA11y('crossing-notes-error', errors.notes_ar)}
                                />
                                <FieldError id="crossing-notes-error" message={errors.notes_ar} />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
                                disabled={saving}
                            >
                                إلغاء
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? 'جارٍ الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة المعبر'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
