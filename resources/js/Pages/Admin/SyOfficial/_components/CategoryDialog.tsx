import React, { useEffect } from 'react';
import { useForm } from '@inertiajs/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/Components/ui/dialog';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Button } from '@/Components/ui/button';
import { Switch } from '@/Components/ui/switch';

export interface CategoryData {
    id: string;
    label_ar: string;
    label_en: string;
    icon?: string;
    is_active: boolean;
}

interface CategoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    category?: CategoryData | null;
}

export default function CategoryDialog({ open, onOpenChange, category }: CategoryDialogProps) {
    const isEditing = !!category;

    const { data, setData, post, put, processing, errors, reset } = useForm({
        id: category?.id || '',
        label_ar: category?.label_ar || '',
        label_en: category?.label_en || '',
        icon: category?.icon || '',
        is_active: category?.is_active ?? true,
    });

    useEffect(() => {
        if (category) {
            setData({
                id: category.id,
                label_ar: category.label_ar,
                label_en: category.label_en,
                icon: category.icon || '',
                is_active: category.is_active,
            });
        } else {
            reset();
        }
    }, [category]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEditing) {
            put(`/api/v1/admin/syofficial/categories/${category.id}`, {
                onSuccess: () => {
                    onOpenChange(false);
                    reset();
                },
            });
        } else {
            post('/api/v1/admin/syofficial/categories', {
                onSuccess: () => {
                    onOpenChange(false);
                    reset();
                },
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'تعديل الفئة' : 'إضافة فئة جديدة'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    {!isEditing && (
                        <div className="space-y-2">
                            <Label htmlFor="cat_id">معرف الفئة (Slug - بالإنجليزية)</Label>
                            <Input
                                id="cat_id"
                                placeholder="مثال: embassies"
                                value={data.id}
                                onChange={(e) => setData('id', e.target.value)}
                                className="text-left dir-ltr"
                            />
                            {errors.id && <span className="text-xs text-destructive">{errors.id}</span>}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="label_ar">الاسم بالعربية</Label>
                        <Input
                            id="label_ar"
                            placeholder="السفارات"
                            value={data.label_ar}
                            onChange={(e) => setData('label_ar', e.target.value)}
                        />
                        {errors.label_ar && <span className="text-xs text-destructive">{errors.label_ar}</span>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="label_en">الاسم بالإنجليزية</Label>
                        <Input
                            id="label_en"
                            placeholder="Embassies"
                            value={data.label_en}
                            onChange={(e) => setData('label_en', e.target.value)}
                            className="text-left dir-ltr"
                        />
                        {errors.label_en && <span className="text-xs text-destructive">{errors.label_en}</span>}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                        <Label htmlFor="cat_active">مفعلة وتظهر في الصفحة</Label>
                        <Switch
                            id="cat_active"
                            checked={data.is_active}
                            onCheckedChange={(checked) => setData('is_active', checked)}
                        />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {isEditing ? 'حفظ التعديلات' : 'إضافة الفئة'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
