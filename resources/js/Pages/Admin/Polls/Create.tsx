import React, { useState } from 'react';
import { router, Link, Head } from '@inertiajs/react';
import axios from '@/Lib/axios';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';

export default function Create() {
    const [poll, setPoll] = useState({
        title: '',
        slug: '',
        timezone: 'Europe/Amsterdam',
        is_active: true
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!poll.title.trim() || !poll.slug.trim()) return;

        setSaving(true);
        try {
            await axios.post('/api/polls', poll);
            router.visit('/polls');
        } catch (err) {
            console.error(err);
            alert('Error creating poll');
        } finally {
            setSaving(false);
        }
    };

    return (
        <MainLayout>
            <Head>
                <title>إنشاء تصويت جديد</title>
                <meta name="description" content="إنشاء وإعداد استبيان تصويت جديد للمرشحين والوزراء في المساحة السورية." />
            </Head>
            <div className="min-h-screen bg-background py-12" dir="rtl">
                <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <form onSubmit={handleSave}>
                        <div className="mb-8 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Button asChild variant="ghost" size="icon">
                                    <Link href="/polls">
                                        <ArrowLeft className="h-5 w-5 rotate-180" />
                                    </Link>
                                </Button>
                                <h1 className="text-3xl font-bold text-foreground">إنشاء تصويت جديد</h1>
                            </div>
                            <Button type="submit" disabled={saving}>
                                <Save className="ml-2 h-4 w-4" />
                                {saving ? 'جاري الإنشاء...' : 'إنشاء التصويت'}
                            </Button>
                        </div>

                        <div className="space-y-6">
                            <Card className="border-border bg-card">
                                <CardHeader>
                                    <CardTitle>المعلومات الأساسية</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="title">العنوان</Label>
                                        <Input
                                            id="title"
                                            placeholder="مثال: تقييم الأداء الحكومي"
                                            value={poll.title}
                                            onChange={e => setPoll({ ...poll, title: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="slug">المعرف (Slug)</Label>
                                        <Input
                                            id="slug"
                                            placeholder="مثال: govt-2025"
                                            value={poll.slug}
                                            onChange={e => setPoll({ ...poll, slug: e.target.value })}
                                            className="text-left"
                                            dir="ltr"
                                            required
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </form>
                </main>
            </div>
        </MainLayout>
    );
}
