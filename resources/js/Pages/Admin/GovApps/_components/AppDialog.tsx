import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/Components/ui/dialog';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Textarea } from '@/Components/ui/textarea';
import { Switch } from '@/Components/ui/switch';
import { Smartphone, Globe, Upload } from 'lucide-react';

export interface GovAppData {
    id: string;
    name: string;
    name_ar?: string;
    description?: string;
    description_ar?: string;
    icon?: string;
    images?: string[];
    links?: {
        official?: string | null;
        android?: string | null;
        apple?: string | null;
    };
    order_column?: number;
    is_active?: boolean;
}

interface AppDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    app: GovAppData | null;
}

export default function AppDialog({ open, onOpenChange, app }: AppDialogProps) {
    const isEdit = !!app;

    const [id, setId] = useState('');
    const [name, setName] = useState('');
    const [nameAr, setNameAr] = useState('');
    const [description, setDescription] = useState('');
    const [descriptionAr, setDescriptionAr] = useState('');
    const [officialLink, setOfficialLink] = useState('');
    const [androidLink, setAndroidLink] = useState('');
    const [appleLink, setAppleLink] = useState('');
    const [isActive, setIsActive] = useState(true);

    const [iconFile, setIconFile] = useState<File | null>(null);
    const [iconPreview, setIconPreview] = useState<string | null>(null);

    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (app) {
            setId(app.id || '');
            setName(app.name || '');
            setNameAr(app.name_ar || app.name || '');
            setDescription(app.description || '');
            setDescriptionAr(app.description_ar || app.description || '');
            setOfficialLink(app.links?.official || '');
            setAndroidLink(app.links?.android || '');
            setAppleLink(app.links?.apple || '');
            setIsActive(app.is_active ?? true);
            setIconPreview(app.icon || null);
        } else {
            setId('');
            setName('');
            setNameAr('');
            setDescription('');
            setDescriptionAr('');
            setOfficialLink('');
            setAndroidLink('');
            setAppleLink('');
            setIsActive(true);
            setIconPreview(null);
        }
        setIconFile(null);
    }, [app, open]);

    const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIconFile(file);
            setIconPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);

        const formData = new FormData();
        if (!isEdit) {
            formData.append('id', id);
        }
        formData.append('name', name);
        formData.append('name_ar', nameAr);
        formData.append('description', description);
        formData.append('description_ar', descriptionAr);
        formData.append('is_active', isActive ? '1' : '0');

        if (officialLink) formData.append('links[official]', officialLink);
        if (androidLink) formData.append('links[android]', androidLink);
        if (appleLink) formData.append('links[apple]', appleLink);

        if (iconFile) {
            formData.append('icon_file', iconFile);
        }

        if (isEdit) {
            formData.append('_method', 'PUT');
            router.post(`/api/v1/admin/govapps/${app.id}`, formData, {
                onSuccess: () => {
                    setProcessing(false);
                    onOpenChange(false);
                },
                onError: () => setProcessing(false),
            });
        } else {
            router.post('/api/v1/admin/govapps', formData, {
                onSuccess: () => {
                    setProcessing(false);
                    onOpenChange(false);
                },
                onError: () => setProcessing(false),
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                        {isEdit ? `تعديل التطبيق: ${app.name}` : 'إضافة تطبيق حكومي جديد'}
                    </DialogTitle>
                    <DialogDescription>
                        أدخل بيانات التطبيق وشعاره وروابط التحميل الرسمية.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    {!isEdit && (
                        <div className="space-y-1.5">
                            <Label htmlFor="id" className="font-semibold text-xs">معرّف التطبيق الفريد (Slug)</Label>
                            <Input
                                id="id"
                                placeholder="مثال: e-services, syrian-post"
                                value={id}
                                onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, ''))}
                                required
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="nameAr" className="font-semibold text-xs">اسم التطبيق (بالعربية)</Label>
                            <Input
                                id="nameAr"
                                value={nameAr}
                                onChange={(e) => setNameAr(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="name" className="font-semibold text-xs">اسم التطبيق (بالإنكليزية)</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="descriptionAr" className="font-semibold text-xs">الوصف (بالعربية)</Label>
                        <Textarea
                            id="descriptionAr"
                            rows={3}
                            value={descriptionAr}
                            onChange={(e) => setDescriptionAr(e.target.value)}
                            placeholder="وصف الخدمات التي يقدمها التطبيق..."
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="font-semibold text-xs">أيقونة التطبيق (Logo)</Label>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-muted border flex items-center justify-center relative flex-shrink-0">
                                {iconPreview ? (
                                    <img src={iconPreview} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <Smartphone className="w-8 h-8 text-muted-foreground/40" />
                                )}
                            </div>
                            <div className="flex-1">
                                <Label htmlFor="icon_file" className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted transition-colors">
                                    <Upload className="w-4 h-4" />
                                    <span>اختر صورة أو أيقونة</span>
                                </Label>
                                <Input id="icon_file" type="file" accept="image/*" className="hidden" onChange={handleIconChange} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2 border-t">
                        <Label className="font-bold text-xs">روابط التحميل والموقع</Label>

                        <div className="space-y-1.5">
                            <Label htmlFor="officialLink" className="text-xs text-muted-foreground">رابط الموقع الرسمي</Label>
                            <Input id="officialLink" type="url" placeholder="https://..." value={officialLink} onChange={(e) => setOfficialLink(e.target.value)} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="androidLink" className="text-xs text-muted-foreground">رابط Google Play (أندرويد)</Label>
                                <Input id="androidLink" type="url" placeholder="https://play.google.com/..." value={androidLink} onChange={(e) => setAndroidLink(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="appleLink" className="text-xs text-muted-foreground">رابط App Store (آيفون)</Label>
                                <Input id="appleLink" type="url" placeholder="https://apps.apple.com/..." value={appleLink} onChange={(e) => setAppleLink(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                        <Label htmlFor="is_active" className="cursor-pointer font-semibold text-xs">تفعيل الظهور في الدليل العام</Label>
                        <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'جاري الحفظ...' : (isEdit ? 'حفظ التغييرات' : 'إضافة التطبيق')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
