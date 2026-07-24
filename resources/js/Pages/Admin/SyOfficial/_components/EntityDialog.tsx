import React, { useEffect, useState } from 'react';
import { useForm } from '@inertiajs/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/Components/ui/dialog';
import { Input } from '@/Components/ui/input';
import { Textarea } from '@/Components/ui/textarea';
import { Label } from '@/Components/ui/label';
import { Button } from '@/Components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Switch } from '@/Components/ui/switch';
import { UploadCloud, Image as ImageIcon } from 'lucide-react';

export interface CategoryOption {
    id: string;
    label_ar: string;
    label_en: string;
}

export interface EntityData {
    id: string;
    category_id: string;
    name: string;
    name_ar: string;
    description?: string;
    description_ar?: string;
    image?: string;
    socials?: Record<string, string>;
    is_active: boolean;
}

interface EntityDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entity?: EntityData | null;
    categories: CategoryOption[];
}

export default function EntityDialog({ open, onOpenChange, entity, categories }: EntityDialogProps) {
    const isEditing = !!entity;
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const { data, setData, post, processing, errors, reset } = useForm({
        id: entity?.id || '',
        category_id: entity?.category_id || (categories[0]?.id || ''),
        name: entity?.name || '',
        name_ar: entity?.name_ar || '',
        description: entity?.description || '',
        description_ar: entity?.description_ar || '',
        image_file: null as File | null,
        is_active: entity?.is_active ?? true,
        socials: {
            facebook: entity?.socials?.facebook || '',
            facebook_secondary: entity?.socials?.facebook_secondary || '',
            instagram: entity?.socials?.instagram || '',
            instagram_secondary: entity?.socials?.instagram_secondary || '',
            twitter: entity?.socials?.twitter || '',
            twitter_secondary: entity?.socials?.twitter_secondary || '',
            telegram: entity?.socials?.telegram || '',
            telegram_secondary: entity?.socials?.telegram_secondary || '',
            website: entity?.socials?.website || '',
            whatsapp: entity?.socials?.whatsapp || '',
            youtube: entity?.socials?.youtube || '',
            linkedin: entity?.socials?.linkedin || '',
        },
    });

    useEffect(() => {
        if (entity) {
            setData({
                id: entity.id,
                category_id: entity.category_id,
                name: entity.name,
                name_ar: entity.name_ar,
                description: entity.description || '',
                description_ar: entity.description_ar || '',
                image_file: null,
                is_active: entity.is_active,
                socials: {
                    facebook: entity.socials?.facebook || '',
                    facebook_secondary: entity.socials?.facebook_secondary || '',
                    instagram: entity.socials?.instagram || '',
                    instagram_secondary: entity.socials?.instagram_secondary || '',
                    twitter: entity.socials?.twitter || '',
                    twitter_secondary: entity.socials?.twitter_secondary || '',
                    telegram: entity.socials?.telegram || '',
                    telegram_secondary: entity.socials?.telegram_secondary || '',
                    website: entity.socials?.website || '',
                    whatsapp: entity.socials?.whatsapp || '',
                    youtube: entity.socials?.youtube || '',
                    linkedin: entity.socials?.linkedin || '',
                },
            });
            setImagePreview(entity.image && (entity.image.startsWith('http') || entity.image.startsWith('/')) ? entity.image : null);
        } else {
            reset();
            setImagePreview(null);
        }
    }, [entity]);

    const handleSocialChange = (key: string, value: string) => {
        setData('socials', {
            ...data.socials,
            [key]: value,
        });
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setData('image_file', file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const endpoint = isEditing
            ? `/api/v1/admin/syofficial/entities/${entity.id}`
            : '/api/v1/admin/syofficial/entities';

        post(endpoint, {
            forceFormData: true,
            onSuccess: () => {
                onOpenChange(false);
                reset();
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'تعديل بيانات الجهة الرسمية' : 'إضافة جهة رسمية جديدة'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    {/* ID & Category */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {!isEditing ? (
                            <div className="space-y-2">
                                <Label htmlFor="ent_id">معرف الجهة (ID - بالإنجليزية)</Label>
                                <Input
                                    id="ent_id"
                                    placeholder="مثال: gov-damascus"
                                    value={data.id}
                                    onChange={(e) => setData('id', e.target.value)}
                                    className="text-left dir-ltr"
                                />
                                {errors.id && <span className="text-xs text-destructive">{errors.id}</span>}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>معرف الجهة</Label>
                                <Input value={entity.id} disabled className="bg-muted text-left dir-ltr" />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="category_id">الفئة</Label>
                            <Select value={data.category_id} onValueChange={(val) => setData('category_id', val)}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="اختر الفئة" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.label_ar} ({c.label_en})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.category_id && <span className="text-xs text-destructive">{errors.category_id}</span>}
                        </div>
                    </div>

                    {/* Names AR / EN */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name_ar">الاسم بالعربية</Label>
                            <Input
                                id="name_ar"
                                placeholder="محافظة دمشق"
                                value={data.name_ar}
                                onChange={(e) => setData('name_ar', e.target.value)}
                            />
                            {errors.name_ar && <span className="text-xs text-destructive">{errors.name_ar}</span>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">الاسم بالإنجليزية</Label>
                            <Input
                                id="name"
                                placeholder="Damascus Governorate"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                className="text-left dir-ltr"
                            />
                            {errors.name && <span className="text-xs text-destructive">{errors.name}</span>}
                        </div>
                    </div>

                    {/* Descriptions AR / EN */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="desc_ar">الوصف بالعربية (اختياري)</Label>
                            <Textarea
                                id="desc_ar"
                                rows={2}
                                value={data.description_ar}
                                onChange={(e) => setData('description_ar', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="desc">الوصف بالإنجليزية (اختياري)</Label>
                            <Textarea
                                id="desc"
                                rows={2}
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                className="text-left dir-ltr"
                            />
                        </div>
                    </div>

                    {/* Image Upload (R2 / WebP) */}
                    <div className="space-y-2">
                        <Label>الشعار / الصورة (يتم تحويلها لـ WebP ورفعها لـ R2)</Label>
                        <div className="flex items-center gap-4 border border-dashed border-border rounded-xl p-4 bg-card">
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center flex-shrink-0 border">
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                                )}
                            </div>
                            <div className="flex-1">
                                <input
                                    type="file"
                                    id="image_file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="hidden"
                                />
                                <Label htmlFor="image_file" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                                    <UploadCloud className="w-4 h-4" />
                                    <span>اختر صورة جديدة</span>
                                </Label>
                                <p className="text-xs text-muted-foreground mt-1">يدعم PNG, JPG, WEBP (حجم أقصى 5 ميغابايت)</p>
                            </div>
                        </div>
                        {errors.image_file && <span className="text-xs text-destructive">{errors.image_file}</span>}
                    </div>

                    {/* Social Media Links */}
                    <div className="space-y-3 pt-2 border-t">
                        <h4 className="font-bold text-sm text-foreground">روابط وسائل التواصل الاجتماعي</h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                                <Label className="text-xs">فيسبوك رئيسي</Label>
                                <Input value={data.socials.facebook} onChange={(e) => handleSocialChange('facebook', e.target.value)} placeholder="https://facebook.com/..." className="text-left dir-ltr h-9" />
                            </div>
                            <div>
                                <Label className="text-xs">فيسبوك فرعي / إعلامي</Label>
                                <Input value={data.socials.facebook_secondary} onChange={(e) => handleSocialChange('facebook_secondary', e.target.value)} placeholder="https://facebook.com/..." className="text-left dir-ltr h-9" />
                            </div>

                            <div>
                                <Label className="text-xs">إكس / تويتر رئيسي</Label>
                                <Input value={data.socials.twitter} onChange={(e) => handleSocialChange('twitter', e.target.value)} placeholder="https://x.com/..." className="text-left dir-ltr h-9" />
                            </div>
                            <div>
                                <Label className="text-xs">إكس / تويتر فرعي / إعلامي</Label>
                                <Input value={data.socials.twitter_secondary} onChange={(e) => handleSocialChange('twitter_secondary', e.target.value)} placeholder="https://x.com/..." className="text-left dir-ltr h-9" />
                            </div>

                            <div>
                                <Label className="text-xs">تلغرام رئيسي</Label>
                                <Input value={data.socials.telegram} onChange={(e) => handleSocialChange('telegram', e.target.value)} placeholder="https://t.me/..." className="text-left dir-ltr h-9" />
                            </div>
                            <div>
                                <Label className="text-xs">تلغرام فرعي / إعلامي</Label>
                                <Input value={data.socials.telegram_secondary} onChange={(e) => handleSocialChange('telegram_secondary', e.target.value)} placeholder="https://t.me/..." className="text-left dir-ltr h-9" />
                            </div>

                            <div>
                                <Label className="text-xs">إنستغرام رئيسي</Label>
                                <Input value={data.socials.instagram} onChange={(e) => handleSocialChange('instagram', e.target.value)} placeholder="https://instagram.com/..." className="text-left dir-ltr h-9" />
                            </div>
                            <div>
                                <Label className="text-xs">إنستغرام فرعي / إعلامي</Label>
                                <Input value={data.socials.instagram_secondary} onChange={(e) => handleSocialChange('instagram_secondary', e.target.value)} placeholder="https://instagram.com/..." className="text-left dir-ltr h-9" />
                            </div>

                            <div>
                                <Label className="text-xs">الموقع الرسمي</Label>
                                <Input value={data.socials.website} onChange={(e) => handleSocialChange('website', e.target.value)} placeholder="https://..." className="text-left dir-ltr h-9" />
                            </div>
                            <div>
                                <Label className="text-xs">واتساب</Label>
                                <Input value={data.socials.whatsapp} onChange={(e) => handleSocialChange('whatsapp', e.target.value)} placeholder="https://whatsapp.com/channel/..." className="text-left dir-ltr h-9" />
                            </div>

                            <div>
                                <Label className="text-xs">يوتيوب</Label>
                                <Input value={data.socials.youtube} onChange={(e) => handleSocialChange('youtube', e.target.value)} placeholder="https://youtube.com/..." className="text-left dir-ltr h-9" />
                            </div>
                            <div>
                                <Label className="text-xs">لينكد إن</Label>
                                <Input value={data.socials.linkedin} onChange={(e) => handleSocialChange('linkedin', e.target.value)} placeholder="https://linkedin.com/..." className="text-left dir-ltr h-9" />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t">
                        <Label htmlFor="ent_active">مفعلة وتظهر للعموم</Label>
                        <Switch
                            id="ent_active"
                            checked={data.is_active}
                            onCheckedChange={(checked) => setData('is_active', checked)}
                        />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {isEditing ? 'حفظ التغييرات' : 'إضافة الجهة'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
