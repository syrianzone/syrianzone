import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/Components/ui/dialog';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Switch } from '@/Components/ui/switch';

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
    }, [category, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        const payload = { name_ar: nameAr, name_en: nameEn, slug, is_active: isActive };
        const opts = {
            onSuccess: () => { setProcessing(false); onOpenChange(false); },
            onError: () => setProcessing(false),
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

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="gw-cat-nameAr" className="font-semibold text-xs">الاسم (بالعربية)</Label>
                            <Input id="gw-cat-nameAr" value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="gw-cat-nameEn" className="font-semibold text-xs">الاسم (بالإنكليزية)</Label>
                            <Input id="gw-cat-nameEn" value={nameEn} onChange={(e) => setNameEn(e.target.value)} required dir="ltr" />
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
                        />
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
