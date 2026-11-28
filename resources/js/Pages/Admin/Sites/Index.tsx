import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Edit, ExternalLink, Globe, Plus, RotateCcw, Trash2 } from 'lucide-react';
import AdminLayout from '@/Components/admin/AdminLayout';
import DirectoryEmptyState from '@/Components/directory/DirectoryEmptyState';
import DirectoryResultCount from '@/Components/directory/DirectoryResultCount';
import { DirectorySearch } from '@/Components/directory/DirectorySearch';
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
import { Textarea } from '@/Components/ui/textarea';
import {
    sitesAdminApi,
    type AdminSyrianSite,
    type SyrianSitePayload,
} from '@/Domain/civicAdmin/api';
import { apiErrorMessage, apiFieldErrors } from '@/Lib/api';
import { confirmDialog } from '@/Lib/confirm';
import { notify } from '@/Lib/notify';

interface SitesAdminIndexProps {
    sites: AdminSyrianSite[];
}

interface SiteFormState {
    name: string;
    slug: string;
    url: string;
    category: string;
    description: string;
    tags: string;
    icon_url: string;
    sort_order: string;
    is_active: boolean;
}

const EMPTY_FORM: SiteFormState = {
    name: '',
    slug: '',
    url: '',
    category: '',
    description: '',
    tags: '',
    icon_url: '',
    sort_order: '',
    is_active: true,
};

function sortSites(items: AdminSyrianSite[]): AdminSyrianSite[] {
    return [...items].sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id));
}

function parseTags(raw: string): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const part of raw.split(/[,،]/)) {
        const tag = part.trim();
        if (!tag || seen.has(tag)) continue;
        seen.add(tag);
        result.push(tag);
    }
    return result;
}

function isHttpUrl(value: string): boolean {
    return /^https?:\/\/.+/i.test(value);
}

export default function SitesAdminIndex({ sites: initialSites }: SitesAdminIndexProps) {
    const [sites, setSites] = useState<AdminSyrianSite[]>(() => sortSites(initialSites));
    const [query, setQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<AdminSyrianSite | null>(null);
    const [form, setForm] = useState<SiteFormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        setSites(sortSites(initialSites));
    }, [initialSites]);

    useEffect(() => {
        if (Object.keys(errors).length === 0) return;
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }, [errors]);

    const categories = useMemo(() => {
        const unique = new Set<string>();
        for (const item of sites) {
            if (item.category?.trim()) unique.add(item.category.trim());
        }
        return Array.from(unique).sort((a, b) => a.localeCompare(b, 'ar'));
    }, [sites]);

    const isFiltered = query.trim() !== '' || categoryFilter !== 'all';

    const filteredSites = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return sites.filter((item) => {
            if (categoryFilter !== 'all' && (item.category?.trim() ?? '') !== categoryFilter) return false;
            if (!needle) return true;
            const haystack = [
                item.name,
                item.slug,
                item.url,
                item.category,
                item.description,
                ...(item.tags ?? []),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(needle);
        });
    }, [sites, query, categoryFilter]);

    const clearFilters = () => {
        setQuery('');
        setCategoryFilter('all');
    };

    const openCreate = () => {
        setEditing(null);
        setErrors({});
        const nextSort = sites.reduce((max, item) => Math.max(max, item.sort_order), 0) + 1;
        setForm({ ...EMPTY_FORM, sort_order: String(nextSort) });
        setDialogOpen(true);
    };

    const openEdit = (item: AdminSyrianSite) => {
        setEditing(item);
        setErrors({});
        setForm({
            name: item.name,
            slug: item.slug,
            url: item.url,
            category: item.category ?? '',
            description: item.description ?? '',
            tags: (item.tags ?? []).join(', '),
            icon_url: item.icon_url ?? '',
            sort_order: String(item.sort_order),
            is_active: item.is_active,
        });
        setDialogOpen(true);
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const clientErrors: Record<string, string> = {};

        const trimmedName = form.name.trim();
        if (!trimmedName) {
            clientErrors.name = 'اسم الموقع مطلوب';
        }

        const trimmedUrl = form.url.trim();
        if (!trimmedUrl) {
            clientErrors.url = 'رابط الموقع مطلوب';
        } else if (!isHttpUrl(trimmedUrl)) {
            clientErrors.url = 'الرابط يجب أن يبدأ بـ http:// أو https://';
        }

        const trimmedSlug = form.slug.trim();
        if (trimmedSlug && !/^[a-z0-9-]+$/.test(trimmedSlug)) {
            clientErrors.slug = 'المعرّف يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط';
        }

        const trimmedIconUrl = form.icon_url.trim();
        if (trimmedIconUrl && !isHttpUrl(trimmedIconUrl)) {
            clientErrors.icon_url = 'رابط الأيقونة يجب أن يبدأ بـ http:// أو https://';
        }

        let sortOrder: number | undefined;
        if (form.sort_order.trim() !== '') {
            const parsed = Number(form.sort_order.trim());
            if (!Number.isInteger(parsed) || parsed < 0) {
                clientErrors.sort_order = 'الترتيب يجب أن يكون عدداً صحيحاً غير سالب';
            } else {
                sortOrder = parsed;
            }
        }

        const parsedTags = parseTags(form.tags);
        if (parsedTags.length > 30) {
            clientErrors.tags = 'الحد الأقصى للوسوم هو 30 وسماً';
        }

        if (Object.keys(clientErrors).length > 0) {
            setErrors(clientErrors);
            return;
        }

        const payload: SyrianSitePayload = {
            name: trimmedName,
            url: trimmedUrl,
            category: form.category.trim() || null,
            description: form.description.trim() || null,
            tags: parsedTags,
            icon_url: trimmedIconUrl || null,
            is_active: form.is_active,
        };

        if (trimmedSlug) {
            payload.slug = trimmedSlug;
        }
        if (sortOrder !== undefined) {
            payload.sort_order = sortOrder;
        }

        setSaving(true);
        setErrors({});
        try {
            if (editing) {
                const { site } = await sitesAdminApi.update(editing.id, payload);
                setSites((prev) => sortSites(prev.map((s) => (s.id === site.id ? site : s))));
                notify.success('تم تحديث الموقع بنجاح');
            } else {
                const { site } = await sitesAdminApi.create(payload);
                setSites((prev) => sortSites([...prev, site]));
                notify.success('تمت إضافة الموقع بنجاح');
            }
            setDialogOpen(false);
        } catch (err) {
            const fieldErrors = apiFieldErrors(err, { arabicOnly: true });
            if (Object.keys(fieldErrors).length > 0) {
                setErrors(fieldErrors);
            }
            notify.error(apiErrorMessage(err, 'تعذّر حفظ بيانات الموقع'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item: AdminSyrianSite) => {
        const confirmed = await confirmDialog({
            title: `حذف الموقع «${item.name}»؟`,
            description: 'سيتم حذف هذا الموقع نهائياً من الدليل العام.',
            confirmText: 'حذف',
            cancelText: 'إلغاء',
            destructive: true,
        });
        if (!confirmed) return;

        setDeletingId(item.id);
        try {
            await sitesAdminApi.remove(item.id);
            setSites((prev) => prev.filter((s) => s.id !== item.id));
            notify.success('تم حذف الموقع');
        } catch (err) {
            notify.error(apiErrorMessage(err, 'تعذّر حذف الموقع'));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <AdminLayout
            title="إدارة المواقع السورية"
            subtitle="إضافة وتعديل وتصنيف المواقع والمنصات السورية في الدليل العام."
            activeSection="sites"
            publicHref="/sites"
            publicLabel="عرض الصفحة العامة"
            actions={(
                <Button type="button" onClick={openCreate}>
                    <Plus className="h-4 w-4 me-1.5" aria-hidden="true" />
                    إضافة موقع
                </Button>
            )}
        >
            <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex-1">
                        <DirectorySearch
                            value={query}
                            onChange={setQuery}
                            placeholder="ابحث بالاسم أو الرابط أو التصنيف أو الوسوم..."
                            ariaLabel="بحث في المواقع السورية"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-full sm:w-48" aria-label="تصفية حسب التصنيف">
                                <SelectValue placeholder="كل التصنيفات" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل التصنيفات</SelectItem>
                                {categories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                        {cat}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {isFiltered && (
                            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                                <RotateCcw className="h-3.5 w-3.5 me-1.5" aria-hidden="true" />
                                مسح التصفية
                            </Button>
                        )}
                    </div>
                </div>

                <DirectoryResultCount>
                    عرض {filteredSites.length} من أصل {sites.length} موقع
                </DirectoryResultCount>

                {filteredSites.length === 0 ? (
                    <DirectoryEmptyState
                        icon={Globe}
                        title={isFiltered ? 'لا توجد مواقع مطابقة للتصفية' : 'لا توجد مواقع مسجّلة بعد'}
                        description={
                            isFiltered
                                ? 'جرّب تعديل كلمات البحث أو اختيار تصنيف آخر.'
                                : 'ابدأ بإضافة أول موقع ليظهر في دليل المواقع السورية.'
                        }
                        directory={{ isFiltered, clear: clearFilters }}
                    />
                ) : (
                    <ResponsiveTable
                        items={filteredSites}
                        getKey={(item) => item.id}
                        mobileLabel="قائمة المواقع السورية"
                        desktopHeader={(
                            <TableRow>
                                <TableHead>الموقع</TableHead>
                                <TableHead>التصنيف</TableHead>
                                <TableHead>الوسوم</TableHead>
                                <TableHead>الحالة</TableHead>
                                <TableHead>الترتيب</TableHead>
                                <TableHead className="text-end">إجراءات</TableHead>
                            </TableRow>
                        )}
                        renderDesktopRow={(item) => {
                            const tags = item.tags ?? [];
                            return (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <div className="font-medium text-foreground">{item.name}</div>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <a
                                                href={item.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                dir="ltr"
                                                className="inline-flex items-center gap-1 text-primary hover:underline truncate max-w-xs"
                                            >
                                                <span className="truncate">{item.url}</span>
                                                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                                            </a>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {item.category ? (
                                            <Badge variant="outline">{item.category}</Badge>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {tags.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {tags.slice(0, 3).map((tag) => (
                                                    <Badge key={tag} variant="secondary" className="font-normal">
                                                        {tag}
                                                    </Badge>
                                                ))}
                                                {tags.length > 3 && (
                                                    <Badge variant="outline">+{tags.length - 3}</Badge>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={item.is_active ? 'success' : 'outline'}>
                                            {item.is_active ? 'مفعّل' : 'مخفي'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                                        {item.sort_order}
                                    </TableCell>
                                    <TableCell className="text-end">
                                        <div className="inline-flex items-center justify-end gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openEdit(item)}
                                                aria-label={`تعديل ${item.name}`}
                                                title="تعديل"
                                            >
                                                <Edit className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                disabled={deletingId === item.id}
                                                onClick={() => handleDelete(item)}
                                                aria-label={`حذف ${item.name}`}
                                                title="حذف"
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        }}
                        renderMobileItem={(item) => (
                            <>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="font-medium text-foreground truncate">{item.name}</div>
                                        <a
                                            href={item.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            dir="ltr"
                                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline max-w-full truncate"
                                        >
                                            <span className="truncate">{item.url}</span>
                                            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                                        </a>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEdit(item)}
                                            aria-label={`تعديل ${item.name}`}
                                            title="تعديل"
                                        >
                                            <Edit className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            disabled={deletingId === item.id}
                                            onClick={() => handleDelete(item)}
                                            aria-label={`حذف ${item.name}`}
                                            title="حذف"
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {item.category && <Badge variant="outline">{item.category}</Badge>}
                                    <Badge variant={item.is_active ? 'success' : 'outline'}>
                                        {item.is_active ? 'مفعّل' : 'مخفي'}
                                    </Badge>
                                </div>
                            </>
                        )}
                    />
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'تعديل موقع' : 'إضافة موقع جديد'}</DialogTitle>
                        <DialogDescription>
                            أدخل بيانات الموقع ورابطه وتصنيفه ليظهر في دليل المواقع السورية.
                        </DialogDescription>
                    </DialogHeader>

                    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="site-name">اسم الموقع *</Label>
                                <Input
                                    id="site-name"
                                    value={form.name}
                                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                    placeholder="مثال: البوابة الإلكترونية السورية"
                                    {...fieldA11y('site-name-error', errors.name)}
                                />
                                <FieldError id="site-name-error" message={errors.name} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="site-slug">المعرّف (Slug)</Label>
                                <Input
                                    id="site-slug"
                                    dir="ltr"
                                    value={form.slug}
                                    onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                                    placeholder="syrian-portal"
                                    {...fieldA11y('site-slug-error', errors.slug)}
                                />
                                <FieldError id="site-slug-error" message={errors.slug} />
                            </div>

                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="site-url">رابط الموقع *</Label>
                                <Input
                                    id="site-url"
                                    dir="ltr"
                                    type="url"
                                    value={form.url}
                                    onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                                    placeholder="https://example.sy"
                                    {...fieldA11y('site-url-error', errors.url)}
                                />
                                <FieldError id="site-url-error" message={errors.url} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="site-category">التصنيف</Label>
                                <Input
                                    id="site-category"
                                    value={form.category}
                                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                                    placeholder="مثال: خدمات حكومية، إعلام، تعليم"
                                    {...fieldA11y('site-category-error', errors.category)}
                                />
                                <FieldError id="site-category-error" message={errors.category} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="site-tags">الوسوم (مفصولة بفاصلة)</Label>
                                <Input
                                    id="site-tags"
                                    value={form.tags}
                                    onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                                    placeholder="رسمي، خدمات، وثائق"
                                    {...fieldA11y('site-tags-error', errors.tags)}
                                />
                                <FieldError id="site-tags-error" message={errors.tags} />
                            </div>

                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="site-icon-url">رابط الأيقونة</Label>
                                <Input
                                    id="site-icon-url"
                                    dir="ltr"
                                    type="url"
                                    value={form.icon_url}
                                    onChange={(e) => setForm((prev) => ({ ...prev, icon_url: e.target.value }))}
                                    placeholder="https://example.sy/favicon.ico"
                                    {...fieldA11y('site-icon-url-error', errors.icon_url)}
                                />
                                <FieldError id="site-icon-url-error" message={errors.icon_url} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="site-sort-order">الترتيب</Label>
                                <Input
                                    id="site-sort-order"
                                    dir="ltr"
                                    type="number"
                                    min={0}
                                    value={form.sort_order}
                                    onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                                    {...fieldA11y('site-sort-order-error', errors.sort_order)}
                                />
                                <FieldError id="site-sort-order-error" message={errors.sort_order} />
                            </div>

                            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                                <Label htmlFor="site-active" className="cursor-pointer">
                                    مفعّل في الدليل العام
                                </Label>
                                <Switch
                                    id="site-active"
                                    checked={form.is_active}
                                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
                                />
                            </div>

                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="site-description">الوصف</Label>
                                <Textarea
                                    id="site-description"
                                    rows={3}
                                    value={form.description}
                                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                                    placeholder="وصف مختصر لما يقدمه الموقع..."
                                    {...fieldA11y('site-description-error', errors.description)}
                                />
                                <FieldError id="site-description-error" message={errors.description} />
                            </div>
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
                                {saving ? 'جارٍ الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة الموقع'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
