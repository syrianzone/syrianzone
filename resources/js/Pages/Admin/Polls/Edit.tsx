import React, { useState, useEffect } from 'react';
import { router, Link, Head } from '@inertiajs/react';
import axios from '@/Lib/axios';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Switch } from '@/Components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import AdminPollManager from '@/Components/admin/AdminPollManager';

interface Candidate {
    id: string;
    candidate_group_id?: string | null;
    name: string;
    title?: string | null;
    image_url?: string | null;
    imageUrl?: string | null;
    category?: string | null;
    status?: "active" | "archived";
}

interface Group {
    id: string;
    poll_id: string;
    name: string;
    sort_order: number;
}

interface Poll {
    id: string;
    slug: string;
    title: string;
    timezone: string;
    is_active: boolean;
}

interface EditPageProps {
    id: string;
    poll: Poll;
    candidates: Candidate[];
    groups: Group[];
}

export default function Edit({ id, poll: initialPoll, candidates: initialCandidates, groups: initialGroups }: EditPageProps) {
    const [poll, setPoll] = useState<Poll>(initialPoll);
    const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
    const [groups, setGroups] = useState<Group[]>(initialGroups);
    const [saving, setSaving] = useState(false);

    const handleSaveMetadata = async () => {
        setSaving(true);
        try {
            await axios.put(`/api/polls/${id}`, poll);
            router.visit('/polls');
        } catch (err) {
            console.error(err);
            alert('حدث خطأ أثناء حفظ الإعدادات');
        } finally {
            setSaving(false);
        }
    };

    const handleRefresh = async () => {
        try {
            const res = await axios.get(`/api/polls/${poll.slug}`, { params: { include_archived: 1 } });
            // The show endpoint returns { poll, candidates, groups }
            if (res.data.poll) setPoll(res.data.poll);
            if (res.data.candidates) setCandidates(res.data.candidates);
            if (res.data.groups) setGroups(res.data.groups);
        } catch (err) {
            console.error('Failed to reload poll data', err);
        }
    };

    const pollManagerData = {
        id,
        candidates,
        groups
    };

    return (
        <MainLayout>
            <Head>
                <title>{`تعديل التصويت: ${poll.title}`}</title>
                <meta name="description" content={`تعديل إعدادات استبيان التصويت، المجموعات والمرشحين لـ ${poll.title}.`} />
            </Head>
            <div className="min-h-screen bg-background py-12" dir="rtl">
                <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-8 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button asChild variant="ghost" size="icon">
                                <Link href="/polls">
                                    <ArrowLeft className="h-5 w-5 rotate-180" />
                                </Link>
                            </Button>
                            <h1 className="text-3xl font-bold text-foreground">تعديل التصويت</h1>
                        </div>
                        <Button onClick={handleSaveMetadata} disabled={saving}>
                            <Save className="ml-2 h-4 w-4" />
                            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                        </Button>
                    </div>

                    <div className="space-y-6">
                        <Card className="border-border bg-card">
                            <CardHeader>
                                <CardTitle>الإعدادات الأساسية</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="title">العنوان</Label>
                                    <Input
                                        id="title"
                                        value={poll.title}
                                        onChange={e => setPoll({ ...poll, title: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="slug">المعرف (Slug)</Label>
                                    <Input
                                        id="slug"
                                        value={poll.slug}
                                        onChange={e => setPoll({ ...poll, slug: e.target.value })}
                                        className="text-left"
                                        dir="ltr"
                                    />
                                </div>
                                <div className="flex items-center justify-between pt-2">
                                    <Label htmlFor="is_active">التصويت نشط</Label>
                                    <Switch
                                        id="is_active"
                                        checked={poll.is_active}
                                        onCheckedChange={checked => setPoll({ ...poll, is_active: checked })}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border bg-card">
                            <CardHeader>
                                <CardTitle>إدارة المجموعات والمرشحين</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <AdminPollManager
                                    pollId={id}
                                    initialData={pollManagerData}
                                    onRefresh={handleRefresh}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>
        </MainLayout>
    );
}
