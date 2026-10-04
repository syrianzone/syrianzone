import React, { useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import axios from 'axios';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Switch } from '@/Components/ui/switch';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/Components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/Components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/Components/ui/table';
import { Compass, Plus, Pencil, Trash2, Loader2, X } from 'lucide-react';
import { AXES } from '@/Pages/Compass/data/axes';
import SpectrumIcon from '@/Pages/Compass/components/SpectrumIcon';
import type { AxisId } from '@/Pages/Compass/data/types';

interface AdminPersona {
    id: number;
    slug: string;
    name: string;
    icon: string | null;
    short: string | null;
    stances: string[];
    factoid: string | null;
    center: Partial<Record<AxisId, number | null>>;
    ranges: Partial<Record<AxisId, { min: number; max: number }>>;
    enabled: boolean;
    sortOrder: number;
}

interface Props {
    personas: AdminPersona[];
    axes: string[];
    icons: string[];
    canViewStats: boolean;
}

type FormState = {
    name: string;
    icon: string;
    short: string;
    factoid: string;
    stances: string[];
    enabled: boolean;
    center: Record<string, string>;
    ranges: Record<string, { min: string; max: string }>;
};

const emptyCenter = (): Record<string, string> => {
    const c: Record<string, string> = {};
    for (const a of AXES) c[a.id] = '';
    return c;
};

const emptyRanges = (): Record<string, { min: string; max: string }> => {
    const r: Record<string, { min: string; max: string }> = {};
    for (const a of AXES) r[a.id] = { min: '', max: '' };
    return r;
};

const centerToForm = (p: AdminPersona): Record<string, string> => {
    const c = emptyCenter();
    for (const a of AXES) {
        const v = p.center?.[a.id];
        c[a.id] = v == null ? '' : String(v);
    }
    return c;
};

const rangesToForm = (p: AdminPersona): Record<string, { min: string; max: string }> => {
    const r = emptyRanges();
    for (const a of AXES) {
        const v = p.ranges?.[a.id];
        if (v) r[a.id] = { min: String(v.min ?? ''), max: String(v.max ?? '') };
    }
    return r;
};

function emptyForm(icons: string[]): FormState {
    return {
        name: '',
        icon: icons[0] ?? 'Shield',
        short: '',
        factoid: '',
        stances: [''],
        enabled: true,
        center: emptyCenter(),
        ranges: emptyRanges(),
    };
}

export default function CompassPersonas({ personas, icons, canViewStats }: Props) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<AdminPersona | null>(null);
    const [form, setForm] = useState<FormState>(() => emptyForm(icons));
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);

    const enabledCount = useMemo(() => personas.filter((p) => p.enabled).length, [personas]);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm(icons));
        setOpen(true);
    };

    const openEdit = (persona: AdminPersona) => {
        setEditing(persona);
        setForm({
            name: persona.name,
            icon: persona.icon ?? 'Shield',
            short: persona.short ?? '',
            factoid: persona.factoid ?? '',
            stances: persona.stances.length ? persona.stances : [''],
            enabled: persona.enabled,
            center: centerToForm(persona),
            ranges: rangesToForm(persona),
        });
        setOpen(true);
    };

    const setStance = (i: number, value: string) =>
        setForm((f) => ({ ...f, stances: f.stances.map((s, k) => (k === i ? value : s)) }));
    const addStance = () => setForm((f) => ({ ...f, stances: [...f.stances, ''] }));
    const removeStance = (i: number) =>
        setForm((f) => ({ ...f, stances: f.stances.filter((_, k) => k !== i) }));

    const setCenter = (axis: string, value: string) =>
        setForm((f) => ({ ...f, center: { ...f.center, [axis]: value } }));
    const setRange = (axis: string, bound: 'min' | 'max', value: string) =>
        setForm((f) => ({ ...f, ranges: { ...f.ranges, [axis]: { ...f.ranges[axis], [bound]: value } } }));

    const handleSave = () => {
        setSaving(true);
        const center: Record<string, number | null> = {};
        for (const a of AXES) {
            const raw = form.center[a.id]?.trim();
            center[a.id] = raw === '' || raw == null ? null : Number(raw);
        }
        const ranges: Record<string, { min: number | null; max: number | null }> = {};
        for (const a of AXES) {
            const row = form.ranges[a.id];
            const min = row?.min?.trim() ?? '';
            const max = row?.max?.trim() ?? '';
            if (min === '' && max === '') continue;
            ranges[a.id] = { min: min === '' ? null : Number(min), max: max === '' ? null : Number(max) };
        }
        const payload = {
            name: form.name,
            icon: form.icon,
            short: form.short,
            factoid: form.factoid,
            stances: form.stances.map((s) => s.trim()).filter(Boolean),
            enabled: form.enabled,
            center,
            ranges: Object.keys(ranges).length ? ranges : null,
        };
        const req = editing
            ? axios.put(`/api/v1/admin/compass/personas/${editing.id}`, payload)
            : axios.post('/api/v1/admin/compass/personas', payload);
        req
            .then(() => {
                setOpen(false);
                router.reload({ only: ['personas'] });
            })
            .catch((e) => alert(e?.response?.data?.message ?? 'تعذّر الحفظ'))
            .finally(() => setSaving(false));
    };

    const toggle = async (persona: AdminPersona) => {
        setBusyId(persona.id);
        try {
            await axios.post(`/api/v1/admin/compass/personas/${persona.id}/toggle`);
            router.reload({ only: ['personas'] });
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (persona: AdminPersona) => {
        if (!window.confirm(`حذف «${persona.name}»؟`)) return;
        setBusyId(persona.id);
        try {
            await axios.delete(`/api/v1/admin/compass/personas/${persona.id}`);
            router.reload({ only: ['personas'] });
        } finally {
            setBusyId(null);
        }
    };

    return (
        <MainLayout>
            <Head title="أنماط بوصلة سوريا" />
            <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8" dir="rtl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Compass className="h-6 w-6 text-primary" />
                        <h1 className="text-xl font-extrabold">أنماط بوصلة سوريا</h1>
                        <Badge variant="secondary" className="text-[11px]">
                            {enabledCount} مفعّل من {personas.length}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        {canViewStats && (
                            <Button variant="outline" asChild>
                                <Link href="/admin/compass">الإحصاءات</Link>
                            </Button>
                        )}
                        <Button onClick={openCreate} className="gap-2">
                            <Plus className="h-4 w-4" /> إضافة نمط
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">القائمة</CardTitle>
                        <CardDescription className="text-xs">
                            يُختار النمط بمطابقة المتجه المركزي، مع نطاقات اختيارية على المحاور تحدّ من الأنماط المرشّحة.
                            النص والمواقف واللمحة تظهر في صفحة النتيجة وصورة المشاركة.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-14">الأيقونة</TableHead>
                                    <TableHead>الاسم</TableHead>
                                    <TableHead className="w-24">المتجه</TableHead>
                                    <TableHead className="w-24">النطاقات</TableHead>
                                    <TableHead className="w-24">مفعّل</TableHead>
                                    <TableHead className="w-28">إجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {personas.map((p) => {
                                    const centerFilled = AXES.filter((a) => p.center?.[a.id] != null).length;
                                    const rangeCount = p.ranges ? Object.keys(p.ranges).length : 0;
                                    return (
                                        <TableRow key={p.id}>
                                            <TableCell>
                                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                    <SpectrumIcon name={p.icon ?? undefined} className="h-4 w-4" />
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {p.name}
                                                <span className="block text-[10px] text-muted-foreground" dir="ltr">{p.slug}</span>
                                            </TableCell>
                                            <TableCell className="tabular-nums">{centerFilled}/11</TableCell>
                                            <TableCell className="tabular-nums">{rangeCount || '—'}</TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={p.enabled}
                                                    disabled={busyId === p.id}
                                                    onCheckedChange={() => toggle(p)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="تعديل">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive"
                                                        onClick={() => remove(p)}
                                                        aria-label="حذف"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader className="text-right sm:text-right">
                        <DialogTitle className="text-right">
                            {editing ? `تعديل «${editing.name}»` : 'إضافة نمط'}
                        </DialogTitle>
                        <DialogDescription className="text-right">
                            الاسم والأيقونة والنصوص والمواقف والمتجه المركزي والنطاقات الاختيارية.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="p-name">الاسم</Label>
                                <Input id="p-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>الأيقونة</Label>
                                <Select value={form.icon} onValueChange={(v) => setForm((f) => ({ ...f, icon: v }))} dir="rtl">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {icons.map((ic) => (
                                            <SelectItem key={ic} value={ic}>
                                                <span className="flex items-center gap-2">
                                                    <SpectrumIcon name={ic} className="h-4 w-4" />
                                                    {ic}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <Label>مفعّل في المطابقة والنتيجة</Label>
                            <Switch checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="p-short">الوصف المختصر</Label>
                            <Input id="p-short" value={form.short} onChange={(e) => setForm((f) => ({ ...f, short: e.target.value }))} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="p-factoid">اللمحة التاريخية</Label>
                            <textarea
                                id="p-factoid"
                                className="min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={form.factoid}
                                onChange={(e) => setForm((f) => ({ ...f, factoid: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>المواقف الأساسية</Label>
                                <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={addStance}>
                                    <Plus className="h-3.5 w-3.5" /> إضافة موقف
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {form.stances.map((s, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <Input value={s} onChange={(e) => setStance(i, e.target.value)} />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive shrink-0"
                                            onClick={() => removeStance(i)}
                                            aria-label="حذف الموقف"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>المتجه المركزي (‎−1‎ إلى ‎+1‎، فارغ = لا ينطبق)</Label>
                            <div className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-2">
                                {AXES.map((a) => (
                                    <div key={a.id} className="flex items-center gap-2">
                                        <span className="min-w-0 flex-1 truncate text-xs">
                                            {a.name}
                                            <span className="ms-1 text-[10px] text-muted-foreground">
                                                (يمين: {a.left} · يسار: {a.right})
                                            </span>
                                        </span>
                                        <Input
                                            type="number"
                                            step="0.05"
                                            min={-1}
                                            max={1}
                                            className="w-20"
                                            value={form.center[a.id] ?? ''}
                                            onChange={(e) => setCenter(a.id, e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>النطاقات على المحاور (اختياري)</Label>
                            <p className="text-[11px] text-muted-foreground">
                                إن حُدّد نطاق، لا يُختار النمط إلا إذا وقعت درجة المستخدم داخله. اتركه فارغاً لعدم التقييد.
                            </p>
                            <div className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-2">
                                {AXES.map((a) => (
                                    <div key={a.id} className="flex items-center gap-2">
                                        <span className="min-w-0 flex-1 truncate text-xs">{a.name}</span>
                                        <Input
                                            type="number"
                                            step="0.05"
                                            min={-1}
                                            max={1}
                                            className="w-16"
                                            placeholder="من"
                                            value={form.ranges[a.id]?.min ?? ''}
                                            onChange={(e) => setRange(a.id, 'min', e.target.value)}
                                        />
                                        <Input
                                            type="number"
                                            step="0.05"
                                            min={-1}
                                            max={1}
                                            className="w-16"
                                            placeholder="إلى"
                                            value={form.ranges[a.id]?.max ?? ''}
                                            onChange={(e) => setRange(a.id, 'max', e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex-row-reverse gap-2">
                        <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="gap-2">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {editing ? 'حفظ التعديلات' : 'إضافة'}
                        </Button>
                        <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
}
