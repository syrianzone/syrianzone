import { useState } from 'react';
import { router } from '@inertiajs/react';
import axios from '@/Lib/axios';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Switch } from '@/Components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/Components/ui/dialog';
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { notify } from '@/Lib/notify';
import { confirmDialog } from '@/Lib/confirm';
import { extractApiErrorMessage, extractApiFieldErrors } from '@/Lib/apiError';
import FieldError, { fieldA11y } from '@/Components/ui/field-error';
import { SECTOR_ICONS, SECTOR_ICON_LABELS, sectorIcon } from '@/Domain/promises/status';
import AdminHeader from './_components/AdminHeader';
import { useCan } from './_lib/useCan';

interface AdminSector {
    id: string;
    label: string;
    icon: string | null;
    isActive: boolean;
    promisesCount: number;
}

interface Props {
    sectors: AdminSector[];
    queueCount: number;
}

export default function PromiseSectors({ sectors, queueCount }: Props) {
    const can = useCan();
    const canManage = can('promises.speakers');

    const [editing, setEditing] = useState<AdminSector | null>(null);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ id: '', label: '', icon: 'circle-ellipsis' });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);

    const reload = () => router.reload({ only: ['sectors'] });

    const openCreate = () => {
        setEditing(null);
        setForm({ id: '', label: '', icon: 'circle-ellipsis' });
        setErrors({});
        setOpen(true);
    };

    const openEdit = (s: AdminSector) => {
        setEditing(s);
        setForm({ id: s.id, label: s.label, icon: s.icon ?? 'circle-ellipsis' });
        setErrors({});
        setOpen(true);
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setErrors({});
        try {
            if (editing) await axios.put(`/api/v1/admin/promises/sectors/${editing.id}`, { label: form.label, icon: form.icon });
            else await axios.post('/api/v1/admin/promises/sectors', form);
            notify.success('تم الحفظ');
            setOpen(false);
            reload();
        } catch (err) {
            setErrors(extractApiFieldErrors(err));
            notify.error(extractApiErrorMessage(err, 'تعذّر الحفظ'));
        } finally {
            setSaving(false);
        }
    };

    const toggle = async (s: AdminSector) => {
        setBusy(s.id);
        try {
            await axios.patch(`/api/v1/admin/promises/sectors/${s.id}/toggle`);
            reload();
        } catch (e) {
            notify.error(extractApiErrorMessage(e, 'تعذّر التحديث'));
        } finally {
            setBusy(null);
        }
    };

    const move = async (index: number, delta: -1 | 1) => {
        const ids = sectors.map((s) => s.id);
        const target = index + delta;
        if (target < 0 || target >= ids.length) return;
        [ids[index], ids[target]] = [ids[target], ids[index]];
        try {
            await axios.post('/api/v1/admin/promises/sectors/reorder', { ids });
            reload();
        } catch (e) {
            notify.error(extractApiErrorMessage(e, 'تعذّر الترتيب'));
        }
    };

    const remove = async (s: AdminSector) => {
        if (!(await confirmDialog({ title: `حذف قطاع «${s.label}»؟`, destructive: true, confirmText: 'حذف' }))) return;
        try {
            await axios.delete(`/api/v1/admin/promises/sectors/${s.id}`);
            notify.success('حُذف القطاع');
            reload();
        } catch (e) {
            notify.error(extractApiErrorMessage(e, 'تعذّر الحذف'));
        }
    };

    return (
        <MainLayout>
            <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8" dir="rtl">
                <AdminHeader
                    title="قطاعات الوعود"
                    current="sectors"
                    queueCount={queueCount}
                    actions={canManage && <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" aria-hidden="true" />إضافة قطاع</Button>}
                />

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">القطاعات</CardTitle>
                        <CardDescription>تظهر في تصفية الصفحة العامة بهذا الترتيب. القطاع المخفي يبقى على وعوده لكنه يختفي من التصفية.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>القطاع</TableHead>
                                    <TableHead className="w-20">الوعود</TableHead>
                                    <TableHead className="w-20">ظاهر</TableHead>
                                    <TableHead className="w-44">إجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sectors.map((s, i) => {
                                    const Icon = sectorIcon(s.icon);
                                    return (
                                        <TableRow key={s.id}>
                                            <TableCell>
                                                <span className="inline-flex items-center gap-2 font-medium text-foreground">
                                                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{s.label}
                                                </span>
                                                <span className="ms-2 text-xs text-muted-foreground" dir="ltr">{s.id}</span>
                                            </TableCell>
                                            <TableCell className="tabular-nums">{s.promisesCount}</TableCell>
                                            <TableCell>
                                                <Switch checked={s.isActive} disabled={!canManage || busy === s.id} onCheckedChange={() => toggle(s)} aria-label={`إظهار قطاع «${s.label}»`} />
                                            </TableCell>
                                            <TableCell>
                                                {canManage && (
                                                    <div className="flex items-center gap-1">
                                                        <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`نقل «${s.label}» إلى الأعلى`}>
                                                            <ArrowUp className="h-4 w-4" aria-hidden="true" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" disabled={i === sectors.length - 1} onClick={() => move(i, 1)} aria-label={`نقل «${s.label}» إلى الأسفل`}>
                                                            <ArrowDown className="h-4 w-4" aria-hidden="true" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label={`تعديل «${s.label}»`}>
                                                            <Pencil className="h-4 w-4" aria-hidden="true" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive"
                                                            disabled={s.promisesCount > 0}
                                                            onClick={() => remove(s)}
                                                            aria-label={s.promisesCount > 0 ? `لا يمكن حذف «${s.label}» لأنه مستخدم` : `حذف «${s.label}»`}
                                                        >
                                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                        </Button>
                                                    </div>
                                                )}
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
                <DialogContent dir="rtl" className="sm:max-w-md">
                    <form onSubmit={save} className="space-y-4" noValidate>
                        <DialogHeader>
                            <DialogTitle>{editing ? `تعديل «${editing.label}»` : 'إضافة قطاع'}</DialogTitle>
                            <DialogDescription>المعرّف ثابت ويُستخدم في روابط التصفية.</DialogDescription>
                        </DialogHeader>
                        {!editing && (
                            <div className="space-y-1.5">
                                <Label htmlFor="sector-id">المعرّف (بالإنكليزية)</Label>
                                <Input id="sector-id" dir="ltr" value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value.toLowerCase() }))} placeholder="agriculture" {...fieldA11y('sector-id-error', errors.id)} />
                                <FieldError id="sector-id-error" message={errors.id} />
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label htmlFor="sector-label">الاسم</Label>
                            <Input id="sector-label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} {...fieldA11y('sector-label-error', errors.label)} />
                            <FieldError id="sector-label-error" message={errors.label} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="sector-icon">الأيقونة</Label>
                            <Select value={form.icon} onValueChange={(v) => setForm((f) => ({ ...f, icon: v }))}>
                                <SelectTrigger id="sector-icon"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(SECTOR_ICONS).map(([key, Icon]) => (
                                        <SelectItem key={key} value={key}>
                                            <span className="inline-flex items-center gap-2"><Icon className="h-4 w-4" aria-hidden="true" />{SECTOR_ICON_LABELS[key] ?? key}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter className="gap-2 sm:justify-start">
                            <Button type="submit" disabled={saving} className="gap-2">
                                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}حفظ
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
}
