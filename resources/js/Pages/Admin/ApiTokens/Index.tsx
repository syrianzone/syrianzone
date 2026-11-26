import React, { useEffect, useMemo, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { apiErrorMessage, apiFieldErrors } from '@/Lib/api';
import { apiTokensApi } from './_lib/api';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import FieldError, { fieldA11y } from '@/Components/ui/field-error';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { notify as toastNotify } from '@/Lib/notify';
import { copyText } from '@/Lib/copy';
import { confirmDialog } from '@/Lib/confirm';
import { formatGregorianSyrianShort } from '@/Lib/syrian-date';
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

interface TokenRow {
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

interface ApiTokensData {
    /**
     * True for anyone but a superadmin: the page manages only the viewer's own
     * tokens, `owners` is just them, and `capabilities` is narrowed server-side
     * to what they hold.
     */
    selfService: boolean;
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
    return formatGregorianSyrianShort(iso);
}

export default function ApiTokensIndex(props: ApiTokensData) {
    const { selfService, tokens, owners, capabilityGroups, capabilities, ttlOptions, endpoint } = props;

    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);

    // Self-service tokens always belong to the viewer, the only owner offered.
    const [ownerId, setOwnerId] = useState<string>(
        selfService && owners[0] ? String(owners[0].id) : '',
    );
    const [name, setName] = useState('');
    const [ttl, setTtl] = useState<string>(ttlOptions[1]?.value ?? '30d');
    const [selected, setSelected] = useState<string[]>([]);
    const [errors, setErrors] = useState<{ user_id?: string; name?: string; permissions?: string }>({});
    const formRef = useRef<HTMLFormElement>(null);
    // Bumped on each rejected submit (not on every edit that clears an error),
    // so focus only moves right after a submit attempt.
    const [rejectedSubmits, setRejectedSubmits] = useState(0);

    // After a rejected submit, move focus to the first field that needs fixing
    // so its inline message is announced in context.
    useEffect(() => {
        const form = formRef.current;
        if (!form || rejectedSubmits === 0) return;
        const target = form.querySelector<HTMLElement>('[aria-invalid="true"]')
            ?? form.querySelector<HTMLElement>('[aria-describedby="permissions-error"] input[type="checkbox"]');
        target?.focus();
    }, [rejectedSubmits]);

    const [issued, setIssued] = useState<{ token: string; message: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const issuedRef = useRef<HTMLDivElement>(null);

    // The new token appears above the form; move focus to it so screen-reader
    // and keyboard users land on the one-time secret instead of missing it.
    useEffect(() => {
        if (issued) issuedRef.current?.focus();
    }, [issued]);

    const notify = (msg: string, ok = true) => {
        if (ok) toastNotify.success(msg);
        else toastNotify.error(msg);
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

    const toggle = (permission: string) => {
        setErrors((prev) => ({ ...prev, permissions: undefined }));
        setSelected((prev) =>
            prev.includes(permission)
                ? prev.filter((p) => p !== permission)
                : [...prev, permission],
        );
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        const missing: typeof errors = {};
        if (!ownerId) missing.user_id = 'اختر المستخدم.';
        if (!name.trim()) missing.name = 'سمِّ الرمز.';
        if (selected.length === 0) missing.permissions = 'اختر صلاحية واحدة على الأقل.';
        setErrors(missing);
        if (Object.keys(missing).length > 0) {
            setRejectedSubmits((n) => n + 1);
            return;
        }
        setSaving(true);
        try {
            const res = await apiTokensApi.issue({
                user_id: Number(ownerId),
                name: name.trim(),
                ttl,
                permissions: selected,
            });
            setIssued({ token: res.plain_text_token, message: res.message });
            setName('');
            setSelected([]);
            router.reload({ only: ['tokens'] });
        } catch (err) {
            const fields = apiFieldErrors(err);
            const permissionsError = Object.entries(fields)
                .find(([key]) => key === 'permissions' || key.startsWith('permissions.'))?.[1];
            const inline = { user_id: fields.user_id, name: fields.name, permissions: permissionsError };
            if (inline.user_id || inline.name || inline.permissions) {
                setErrors(inline);
                setRejectedSubmits((n) => n + 1);
            } else {
                notify(apiErrorMessage(err, 'تعذّر إنشاء الرمز.'), false);
            }
        } finally {
            setSaving(false);
        }
    };

    const revoke = async (id: number) => {
        const ok = await confirmDialog({
            title: 'إبطال هذا الرمز؟',
            description: 'سيتوقف أي وكيل يستخدمه فوراً، ولا يمكن التراجع عن الإبطال.',
            destructive: true,
            confirmText: 'إبطال',
        });
        if (!ok) return;
        try {
            const res = await apiTokensApi.revoke(id);
            notify(res.message);
            router.reload({ only: ['tokens'] });
        } catch (e) {
            notify(apiErrorMessage(e, 'تعذّر إبطال الرمز.'), false);
        }
    };

    const revokeAll = async (userId: number) => {
        const ok = await confirmDialog({
            title: 'إبطال كل رموز هذا المستخدم؟',
            description: 'تُبطل كل رموز الوكلاء الخاصة به وتنتهي جلساته على الهاتف، ولا يمكن التراجع.',
            destructive: true,
            confirmText: 'إبطال الكل',
        });
        if (!ok) return;
        try {
            const res = await apiTokensApi.revokeAllForUser(userId);
            notify(res.message);
            router.reload({ only: ['tokens'] });
        } catch (e) {
            notify(apiErrorMessage(e, 'تعذّر إبطال الرموز.'), false);
        }
    };

    const copyToken = async () => {
        if (!issued) return;
        // The local check mark is this panel's own confirmation; the copy helper
        // still owns the failure message when the browser refuses.
        if (await copyText(issued.token, {
            successMessage: 'نُسخ رمز الوصول',
            failureMessage: 'تعذّر النسخ، انسخ الرمز يدوياً.',
        })) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <MainLayout>
            
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
                        <Plus className="w-4 h-4 me-2" />
                        رمز جديد
                    </Button>
                </div>

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

                {issued && (
                    <Card
                        ref={issuedRef}
                        tabIndex={-1}
                        aria-labelledby="issued-token-title"
                        className="border-green-500/50 bg-green-500/5 focus-visible:outline-none"
                    >
                        <CardHeader>
                            <CardTitle id="issued-token-title" className="text-base flex items-center gap-2 text-green-600 dark:text-green-400">
                                <Check className="w-5 h-5" aria-hidden="true" />
                                تم إنشاء الرمز
                            </CardTitle>
                            <CardDescription>{issued.message}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center gap-2">
                                <code dir="ltr" className="flex-1 bg-muted rounded-md p-3 text-xs break-all text-left select-all">
                                    {issued.token}
                                </code>
                                <Button size="sm" variant="outline" onClick={() => void copyToken()}>
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

                {showForm && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">إنشاء رمز</CardTitle>
                            <CardDescription>
                                {selfService
                                    ? 'الرمز لحسابك، ويحمل من صلاحياتك ما تختاره فقط. وإذا سُحبت منك صلاحية توقّف الرمز عن استخدامها فوراً.'
                                    : 'يُمنح الرمز ما يملكه المستخدم بالفعل فقط. لا يوجد خيار «الكل» — عمداً، حتى لا يتفوق الرمز على صاحبه.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <form ref={formRef} onSubmit={submit} noValidate className="space-y-5">
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div className="space-y-2">
                                    {selfService ? (
                                        <>
                                            {/* Not a control, so a plain caption rather than a <label>. */}
                                            <p className="text-sm font-medium leading-none">المستخدم</p>
                                            <p className="h-10 flex items-center text-sm font-medium">
                                                {owners[0]?.name ?? '—'}
                                            </p>
                                        </>
                                    ) : (
                                    <>
                                    <Label htmlFor="owner">المستخدم</Label>
                                    <Select
                                        value={ownerId}
                                        onValueChange={(value) => {
                                            setOwnerId(value);
                                            setErrors((prev) => ({ ...prev, user_id: undefined }));
                                        }}
                                        dir="rtl"
                                    >
                                        <SelectTrigger id="owner" {...fieldA11y('owner-error', errors.user_id)}>
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
                                    <FieldError id="owner-error" message={errors.user_id} />
                                    </>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="name">اسم الرمز</Label>
                                    <Input
                                        id="name"
                                        value={name}
                                        onChange={(e) => {
                                            setName(e.target.value);
                                            setErrors((prev) => ({ ...prev, name: undefined }));
                                        }}
                                        placeholder="claude-code"
                                        dir="ltr"
                                        spellCheck={false}
                                        autoComplete="off"
                                        {...fieldA11y('name-error', errors.name)}
                                    />
                                    <FieldError id="name-error" message={errors.name} />
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

                            <div
                                className="space-y-3"
                                role="group"
                                aria-labelledby="permissions-label"
                                aria-describedby={errors.permissions ? 'permissions-error' : undefined}
                            >
                                <p id="permissions-label" className="text-sm font-medium leading-none">الصلاحيات</p>
                                {selectedOwner?.role === 'superadmin' && (
                                    <p className="text-xs text-muted-foreground">
                                        هذا المستخدم مدير عام، فيُمنح الرمز ما تختاره بالضبط — بقية الصلاحيات تبقى خارج الرمز.
                                    </p>
                                )}
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {grouped.map(({ group, label, perms }) => (
                                        <div
                                            key={group}
                                            role="group"
                                            aria-labelledby={`perm-group-${group}`}
                                            className="rounded-lg border border-border p-3 space-y-2"
                                        >
                                            <p id={`perm-group-${group}`} className="text-sm font-bold">{label}</p>
                                            <div className="space-y-1.5">
                                                {perms.map(([permission, permLabel]) => {
                                                    const checked = selected.includes(permission);
                                                    return (
                                                        <label key={permission} className="flex items-center gap-2 text-sm cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => toggle(permission)}
                                                                className="peer sr-only"
                                                            />
                                                            <span
                                                                aria-hidden
                                                                className={`w-4 h-4 shrink-0 rounded-sm border flex items-center justify-center transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background ${
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
                                <FieldError id="permissions-error" message={errors.permissions} />
                            </div>

                            <Button type="submit" disabled={saving}>
                                {saving ? 'جارٍ الإصدار...' : 'إصدار الرمز'}
                            </Button>
                          </form>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">
                            {selfService ? 'رموزك' : 'الرموز الصادرة'} ({tokens.length})
                        </CardTitle>
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
                                        {!selfService && <TableHead className="text-right">المستخدم</TableHead>}
                                        <TableHead className="text-right">الصلاحيات</TableHead>
                                        <TableHead className="text-right">آخر استخدام</TableHead>
                                        <TableHead className="text-right">ينتهي</TableHead>
                                        <TableHead className="text-right">
                                            <span className="sr-only">إجراءات</span>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tokens.map((t) => {
                                        const owner = t.owner;
                                        return (
                                            <TableRow key={t.id}>
                                                <TableCell className="font-medium" dir="ltr">{t.name}</TableCell>
                                                {!selfService && (
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5">
                                                        {owner?.name ?? '—'}
                                                        {t.owner_banned && (
                                                            <ShieldAlert className="w-4 h-4 text-destructive" aria-label="حساب محظور" />
                                                        )}
                                                    </div>
                                                </TableCell>
                                                )}
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
                                                        {/* Revoke-all also ends the user's mobile sessions,
                                                            so it stays a superadmin leak response. */}
                                                        {!selfService && owner && (
                                                            <Button aria-label="إبطال كل رموز هذا المستخدم"
                                                                size="sm"
                                                                variant="ghost"
                                                                title="إبطال كل رموز هذا المستخدم"
                                                                onClick={() => revokeAll(owner.id)}
                                                            >
                                                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                                            </Button>
                                                        )}
                                                        <Button aria-label="إبطال" size="sm" variant="ghost" title="إبطال" onClick={() => revoke(t.id)}>
                                                            <Trash2 className="w-4 h-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                <p className="text-xs text-muted-foreground">
                    كل نداء للأداة يُسجَّل في <code dir="ltr">mcp_tool_calls</code> مع الرمز والمستخدم والنتيجة.
                </p>
            </div>

        </MainLayout>
    );
}
