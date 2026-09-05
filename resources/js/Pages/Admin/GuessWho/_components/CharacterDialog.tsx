import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/Components/ui/dialog';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Textarea } from '@/Components/ui/textarea';
import { Switch } from '@/Components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { ImagePlus } from 'lucide-react';
import type { GuessWhoCategoryData } from './CategoryDialog';

export interface GuessWhoCharacterData {
    id: number;
    category_id: number;
    name_ar: string;
    name_en: string;
    image_path: string;
    attributes?: Record<string, string> | null;
    is_active: boolean;
    category?: { id: number; name_ar: string };
}

/** Parse `key: value` lines into an object (Filament KeyValue equivalent). */
function parseAttributes(text: string): Record<string, string> | null {
    const out: Record<string, string> = {};
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const sep = trimmed.indexOf(':');
        if (sep === -1) continue;
        const key = trimmed.slice(0, sep).trim();
        const value = trimmed.slice(sep + 1).trim();
        if (key) out[key] = value;
    }
    return Object.keys(out).length > 0 ? out : null;
}

function stringifyAttributes(attrs?: Record<string, string> | null): string {
    if (!attrs) return '';
    return Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join('\n');
}

interface CharacterDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    character: GuessWhoCharacterData | null;
    categories: GuessWhoCategoryData[];
    defaultCategoryId?: number | null;
}

export default function CharacterDialog({ open, onOpenChange, character, categories, defaultCategoryId }: CharacterDialogProps) {
    const isEdit = !!character;

    const [categoryId, setCategoryId] = useState<string>('');
    const [nameAr, setNameAr] = useState('');
    const [nameEn, setNameEn] = useState('');
    const [attributesText, setAttributesText] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (character) {
            setCategoryId(String(character.category_id));
            setNameAr(character.name_ar || '');
            setNameEn(character.name_en || '');
            setAttributesText(stringifyAttributes(character.attributes));
            setIsActive(character.is_active ?? true);
            setImagePreview(`/storage/${character.image_path}`);
        } else {
            setCategoryId(defaultCategoryId ? String(defaultCategoryId) : (categories[0] ? String(categories[0].id) : ''));
            setNameAr('');
            setNameEn('');
            setAttributesText('');
            setIsActive(true);
            setImagePreview(null);
        }
        setImageFile(null);
    }, [character, open]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!categoryId) return;
        setProcessing(true);

        const formData = new FormData();
        formData.append('category_id', categoryId);
        formData.append('name_ar', nameAr);
        formData.append('name_en', nameEn);
        formData.append('is_active', isActive ? '1' : '0');
        const attrs = parseAttributes(attributesText);
        if (attrs) {
            Object.entries(attrs).forEach(([k, v]) => formData.append(`attributes[${k}]`, v));
        }
        if (imageFile) {
            formData.append('image_file', imageFile);
        }

        const opts = {
            onSuccess: () => { setProcessing(false); onOpenChange(false); },
            onError: () => setProcessing(false),
        };
        if (isEdit) {
            formData.append('_method', 'PUT');
            router.post(`/api/v1/admin/guesswho/characters/${character.id}`, formData, opts);
        } else {
            router.post('/api/v1/admin/guesswho/characters', formData, opts);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                        {isEdit ? `تعديل الشخصية: ${character.name_ar}` : 'إضافة شخصية جديدة'}
                    </DialogTitle>
                    <DialogDescription>بيانات الشخصية وصورتها وسماتها (مثال: gender: male).</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <Label className="font-semibold text-xs">الفئة</Label>
                        <Select value={categoryId} onValueChange={setCategoryId}>
                            <SelectTrigger>
                                <SelectValue placeholder="اختر الفئة" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((c) => (
                                    <SelectItem key={c.id} value={String(c.id)}>{c.name_ar}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="gw-char-nameAr" className="font-semibold text-xs">الاسم (بالعربية)</Label>
                            <Input id="gw-char-nameAr" value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="gw-char-nameEn" className="font-semibold text-xs">الاسم (بالإنكليزية)</Label>
                            <Input id="gw-char-nameEn" value={nameEn} onChange={(e) => setNameEn(e.target.value)} required dir="ltr" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="font-semibold text-xs">صورة الشخصية {isEdit ? '(اتركها فارغة للإبقاء على الحالية)' : ''}</Label>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full overflow-hidden bg-muted border flex items-center justify-center flex-shrink-0">
                                {imagePreview ? (
                                    <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <ImagePlus className="w-8 h-8 text-muted-foreground/40" />
                                )}
                            </div>
                            <div className="flex-1">
                                <Label htmlFor="gw-char-image" className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted transition-colors">
                                    <ImagePlus className="w-4 h-4" />
                                    <span>اختر صورة</span>
                                </Label>
                                <Input id="gw-char-image" type="file" accept="image/*" className="hidden" onChange={handleImageChange} required={!isEdit} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="gw-char-attrs" className="font-semibold text-xs">السمات (سطر لكل سمة بصيغة key: value)</Label>
                        <Textarea
                            id="gw-char-attrs"
                            rows={3}
                            dir="ltr"
                            value={attributesText}
                            onChange={(e) => setAttributesText(e.target.value)}
                            placeholder={'gender: male\nglasses: true'}
                        />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                        <Label htmlFor="gw-char-active" className="cursor-pointer font-semibold text-xs">تفعيل الظهور في اللعبة</Label>
                        <Switch id="gw-char-active" checked={isActive} onCheckedChange={setIsActive} />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'جاري الحفظ...' : (isEdit ? 'حفظ التغييرات' : 'إضافة الشخصية')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
