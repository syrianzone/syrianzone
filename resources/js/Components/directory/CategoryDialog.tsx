import { useEffect } from 'react';
import { useForm } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/Components/ui/dialog';
import FieldError, { fieldA11y } from '@/Components/ui/field-error';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Switch } from '@/Components/ui/switch';

export interface DirectoryCategory {
    id: string;
    label_ar: string;
    label_en: string;
    is_active?: boolean;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The row being edited, or null to create one. */
    category: DirectoryCategory | null;
    /** Create posts here; update puts to `${endpoint}/${id}`. */
    endpoint: string;
    title?: { create: string; edit: string };
    submit?: { create: string; edit: string };
    slug?: { label: string; placeholder: string; maxLength?: number };
    activeLabel?: string;
    /** Renders a destructive button while editing, for a screen that deletes from here. */
    onDelete?: () => void;
    deleteLabel?: string;
}

/**
 * The name + slug + visibility form every directory category has. The page
 * passes its route, its labels and whether it offers delete; the fields, their
 * validation and their error wiring are one implementation.
 */
export default function CategoryDialog({
    open, onOpenChange, category, endpoint,
    title = { create: 'إضافة فئة جديدة', edit: 'تعديل الفئة' },
    submit = { create: 'إضافة الفئة', edit: 'حفظ التعديلات' },
    slug = { label: 'معرف الفئة (Slug - بالإنجليزية)', placeholder: 'مثال: embassies', maxLength: 64 },
    activeLabel = 'مفعلة وتظهر في الصفحة',
    onDelete,
    deleteLabel = 'حذف الفئة',
}: Props) {
    const isEditing = category !== null;
    const form = useForm({
        id: category?.id ?? '',
        label_ar: category?.label_ar ?? '',
        label_en: category?.label_en ?? '',
        is_active: category?.is_active ?? true,
    });

    useEffect(() => {
        if (category) {
            form.setData({
                id: category.id,
                label_ar: category.label_ar,
                label_en: category.label_en,
                is_active: category.is_active ?? true,
            });
        } else {
            form.setData({ id: '', label_ar: '', label_en: '', is_active: true });
        }
        form.clearErrors();
    }, [category, open]);

    const submitForm = (event: React.FormEvent) => {
        event.preventDefault();
        const done = { onSuccess: () => onOpenChange(false) };
        if (isEditing) form.put(`${endpoint}/${category.id}`, done);
        else form.post(endpoint, done);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle>{isEditing ? title.edit : title.create}</DialogTitle>
                </DialogHeader>

                <form onSubmit={submitForm} className="space-y-4 py-2">
                    {!isEditing && slug && (
                        <div className="space-y-2">
                            <Label htmlFor="category-id">{slug.label}</Label>
                            <Input
                                id="category-id"
                                placeholder={slug.placeholder}
                                value={form.data.id}
                                onChange={(event) => form.setData('id', event.target.value)}
                                maxLength={slug.maxLength}
                                required
                                dir="ltr"
                                className="text-left"
                                {...fieldA11y('category-id-error', form.errors.id)}
                            />
                            <FieldError id="category-id-error" message={form.errors.id} />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="category-label-ar">الاسم بالعربية</Label>
                        <Input
                            id="category-label-ar"
                            value={form.data.label_ar}
                            onChange={(event) => form.setData('label_ar', event.target.value)}
                            required
                            {...fieldA11y('category-label-ar-error', form.errors.label_ar)}
                        />
                        <FieldError id="category-label-ar-error" message={form.errors.label_ar} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category-label-en">الاسم بالإنجليزية</Label>
                        <Input
                            id="category-label-en"
                            value={form.data.label_en}
                            onChange={(event) => form.setData('label_en', event.target.value)}
                            required
                            dir="ltr"
                            className="text-left"
                            {...fieldA11y('category-label-en-error', form.errors.label_en)}
                        />
                        <FieldError id="category-label-en-error" message={form.errors.label_en} />
                    </div>

                    <div className="flex items-center justify-between border-t pt-2">
                        <Label htmlFor="category-active">{activeLabel}</Label>
                        <Switch
                            id="category-active"
                            checked={form.data.is_active}
                            onCheckedChange={(checked) => form.setData('is_active', checked)}
                        />
                    </div>

                    <DialogFooter className="gap-2 pt-4 sm:gap-0">
                        {isEditing && onDelete && (
                            <Button type="button" variant="destructive" onClick={onDelete} className="me-auto">
                                {deleteLabel}
                            </Button>
                        )}
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {isEditing ? submit.edit : submit.create}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
