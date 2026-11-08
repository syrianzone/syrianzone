import { useMemo, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import axios from '@/Lib/axios';
import MainLayout from '@/Layouts/MainLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/Components/ui/dialog';
import { ImageUp, Loader2, Pencil, Search, Trash2, UserPlus } from 'lucide-react';
import { notify } from '@/Lib/notify';
import { confirmDialog } from '@/Lib/confirm';
import { extractApiErrorMessage, extractApiFieldErrors } from '@/Lib/apiError';
import SpeakerAvatar from '@/Pages/Promises/_components/SpeakerAvatar';
import FieldError, { fieldA11y } from '@/Pages/Promises/_components/FieldError';
import SpeakerPicker from '@/Pages/Promises/_components/SpeakerPicker';
import { PENDING_SPEAKER_LABEL, SPEAKER_SOURCE_LABEL } from '@/Pages/Promises/_lib/status';
import type { SpeakerOption } from '@/Pages/Promises/_lib/types';
import AdminHeader from './_components/AdminHeader';
import { useCan } from './_lib/useCan';
import type { AdminSpeaker } from './_lib/types';

interface Props {
    speakers: AdminSpeaker[];
    institutions: Array<{ id: string; name: string }>;
    queueCount: number;
}

const NONE = '__none';

interface SpeakerForm {
    name: string;
    title: string;
    institutionId: string;
    imageUrl: string;
    xHandle: string;
}

const emptyForm = (): SpeakerForm => ({ name: '', title: '', institutionId: NONE, imageUrl: '', xHandle: '' });

export default function PromiseSpeakers({ speakers, institutions, queueCount }: Props) {
    const can = useCan();
    const canManage = can('promises.speakers');

    const [q, setQ] = useState('');
    const [linking, setLinking] = useState<SpeakerOption | null>(null);
    const [editing, setEditing] = useState<AdminSpeaker | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState<SpeakerForm>(emptyForm);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const visible = useMemo(() => {
        const needle = q.trim();
        return needle ? speakers.filter((s) => `${s.name} ${s.title ?? ''}`.includes(needle)) : speakers;
    }, [speakers, q]);

    const link = async (option: SpeakerOption) => {
        setLinking(option);
        try {
            await axios.post('/api/v1/admin/promises/speakers', { ref: option.ref });
            notify.success(`أُضيف ${option.name} إلى القائمة`);
            router.reload({ only: ['speakers'] });
        } catch (e) {
            notify.error(extractApiErrorMessage(e, 'تعذّرت الإضافة'));
        } finally {
            setLinking(null);
        }
    };

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm());
        setErrors({});
        setDialogOpen(true);
    };

    const openEdit = (s: AdminSpeaker) => {
        setEditing(s);
        setForm({
            name: s.name,
            title: s.title ?? '',
            institutionId: s.institutionId ?? NONE,
            imageUrl: s.imageUrl ?? '',
            xHandle: s.xHandle ?? '',
        });
        setErrors({});
        setDialogOpen(true);
    };

    const upload = async (file: File) => {
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            fd.append('kind', 'speaker');
            const res = await axios.post('/api/v1/admin/promises/speakers/upload-image', fd);
            setForm((f) => ({ ...f, imageUrl: res.data.url }));
        } catch (e) {
            notify.error(extractApiErrorMessage(e, 'تعذّر رفع الصورة'));
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setErrors({});
        const payload = {
            name: form.name.trim(),
            title: form.title.trim() || null,
            institution_id: form.institutionId === NONE ? null : form.institutionId,
            image_url: form.imageUrl.trim() || null,
            x_handle: form.xHandle.trim() || null,
        };
        try {
            if (editing) await axios.put(`/api/v1/admin/promises/speakers/${editing.id}`, payload);
            else await axios.post('/api/v1/admin/promises/speakers', payload);
            notify.success('تم الحفظ');
            setDialogOpen(false);
            router.reload({ only: ['speakers'] });
        } catch (err) {
            setErrors(extractApiFieldErrors(err));
            notify.error(extractApiErrorMessage(err, 'تعذّر الحفظ'));
        } finally {
            setSaving(false);
        }
    };

    const remove = async (s: AdminSpeaker) => {
        if (!(await confirmDialog({ title: `حذف «${s.name}» من القائمة؟`, destructive: true, confirmText: 'حذف' }))) return;
        try {
            await axios.delete(`/api/v1/admin/promises/speakers/${s.id}`);
            notify.success('حُذف');
            router.reload({ only: ['speakers'] });
        } catch (e) {
            notify.error(extractApiErrorMessage(e, 'تعذّر الحذف'));
        }
    };

    return (
        <MainLayout>
            <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8" dir="rtl">
                <AdminHeader
                    title="أصحاب التصريحات"
                    current="speakers"
                    queueCount={queueCount}
                    actions={canManage && (
                        <Button onClick={openCreate} className="gap-2"><UserPlus className="h-4 w-4" aria-hidden="true" />إضافة شخص جديد</Button>
                    )}
                />

                {canManage && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">أضف من قوائم الموقع</CardTitle>
                            <CardDescription>
                                ابحث في المسؤولين الموجودين أصلاً (تقييم الحكومة، الحسابات الرسمية، مجلس الشعب) لربطهم بدل إدخالهم من جديد.
                                تُقرأ الصورة والحساب من السجل الأصلي.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="max-w-md">
                            <Label htmlFor="link-speaker" className="sr-only">ابحث عن مسؤول لإضافته</Label>
                            <SpeakerPicker id="link-speaker" endpoint="/api/v1/admin/promises/speakers/search" value={linking} onChange={link} />
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardContent className="space-y-4 p-5">
                        <div className="relative w-full sm:w-72">
                            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                            <Input aria-label="بحث في القائمة" placeholder="بحث بالاسم أو المنصب..." value={q} onChange={(e) => setQ(e.target.value)} className="ps-9" />
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>الاسم</TableHead>
                                        <TableHead>الجهة</TableHead>
                                        <TableHead>المصدر</TableHead>
                                        <TableHead className="w-16">الوعود</TableHead>
                                        <TableHead className="w-28">إجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {visible.length === 0 && (
                                        <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">لا أحد في القائمة بعد.</TableCell></TableRow>
                                    )}
                                    {visible.map((s) => (
                                        <TableRow key={s.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2.5">
                                                    <SpeakerAvatar name={s.name} image={s.image} size={32} />
                                                    <div>
                                                        <p className="font-medium text-foreground">
                                                            {s.name}
                                                            {s.status === 'pending' && <Badge variant="outline" className="ms-1.5 text-[10px]">{PENDING_SPEAKER_LABEL}</Badge>}
                                                        </p>
                                                        {s.title && <p className="text-xs text-muted-foreground">{s.title}</p>}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{s.institutionName ?? '—'}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{s.link ? SPEAKER_SOURCE_LABEL[s.link] : 'إدخال يدوي'}</TableCell>
                                            <TableCell className="tabular-nums">{s.promisesCount}</TableCell>
                                            <TableCell>
                                                {canManage && (
                                                    <div className="flex items-center gap-1">
                                                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label={`تعديل «${s.name}»`}>
                                                            <Pencil className="h-4 w-4" aria-hidden="true" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive"
                                                            disabled={s.promisesCount > 0}
                                                            onClick={() => remove(s)}
                                                            aria-label={s.promisesCount > 0 ? `لا يمكن حذف «${s.name}» لارتباطه بوعود` : `حذف «${s.name}»`}
                                                        >
                                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
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
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent dir="rtl" className="sm:max-w-lg">
                    <form onSubmit={save} className="space-y-4" noValidate>
                        <DialogHeader>
                            <DialogTitle>{editing ? `تعديل «${editing.name}»` : 'إضافة شخص جديد'}</DialogTitle>
                            <DialogDescription>
                                {editing?.link ? 'الصورة والحساب يُقرآن من السجل الأصلي ما لم تحدّد غيرهما هنا.' : 'لمن ليس في قوائم الموقع بعد، مثل المتحدثين الرسميين.'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-1.5">
                            <Label htmlFor="speaker-name">الاسم</Label>
                            <Input id="speaker-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} {...fieldA11y('speaker-name-error', errors.name)} />
                            <FieldError id="speaker-name-error" message={errors.name} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="speaker-title">المنصب الحالي</Label>
                            <Input id="speaker-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} {...fieldA11y('speaker-title-error', errors.title)} />
                            <FieldError id="speaker-title-error" message={errors.title} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="speaker-institution">الجهة</Label>
                            <Select value={form.institutionId} onValueChange={(v) => setForm((f) => ({ ...f, institutionId: v }))}>
                                <SelectTrigger id="speaker-institution"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE}>— بلا جهة —</SelectItem>
                                    {institutions.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="speaker-image">الصورة</Label>
                            <div className="flex items-center gap-2">
                                <SpeakerAvatar name={form.name} image={form.imageUrl || editing?.image || null} size={36} />
                                <Input id="speaker-image" dir="ltr" value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="رابط الصورة أو ارفعها" {...fieldA11y('speaker-image-error', errors.image_url)} />
                                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-hidden="true" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
                                <Button type="button" variant="outline" size="icon" disabled={uploading} onClick={() => fileRef.current?.click()} aria-label="رفع صورة">
                                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImageUp className="h-4 w-4" aria-hidden="true" />}
                                </Button>
                            </div>
                            <FieldError id="speaker-image-error" message={errors.image_url} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="speaker-x">الحساب على إكس</Label>
                            <Input id="speaker-x" dir="ltr" value={form.xHandle} onChange={(e) => setForm((f) => ({ ...f, xHandle: e.target.value }))} placeholder="@handle" {...fieldA11y('speaker-x-error', errors.x_handle)} />
                            <FieldError id="speaker-x-error" message={errors.x_handle} />
                        </div>
                        <DialogFooter className="gap-2 sm:justify-start">
                            <Button type="submit" disabled={saving} className="gap-2">
                                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}حفظ
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
}
