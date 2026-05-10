'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import Link from 'next/link';
import AdminPollManager from '@/components/admin/AdminPollManager';

interface Candidate {
    id: string;
    name: string;
    title: string | null;
    image_url: string | null;
    category: string;
    sort: number;
}

interface Poll {
    id: string;
    slug: string;
    title: string;
    timezone: string;
    is_active: boolean;
    candidates: Candidate[];
    groups: any[];
}

export default function AdminPollEdit() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();
    const { isAdmin, loading: authLoading } = useAuth();

    const [poll, setPoll] = useState<Poll | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!id) return;

        // Note: Using show endpoint which returns poll + candidates
        // But show endpoint uses SLUG. We need one that uses ID for admin.
        // Or we can just use the public show endpoint if we have the slug.
        // For simplicity, let's assume we can fetch by ID in the updated controller or adjust it.

        axios.get(`/polls/${id}`, { params: { include_archived: 1 } })
            .then(res => {
                const pollData = res.data.poll || res.data;
                // If groups are returned as sibling, merge them
                if (res.data.groups) {
                    pollData.groups = res.data.groups;
                }
                // If candidates are returned as sibling, merge them
                if (res.data.candidates) {
                    pollData.candidates = res.data.candidates;
                }
                setPoll(pollData);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [id]);

    const handleSave = async () => {
        if (!poll) return;
        setSaving(true);
        try {
            await axios.put(`/polls/${id}`, poll);
            router.push('/polls');
        } catch (err) {
            console.error(err);
            alert('Error saving poll');
        } finally {
            setSaving(false);
        }
    };


    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    if (!poll) {
        return <div className="min-h-screen flex items-center justify-center">Poll not found</div>;
    }

    return (
        <div className="min-h-screen bg-background" dir="rtl">
            <main className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button asChild variant="ghost" size="icon">
                            <Link href="/polls">
                                <ArrowLeft className="h-5 w-5 rotate-180" />
                            </Link>
                        </Button>
                        <h1 className="text-3xl font-bold text-foreground">تعديل التصويت</h1>
                    </div>
                    <Button onClick={handleSave} disabled={saving}>
                        <Save className="mr-2 h-4 w-4" />
                        {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                    </Button>
                </div>

                <div className="space-y-6">
                    <Card className="border-border">
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
                            <div className="flex items-center justify-between">
                                <Label htmlFor="is_active">التصويت نشط</Label>
                                <Switch
                                    id="is_active"
                                    checked={poll.is_active}
                                    onCheckedChange={checked => setPoll({ ...poll, is_active: checked })}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border">
                        <CardHeader>
                            <CardTitle>إدارة المجموعات والمرشحين</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <AdminPollManager
                                pollId={id}
                                initialData={poll}
                                onRefresh={() => {
                                    axios.get(`/polls/${id}`, { params: { include_archived: 1 } }).then(res => {
                                        const pollData = res.data.poll || res.data;
                                        if (res.data.groups) pollData.groups = res.data.groups;
                                        if (res.data.candidates) pollData.candidates = res.data.candidates;
                                        setPoll(pollData);
                                    });
                                }}
                            />
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
