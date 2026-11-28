import React, { useEffect, useState } from 'react';
import {
    Ban,
    BarChart3,
    Edit,
    Eye,
    Loader2,
    Plus,
    Save,
    Trash2,
    X,
} from 'lucide-react';
import { AdminLayout } from '@/Components/admin/AdminLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Switch } from '@/Components/ui/switch';
import AdminPollManager from '@/Domain/polls/AdminPollManager';
import { pollsApi } from '@/Domain/polls/api';
import { DEFAULT_POLL_TIMEZONE, isCorePollSlug } from '@/Domain/polls/core';
import type { Poll, PollCandidate, PollGroup } from '@/Domain/polls/types';
import { apiErrorMessage } from '@/Lib/api';
import { confirmDialog } from '@/Lib/confirm';
import { notify } from '@/Lib/notify';
import { useCan } from '@/Lib/useCan';
import { cn } from '@/Lib/utils';

const pollPublicUrl = (slug: string) =>
    isCorePollSlug(slug) ? '/tierlist' : `/polls/${slug}`;

const pollLeaderboardUrl = (slug: string) =>
    isCorePollSlug(slug) ? '/tierlist/leaderboard' : `/polls/${slug}/leaderboard`;

interface AdminPollsIndexProps {
    polls: Poll[];
}

export default function AdminPollsIndex({ polls = [] }: AdminPollsIndexProps) {
    const can = useCan();
    const canCreatePolls = can('polls.create');
    const canEditPolls = can('polls.edit');
    const canDeletePolls = can('polls.delete');

    const [localPolls, setLocalPolls] = useState<Poll[]>(polls);

    const [createOpen, setCreateOpen] = useState(false);
    const [createTitle, setCreateTitle] = useState('');
    const [createSlug, setCreateSlug] = useState('');
    const [createActive, setCreateActive] = useState(true);
    const [creating, setCreating] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
    const [editingCandidates, setEditingCandidates] = useState<PollCandidate[]>([]);
    const [editingGroups, setEditingGroups] = useState<PollGroup[]>([]);
    const [editingLoading, setEditingLoading] = useState(false);
    const [editingSaving, setEditingSaving] = useState(false);

    useEffect(() => {
        setLocalPolls(polls);
    }, [polls]);

    const fetchPollDetails = async (id: string) => {
        setEditingLoading(true);
        try {
            const data = await pollsApi.details(id);
            const poll = data.poll;
            if (poll) {
                setEditingPoll(poll);
                setLocalPolls((prev) =>
                    prev.map((p) =>
                        p.id === poll.id
                            ? {
                                  ...p,
                                  ...poll,
                                  candidates_count: data.candidates?.length ?? p.candidates_count,
                              }
                            : p,
                    ),
                );
            }
            if (data.candidates) setEditingCandidates(data.candidates);
            if (data.groups) setEditingGroups(data.groups);
        } catch (err) {
            notify.error(apiErrorMessage(err, 'تعذر تحميل بيانات الاستبيان'));
            setEditingId(null);
            setEditingPoll(null);
        } finally {
            setEditingLoading(false);
        }
    };

    const openPollEditor = (poll: Poll) => {
        setEditingId(poll.id);
        setEditingPoll(poll);
        setEditingCandidates([]);
        setEditingGroups([]);
        void fetchPollDetails(poll.id);

        const url = new URL(window.location.href);
        url.searchParams.set('edit-poll', poll.id);
        url.searchParams.delete('create-poll');
        window.history.replaceState({}, '', url.toString());
    };

    const closePollEditor = () => {
        setEditingId(null);
        setEditingPoll(null);
        setEditingCandidates([]);
        setEditingGroups([]);

        const url = new URL(window.location.href);
        url.searchParams.delete('edit-poll');
        url.searchParams.delete('edit');
        window.history.replaceState(
            {},
            '',
            url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''),
        );
    };

    const handleRefreshEditor = async () => {
        if (!editingId) return;
        await fetchPollDetails(editingId);
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const editParam = params.get('edit-poll') ?? params.get('edit');
        const createParam = params.get('create-poll') ?? params.get('create');

        if (editParam) {
            const target = localPolls.find((p) => p.id === editParam || p.slug === editParam);
            if (target) {
                openPollEditor(target);
            } else {
                setEditingId(editParam);
                setEditingPoll(null);
                void fetchPollDetails(editParam);
            }
        } else if (createParam !== null && (createParam === '1' || createParam === '')) {
            setCreateOpen(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCreatePoll = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (creating) return;
        if (!createTitle.trim() || !createSlug.trim()) {
            document
                .getElementById(!createTitle.trim() ? 'create-poll-title' : 'create-poll-slug')
                ?.focus();
            return;
        }
        setCreating(true);
        try {
            const created = await pollsApi.create({
                title: createTitle.trim(),
                slug: createSlug.trim(),
                timezone: DEFAULT_POLL_TIMEZONE,
                is_active: createActive,
            });
            const pollRow: Poll = { ...created, candidates_count: 0 };
            setLocalPolls((prev) => [pollRow, ...prev]);
            setCreateOpen(false);
            setCreateTitle('');
            setCreateSlug('');
            setCreateActive(true);
            notify.success('تم إنشاء الاستبيان.');
            openPollEditor(pollRow);
        } catch (err) {
            notify.error(apiErrorMessage(err, 'تعذر إنشاء الاستبيان.'));
        } finally {
            setCreating(false);
        }
    };

    const handleSavePollMetadata = async () => {
        if (!editingPoll || editingSaving) return;
        setEditingSaving(true);
        try {
            const updated = await pollsApi.update(editingPoll.id, {
                title: editingPoll.title,
                slug: editingPoll.slug,
                is_active: Boolean(editingPoll.is_active),
            });
            setEditingPoll(updated);
            setLocalPolls((prev) =>
                prev.map((p) =>
                    p.id === updated.id
                        ? { ...p, ...updated, candidates_count: p.candidates_count }
                        : p,
                ),
            );
            notify.success('تم حفظ إعدادات الاستبيان.');
        } catch (err) {
            notify.error(apiErrorMessage(err, 'تعذر حفظ إعدادات الاستبيان.'));
        } finally {
            setEditingSaving(false);
        }
    };

    const handleDeletePoll = async (id: string, slug: string) => {
        if (isCorePollSlug(slug)) {
            notify.info('لا يمكن حذف استبيان تقييم الوزراء الرئيسي.');
            return;
        }
        const okDelete = await confirmDialog({
            title: 'حذف هذا الاستبيان؟',
            description: 'سيتم حذف الاستبيان وجميع المرشحين التابعين له نهائياً.',
            destructive: true,
            confirmText: 'حذف',
        });
        if (!okDelete) return;

        try {
            await pollsApi.remove(id);
            setLocalPolls((prev) => prev.filter((p) => p.id !== id));
            if (editingId === id) closePollEditor();
            notify.success('تم حذف الاستبيان.');
        } catch (err) {
            notify.error(apiErrorMessage(err, 'تعذر الحذف.'));
        }
    };

    return (
        <AdminLayout
            title="الاستبيانات والتقييم"
            subtitle="إنشاء الاستبيانات وإدارة المجموعات والمرشحين والنتائج."
            activeSection="polls"
            publicHref="/tierlist"
            publicLabel="عرض تقييم الحكومة"
            actions={
                canCreatePolls ? (
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus className="me-1.5 h-4 w-4" aria-hidden="true" />
                        استبيان جديد
                    </Button>
                ) : undefined
            }
        >
            <Card>
                <CardContent className="p-0">
                    {localPolls.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            لا توجد استبيانات حالياً.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-start text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                                        <th className="px-4 py-3 text-start font-medium">الاستبيان</th>
                                        <th className="px-4 py-3 text-start font-medium">المعرف</th>
                                        <th className="px-4 py-3 text-start font-medium">المرشحون</th>
                                        <th className="px-4 py-3 text-start font-medium">الحالة</th>
                                        <th className="px-4 py-3 text-end font-medium">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {localPolls.map((poll) => {
                                        const isEditing = editingId === poll.id;
                                        return (
                                            <tr
                                                key={poll.id}
                                                className={cn(
                                                    'transition-colors hover:bg-muted/20',
                                                    isEditing && 'bg-primary/5',
                                                )}
                                            >
                                                <td className="px-4 py-3.5 font-medium text-foreground">
                                                    {poll.title}
                                                </td>
                                                <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                                                    <span dir="ltr">{poll.slug}</span>
                                                </td>
                                                <td className="px-4 py-3.5 tabular-nums text-muted-foreground">
                                                    {poll.candidates_count}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    {poll.is_active ? (
                                                        <Badge variant="secondary">نشط</Badge>
                                                    ) : (
                                                        <Badge variant="outline">متوقف</Badge>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-end">
                                                    <div className="flex justify-end gap-2">
                                                        <a
                                                            href={pollPublicUrl(poll.slug)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="rounded border border-border bg-muted p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                                                            title="عرض صفحة التصويت"
                                                            aria-label={`عرض صفحة التصويت: ${poll.title}`}
                                                        >
                                                            <Eye className="h-4 w-4" aria-hidden="true" />
                                                        </a>
                                                        <a
                                                            href={pollLeaderboardUrl(poll.slug)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="rounded border border-border bg-muted p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                                                            title="عرض النتائج"
                                                            aria-label={`عرض النتائج: ${poll.title}`}
                                                        >
                                                            <BarChart3 className="h-4 w-4" aria-hidden="true" />
                                                        </a>
                                                        <button
                                                            type="button"
                                                            aria-label={
                                                                !canEditPolls
                                                                    ? 'يحتاج صلاحية polls.edit'
                                                                    : isEditing
                                                                      ? `إغلاق المحرر: ${poll.title}`
                                                                      : `تعديل: ${poll.title}`
                                                            }
                                                            onClick={() =>
                                                                isEditing ? closePollEditor() : openPollEditor(poll)
                                                            }
                                                            className={cn(
                                                                'rounded border border-border p-1.5 transition-colors',
                                                                isEditing
                                                                    ? 'border-primary bg-primary text-primary-foreground'
                                                                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                                                            )}
                                                            title={
                                                                !canEditPolls
                                                                    ? 'يحتاج صلاحية polls.edit'
                                                                    : isEditing
                                                                      ? 'إغلاق المحرر'
                                                                      : 'تعديل'
                                                            }
                                                        >
                                                            {isEditing ? (
                                                                <X className="h-4 w-4" aria-hidden="true" />
                                                            ) : (
                                                                <Edit className="h-4 w-4" aria-hidden="true" />
                                                            )}
                                                        </button>
                                                        {!isCorePollSlug(poll.slug) ? (
                                                            <button
                                                                type="button"
                                                                aria-label={
                                                                    canDeletePolls
                                                                        ? `حذف: ${poll.title}`
                                                                        : 'يحتاج صلاحية polls.delete'
                                                                }
                                                                disabled={!canDeletePolls}
                                                                onClick={() => handleDeletePoll(poll.id, poll.slug)}
                                                                className="rounded border border-border bg-muted p-1.5 text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/15 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                                                                title={
                                                                    canDeletePolls
                                                                        ? 'حذف'
                                                                        : 'يحتاج صلاحية polls.delete'
                                                                }
                                                            >
                                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                            </button>
                                                        ) : (
                                                            <span
                                                                className="cursor-not-allowed rounded border border-border bg-muted p-1.5 text-muted-foreground/50"
                                                                title="استبيان غير قابل للحذف"
                                                            >
                                                                <Ban className="h-4 w-4" aria-hidden="true" />
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {editingId && (
                <Card className="border-primary/30">
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Edit className="h-5 w-5 text-primary" aria-hidden="true" />
                            {editingLoading
                                ? 'جارٍ تحميل الاستبيان…'
                                : `تحرير: ${editingPoll?.title ?? ''}`}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            {editingPoll && (
                                <>
                                    <Button asChild variant="outline" size="sm">
                                        <a href={pollPublicUrl(editingPoll.slug)} target="_blank" rel="noreferrer">
                                            <Eye className="me-1 h-4 w-4" aria-hidden="true" />
                                            عرض
                                        </a>
                                    </Button>
                                    <Button asChild variant="outline" size="sm">
                                        <a href={pollLeaderboardUrl(editingPoll.slug)} target="_blank" rel="noreferrer">
                                            <BarChart3 className="me-1 h-4 w-4" aria-hidden="true" />
                                            النتائج
                                        </a>
                                    </Button>
                                </>
                            )}
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={closePollEditor}
                                title="إغلاق"
                                aria-label="إغلاق محرر الاستبيان"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {editingLoading || !editingPoll ? (
                            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                                جارٍ تحميل بيانات الاستبيان…
                            </div>
                        ) : (
                            <>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-poll-title">العنوان</Label>
                                        <Input
                                            id="edit-poll-title"
                                            value={editingPoll.title}
                                            onChange={(e) =>
                                                setEditingPoll({ ...editingPoll, title: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-poll-slug">المعرف (Slug)</Label>
                                        <Input
                                            id="edit-poll-slug"
                                            value={editingPoll.slug}
                                            onChange={(e) =>
                                                setEditingPoll({ ...editingPoll, slug: e.target.value })
                                            }
                                            className="text-left font-mono"
                                            dir="ltr"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            id="edit-poll-active"
                                            checked={Boolean(editingPoll.is_active)}
                                            onCheckedChange={(checked) =>
                                                setEditingPoll({ ...editingPoll, is_active: checked })
                                            }
                                        />
                                        <Label htmlFor="edit-poll-active">التصويت نشط</Label>
                                    </div>
                                    <Button
                                        type="button"
                                        aria-label={canEditPolls ? undefined : 'يحتاج صلاحية polls.edit'}
                                        onClick={handleSavePollMetadata}
                                        disabled={editingSaving || !canEditPolls}
                                        title={canEditPolls ? undefined : 'يحتاج صلاحية polls.edit'}
                                    >
                                        <Save className="me-2 h-4 w-4" aria-hidden="true" />
                                        {editingSaving ? 'جاري الحفظ…' : 'حفظ الإعدادات'}
                                    </Button>
                                </div>
                                <div className="border-t border-border pt-6">
                                    <h2 className="mb-4 font-bold">إدارة المجموعات والمرشحين</h2>
                                    <AdminPollManager
                                        pollId={editingId}
                                        initialData={{
                                            id: editingId,
                                            candidates: editingCandidates,
                                            groups: editingGroups,
                                        }}
                                        onRefresh={handleRefreshEditor}
                                    />
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            <Dialog
                open={createOpen}
                onOpenChange={(open) => {
                    setCreateOpen(open);
                    if (!open) {
                        const url = new URL(window.location.href);
                        url.searchParams.delete('create-poll');
                        url.searchParams.delete('create');
                        window.history.replaceState(
                            {},
                            '',
                            url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''),
                        );
                    }
                }}
            >
                <DialogContent dir="rtl" className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>إنشاء استبيان جديد</DialogTitle>
                        <DialogDescription>
                            أنشئ الاستبيان هنا، ثم أضف المجموعات والمرشحين من نفس اللوحة.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreatePoll} className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="create-poll-title">العنوان</Label>
                            <Input
                                id="create-poll-title"
                                placeholder="مثال: تقييم الأداء الحكومي"
                                value={createTitle}
                                onChange={(e) => setCreateTitle(e.target.value)}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="create-poll-slug">المعرف (Slug)</Label>
                            <Input
                                id="create-poll-slug"
                                placeholder="مثال: govt-2025"
                                value={createSlug}
                                onChange={(e) => setCreateSlug(e.target.value)}
                                className="text-left font-mono"
                                dir="ltr"
                                required
                            />
                            <p className="text-[11px] text-muted-foreground">
                                أحرف لاتينية صغيرة وأرقام وشرطات فقط. يُستخدم في رابط صفحة التصويت.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                id="create-poll-active"
                                checked={createActive}
                                onCheckedChange={setCreateActive}
                            />
                            <Label htmlFor="create-poll-active">تفعيل الاستبيان فور الإنشاء</Label>
                        </div>
                        <DialogFooter className="flex-row-reverse gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setCreateOpen(false)}
                            >
                                إلغاء
                            </Button>
                            <Button type="submit" size="sm" disabled={creating}>
                                {creating ? 'جاري الإنشاء…' : 'إنشاء ومتابعة التحرير'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
