import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Textarea } from '@/Components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Switch } from '@/Components/ui/switch';
import { Megaphone } from 'lucide-react';

export interface SitePopupData {
    enabled: boolean;
    title: string;
    description: string;
    buttonText: string;
    dismissText: string;
    link: string;
    version: number;
}

export default function SitePopupAdminIndex({ popup }: { popup: SitePopupData }) {
    const [form, setForm] = useState<SitePopupData>(popup);
    const [saving, setSaving] = useState(false);

    const set = (key: keyof SitePopupData, value: string | boolean) =>
        setForm((f) => ({ ...f, [key]: value }));

    const handleSave = () => {
        setSaving(true);
        router.put('/api/v1/admin/site-popup', { ...form }, {
            onFinish: () => setSaving(false),
        });
    };

    return (
        <MainLayout>
            <Head title="إدارة النافذة المنبثقة" />
            <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6" dir="rtl">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Megaphone className="w-6 h-6 text-primary" />
                            إدارة النافذة المنبثقة للصفحة الرئيسية
                        </CardTitle>
                        <CardDescription>
                            النصوص والرابط هنا تظهر للزوار في النافذة المنبثقة. رفع نسخة جديدة يعيد إظهارها لمن أغلقها سابقاً. النسخة الحالية: {popup.version}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <Label htmlFor="enabled">إظهار النافذة</Label>
                            <Switch
                                id="enabled"
                                checked={form.enabled}
                                onCheckedChange={(v) => set('enabled', v)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="title">العنوان</Label>
                            <Input id="title" value={form.title} maxLength={100} onChange={(e) => set('title', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">الوصف</Label>
                            <Textarea id="description" value={form.description} maxLength={500} rows={3} onChange={(e) => set('description', e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="buttonText">نص زر الرابط</Label>
                                <Input id="buttonText" value={form.buttonText} maxLength={50} onChange={(e) => set('buttonText', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dismissText">نص زر الإغلاق</Label>
                                <Input id="dismissText" value={form.dismissText} maxLength={50} onChange={(e) => set('dismissText', e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="link">الرابط (https فقط)</Label>
                            <Input id="link" value={form.link} dir="ltr" onChange={(e) => set('link', e.target.value)} />
                        </div>
                        <Button onClick={handleSave} disabled={saving} className="w-full font-bold">
                            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
