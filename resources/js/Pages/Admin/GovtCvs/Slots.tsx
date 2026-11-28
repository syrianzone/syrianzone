import { useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { AdminLayout } from '@/Components/admin/AdminLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import { FilterChip } from '@/Components/ui/filter-chip';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Switch } from '@/Components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { Textarea } from '@/Components/ui/textarea';
import FieldError, { fieldA11y } from '@/Components/ui/field-error';
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { normalizeArabic } from '@/Lib/arabic';
import { notify } from '@/Lib/notify';
import { confirmDialog } from '@/Lib/confirm';
import { apiErrorMessage, apiFieldErrors } from '@/Lib/api';
import { useCan } from '@/Lib/useCan';
import { govtCvsApi } from '@/Domain/govtcvs/api';
import { SlotStatusBadge, TierBadge } from '@/Domain/govtcvs/StatusBadges';
import { SLOT_STATUS_META, TIER_META } from '@/Domain/govtcvs/constants';
import type { GovtOfficeSlotItem, InstitutionOption } from '@/Domain/govtcvs/types';
import AdminNav from './_components/AdminNav';

const ALL = 'all';
const NONE = '__none';

interface Props {
    slots: GovtOfficeSlotItem[];
    institutions?: InstitutionOption[];
}

interface SlotFormState {
    slug: string;
    title_ar: string;
    institution_id: string;
    institution_name_ar: string;
    tier: string;
    is_single_seat: boolean;
    status: string;
    active_from: string;
    ended_at: string;
    lineage_note_ar: string;
    replaced_by_slot_id: string;
}

function emptySlotForm(): SlotFormState {
    return {
        slug: '',
        title_ar: '',
        institution_id: NONE,
        institution_name_ar: '',
        tier: 'minister',
        is_single_seat: true,
        status: 'active',
        active_from: '',
        ended_at: '',
        lineage_note_ar: '',
        replaced_by_slot_id: NONE,
    };
}

function slotToForm(slot: GovtOfficeSlotItem): SlotFormState {
    return {
        slug: slot.slug ?? '',
        title_ar: slot.title_ar ?? '',
        institution_id: slot.institution_id ?? NONE,
        institution_name_ar: slot.institution_name_ar ?? '',
        tier: slot.tier || 'minister',
        is_single_seat: slot.is_single_seat ?? true,
        status: slot.status || 'active',
        active_from: slot.active_from ?? '',
        ended_at: slot.ended_at ?? '',
        lineage_note_ar: slot.lineage_note_ar ?? '',
        replaced_by_slot_id: slot.replaced_by_slot_id ?? NONE,
    };
}

const orNull = (v: string) => (v.trim() === '' || v === NONE ? null : v.trim());

export default function GovtCvsAdminSlots({ slots = [], institutions = [] }: Props) {
    const can = useCan() as (cap: string) => boolean;
    const canManageSlots = can('govtcvs.slots');

    const [q, setQ] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>(ALL);
    const [tierFilter, setTierFilter] = useState<string>(ALL);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingSlot, setEditingSlot] = useState<GovtOfficeSlotItem | null>(null);
    const [form, setForm] = useState<SlotFormState>(emptySlotForm);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const visibleSlots = useMemo(() => {
        const needle = normalizeArabic(q);
        return slots.filter((s) => {
            if (statusFilter !== ALL && s.status !== statusFilter) return false;
            if (tierFilter !== ALL && s.tier !== tierFilter) return false;
            if (needle) {
                const haystack = normalizeArabic(
                    [
                        s.title_ar,
                        s.slug,
                        s.institution_name_ar,
                        s.current_holder?.display_name_ar,
                    ]
                        .filter(Boolean)
                        .join(' '),
                );
                if (!haystack.includes(needle)) return false;
            }
            return true;
        });
    }, [slots, q, statusFilter, tierFilter]);

    const openCreate = () => {
        setEditingSlot(null);
        setForm(emptySlotForm());
        setErrors({});
        setDialogOpen(true);
    };

    const openEdit = (slot: GovtOfficeSlotItem) => {
        setEditingSlot(slot);
        setForm(slotToForm(slot));
        setErrors({});
        setDialogOpen(true);
    };

    const saveSlot = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setErrors({});

        const selectedInst = institutions.find((i) => i.id === form.institution_id);
        const payload = {
            slug: orNull(form.slug),
            title_ar: form.title_ar.trim(),
            institution_id: orNull(form.institution_id),
            institution_name_ar:
                orNull(form.institution_name_ar) ?? selectedInst?.name_ar ?? null,
            tier: form.tier,
            is_single_seat: form.is_single_seat,
            status: form.status,
            active_from: orNull(form.active_from),
            ended_at: orNull(form.ended_at),
            lineage_note_ar: orNull(form.lineage_note_ar),
            replaced_by_slot_id: orNull(form.replaced_by_slot_id),
        };

        try {
            await govtCvsApi.saveSlot(editingSlot?.id ?? null, payload);
            notify.success(editingSlot ? 'حُدّث المنصب القياسي' : 'أُضيف المنصب القياسي');
            setDialogOpen(false);
            router.reload({ only: ['slots'] });
        } catch (err) {
            setErrors(apiFieldErrors(err));
            notify.error(apiErrorMessage(err, 'تعذّر حفظ المنصب'));
        } finally {
            setSaving(false);
        }
    };

    const removeSlot = async (slot: GovtOfficeSlotItem) => {
        const ok = await confirmDialog({
            title: `حذف منصب «${slot.title_ar}»؟`,
            description:
                'سيُحذف تعريف المنصب القياسي. الولايات المرتبطة به ستبقى محفوظة باسم المنصب.',
            destructive: true,
            confirmText: 'حذف',
        });
        if (!ok) return;
        try {
            await govtCvsApi.deleteSlot(slot.id);
            notify.success('حُذف المنصب القياسي');
            router.reload({ only: ['slots'] });
        } catch (err) {
            notify.error(apiErrorMessage(err, 'تعذّر حذف المنصب'));
        }
    };

    return (
        <AdminLayout
            title="إدارة المناصب والشواغر الحكومية"
            activeSection="govtcvs"
            publicHref="/govtcvs"
            publicLabel="عرض السير الذاتية"
            actions={
                canManageSlots ? (
                    <Button type="button" size="sm" onClick={openCreate} className="gap-2">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        إضافة منصب قياسي
                    </Button>
                ) : undefined
            }
        >
            <Head title="إدارة المناصب والشواغر الحكومية" />
            <AdminNav current="slots" />

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">سجل المناصب القياسية</CardTitle>
                        <CardDescription>
                            تُستخدم المناصب الفردية (مثل وزير أو محافظ) لربط السلف بالخلف تلقائياً وتتبع دمج أو إلغاء الوزارات والهيئات.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div
                                className="flex flex-wrap gap-2"
                                role="group"
                                aria-label="تصفية حسب حالة المنصب القياسي"
                            >
                                <FilterChip
                                    active={statusFilter === ALL}
                                    onClick={() => setStatusFilter(ALL)}
                                >
                                    الكل (<span dir="ltr" className="tabular-nums">{slots.length}</span>)
                                </FilterChip>
                                {Object.values(SLOT_STATUS_META).map((meta) => (
                                    <FilterChip
                                        key={meta.key}
                                        active={statusFilter === meta.key}
                                        onClick={() => setStatusFilter(meta.key)}
                                    >
                                        {meta.label}
                                    </FilterChip>
                                ))}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Select value={tierFilter} onValueChange={setTierFilter}>
                                    <SelectTrigger
                                        aria-label="تصفية حسب المستوى الوظيفي"
                                        className="h-9 w-44"
                                    >
                                        <SelectValue placeholder="كل المستويات" />
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

                                <div className="relative w-full sm:w-64">
                                    <Search
                                        className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <Input
                                        aria-label="بحث في المناصب القياسية"
                                        placeholder="المسمى أو الجهة أو الشاغل..."
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                        className="h-9 ps-9"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>المنصب</TableHead>
                                        <TableHead>الجهة الحكومية</TableHead>
                                        <TableHead>المستوى</TableHead>
                                        <TableHead>النوع</TableHead>
                                        <TableHead>الحالة</TableHead>
                                        <TableHead>الشاغل الحالي</TableHead>
                                        <TableHead className="w-20">التعيينات</TableHead>
                                        <TableHead className="w-28">إجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {visibleSlots.length === 0 && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={8}
                                                className="py-10 text-center text-muted-foreground"
                                            >
                                                لا توجد مناصب قياسية تطابق البحث.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {visibleSlots.map((slot) => (
                                        <TableRow key={slot.id}>
                                            <TableCell>
                                                <p className="font-semibold text-foreground">
                                                    {slot.title_ar}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    <span dir="ltr">{slot.slug}</span>
                                                </p>
                                                {slot.lineage_note_ar && (
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {slot.lineage_note_ar}
                                                    </p>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {slot.institution_name_ar ?? '—'}
                                            </TableCell>
                                            <TableCell>
                                                <TierBadge tier={slot.tier} short />
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className="whitespace-nowrap text-xs"
                                                >
                                                    {slot.is_single_seat
                                                        ? 'مقعد فردي'
                                                        : 'متعدد المقاعد'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <SlotStatusBadge status={slot.status} />
                                            </TableCell>
                                            <TableCell>
                                                {slot.current_holder ? (
                                                    <Link
                                                        href={`/admin/govtcvs/officials/${slot.current_holder.id}`}
                                                        className="font-medium text-primary hover:underline"
                                                    >
                                                        {slot.current_holder.display_name_ar}
                                                    </Link>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">
                                                        شاغر / غير محدد
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="tabular-nums text-xs text-muted-foreground">
                                                <span dir="ltr">{slot.tenures_count}</span>
                                            </TableCell>
                                            <TableCell>
                                                {canManageSlots && (
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label={`تعديل منصب «${slot.title_ar}»`}
                                                            onClick={() => openEdit(slot)}
                                                        >
                                                            <Pencil
                                                                className="h-4 w-4"
                                                                aria-hidden="true"
                                                            />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive"
                                                            disabled={slot.tenures_count > 0}
                                                            aria-label={
                                                                slot.tenures_count > 0
                                                                    ? `لا يمكن حذف «${slot.title_ar}» لارتباطه بتعيينات`
                                                                    : `حذف منصب «${slot.title_ar}»`
                                                            }
                                                            onClick={() => removeSlot(slot)}
                                                        >
                                                            <Trash2
                                                                className="h-4 w-4"
                                                                aria-hidden="true"
                                                            />
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent dir="rtl" className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                    <form onSubmit={saveSlot} className="space-y-4" noValidate>
                        <DialogHeader>
                            <DialogTitle>
                                {editingSlot
                                    ? `تعديل «${editingSlot.title_ar}»`
                                    : 'إضافة منصب قياسي جديد'}
                            </DialogTitle>
                            <DialogDescription>
                                يربط هذا السجل المناصب المتعاقبة في الوزارة أو المحافظة أو الهيئة نفسها.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-1.5">
                            <Label htmlFor="slot_title_ar">المسمى الوظيفي *</Label>
                            <Input
                                id="slot_title_ar"
                                aria-required="true"
                                value={form.title_ar}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, title_ar: e.target.value }))
                                }
                                placeholder="مثال: وزير الاتصالات وتقانة المعلومات"
                                {...fieldA11y('slot_title_ar-error', errors.title_ar)}
                            />
                            <FieldError id="slot_title_ar-error" message={errors.title_ar} />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="slot_slug">المعرّف بالإنكليزية (Slug)</Label>
                            <Input
                                id="slot_slug"
                                dir="ltr"
                                value={form.slug}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        slug: e.target.value.toLowerCase(),
                                    }))
                                }
                                placeholder="minister-of-communications"
                                {...fieldA11y('slot_slug-error', errors.slug)}
                            />
                            <FieldError id="slot_slug-error" message={errors.slug} />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="slot_tier">المستوى الوظيفي</Label>
                                <Select
                                    value={form.tier}
                                    onValueChange={(v) => setForm((f) => ({ ...f, tier: v }))}
                                >
                                    <SelectTrigger id="slot_tier" aria-label="المستوى الوظيفي">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.values(TIER_META).map((item) => (
                                            <SelectItem key={item.key} value={item.key}>
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="slot_status">حالة المنصب</Label>
                                <Select
                                    value={form.status}
                                    onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                                >
                                    <SelectTrigger id="slot_status" aria-label="حالة المنصب">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.values(SLOT_STATUS_META).map((item) => (
                                            <SelectItem key={item.key} value={item.key}>
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="slot_institution_id">الجهة الحكومية</Label>
                                <Select
                                    value={form.institution_id}
                                    onValueChange={(v) =>
                                        setForm((f) => ({ ...f, institution_id: v }))
                                    }
                                >
                                    <SelectTrigger
                                        id="slot_institution_id"
                                        aria-label="الجهة الحكومية"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NONE}>— بلا جهة مرتبطة —</SelectItem>
                                        {institutions.map((inst) => (
                                            <SelectItem key={inst.id} value={inst.id}>
                                                {inst.name_ar}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="slot_institution_name_ar">
                                    اسم الجهة (نص مخصّص)
                                </Label>
                                <Input
                                    id="slot_institution_name_ar"
                                    value={form.institution_name_ar}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            institution_name_ar: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="slot_active_from">تاريخ الاستحداث / التفعيل</Label>
                                <Input
                                    id="slot_active_from"
                                    type="date"
                                    dir="ltr"
                                    value={form.active_from}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, active_from: e.target.value }))
                                    }
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="slot_ended_at">تاريخ الدمج / الإلغاء</Label>
                                <Input
                                    id="slot_ended_at"
                                    type="date"
                                    dir="ltr"
                                    value={form.ended_at}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, ended_at: e.target.value }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="slot_replaced_by">
                                استُبدل بالمنصب (عند الدمج)
                            </Label>
                            <Select
                                value={form.replaced_by_slot_id}
                                onValueChange={(v) =>
                                    setForm((f) => ({ ...f, replaced_by_slot_id: v }))
                                }
                            >
                                <SelectTrigger
                                    id="slot_replaced_by"
                                    aria-label="استُبدل بالمنصب"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE}>— لا يوجد —</SelectItem>
                                    {slots
                                        .filter((s) => s.id !== editingSlot?.id)
                                        .map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.title_ar}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch
                                id="slot_is_single_seat"
                                checked={form.is_single_seat}
                                onCheckedChange={(v) =>
                                    setForm((f) => ({ ...f, is_single_seat: v }))
                                }
                            />
                            <Label htmlFor="slot_is_single_seat" className="font-normal">
                                منصب ذو مقعد فردي واحد (يشغله شخص واحد في الوقت نفسه)
                            </Label>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="slot_lineage_note_ar">
                                ملاحظة التسلسل المؤسسي (تاريخ الدمج أو الفصل)
                            </Label>
                            <Textarea
                                id="slot_lineage_note_ar"
                                rows={2}
                                value={form.lineage_note_ar}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        lineage_note_ar: e.target.value,
                                    }))
                                }
                            />
                        </div>

                        <DialogFooter className="gap-2 sm:justify-start">
                            <Button type="submit" disabled={saving} className="gap-2">
                                {saving && (
                                    <Loader2
                                        className="h-4 w-4 animate-spin"
                                        aria-hidden="true"
                                    />
                                )}
                                حفظ
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
                            >
                                إلغاء
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
