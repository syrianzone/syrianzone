import React, { useMemo, useRef, useState } from 'react';
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
import { Compass, Plus, Pencil, Trash2, Upload, Loader2, ImageOff } from 'lucide-react';
import { AXES } from '@/Pages/Compass/data/axes';
import type { AxisId } from '@/Pages/Compass/data/types';

interface AdminFigure {
    id: number;
    name: string;
    category: string;
    align: string;
    positions: Partial<Record<AxisId, number | null>>;
    imagePath: string | null;
    imageUrl: string | null;
    enabled: boolean;
    sortOrder: number;
}

interface Props {
    figures: AdminFigure[];
    categories: string[];
    axes: string[];
    canViewStats: boolean;
}

const CATEGORY_LABEL: Record<string, string> = {
    founder: 'مؤسّسو الاستقلال',
    baath: 'قوميون/بعث',
    islam: 'إسلاميون',
    civ: 'معارضة مدنية',
    kurd: 'أكراد',
    minority: 'أقليات',
    current: 'معاصرون',
};

type FormState = {
    name: string;
    category: string;
    align: string;
    enabled: boolean;
    imageUrl: string | null;
    imagePath: string | null;
    positions: Record<string, string>;
};

const emptyPositions = (): Record<string, string> => {
    const p: Record<string, string> = {};
    for (const a of AXES) p[a.id] = '';
    return p;
};

const toPositionForm = (figure: AdminFigure): Record<string, string> => {
    const p = emptyPositions();
    for (const a of AXES) {
        const v = figure.positions?.[a.id];
        p[a.id] = v == null ? '' : String(v);
    }
    return p;
};

function emptyForm(categories: string[]): FormState {
    return {
        name: '',
        category: categories[0] ?? 'founder',
        align: 'neutral',
        enabled: false,
        imageUrl: null,
        imagePath: null,
        positions: emptyPositions(),
    };
}

export default function CompassFigures({ figures, categories, axes = [], canViewStats }: Props) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<AdminFigure | null>(null);
    const [form, setForm] = useState<FormState>(() => emptyForm(categories));
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // The axis rows come from the same AXES catalogue the editor labels use, so
    // a value can never be written to a key the form did not render. The `axes`
    // prop is accepted only so a server-side axis list can be reconciled later.
    void axes;

    const enabledCount = useMemo(() => figures.filter((f) => f.enabled).length, [figures]);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm(categories));
        setOpen(true);
    };

    const openEdit = (figure: AdminFigure) => {
        setEditing(figure);
        setForm({
            name: figure.name,
            category: figure.category,
            align: figure.align,
            enabled: figure.enabled,
            imageUrl: figure.imageUrl,
            imagePath: figure.imagePath,
            positions: toPositionForm(figure),
        });
        setOpen(true);
    };

    const setPosition = (axis: string, value: string) =>
        setForm((f) => ({ ...f, positions: { ...f.positions, [axis]: value } }));

    const handleUpload = async (file: File) => {
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            const res = await axios.post('/api/v1/admin/compass/figures/upload-image', fd);
            setForm((f) => ({ ...f, imageUrl: res.data.url, imagePath: res.data.path }));
        } catch {
            alert('تعذّر رفع الصورة');
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const handleSave = () => {
        setSaving(true);
        const positions: Record<string, number | null> = {};
        for (const a of AXES) {
            const raw = form.positions[a.id]?.trim();
            positions[a.id] = raw === '' || raw == null ? null : Number(raw);
        }
        const payload = {
            name: form.name,
            category: form.category,
            align: form.align || 'neutral',
            enabled: form.enabled,
            image_url: form.imageUrl,
            image_path: form.imagePath,
            positions,
        };
        const req = editing
            ? axios.put(`/api/v1/admin/compass/figures/${editing.id}`, payload)
            : axios.post('/api/v1/admin/compass/figures', payload);
        req
            .then(() => {
                setOpen(false);
                router.reload({ only: ['figures'] });
            })
            .catch((e) => alert(e?.response?.data?.message ?? 'تعذّر الحفظ'))
            .finally(() => setSaving(false));
    };

    const toggle = async (figure: AdminFigure) => {
        setBusyId(figure.id);
        try {
            await axios.post(`/api/v1/admin/compass/figures/${figure.id}/toggle`);
            router.reload({ only: ['figures'] });
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (figure: AdminFigure) => {
        if (!window.confirm(`حذف «${figure.name}»؟`)) return;
        setBusyId(figure.id);
        try {
            await axios.delete(`/api/v1/admin/compass/figures/${figure.id}`);
            router.reload({ only: ['figures'] });
        } finally {
            setBusyId(null);
        }
    };

    return (
        <MainLayout>
            <Head title="شخصيات بوصلة سوريا" />
            <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8" dir="rtl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Compass className="h-6 w-6 text-primary" />
                        <h1 className="text-xl font-extrabold">شخصيات بوصلة سوريا</h1>
                        <Badge variant="secondary" className="text-[11px]">
                            {enabledCount} مفعّلة من {figures.length}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        {canViewStats && (
                            <Button variant="outline" asChild>
                                <Link href="/admin/compass">الإحصاءات</Link>
                            </Button>
                        )}
                        <Button onClick={openCreate} className="gap-2">
                            <Plus className="h-4 w-4" /> إضافة شخصية
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">القائمة</CardTitle>
                        <CardDescription className="text-xs">
                            الشخصيات معطّلة افتراضياً؛ لن تدخل المطابقة حتى تُفعّلها. المواقف على المحاور من ‎−1‎ إلى ‎+1‎،
                            واترك الحقل فارغاً لـ«لا ينطبق».
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-14">الصورة</TableHead>
                                    <TableHead>الاسم</TableHead>
                                    <TableHead>الفئة</TableHead>
                                    <TableHead>التحالف</TableHead>
                                    <TableHead className="w-24">المحاور</TableHead>
                                    <TableHead className="w-24">مفعّلة</TableHead>
                                    <TableHead className="w-28">إجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {figures.map((f) => {
                                    const filled = AXES.filter((a) => f.positions?.[a.id] != null).length;
                                    return (
                                        <TableRow key={f.id}>
                                            <TableCell>
                                                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                                                    {f.imageUrl ? (
                                                        <img src={f.imageUrl} alt="" className="h-full w-full object-cover" />
                                                    ) : (
                                                        <ImageOff className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">{f.name}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {CATEGORY_LABEL[f.category] ?? f.category}
                                            </TableCell>
                                            <TableCell className="text-xs" dir="ltr">{f.align}</TableCell>
                                            <TableCell className="tabular-nums">{filled}/11</TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={f.enabled}
                                                    disabled={busyId === f.id}
                                                    onCheckedChange={() => toggle(f)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => openEdit(f)} aria-label="تعديل">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive"
                                                        onClick={() => remove(f)}
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
                        <DialogTitle className="text-right">{editing ? `تعديل «${editing.name}»` : 'إضافة شخصية'}</DialogTitle>
                        <DialogDescription className="text-right">
                            الاسم والفئة والتحالف والمواقف على المحاور، مع صورة تُرفع إلى R2.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="fig-name">الاسم</Label>
                                <Input
                                    id="fig-name"
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>الفئة</Label>
                                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))} dir="rtl">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map((c) => (
                                            <SelectItem key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="fig-align">التحالف (مثال: west/neutral)</Label>
                                <Input
                                    id="fig-align"
                                    dir="ltr"
                                    value={form.align}
                                    onChange={(e) => setForm((f) => ({ ...f, align: e.target.value }))}
                                />
                            </div>
                            <div className="flex items-end justify-between rounded-lg border p-3">
                                <Label>مفعّلة في المطابقة</Label>
                                <Switch
                                    checked={form.enabled}
                                    onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>الصورة</Label>
                            <div className="flex items-center gap-3">
                                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                                    {form.imageUrl ? (
                                        <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <ImageOff className="h-5 w-5 text-muted-foreground" />
                                    )}
                                </div>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleUpload(file);
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="gap-2"
                                    disabled={uploading}
                                    onClick={() => fileRef.current?.click()}
                                >
                                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                    رفع صورة
                                </Button>
                                {form.imageUrl && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="text-destructive"
                                        onClick={() => setForm((f) => ({ ...f, imageUrl: null, imagePath: null }))}
                                    >
                                        إزالة
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>المواقف على المحاور</Label>
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
                                            value={form.positions[a.id] ?? ''}
                                            onChange={(e) => setPosition(a.id, e.target.value)}
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
