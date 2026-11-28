import React, { useMemo, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import {
    Ban,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Pencil,
    Plus,
    RotateCcw,
    Search,
    ShieldCheck,
    Trash2,
    UserCheck,
    X,
} from 'lucide-react';
import AdminLayout from '@/Components/admin/AdminLayout';
import { ResponsiveTable } from '@/Components/directory/ResponsiveTable';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import FieldError, { fieldA11y } from '@/Components/ui/field-error';
import { FilterChip } from '@/Components/ui/filter-chip';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/Components/ui/select';
import { Switch } from '@/Components/ui/switch';
import { TableCell, TableHead, TableRow } from '@/Components/ui/table';
import {
    usersAdminApi,
    type AdminUserRecord,
    type UserRoleOption,
} from '@/Domain/users/api';
import { apiErrorMessage, apiFieldErrors } from '@/Lib/api';
import { confirmDialog } from '@/Lib/confirm';
import { notify } from '@/Lib/notify';
import { ProjectIcon } from '@/Lib/projectIcons';
import { cn } from '@/Lib/utils';
import type { AuthProps } from '@/types/auth';

type RoleFilter = 'all' | 'superadmin' | 'user';
type StatusFilter = 'all' | 'active' | 'banned' | 'trashed';

interface PaginatedUsers {
    data: AdminUserRecord[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface PermissionGroupMeta {
    label: string;
    icon: string;
}

interface CityOption {
    id: string;
    name_ar: string;
}

interface UsersIndexProps {
    users: PaginatedUsers;
    filters: {
        q: string;
        role: RoleFilter;
        status: StatusFilter;
    };
    permissionGroups: Record<string, Record<string, string>>;
    permissionGroupMeta: Record<string, PermissionGroupMeta>;
    cities: CityOption[];
    roleOptions: Record<string, string>;
    canManageUsers: boolean;
    canBanUsers: boolean;
}

interface UserFormState {
    name: string;
    email: string;
    password: string;
    role: UserRoleOption;
    is_banned: boolean;
    permissions: string[];
    transit_scope: string[];
}

const ROLE_FILTERS: ReadonlyArray<{ value: RoleFilter; label: string }> = [
    { value: 'all', label: 'كل الأدوار' },
    { value: 'superadmin', label: 'مدير عام' },
    { value: 'user', label: 'مستخدم عادي' },
];

const STATUS_FILTERS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: 'الكل' },
    { value: 'active', label: 'نشط' },
    { value: 'banned', label: 'محظور' },
    { value: 'trashed', label: 'محذوف' },
];

function emptyForm(): UserFormState {
    return {
        name: '',
        email: '',
        password: '',
        role: 'user',
        is_banned: false,
        permissions: [],
        transit_scope: [],
    };
}

function formFromUser(user: AdminUserRecord): UserFormState {
    return {
        name: user.name,
        email: user.email,
        password: '',
        role: user.role === 'superadmin' ? 'superadmin' : 'user',
        is_banned: user.is_banned,
        permissions: [...user.permissions],
        transit_scope: [...user.transit_scope],
    };
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    try {
        return new Intl.DateTimeFormat('ar-SY-u-nu-latn', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }).format(new Date(iso));
    } catch {
        return iso.slice(0, 10);
    }
}

export default function UsersIndex({
    users,
    filters,
    permissionGroups,
    permissionGroupMeta,
    cities,
    roleOptions,
    canManageUsers,
    canBanUsers,
}: UsersIndexProps) {
    const { auth } = usePage<{ auth: AuthProps }>().props;
    const currentUserId = auth.user?.id ?? null;

    const [searchQuery, setSearchQuery] = useState(filters.q ?? '');
    const [busyUserId, setBusyUserId] = useState<number | null>(null);

    // Create / Edit dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);
    const [form, setForm] = useState<UserFormState>(emptyForm);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

    const cityNameById = useMemo(() => {
        const map: Record<string, string> = {};
        for (const city of cities) {
            map[city.id] = city.name_ar;
        }
        return map;
    }, [cities]);

    const transitCapabilityKeys = useMemo(
        () => Object.keys(permissionGroups.transit ?? {}),
        [permissionGroups],
    );

    const hasTransitPermission = useMemo(
        () =>
            form.permissions.some(
                (perm) => perm === '*' || transitCapabilityKeys.includes(perm),
            ),
        [form.permissions, transitCapabilityKeys],
    );

    const navigateWithFilters = (next: {
        q?: string;
        role?: RoleFilter;
        status?: StatusFilter;
        page?: number;
    }) => {
        const params: Record<string, string | number> = {};
        const qVal = (next.q ?? searchQuery).trim();
        const roleVal = next.role ?? filters.role;
        const statusVal = next.status ?? filters.status;

        if (qVal !== '') params.q = qVal;
        if (roleVal !== 'all') params.role = roleVal;
        if (statusVal !== 'all') params.status = statusVal;
        if (next.page && next.page > 1) params.page = next.page;

        router.get('/admin/users', params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        navigateWithFilters({ q: searchQuery, page: 1 });
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        navigateWithFilters({ q: '', page: 1 });
    };

    const openCreateDialog = () => {
        setEditingUser(null);
        setForm(emptyForm());
        setFieldErrors({});
        setOpenGroups({});
        setDialogOpen(true);
    };

    const openEditDialog = (user: AdminUserRecord) => {
        setEditingUser(user);
        setForm(formFromUser(user));
        setFieldErrors({});
        const initialOpen: Record<string, boolean> = {};
        const hasWildcard = user.permissions.includes('*');
        for (const [groupKey, caps] of Object.entries(permissionGroups)) {
            if (
                (groupKey === 'transit' && (hasWildcard || user.transit_scope.length > 0)) ||
                Object.keys(caps).some((cap) => user.permissions.includes(cap))
            ) {
                initialOpen[groupKey] = true;
            }
        }
        setOpenGroups(initialOpen);
        setDialogOpen(true);
    };

    const toggleGroup = (groupKey: string) => {
        setOpenGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
    };

    const togglePermission = (capability: string) => {
        setForm((prev) => {
            const exists = prev.permissions.includes(capability);
            const nextPermissions = exists
                ? prev.permissions.filter((p) => p !== capability)
                : [...prev.permissions, capability];
            return { ...prev, permissions: nextPermissions };
        });
    };

    const toggleGroupAll = (groupKey: string) => {
        const keys = Object.keys(permissionGroups[groupKey] ?? {});
        if (keys.length === 0) return;

        setForm((prev) => {
            const allSelected = keys.every((k) => prev.permissions.includes(k));
            const nextPermissions = allSelected
                ? prev.permissions.filter((p) => !keys.includes(p))
                : Array.from(new Set([...prev.permissions, ...keys]));
            return { ...prev, permissions: nextPermissions };
        });
    };

    const toggleTransitCity = (cityId: string) => {
        setForm((prev) => {
            const exists = prev.transit_scope.includes(cityId);
            const nextScope = exists
                ? prev.transit_scope.filter((id) => id !== cityId)
                : [...prev.transit_scope, cityId];
            return { ...prev, transit_scope: nextScope };
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setFieldErrors({});

        try {
            if (editingUser) {
                const payload = {
                    name: form.name.trim(),
                    email: form.email.trim(),
                    ...(form.password.trim() !== '' ? { password: form.password } : {}),
                    role: form.role,
                    is_banned: form.role === 'superadmin' ? false : form.is_banned,
                    permissions: form.permissions,
                    transit_scope: hasTransitPermission ? form.transit_scope : [],
                };
                const res = await usersAdminApi.update(editingUser.id, payload);
                notify.success(res.message ?? 'تم تحديث بيانات المستخدم بنجاح');
            } else {
                const payload = {
                    name: form.name.trim(),
                    email: form.email.trim(),
                    password: form.password,
                    role: form.role,
                    is_banned: form.role === 'superadmin' ? false : form.is_banned,
                    permissions: form.permissions,
                    transit_scope: hasTransitPermission ? form.transit_scope : [],
                };
                const res = await usersAdminApi.create(payload);
                notify.success(res.message ?? 'تم إنشاء المستخدم بنجاح');
            }

            setDialogOpen(false);
            router.reload({ only: ['users'] });
        } catch (err) {
            const errs = apiFieldErrors(err);
            if (Object.keys(errs).length > 0) {
                setFieldErrors(errs);
            }
            notify.error(apiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const handleToggleBan = async (user: AdminUserRecord) => {
        const willBan = !user.is_banned;
        const confirmed = await confirmDialog({
            title: willBan ? `حظر المستخدم «${user.name}»؟` : `إلغاء حظر «${user.name}»؟`,
            description: willBan
                ? 'سيتم إنهاء جلسات المستخدم وإلغاء رموز الوصول الخاصة به فوراً ومنعه من تسجيل الدخول.'
                : 'سيتمكن المستخدم من تسجيل الدخول واستخدام المنصة مجدداً.',
            confirmText: willBan ? 'حظر المستخدم' : 'إلغاء الحظر',
            cancelText: 'إلغاء',
            destructive: willBan,
        });
        if (!confirmed) return;

        setBusyUserId(user.id);
        try {
            const res = await usersAdminApi.toggleBan(user.id);
            notify.success(
                res.message ?? (res.is_banned ? 'تم حظر المستخدم بنجاح' : 'تم إلغاء حظر المستخدم'),
            );
            router.reload({ only: ['users'] });
        } catch (err) {
            notify.error(apiErrorMessage(err));
        } finally {
            setBusyUserId(null);
        }
    };

    const handleDelete = async (user: AdminUserRecord) => {
        const confirmed = await confirmDialog({
            title: `حذف المستخدم «${user.name}»؟`,
            description: 'سيتم نقل الحساب إلى سلة المحذوفات ويمكن استعادته لاحقاً.',
            confirmText: 'حذف المستخدم',
            cancelText: 'إلغاء',
            destructive: true,
        });
        if (!confirmed) return;

        setBusyUserId(user.id);
        try {
            const res = await usersAdminApi.remove(user.id);
            notify.success(res.message ?? 'تم حذف المستخدم بنجاح');
            router.reload({ only: ['users'] });
        } catch (err) {
            notify.error(apiErrorMessage(err));
        } finally {
            setBusyUserId(null);
        }
    };

    const handleRestore = async (user: AdminUserRecord) => {
        const confirmed = await confirmDialog({
            title: `استعادة المستخدم «${user.name}»؟`,
            description: 'سيُعاد تفعيل الحساب بنفس بياناته وصلاحياته السابقة.',
            confirmText: 'استعادة',
            cancelText: 'إلغاء',
        });
        if (!confirmed) return;

        setBusyUserId(user.id);
        try {
            const res = await usersAdminApi.restore(user.id);
            notify.success(res.message ?? 'تم استعادة المستخدم بنجاح');
            router.reload({ only: ['users'] });
        } catch (err) {
            notify.error(apiErrorMessage(err));
        } finally {
            setBusyUserId(null);
        }
    };

    const renderRoleBadge = (user: AdminUserRecord) => {
        if (user.role === 'superadmin') {
            return (
                <Badge variant="default" className="gap-1">
                    <ShieldCheck className="size-3" aria-hidden="true" />
                    مدير عام
                </Badge>
            );
        }
        return <Badge variant="secondary">مستخدم عادي</Badge>;
    };

    const renderStatusBadge = (user: AdminUserRecord) => {
        if (user.deleted_at) {
            return <Badge variant="outline">محذوف</Badge>;
        }
        if (user.is_banned) {
            return <Badge variant="destructive">محظور</Badge>;
        }
        return <Badge variant="success">نشط</Badge>;
    };

    const renderPermissionsSummary = (user: AdminUserRecord) => {
        if (user.role === 'superadmin') {
            return <span className="text-xs text-muted-foreground">وصول كامل</span>;
        }
        const count = user.effective_permissions.length;
        if (count === 0) {
            return <span className="text-xs text-muted-foreground">بدون صلاحيات</span>;
        }
        const scopeLabel =
            user.transit_scope.length > 0
                ? user.transit_scope.map((id) => cityNameById[id] ?? id).join('، ')
                : null;
        return (
            <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-foreground">
                    {count} {count === 1 ? 'صلاحية' : 'صلاحيات'}
                </span>
                {scopeLabel && (
                    <span className="text-[11px] text-muted-foreground line-clamp-1" title={scopeLabel}>
                        النقل: {scopeLabel}
                    </span>
                )}
            </div>
        );
    };

    const renderActions = (user: AdminUserRecord) => {
        const isSelf = currentUserId !== null && user.id === currentUserId;
        const isSuperAdmin = user.role === 'superadmin';
        const isTrashed = Boolean(user.deleted_at);
        const isBusy = busyUserId === user.id;

        const showBan = canBanUsers && !isSuperAdmin && !isSelf && !isTrashed;

        return (
            <div className="flex items-center justify-end gap-1.5">
                {showBan && (
                    <Button
                        type="button"
                        size="sm"
                        variant={user.is_banned ? 'outline' : 'ghost'}
                        disabled={isBusy}
                        onClick={() => handleToggleBan(user)}
                        aria-label={user.is_banned ? `إلغاء حظر ${user.name}` : `حظر ${user.name}`}
                        title={user.is_banned ? 'إلغاء الحظر' : 'حظر المستخدم'}
                        className={cn(
                            !user.is_banned && 'text-destructive hover:text-destructive hover:bg-destructive/10',
                        )}
                    >
                        {user.is_banned ? (
                            <>
                                <UserCheck className="size-3.5 me-1" aria-hidden="true" />
                                إلغاء الحظر
                            </>
                        ) : (
                            <>
                                <Ban className="size-3.5 me-1" aria-hidden="true" />
                                حظر
                            </>
                        )}
                    </Button>
                )}

                {canManageUsers && (
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={isBusy}
                        onClick={() => openEditDialog(user)}
                        aria-label={`تعديل ${user.name}`}
                        title="تعديل"
                    >
                        <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                )}

                {canManageUsers && isTrashed && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => handleRestore(user)}
                        aria-label={`استعادة ${user.name}`}
                    >
                        <RotateCcw className="size-3.5 me-1" aria-hidden="true" />
                        استعادة
                    </Button>
                )}

                {canManageUsers && !isTrashed && !isSelf && (
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={isBusy}
                        onClick={() => handleDelete(user)}
                        aria-label={`حذف ${user.name}`}
                        title="حذف"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                        <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                )}
            </div>
        );
    };

    const editingSelf = editingUser !== null && currentUserId !== null && editingUser.id === currentUserId;
    const banDisabled = form.role === 'superadmin' || editingSelf;

    return (
        <AdminLayout
            title="إدارة المستخدمين والصلاحيات"
            subtitle="عرض حسابات المستخدمين، إدارة الصلاحيات التفصيلية لكل وحدة، وحظر أو استعادة الحسابات."
            activeSection="users"
            actions={
                canManageUsers ? (
                    <Button type="button" onClick={openCreateDialog} className="gap-1.5">
                        <Plus className="size-4" aria-hidden="true" />
                        مستخدم جديد
                    </Button>
                ) : undefined
            }
        >
            <div className="space-y-4">
                {/* Search and Filters */}
                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                            <Label htmlFor="users-search" className="sr-only">
                                بحث بالاسم أو البريد الإلكتروني
                            </Label>
                            <Search
                                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <Input
                                id="users-search"
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="ابحث بالاسم أو البريد الإلكتروني..."
                                className="ps-9 pe-9"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={handleClearSearch}
                                    aria-label="مسح البحث"
                                    className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="size-3.5" aria-hidden="true" />
                                </button>
                            )}
                        </div>
                        <Button type="submit" variant="secondary">
                            بحث
                        </Button>
                    </form>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="تصفية حسب الدور">
                            <span className="text-xs text-muted-foreground me-1">الدور:</span>
                            {ROLE_FILTERS.map((opt) => (
                                <FilterChip
                                    key={opt.value}
                                    active={filters.role === opt.value}
                                    onClick={() => navigateWithFilters({ role: opt.value, page: 1 })}
                                >
                                    {opt.label}
                                </FilterChip>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="تصفية حسب الحالة">
                            <span className="text-xs text-muted-foreground me-1">الحالة:</span>
                            {STATUS_FILTERS.map((opt) => (
                                <FilterChip
                                    key={opt.value}
                                    active={filters.status === opt.value}
                                    onClick={() => navigateWithFilters({ status: opt.value, page: 1 })}
                                >
                                    {opt.label}
                                </FilterChip>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Users Table */}
                {users.data.length === 0 ? (
                    <div className="rounded-lg border border-border bg-card px-6 py-12 text-center space-y-2">
                        <p className="text-sm font-medium text-foreground">لا يوجد مستخدمون مطابقون لخيارات البحث الحالية.</p>
                        {(filters.q !== '' || filters.role !== 'all' || filters.status !== 'all') && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setSearchQuery('');
                                    router.get('/admin/users', {}, { preserveState: true, replace: true });
                                }}
                            >
                                إعادة ضبط التصفية
                            </Button>
                        )}
                    </div>
                ) : (
                    <ResponsiveTable
                        items={users.data}
                        getKey={(u) => u.id}
                        mobileLabel="قائمة المستخدمين"
                        desktopHeader={
                            <TableRow>
                                <TableHead className="text-start">المستخدم</TableHead>
                                <TableHead className="text-start">الدور</TableHead>
                                <TableHead className="text-start">الحالة</TableHead>
                                <TableHead className="text-start">الصلاحيات</TableHead>
                                <TableHead className="text-start">تاريخ الإنشاء</TableHead>
                                <TableHead className="text-end">الإجراءات</TableHead>
                            </TableRow>
                        }
                        renderDesktopRow={(user) => (
                            <TableRow key={user.id} className={cn(user.deleted_at && 'opacity-65')}>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-foreground">
                                            {user.name}
                                            {currentUserId === user.id && (
                                                <span className="ms-1.5 text-xs font-normal text-muted-foreground">
                                                    (أنت)
                                                </span>
                                            )}
                                        </span>
                                        <span dir="ltr" className="text-xs text-muted-foreground text-start">
                                            {user.email}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>{renderRoleBadge(user)}</TableCell>
                                <TableCell>{renderStatusBadge(user)}</TableCell>
                                <TableCell>{renderPermissionsSummary(user)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    {formatDate(user.created_at)}
                                </TableCell>
                                <TableCell className="text-end">{renderActions(user)}</TableCell>
                            </TableRow>
                        )}
                        renderMobileItem={(user) => (
                            <div className={cn('space-y-2', user.deleted_at && 'opacity-65')}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-medium text-sm text-foreground truncate">
                                            {user.name}
                                            {currentUserId === user.id && (
                                                <span className="ms-1 text-xs font-normal text-muted-foreground">
                                                    (أنت)
                                                </span>
                                            )}
                                        </p>
                                        <p dir="ltr" className="text-xs text-muted-foreground truncate text-start">
                                            {user.email}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {renderRoleBadge(user)}
                                        {renderStatusBadge(user)}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between gap-2 pt-1">
                                    <div>{renderPermissionsSummary(user)}</div>
                                    {renderActions(user)}
                                </div>
                            </div>
                        )}
                    />
                )}

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                        {users.total > 0 && users.from !== null && users.to !== null
                            ? `عرض ${users.from}–${users.to} من أصل ${users.total} مستخدم`
                            : `إجمالي ${users.total} مستخدم`}
                    </span>

                    {users.last_page > 1 && (
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={users.current_page <= 1}
                                onClick={() => navigateWithFilters({ page: users.current_page - 1 })}
                            >
                                <ChevronRight className="size-4 me-1" aria-hidden="true" />
                                السابق
                            </Button>
                            <span className="text-foreground font-medium">
                                صفحة {users.current_page} من {users.last_page}
                            </span>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={users.current_page >= users.last_page}
                                onClick={() => navigateWithFilters({ page: users.current_page + 1 })}
                            >
                                التالي
                                <ChevronLeft className="size-4 ms-1" aria-hidden="true" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Create / Edit User Dialog */}
            {canManageUsers && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>
                                {editingUser ? `تعديل المستخدم: ${editingUser.name}` : 'إنشاء مستخدم جديد'}
                            </DialogTitle>
                            <DialogDescription>
                                {editingUser
                                    ? 'عدّل بيانات الحساب والدور والصلاحيات التفصيلية لكل وحدة.'
                                    : 'أضف حساباً جديداً وحدد دوره وصلاحياته التفصيلية في المنصة.'}
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleSave} className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="user-name">الاسم</Label>
                                    <Input
                                        id="user-name"
                                        required
                                        maxLength={255}
                                        value={form.name}
                                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                        {...fieldA11y('user-name-error', fieldErrors.name)}
                                    />
                                    <FieldError id="user-name-error" message={fieldErrors.name} />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="user-email">البريد الإلكتروني</Label>
                                    <Input
                                        id="user-email"
                                        type="email"
                                        dir="ltr"
                                        required
                                        maxLength={255}
                                        className="text-start"
                                        value={form.email}
                                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                        {...fieldA11y('user-email-error', fieldErrors.email)}
                                    />
                                    <FieldError id="user-email-error" message={fieldErrors.email} />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="user-role">الدور</Label>
                                    <Select
                                        value={form.role}
                                        onValueChange={(value) =>
                                            setForm((f) => ({
                                                ...f,
                                                role: value === 'superadmin' ? 'superadmin' : 'user',
                                                is_banned: value === 'superadmin' ? false : f.is_banned,
                                            }))
                                        }
                                    >
                                        <SelectTrigger id="user-role">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(roleOptions).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FieldError id="user-role-error" message={fieldErrors.role} />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="user-password">
                                        {editingUser ? 'كلمة المرور (اختياري)' : 'كلمة المرور'}
                                    </Label>
                                    <Input
                                        id="user-password"
                                        type="password"
                                        dir="ltr"
                                        className="text-start"
                                        required={!editingUser}
                                        minLength={8}
                                        maxLength={255}
                                        placeholder={editingUser ? 'اتركه فارغاً للإبقاء على الحالية' : '8 أحرف على الأقل'}
                                        value={form.password}
                                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                                        {...fieldA11y('user-password-error', fieldErrors.password)}
                                    />
                                    <FieldError id="user-password-error" message={fieldErrors.password} />
                                </div>
                            </div>

                            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3.5 py-2.5">
                                <div className="space-y-0.5">
                                    <Label htmlFor="user-banned" className="text-sm font-medium">
                                        حظر الحساب
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        {form.role === 'superadmin'
                                            ? 'لا يمكن حظر حساب المدير العام.'
                                            : editingSelf
                                              ? 'لا يمكنك حظر حسابك الخاص.'
                                              : 'يمنع المستخدم من تسجيل الدخول ويلغي جلساته ورموزه الفعّالة.'}
                                    </p>
                                </div>
                                <Switch
                                    id="user-banned"
                                    disabled={banDisabled}
                                    checked={banDisabled ? false : form.is_banned}
                                    onCheckedChange={(checked) => setForm((f) => ({ ...f, is_banned: checked }))}
                                />
                            </div>

                            {/* Grouped Permissions */}
                            <div className="space-y-2.5">
                                <div>
                                    <h2 className="text-sm font-semibold text-foreground">الصلاحيات التفصيلية</h2>
                                    <p className="text-xs text-muted-foreground">
                                        {form.role === 'superadmin'
                                            ? 'يمتلك المدير العام وصولاً كاملاً لجميع الوحدات تلقائياً؛ لا حاجة لتحديد صلاحيات فردية.'
                                            : 'منح صلاحيات مخصصة لكل وحدة للمستخدمين من غير المدير العام.'}
                                    </p>
                                </div>

                                {form.role !== 'superadmin' && (
                                    <div className="space-y-2">
                                        {Object.entries(permissionGroups).map(([groupKey, capabilities]) => {
                                            const meta = permissionGroupMeta[groupKey] ?? {
                                                label: groupKey,
                                                icon: groupKey,
                                            };
                                            const capEntries = Object.entries(capabilities);
                                            const selectedCount = capEntries.filter(([capKey]) =>
                                                form.permissions.includes(capKey),
                                            ).length;
                                            const isExpanded = Boolean(openGroups[groupKey]);
                                            const allSelected =
                                                capEntries.length > 0 && selectedCount === capEntries.length;

                                            return (
                                                <div
                                                    key={groupKey}
                                                    className="rounded-md border border-border bg-card overflow-hidden"
                                                >
                                                    <button
                                                        type="button"
                                                        aria-expanded={isExpanded}
                                                        onClick={() => toggleGroup(groupKey)}
                                                        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-start hover:bg-muted/40 transition-colors"
                                                    >
                                                        <span className="flex items-center gap-2.5 min-w-0">
                                                            <ProjectIcon
                                                                name={meta.icon}
                                                                className="size-5 shrink-0"
                                                            />
                                                            <span className="text-sm font-medium text-foreground truncate">
                                                                {meta.label}
                                                            </span>
                                                            {selectedCount > 0 && (
                                                                <Badge variant="secondary" className="text-[11px]">
                                                                    {selectedCount}/{capEntries.length}
                                                                </Badge>
                                                            )}
                                                        </span>
                                                        <ChevronDown
                                                            className={cn(
                                                                'size-4 shrink-0 text-muted-foreground transition-transform',
                                                                isExpanded && 'rotate-180',
                                                            )}
                                                            aria-hidden="true"
                                                        />
                                                    </button>

                                                    {isExpanded && (
                                                        <div className="border-t border-border px-3.5 py-3 space-y-3 bg-muted/15">
                                                            {capEntries.length > 1 && (
                                                                <div className="flex justify-end">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleGroupAll(groupKey)}
                                                                        className="text-xs text-primary hover:underline"
                                                                    >
                                                                        {allSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                                                                    </button>
                                                                </div>
                                                            )}

                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                {capEntries.map(([capKey, capLabel]) => {
                                                                    const checked = form.permissions.includes(capKey);
                                                                    return (
                                                                        <label
                                                                            key={capKey}
                                                                            className="flex items-start gap-2 rounded-md border border-transparent px-2 py-1.5 text-xs hover:bg-muted/50 cursor-pointer"
                                                                        >
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={checked}
                                                                                onChange={() =>
                                                                                    togglePermission(capKey)
                                                                                }
                                                                                className="mt-0.5 size-4 rounded border-input accent-primary"
                                                                            />
                                                                            <span className="text-foreground leading-snug">
                                                                                {capLabel}
                                                                            </span>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>

                                                            {/* Conditional Transit Governorate Scope */}
                                                            {groupKey === 'transit' && hasTransitPermission && (
                                                                <div className="mt-3 rounded-md border border-border bg-background p-3 space-y-2">
                                                                    <div className="space-y-0.5">
                                                                        <p className="text-xs font-semibold text-foreground">
                                                                            نطاق المحافظات
                                                                        </p>
                                                                        <p className="text-[11px] text-muted-foreground">
                                                                            اتركه فارغاً للسماح بجميع المحافظات.
                                                                        </p>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                                                        {cities.map((city) => {
                                                                            const checked =
                                                                                form.transit_scope.includes(city.id);
                                                                            return (
                                                                                <label
                                                                                    key={city.id}
                                                                                    className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/50 cursor-pointer"
                                                                                >
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={checked}
                                                                                        onChange={() =>
                                                                                            toggleTransitCity(city.id)
                                                                                        }
                                                                                        className="size-3.5 rounded border-input accent-primary"
                                                                                    />
                                                                                    <span className="text-foreground">
                                                                                        {city.name_ar}
                                                                                    </span>
                                                                                </label>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                    <FieldError
                                                                        id="transit-scope-error"
                                                                        message={fieldErrors.transit_scope}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setDialogOpen(false)}
                                    disabled={saving}
                                >
                                    إلغاء
                                </Button>
                                <Button type="submit" disabled={saving}>
                                    {saving
                                        ? 'جارٍ الحفظ...'
                                        : editingUser
                                          ? 'حفظ التغييرات'
                                          : 'إنشاء المستخدم'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </AdminLayout>
    );
}
