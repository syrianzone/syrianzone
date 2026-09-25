import React, { useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/Components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/Components/ui/table';
import { Badge } from '@/Components/ui/badge';
import {
    KeyRound, Plus, Copy, Check, Trash2, ShieldAlert, AlertTriangle,
} from 'lucide-react';

export interface TokenRow {
    id: number;
    name: string;
    abilities: string[];
    owner: { id: number; name: string; role: string } | null;
    owner_banned: boolean;
    last_used_at: string | null;
    expires_at: string | null;
    is_expired: boolean;
    created_at: string | null;
}

interface Owner { id: number; name: string; role: string }
interface TtlOption { value: string; label: string }

export interface ApiTokensData {
    tokens: TokenRow[];
    owners: Owner[];
    capabilityGroups: Record<string, { label: string; icon: string }>;
    capabilities: Record<string, Record<string, string>>;
    ttlOptions: TtlOption[];
    endpoint: string;
}

const ROLE_LABELS: Record<string, string> = {
    superadmin: 'مدير عام',
    admin: 'مشرف',
    transit_admin: 'مشرف نقل',
    syofficial_admin: 'مشرف الحسابات الرسمية',
    govapps_admin: 'مشرف التطبيقات الحكومية',
    phonebook_admin: 'مشرف دليل الهاتف',
    places_admin: 'مشرف مشوار',
    user: 'مستخدم',
};

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ApiTokensIndex(props: ApiTokensData) {
    const { tokens, owners, capabilityGroups, capabilities, ttlOptions, endpoint } = props;

    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);

    // Mint form state
    const [ownerId, setOwnerId] = useState<string>('');
    const [name, setName] = useState('');
    const [ttl, setTtl] = useState<string>(ttlOptions[1]?.value ?? '30d');
    const [selected, setSelected] = useState<string[]>([]);

    // One-time plaintext reveal
    const [issued, setIssued] = useState<{ token: string; message: string } | null>(null);
    const [copied, setCopied] = useState(false);

    const notify = (msg: string, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 5000);
    };

    // A superadmin holds every capability, so the picker cannot meaningfully
    // narrow the owner list. Show which capabilities the chosen owner actually
    // has so the selection is informed rather than guesswork.
    const selectedOwner = useMemo(
        () => owners.find((o) => String(o.id) === ownerId) ?? null,
        [owners, ownerId],
    );

    const grouped = useMemo(
        () => Object.entries(capabilities).map(([group, perms]) => ({
            group,
            label: capabilityGroups[group]?.label ?? group,
            perms: Object.entries(perms),
        })),
        [capabilities, capabilityGroups],
    );

    const toggle = (permission: string) =>
        setSelected((prev) =>
            prev.includes(permission)
                ? prev.filter((p) => p !== permission)
                : [...prev, permission],
        );

    const submit = async () => {
        if (!ownerId || !name.trim() || selected.length === 0) {
            notify('اختر المستخدم، وسم الرمز، وصلاحية واحدة على الأقل.', false);
            return;
        }
        setSaving(true);
        try {
            const res = await axios.post('/api/v1/admin/api-tokens', {
                user_id: Number(ownerId),
                name: name.trim(),
                ttl,
                permissions: selected,
            });
            setIssued({ token: res.data.plain_text_token, message: res.data.message });
            setName('');
            setSelected([]);
            router.reload({ only: ['tokens'] });
        } catch (e: any) {
            notify(e.response?.data?.message ?? 'تعذّر إنشاء الرمز.', false);
        } finally {
            setSaving(false);
        }
    };

    const revoke = async (id: number) => {
        try {
            const res = await axios.delete(`/api/v1/admin/api-tokens/${id}`);
            notify(res.data.message);
            router.reload({ only: ['tokens'] });
        } catch {
            notify('تعذّر إبطال الرمز.', false);
        }
    };

    const revokeAll = async (userId: number) => {
        try {
            const res = await axios.post(`/api/v1/admin/api-tokens/revoke-all/${userId}`);
            notify(res.data.message);
            router.reload({ only: ['tokens'] });
        } catch {
            notify('تعذّر إبطال الرموز.', false);
        }
    };

    const copyToken = async () => {
        if (!issued) return;
        try {
            await navigator.clipboard.writeText(issued.token);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            notify('تعذّر النسخ، انسخ الرمز يدوياً.', false);
        }
    };

    return (
        <MainLayout>
            <Head title="رموز الوكلاء" />
            <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6" dir="rtl">

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <KeyRound className="w-6 h-6 text-primary" />
                            رموز وكلاء الذكاء الاصطناعي
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            رموز وصول للوكلاء على{' '}
                            <code className="bg-muted px-1.5 py-0.5 rounded text-xs" dir="ltr">{endpoint}</code>
                        </p>
                    </div>
                    <Button onClick={() => setShowForm((s) => !s)} variant={showForm ? 'outline' : 'default'}>
                        <Plus className="w-4 h-4 ms-2" />
                        رمز جديد
                    </Button>
                </div>

                {/* Endpoint help — an agent cannot be connected without this. */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">كيف يتصل الوكيل</CardTitle>
                        <CardDescription>
                            يُرسل الرمز كـ <code dir="ltr">Authorization: Bearer &lt;token&gt;</code> في كل طلب.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre dir="ltr" className="bg-muted rounded-md p-3 text-xs overflow-x-auto text-left">
{`curl -X POST ${endpoint} \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}
                        </pre>
                        <p className="text-xs text-muted-foreground mt-2">
                            أو استخدم <code dir="ltr">php artisan mcp:inspector mcp/admin</code> للحصول على إعدادات جاهزة لعميلك.
                        </p>
                    </CardContent>
                </Card>

                {/* One-time plaintext reveal */}
                {issued && (
                    <Card className="border-green-500/50 bg-green-500/5">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2 text-green-600 dark:text-green-400">
                                <Check className="w-5 h-5" />
                                تم إنشاء الرمز
                            </CardTitle>
                            <CardDescription>{issued.message}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center gap-2">
                                <code dir="ltr" className="flex-1 bg-muted rounded-md p-3 text-xs break-all text-left select-all">
                                    {issued.token}
                                </code>
                                <Button size="sm" variant="outline" onClick={copyToken}>
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    {copied ? 'تم النسخ' : 'نسخ'}
                                </Button>
                            </div>
                            <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>
                                    لن يظهر هذا الرمز مرة أخرى — يُحفظ في قاعدة البيانات تجزئة فقط.
                                    إذا فقدته، ألغِ هذا الرمز وأصدر غيره.
                                </span>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => setIssued(null)}>
                                فهمت، أخفِ الرمز
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Mint form */}
                {showForm && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">إنشاء رمز</CardTitle>
                            <CardDescription>
                                يُمنح الرمز ما يملكه المستخدم بالفعل فقط. لا يوجد خيار «الكل» —
                                عمداً، حتى لا يتفوق الرمز على صاحبه.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="owner">المستخدم</Label>
                                    <Select value={ownerId} onValueChange={setOwnerId} dir="rtl">
                                        <SelectTrigger id="owner">
                                            <SelectValue placeholder="اختر مستخدماً" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {owners.map((o) => (
                                                <SelectItem key={o.id} value={String(o.id)}>
                                                    {o.name} — {ROLE_LABELS[o.role] ?? o.role}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="name">اسم الرمز</Label>
                                    <Input
                                        id="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="claude-code"
                                        dir="ltr"
                                    />
                                    <p className="text-xs text-muted-foreground">يظهر في سجل التدقيق.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="ttl">مدة الصلاحية</Label>
                                    <Select value={ttl} onValueChange={setTtl} dir="rtl">
                                        <SelectTrigger id="ttl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ttlOptions.map((t) => (
                                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label>الصلاحيات</Label>
                                {selectedOwner?.role === 'superadmin' && (
                                    <p className="text-xs text-muted-foreground">
                                        هذا المستخدم مدير عام، فيُمنح الرمز ما تختاره بالضبط — بقية الصلاحيات تبقى خارج الرمز.
                                    </p>
                                )}
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {grouped.map(({ group, label, perms }) => (
                                        <div key={group} className="rounded-lg border border-border p-3 space-y-2">
                                            <p className="text-sm font-bold">{label}</p>
                                            <div className="space-y-1.5">
                                                {perms.map(([permission, permLabel]) => {
                                                    const checked = selected.includes(permission);
                                                    return (
                                                        <label key={permission} className="flex items-center gap-2 text-sm cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => toggle(permission)}
                                                                className="sr-only"
                                                            />
                                                            <span
                                                                aria-hidden
                                                                className={`w-4 h-4 shrink-0 rounded-sm border flex items-center justify-center transition-all ${
                                                                    checked
                                                                        ? 'bg-primary border-primary text-primary-foreground'
                                                                        : 'border-input'
                                                                }`}
                                                            >
                                                                {checked && <Check className="w-3 h-3" />}
                                                            </span>
                                                            <span>{permLabel}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {selected.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        {selected.length} صلاحية محددة
                                    </p>
                                )}
                            </div>

                            <Button onClick={submit} disabled={saving}>
                                {saving ? 'جارٍ الإصدار...' : 'إصدار الرمز'}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Token list */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">الرموز الصادرة ({tokens.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {tokens.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                                لا توجد رموز بعد.
                            </p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-right">الاسم</TableHead>
                                        <TableHead className="text-right">المستخدم</TableHead>
                                        <TableHead className="text-right">الصلاحيات</TableHead>
                                        <TableHead className="text-right">آخر استخدام</TableHead>
                                        <TableHead className="text-right">ينتهي</TableHead>
                                        <TableHead />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tokens.map((t) => (
                                        <TableRow key={t.id}>
                                            <TableCell className="font-medium" dir="ltr">{t.name}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    {t.owner?.name ?? '—'}
                                                    {t.owner_banned && (
                                                        <ShieldAlert className="w-4 h-4 text-destructive" aria-label="حساب محظور" />
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {(t.abilities ?? []).map((a) => (
                                                        <Badge key={a} variant="secondary" className="text-[10px]" dir="ltr">
                                                            {a}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs">
                                                {t.last_used_at ? formatDate(t.last_used_at) : 'لم يُستخدم'}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                <span className={t.is_expired ? 'text-destructive font-bold' : 'text-muted-foreground'}>
                                                    {t.is_expired ? 'منتهٍ' : formatDate(t.expires_at)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    {t.owner && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            title="إبطال كل رموز هذا المستخدم"
                                                            onClick={() => revokeAll(t.owner!.id)}
                                                        >
                                                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                                                        </Button>
                                                    )}
                                                    <Button size="sm" variant="ghost" title="إبطال" onClick={() => revoke(t.id)}>
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                <p className="text-xs text-muted-foreground">
                    كل نداء للأداة يُسجَّل في <code dir="ltr">mcp_tool_calls</code> مع الرمز والمستخدم والنتيجة.
                </p>
            </div>

            {toast && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg ${toast.ok ? 'bg-green-600 text-white' : 'bg-destructive text-destructive-foreground'}`}>
                    {toast.msg}
                </div>
            )}
        </MainLayout>
    );
}
