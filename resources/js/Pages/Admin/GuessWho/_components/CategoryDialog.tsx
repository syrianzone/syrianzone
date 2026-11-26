import React, { useState, useEffect, useRef } from 'react';
import { router } from '@inertiajs/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/Components/ui/dialog';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Switch } from '@/Components/ui/switch';
import FieldError, { fieldA11y } from '@/Components/ui/field-error';
import { notify } from '@/Lib/notify';

export interface GuessWhoCategoryData {
    id: number;
    name_ar: string;
    name_en: string;
    slug: string;
    is_active: boolean;
    characters_count?: number;
}

interface CategoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    category: GuessWhoCategoryData | null;
}

export default function CategoryDialog({ open, onOpenChange, category }: CategoryDialogProps) {
    const isEdit = !!category;

    const [nameAr, setNameAr] = useState('');
    const [nameEn, setNameEn] = useState('');
    const [slug, setSlug] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const formRef = useRef<HTMLFormElement>(null);

    // After the server rejects the save, focus the first invalid field so its
    // message is announced where it can be fixed.
    useEffect(() => {
        if (Object.keys(errors).length === 0) return;
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }, [errors]);

    useEffect(() => {
        if (category) {
            setNameAr(category.name_ar || '');
            setNameEn(category.name_en || '');
            setSlug(category.slug || '');
            setIsActive(category.is_active ?? true);
        } else {
            setNameAr('');
            setNameEn('');
            setSlug('');
            setIsActive(true);
        }
        setErrors({});
    }, [category, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        const payload = { name_ar: nameAr, name_en: nameEn, slug, is_active: isActive };
        const opts = {
            onSuccess: () => { setProcessing(false); onOpenChange(false); },
            onError: (errs: Record<string, string>) => {
                setProcessing(false);
                setErrors(errs);
                const shown = ['name_ar', 'name_en', 'slug'];
                if (!Object.keys(errs).some((key) => shown.includes(key))) {
                    notify.error(Object.values(errs)[0] ?? 'تعذر حفظ الفئة');
                }
            },
        };
        if (isEdit) {
            router.put(`/api/v1/admin/guesswho/categories/${category.id}`, payload, opts);
        } else {
            router.post('/api/v1/admin/guesswho/categories', payload, opts);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                        {isEdit ? `تعديل الفئة: ${category.name_ar}` : 'إضافة فئة جديدة'}
                    </DialogTitle>
                    <DialogDescription>بيانات فئة لعبة من هو.</DialogDescription>
                </DialogHeader>

                <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="gw-cat-nameAr" className="font-semibold text-xs">الاسم (بالعربية)</Label>
                            <Input id="gw-cat-nameAr" value={nameAr} onChange={(e) => setNameAr(e.target.value)} required {...fieldA11y('gw-cat-nameAr-error', errors.name_ar)} />
                            <FieldError id="gw-cat-nameAr-error" message={errors.name_ar} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="gw-cat-nameEn" className="font-semibold text-xs">الاسم (بالإنكليزية)</Label>
                            <Input id="gw-cat-nameEn" value={nameEn} onChange={(e) => setNameEn(e.target.value)} required dir="ltr" {...fieldA11y('gw-cat-nameEn-error', errors.name_en)} />
                            <FieldError id="gw-cat-nameEn-error" message={errors.name_en} />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="gw-cat-slug" className="font-semibold text-xs">المعرّف الفريد (Slug)</Label>
                        <Input
                            id="gw-cat-slug"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, ''))}
                            required
                            dir="ltr"
                            placeholder="مثال: football-players"
                            {...fieldA11y('gw-cat-slug-error', errors.slug)}
                        />
                        <FieldError id="gw-cat-slug-error" message={errors.slug} />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                        <Label htmlFor="gw-cat-active" className="cursor-pointer font-semibold text-xs">تفعيل الظهور في اللعبة</Label>
                        <Switch id="gw-cat-active" checked={isActive} onCheckedChange={setIsActive} />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'جاري الحفظ...' : (isEdit ? 'حفظ التغييرات' : 'إضافة الفئة')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
