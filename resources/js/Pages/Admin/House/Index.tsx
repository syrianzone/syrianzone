import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Edit, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
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
import { TableCell, TableHead, TableRow } from '@/Components/ui/table';
import {
    houseAdminApi,
    type AdminHouseMember,
    type HouseMemberGender,
    type HouseMemberPayload,
    type HouseMemberStatus,
} from '@/Domain/civicAdmin/api';
import { apiErrorMessage, apiFieldErrors } from '@/Lib/api';
import { confirmDialog } from '@/Lib/confirm';
import { notify } from '@/Lib/notify';

interface HouseAdminIndexProps {
    members: AdminHouseMember[];
}

interface HouseMemberFormState {
    member_number: string;
    name_ar: string;
    governorate_ar: string;
    district: string;
    town: string;
    gender: 'none' | HouseMemberGender;
    birth_year: string;
    age: string;
    selection_method: string;
    category: string;
    status: HouseMemberStatus;
    management_position: string;
    facebook_url: string;
    twitter_url: string;
}

const STATUS_LABELS: Record<HouseMemberStatus, string> = {
    active: 'نشط',
    resigned: 'مستقيل',
    dead: 'متوفى',
    inactive: 'غير نشط',
};

const STATUS_VARIANTS: Record<HouseMemberStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
    active: 'success',
    resigned: 'warning',
    dead: 'destructive',
    inactive: 'secondary',
};

const GENDER_LABELS: Record<HouseMemberGender, string> = {
    M: 'ذكر',
    F: 'أنثى',
};

const EMPTY_FORM: HouseMemberFormState = {
    member_number: '',
    name_ar: '',
    governorate_ar: '',
    district: '',
    town: '',
    gender: 'none',
    birth_year: '',
    age: '',
    selection_method: '',
    category: '',
    status: 'active',
    management_position: '',
    facebook_url: '',
    twitter_url: '',
};

function sortMembers(items: AdminHouseMember[]): AdminHouseMember[] {
    return [...items].sort((a, b) => {
        const govCmp = (a.governorate_ar ?? '').localeCompare(b.governorate_ar ?? '', 'ar');
        if (govCmp !== 0) return govCmp;
        return a.name_ar.localeCompare(b.name_ar, 'ar');
    });
}

function isHttpUrl(value: string): boolean {
    return /^https?:\/\/.+/i.test(value);
}

export default function HouseAdminIndex({ members: initialMembers }: HouseAdminIndexProps) {
    const [members, setMembers] = useState<AdminHouseMember[]>(() => sortMembers(initialMembers));
    const [query, setQuery] = useState('');
    const [governorateFilter, setGovernorateFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState<'all' | HouseMemberStatus>('all');
    const [genderFilter, setGenderFilter] = useState<'all' | HouseMemberGender>('all');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<AdminHouseMember | null>(null);
    const [form, setForm] = useState<HouseMemberFormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        setMembers(sortMembers(initialMembers));
    }, [initialMembers]);

    useEffect(() => {
        if (Object.keys(errors).length === 0) return;
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }, [errors]);

    const governorates = useMemo(() => {
        const unique = new Set<string>();
        for (const item of members) {
            if (item.governorate_ar?.trim()) unique.add(item.governorate_ar.trim());
        }
        return Array.from(unique).sort((a, b) => a.localeCompare(b, 'ar'));
    }, [members]);

    const isFiltered =
        query.trim() !== '' ||
        governorateFilter !== 'all' ||
        statusFilter !== 'all' ||
        genderFilter !== 'all';

    const filteredMembers = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return members.filter((item) => {
            if (governorateFilter !== 'all' && (item.governorate_ar?.trim() ?? '') !== governorateFilter) {
                return false;
            }
            if (statusFilter !== 'all' && item.status !== statusFilter) return false;
            if (genderFilter !== 'all' && item.gender !== genderFilter) return false;
            if (!needle) return true;
            const haystack = [
                item.name_ar,
                item.member_number,
                item.governorate_ar,
                item.district,
                item.town,
                item.management_position,
                item.category,
                item.selection_method,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(needle);
        });
    }, [members, query, governorateFilter, statusFilter, genderFilter]);

    const clearFilters = () => {
        setQuery('');
        setGovernorateFilter('all');
        setStatusFilter('all');
        setGenderFilter('all');
    };

    const openCreate = () => {
        setEditing(null);
        setErrors({});
        setForm(EMPTY_FORM);
        setDialogOpen(true);
    };

    const openEdit = (item: AdminHouseMember) => {
        setEditing(item);
        setErrors({});
        setForm({
            member_number: item.member_number ?? '',
            name_ar: item.name_ar,
            governorate_ar: item.governorate_ar ?? '',
            district: item.district ?? '',
            town: item.town ?? '',
            gender: item.gender ?? 'none',
            birth_year: item.birth_year !== null && item.birth_year !== undefined ? String(item.birth_year) : '',
            age: item.age !== null && item.age !== undefined ? String(item.age) : '',
            selection_method: item.selection_method ?? '',
            category: item.category ?? '',
            status: item.status,
            management_position: item.management_position ?? '',
            facebook_url: item.facebook_url ?? '',
            twitter_url: item.twitter_url ?? '',
        });
        setDialogOpen(true);
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const clientErrors: Record<string, string> = {};

        const trimmedName = form.name_ar.trim();
        if (!trimmedName) {
            clientErrors.name_ar = 'اسم العضو مطلوب';
        }

        const trimmedMemberNumber = form.member_number.trim();
        if (trimmedMemberNumber && !/^[0-9A-Za-z-]+$/.test(trimmedMemberNumber)) {
            clientErrors.member_number = 'رقم العضوية يجب أن يحتوي على أحرف إنجليزية وأرقام وشرطات فقط';
        }

        let birthYear: number | null = null;
        if (form.birth_year.trim() !== '') {
            const parsed = Number(form.birth_year.trim());
            if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2025) {
                clientErrors.birth_year = 'سنة الميلاد يجب أن تكون بين 1900 و 2025';
            } else {
                birthYear = parsed;
            }
        }

        let age: number | null = null;
        if (form.age.trim() !== '') {
            const parsed = Number(form.age.trim());
            if (!Number.isInteger(parsed) || parsed < 18 || parsed > 120) {
                clientErrors.age = 'العمر يجب أن يكون بين 18 و 120';
            } else {
                age = parsed;
            }
        }

        const trimmedFb = form.facebook_url.trim();
        if (trimmedFb && !isHttpUrl(trimmedFb)) {
            clientErrors.facebook_url = 'رابط فيسبوك يجب أن يبدأ بـ http:// أو https://';
        }

        const trimmedTw = form.twitter_url.trim();
        if (trimmedTw && !isHttpUrl(trimmedTw)) {
            clientErrors.twitter_url = 'رابط تويتر / X يجب أن يبدأ بـ http:// أو https://';
        }

        if (Object.keys(clientErrors).length > 0) {
            setErrors(clientErrors);
            return;
        }

        const payload: HouseMemberPayload = {
            name_ar: trimmedName,
            member_number: trimmedMemberNumber || null,
            governorate_ar: form.governorate_ar.trim() || null,
            district: form.district.trim() || null,
            town: form.town.trim() || null,
            gender: form.gender === 'none' ? null : form.gender,
            birth_year: birthYear,
            age,
            selection_method: form.selection_method.trim() || null,
            category: form.category.trim() || null,
            status: form.status,
            management_position: form.management_position.trim() || null,
            facebook_url: trimmedFb || null,
            twitter_url: trimmedTw || null,
        };

        setSaving(true);
        setErrors({});
        try {
            if (editing) {
                const { member } = await houseAdminApi.update(editing.id, payload);
                setMembers((prev) => sortMembers(prev.map((m) => (m.id === member.id ? member : m))));
                notify.success('تم تحديث بيانات العضو بنجاح');
            } else {
                const { member } = await houseAdminApi.create(payload);
                setMembers((prev) => sortMembers([...prev, member]));
                notify.success('تمت إضافة العضو بنجاح');
            }
            setDialogOpen(false);
        } catch (err) {
            const fieldErrors = apiFieldErrors(err, { arabicOnly: true });
            if (Object.keys(fieldErrors).length > 0) {
                setErrors(fieldErrors);
            }
            notify.error(apiErrorMessage(err, 'تعذّر حفظ بيانات العضو'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item: AdminHouseMember) => {
        const confirmed = await confirmDialog({
            title: `حذف العضو «${item.name_ar}»؟`,
            description: 'سيتم حذف هذا السجل نهائياً من قائمة أعضاء مجلس الشعب 2026.',
            confirmText: 'حذف',
            cancelText: 'إلغاء',
            destructive: true,
        });
        if (!confirmed) return;

        setDeletingId(item.id);
        try {
            await houseAdminApi.remove(item.id);
            setMembers((prev) => prev.filter((m) => m.id !== item.id));
            notify.success('تم حذف العضو');
        } catch (err) {
            notify.error(apiErrorMessage(err, 'تعذّر حذف العضو'));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <AdminLayout
            title="إدارة أعضاء مجلس الشعب 2026"
            subtitle="إضافة وتعديل بيانات أعضاء مجلس الشعب حسب المحافظة والصفة والحالة."
            activeSection="house"
            publicHref="/house"
            publicLabel="عرض الصفحة العامة"
            actions={(
                <Button type="button" onClick={openCreate}>
                    <Plus className="h-4 w-4 me-1.5" aria-hidden="true" />
                    إضافة عضو
                </Button>
            )}
        >
            <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="flex-1">
                        <DirectorySearch
                            value={query}
                            onChange={setQuery}
                            placeholder="ابحث بالاسم أو رقم العضوية أو المحافظة أو المنطقة أو المنصب..."
                            ariaLabel="بحث في أعضاء مجلس الشعب"
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:items-center">
                        <Select value={governorateFilter} onValueChange={setGovernorateFilter}>
                            <SelectTrigger className="w-full lg:w-44" aria-label="تصفية حسب المحافظة">
                                <SelectValue placeholder="كل المحافظات" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل المحافظات</SelectItem>
                                {governorates.map((gov) => (
                                    <SelectItem key={gov} value={gov}>
                                        {gov}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={statusFilter}
                            onValueChange={(value) => setStatusFilter(value as 'all' | HouseMemberStatus)}
                        >
                            <SelectTrigger className="w-full lg:w-36" aria-label="تصفية حسب الحالة">
                                <SelectValue placeholder="كل الحالات" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الحالات</SelectItem>
                                <SelectItem value="active">{STATUS_LABELS.active}</SelectItem>
                                <SelectItem value="resigned">{STATUS_LABELS.resigned}</SelectItem>
                                <SelectItem value="dead">{STATUS_LABELS.dead}</SelectItem>
                                <SelectItem value="inactive">{STATUS_LABELS.inactive}</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select
                            value={genderFilter}
                            onValueChange={(value) => setGenderFilter(value as 'all' | HouseMemberGender)}
                        >
                            <SelectTrigger className="w-full lg:w-32" aria-label="تصفية حسب الجنس">
                                <SelectValue placeholder="الجنس" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">الكل</SelectItem>
                                <SelectItem value="M">{GENDER_LABELS.M}</SelectItem>
                                <SelectItem value="F">{GENDER_LABELS.F}</SelectItem>
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
                    عرض {filteredMembers.length} من أصل {members.length} عضو
                </DirectoryResultCount>

                {filteredMembers.length === 0 ? (
                    <DirectoryEmptyState
                        icon={Users}
                        title={isFiltered ? 'لا يوجد أعضاء مطابقون للتصفية' : 'لا يوجد أعضاء مسجّلون بعد'}
                        description={
                            isFiltered
                                ? 'جرّب تعديل كلمات البحث أو إزالة بعض الفلاتر.'
                                : 'ابدأ بإضافة أول عضو ليظهر في سجل مجلس الشعب 2026.'
                        }
                        directory={{ isFiltered, clear: clearFilters }}
                    />
                ) : (
                    <ResponsiveTable
                        items={filteredMembers}
                        getKey={(item) => item.id}
                        mobileLabel="قائمة أعضاء مجلس الشعب 2026"
                        desktopHeader={(
                            <TableRow>
                                <TableHead>العضو</TableHead>
                                <TableHead>المحافظة / المنطقة</TableHead>
                                <TableHead>الجنس / الميلاد</TableHead>
                                <TableHead>الفئة / الاختيار</TableHead>
                                <TableHead>الحالة</TableHead>
                                <TableHead className="text-end">إجراءات</TableHead>
                            </TableRow>
                        )}
                        renderDesktopRow={(item) => (
                            <TableRow key={item.id}>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-foreground">{item.name_ar}</span>
                                        {item.member_number && (
                                            <Badge variant="outline" className="font-mono text-[11px]">
                                                <span dir="ltr">{item.member_number}</span>
                                            </Badge>
                                        )}
                                    </div>
                                    {item.management_position && (
                                        <div className="text-xs text-muted-foreground">{item.management_position}</div>
                                    )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    <div>{item.governorate_ar || '—'}</div>
                                    {(item.district || item.town) && (
                                        <div className="text-xs">
                                            {[item.district, item.town].filter(Boolean).join(' · ')}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    <div>{item.gender ? GENDER_LABELS[item.gender] : '—'}</div>
                                    {item.birth_year && (
                                        <div className="text-xs tabular-nums">{item.birth_year}</div>
                                    )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    <div>{item.category || '—'}</div>
                                    {item.selection_method && (
                                        <div className="text-xs">{item.selection_method}</div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={STATUS_VARIANTS[item.status] ?? 'secondary'}>
                                        {STATUS_LABELS[item.status] ?? item.status}
                                    </Badge>
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
                                            {[item.governorate_ar, item.district, item.town].filter(Boolean).join(' · ') || '—'}
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
                                    {item.gender && <Badge variant="outline">{GENDER_LABELS[item.gender]}</Badge>}
                                    {item.member_number && (
                                        <Badge variant="outline" className="font-mono text-[11px]">
                                            <span dir="ltr">{item.member_number}</span>
                                        </Badge>
                                    )}
                                    {item.category && <Badge variant="secondary">{item.category}</Badge>}
                                </div>
                            </>
                        )}
                    />
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'تعديل بيانات عضو' : 'إضافة عضو جديد'}</DialogTitle>
                        <DialogDescription>
                            أدخل بيانات عضو مجلس الشعب 2026 بما في ذلك المحافظة والصفة والحالة.
                        </DialogDescription>
                    </DialogHeader>

                    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="member-name-ar">الاسم الكامل *</Label>
                                <Input
                                    id="member-name-ar"
                                    value={form.name_ar}
                                    onChange={(e) => setForm((prev) => ({ ...prev, name_ar: e.target.value }))}
                                    placeholder="الاسم الثلاثي للعضو"
                                    {...fieldA11y('member-name-ar-error', errors.name_ar)}
                                />
                                <FieldError id="member-name-ar-error" message={errors.name_ar} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="member-number">رقم العضوية</Label>
                                <Input
                                    id="member-number"
                                    dir="ltr"
                                    value={form.member_number}
                                    onChange={(e) => setForm((prev) => ({ ...prev, member_number: e.target.value }))}
                                    placeholder="2026-001"
                                    {...fieldA11y('member-number-error', errors.member_number)}
                                />
                                <FieldError id="member-number-error" message={errors.member_number} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="member-governorate">المحافظة</Label>
                                <Input
                                    id="member-governorate"
                                    value={form.governorate_ar}
                                    onChange={(e) => setForm((prev) => ({ ...prev, governorate_ar: e.target.value }))}
                                    placeholder="مثال: دمشق"
                                    {...fieldA11y('member-governorate-error', errors.governorate_ar)}
                                />
                                <FieldError id="member-governorate-error" message={errors.governorate_ar} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="member-district">المنطقة / الدائرة</Label>
                                <Input
                                    id="member-district"
                                    value={form.district}
                                    onChange={(e) => setForm((prev) => ({ ...prev, district: e.target.value }))}
                                    {...fieldA11y('member-district-error', errors.district)}
                                />
                                <FieldError id="member-district-error" message={errors.district} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="member-town">البلدة / الحي</Label>
                                <Input
                                    id="member-town"
                                    value={form.town}
                                    onChange={(e) => setForm((prev) => ({ ...prev, town: e.target.value }))}
                                    {...fieldA11y('member-town-error', errors.town)}
                                />
                                <FieldError id="member-town-error" message={errors.town} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="member-gender">الجنس</Label>
                                <Select
                                    value={form.gender}
                                    onValueChange={(value) =>
                                        setForm((prev) => ({ ...prev, gender: value as 'none' | HouseMemberGender }))
                                    }
                                >
                                    <SelectTrigger id="member-gender" aria-label="الجنس">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">غير محدد</SelectItem>
                                        <SelectItem value="M">{GENDER_LABELS.M}</SelectItem>
                                        <SelectItem value="F">{GENDER_LABELS.F}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FieldError id="member-gender-error" message={errors.gender} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="member-birth-year">سنة الميلاد</Label>
                                <Input
                                    id="member-birth-year"
                                    dir="ltr"
                                    type="number"
                                    min={1900}
                                    max={2025}
                                    value={form.birth_year}
                                    onChange={(e) => setForm((prev) => ({ ...prev, birth_year: e.target.value }))}
                                    placeholder="1980"
                                    {...fieldA11y('member-birth-year-error', errors.birth_year)}
                                />
                                <FieldError id="member-birth-year-error" message={errors.birth_year} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="member-age">العمر</Label>
                                <Input
                                    id="member-age"
                                    dir="ltr"
                                    type="number"
                                    min={18}
                                    max={120}
                                    value={form.age}
                                    onChange={(e) => setForm((prev) => ({ ...prev, age: e.target.value }))}
                                    placeholder="46"
                                    {...fieldA11y('member-age-error', errors.age)}
                                />
                                <FieldError id="member-age-error" message={errors.age} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="member-selection-method">طريقة الاختيار</Label>
                                <Input
                                    id="member-selection-method"
                                    value={form.selection_method}
                                    onChange={(e) => setForm((prev) => ({ ...prev, selection_method: e.target.value }))}
                                    placeholder="مثال: انتخاب / تعيين"
                                    {...fieldA11y('member-selection-method-error', errors.selection_method)}
                                />
                                <FieldError id="member-selection-method-error" message={errors.selection_method} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="member-category">الفئة / التخصص</Label>
                                <Input
                                    id="member-category"
                                    value={form.category}
                                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                                    {...fieldA11y('member-category-error', errors.category)}
                                />
                                <FieldError id="member-category-error" message={errors.category} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="member-status">الحالة</Label>
                                <Select
                                    value={form.status}
                                    onValueChange={(value) =>
                                        setForm((prev) => ({ ...prev, status: value as HouseMemberStatus }))
                                    }
                                >
                                    <SelectTrigger id="member-status" aria-label="حالة العضو">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">{STATUS_LABELS.active}</SelectItem>
                                        <SelectItem value="resigned">{STATUS_LABELS.resigned}</SelectItem>
                                        <SelectItem value="dead">{STATUS_LABELS.dead}</SelectItem>
                                        <SelectItem value="inactive">{STATUS_LABELS.inactive}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FieldError id="member-status-error" message={errors.status} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="member-management-position">المنصب الإداري / اللجنة</Label>
                                <Input
                                    id="member-management-position"
                                    value={form.management_position}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, management_position: e.target.value }))
                                    }
                                    {...fieldA11y('member-management-position-error', errors.management_position)}
                                />
                                <FieldError id="member-management-position-error" message={errors.management_position} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="member-facebook-url">رابط فيسبوك</Label>
                                <Input
                                    id="member-facebook-url"
                                    dir="ltr"
                                    type="url"
                                    value={form.facebook_url}
                                    onChange={(e) => setForm((prev) => ({ ...prev, facebook_url: e.target.value }))}
                                    placeholder="https://facebook.com/..."
                                    {...fieldA11y('member-facebook-url-error', errors.facebook_url)}
                                />
                                <FieldError id="member-facebook-url-error" message={errors.facebook_url} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="member-twitter-url">رابط X / تويتر</Label>
                                <Input
                                    id="member-twitter-url"
                                    dir="ltr"
                                    type="url"
                                    value={form.twitter_url}
                                    onChange={(e) => setForm((prev) => ({ ...prev, twitter_url: e.target.value }))}
                                    placeholder="https://x.com/..."
                                    {...fieldA11y('member-twitter-url-error', errors.twitter_url)}
                                />
                                <FieldError id="member-twitter-url-error" message={errors.twitter_url} />
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
                                {saving ? 'جارٍ الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة العضو'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
