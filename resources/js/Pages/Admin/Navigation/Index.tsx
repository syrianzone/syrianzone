import React, { useMemo, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Badge } from '@/Components/ui/badge';
import { Switch } from '@/Components/ui/switch';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import {
    ArrowDown,
    ArrowRight,
    ArrowUp,
    Edit,
    Eye,
    EyeOff,
    Globe,
    LayoutGrid,
    Plus,
    RotateCcw,
    Save,
    Smartphone,
    Trash2,
} from 'lucide-react';
import {
    SITE_ICON_MAP,
    SITE_ICON_OPTIONS,
    SiteNavigationConfig,
    SiteNavigationItemData,
    SiteNavigationSubCategory,
} from '@/Lib/siteLinks';
import { confirmDialog } from '@/Lib/confirm';
import { notify } from '@/Lib/notify';

interface Props {
    navigation: SiteNavigationConfig;
    defaults: SiteNavigationConfig;
}

const EMPTY_ITEM: SiteNavigationItemData = {
    id: '',
    title: '',
    subtitle: '',
    href: '/',
    text: '',
    type: 'web',
    target: '/',
    iconKey: 'globe',
    iconUrl: null,
    image: null,
    isFlag: false,
    external: false,
    isInternal: true,
    enabled: true,
    showOnHome: true,
    showInNavbar: true,
    surfaces: ['home', 'navbar', 'mobile_menu', 'mobile_home'],
    subCategories: [],
    isCustom: true,
};

function renderItemIcon(item: SiteNavigationItemData) {
    const iconUrl = item.iconUrl || item.image;
    if (item.isFlag) {
        return (
            <img
                src="/flag-replacer/1f1f8-1f1fe.svg"
                alt=""
                className="h-8 w-8 shrink-0 object-contain"
            />
        );
    }
    if (iconUrl) {
        return (
            <img
                src={iconUrl}
                alt=""
                className="h-8 w-8 shrink-0 object-contain"
            />
        );
    }
    const IconComp = item.iconKey && SITE_ICON_MAP[item.iconKey] ? SITE_ICON_MAP[item.iconKey] : null;
    if (IconComp) {
        return <IconComp className="h-8 w-8 shrink-0 text-primary" />;
    }
    return <Globe className="h-7 w-7 shrink-0 text-muted-foreground" />;
}

export default function SiteNavigationAdminIndex({ navigation }: Props) {
    const [config, setConfig] = useState<SiteNavigationConfig>(() => ({
        navbarTopCount: navigation.navbarTopCount ?? 5,
        useSeparateNavbarOrder: Boolean(navigation.useSeparateNavbarOrder),
        navbarOrder: Array.isArray(navigation.navbarOrder)
            ? [...navigation.navbarOrder]
            : navigation.items.map((i) => i.id),
        items: navigation.items.map((item) => ({
            ...item,
            title: item.title || item.text,
            text: item.title || item.text,
            subtitle: item.subtitle || '',
            type: item.type || (item.external ? 'external' : 'web'),
            target: item.target || item.href,
            iconUrl: item.iconUrl ?? item.image ?? null,
            image: item.iconUrl ?? item.image ?? null,
            enabled: item.enabled !== false,
            subCategories: Array.isArray(item.subCategories) ? item.subCategories : [],
        })),
        version: navigation.version ?? 1,
    }));

    const [saving, setSaving] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [draftItem, setDraftItem] = useState<SiteNavigationItemData>(EMPTY_ITEM);

    const stats = useMemo(() => {
        const total = config.items.length;
        const enabledCount = config.items.filter((i) => i.enabled !== false).length;
        const homeCount = config.items.filter((i) => i.enabled !== false && i.showOnHome !== false).length;
        const navCount = config.items.filter((i) => i.enabled !== false && i.showInNavbar !== false).length;
        return { total, enabledCount, homeCount, navCount };
    }, [config.items]);

    const moveItem = (index: number, direction: -1 | 1) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= config.items.length) return;
        setConfig((prev) => {
            const nextItems = [...prev.items];
            const [moved] = nextItems.splice(index, 1);
            nextItems.splice(targetIndex, 0, moved);
            return {
                ...prev,
                items: nextItems,
                navbarOrder: prev.useSeparateNavbarOrder
                    ? prev.navbarOrder
                    : nextItems.map((i) => i.id),
            };
        });
    };

    const updateItemField = <K extends keyof SiteNavigationItemData>(
        index: number,
        key: K,
        value: SiteNavigationItemData[K],
    ) => {
        setConfig((prev) => {
            const nextItems = prev.items.map((item, idx) => {
                if (idx !== index) return item;
                const updated = { ...item, [key]: value };
                if (key === 'enabled' && value === false) {
                    updated.showOnHome = false;
                    updated.showInNavbar = false;
                } else if (key === 'enabled' && value === true) {
                    updated.showOnHome = true;
                    updated.showInNavbar = true;
                }
                return updated;
            });
            return { ...prev, items: nextItems };
        });
    };

    const openCreateModal = () => {
        setEditingIndex(null);
        setDraftItem({
            ...EMPTY_ITEM,
            id: `custom_${Date.now()}`,
        });
        setIsDialogOpen(true);
    };

    const openEditModal = (index: number) => {
        const item = config.items[index];
        setEditingIndex(index);
        setDraftItem({
            ...item,
            title: item.title || item.text,
            text: item.title || item.text,
            subtitle: item.subtitle || '',
            type: item.type || (item.external ? 'external' : 'web'),
            target: item.target || item.href,
            iconUrl: item.iconUrl ?? item.image ?? null,
            image: item.iconUrl ?? item.image ?? null,
            enabled: item.enabled !== false,
            subCategories: Array.isArray(item.subCategories)
                ? item.subCategories.map((s) => ({ ...s }))
                : [],
        });
        setIsDialogOpen(true);
    };

    const handleSaveModalItem = () => {
        const title = (draftItem.title || draftItem.text || '').trim();
        const href = (draftItem.href || '').trim();
        const id = (draftItem.id || href).trim();

        if (!title) {
            notify.error('يرجى إدخال اسم القسم أو الأيقونة');
            return;
        }
        if (!href.startsWith('/') && !href.startsWith('https://') && !href.startsWith('http://')) {
            notify.error('يجب أن يبدأ الرابط بـ / للروابط الداخلية أو https:// للروابط الخارجية');
            return;
        }

        const isExternal = href.startsWith('http://') || href.startsWith('http://') || draftItem.external;
        const normalized: SiteNavigationItemData = {
            ...draftItem,
            id,
            title,
            text: title,
            subtitle: (draftItem.subtitle || '').trim(),
            href,
            type: draftItem.type || (isExternal ? 'external' : 'web'),
            target: (draftItem.target || href).trim(),
            iconUrl: draftItem.iconUrl ? draftItem.iconUrl.trim() : null,
            image: draftItem.iconUrl ? draftItem.iconUrl.trim() : null,
            external: Boolean(draftItem.external || href.startsWith('http')),
            enabled: draftItem.enabled !== false,
            subCategories: (draftItem.subCategories || []).filter((s) => s.title.trim() !== ''),
        };

        setConfig((prev) => {
            const nextItems = [...prev.items];
            if (editingIndex !== null) {
                nextItems[editingIndex] = normalized;
            } else {
                nextItems.push(normalized);
            }
            const nextOrder = prev.navbarOrder.includes(normalized.id)
                ? prev.navbarOrder
                : [...prev.navbarOrder, normalized.id];
            return {
                ...prev,
                items: nextItems,
                navbarOrder: nextOrder,
            };
        });

        setIsDialogOpen(false);
    };

    const handleDeleteCustomItem = async (index: number) => {
        const item = config.items[index];
        const confirmed = await confirmDialog({
            title: 'حذف العنصر',
            description: `هل أنت متأكد من حذف «${item.title || item.text}» من القائمة؟`,
            confirmText: 'حذف',
            cancelText: 'إلغاء',
            variant: 'destructive',
        });
        if (!confirmed) return;

        setConfig((prev) => {
            const nextItems = prev.items.filter((_, idx) => idx !== index);
            return {
                ...prev,
                items: nextItems,
                navbarOrder: prev.navbarOrder.filter((id) => id !== item.id),
            };
        });
    };

    const handleSaveAll = () => {
        setSaving(true);
        router.put(
            '/api/v1/admin/navigation',
            {
                navbarTopCount: config.navbarTopCount,
                useSeparateNavbarOrder: config.useSeparateNavbarOrder,
                navbarOrder: config.navbarOrder,
                items: config.items as unknown as Record<string, any>[],
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    notify.success('تم حفظ إعدادات وترتيب الأيقونات والقوائم بنجاح');
                },
                onError: () => {
                    notify.error('تعذر حفظ التغييرات، يرجى التحقق من المدخلات');
                },
                onFinish: () => setSaving(false),
            },
        );
    };

    const handleResetDefaults = async () => {
        const confirmed = await confirmDialog({
            title: 'استعادة الإعدادات الافتراضية',
            description:
                'سيتم إرجاع جميع الأيقونات والأقسام والترتيب إلى الوضع الافتراضي للمنصة. هل تود المتابعة؟',
            confirmText: 'استعادة الافتراضي',
            cancelText: 'إلغاء',
            variant: 'destructive',
        });
        if (!confirmed) return;

        setSaving(true);
        router.put(
            '/api/v1/admin/navigation',
            { reset: true },
            {
                preserveScroll: false,
                onSuccess: () => {
                    notify.success('تمت استعادة الإعدادات الافتراضية بنجاح');
                },
                onFinish: () => setSaving(false),
            },
        );
    };

    const addSubCategory = () => {
        const nextSub: SiteNavigationSubCategory = {
            id: `${draftItem.id || 'item'}_sub_${(draftItem.subCategories || []).length + 1}`,
            title: '',
            subtitle: '',
            href: draftItem.href || '/',
            type: 'native',
            target: '',
            iconKey: draftItem.iconKey,
            iconUrl: null,
        };
        setDraftItem((prev) => ({
            ...prev,
            subCategories: [...(prev.subCategories || []), nextSub],
        }));
    };

    const updateSubCategory = (
        subIdx: number,
        key: keyof SiteNavigationSubCategory,
        value: string | null,
    ) => {
        setDraftItem((prev) => {
            const list = [...(prev.subCategories || [])];
            list[subIdx] = { ...list[subIdx], [key]: value };
            return { ...prev, subCategories: list };
        });
    };

    const removeSubCategory = (subIdx: number) => {
        setDraftItem((prev) => ({
            ...prev,
            subCategories: (prev.subCategories || []).filter((_, i) => i !== subIdx),
        }));
    };

    return (
        <MainLayout>
            <h1 className="sr-only">إدارة أيقونات وأقسام المنصة</h1>
            <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6" dir="rtl">
                {/* Header & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Link href="/dashboard" className="hover:text-foreground inline-flex items-center gap-1">
                                <ArrowRight className="w-3.5 h-3.5" />
                                لوحة التحكم
                            </Link>
                            <span>/</span>
                            <span>إدارة الأيقونات والقوائم</span>
                        </div>
                        <h2 className="text-2xl font-extrabold flex items-center gap-2.5">
                            <LayoutGrid className="w-6 h-6 text-primary" />
                            إدارة أيقونات وأقسام المنصة (Single Source of Truth)
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            تحكم بترتيب وإظهار أو إخفاء الأقسام في الصفحة الرئيسية، الشريط العلوي، قائمة الجوال، وتطبيق Flutter عبر <code dir="ltr" className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/v1/navigation</code>.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={openCreateModal}
                            className="gap-1.5 font-bold"
                        >
                            <Plus className="w-4 h-4" />
                            إضافة عنصر جديد
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleResetDefaults}
                            disabled={saving}
                            className="gap-1.5 text-destructive hover:text-destructive"
                        >
                            <RotateCcw className="w-4 h-4" />
                            الافتراضي
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveAll}
                            disabled={saving}
                            className="gap-1.5 font-bold"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
                        </Button>
                    </div>
                </div>

                {/* Summary & Navbar Settings */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-muted-foreground">
                                إحصائيات العرض الحالية
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center justify-between text-sm">
                            <div>
                                <span className="text-2xl font-extrabold text-foreground">{stats.enabledCount}</span>
                                <span className="text-muted-foreground ms-1">/ {stats.total} مفعّل</span>
                            </div>
                            <div className="flex gap-2 text-xs">
                                <Badge variant="secondary">الرئيسية: {stats.homeCount}</Badge>
                                <Badge variant="secondary">العلوي: {stats.navCount}</Badge>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-muted-foreground">
                                إعدادات الشريط العلوي (Navbar)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Label htmlFor="navbarTopCount" className="text-sm font-semibold whitespace-nowrap">
                                    عدد الروابط البارزة قبل قائمة «المزيد»:
                                </Label>
                                <Input
                                    id="navbarTopCount"
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={config.navbarTopCount}
                                    onChange={(e) =>
                                        setConfig((prev) => ({
                                            ...prev,
                                            navbarTopCount: Math.max(1, Math.min(10, Number(e.target.value) || 5)),
                                        }))
                                    }
                                    className="w-20 text-center font-bold"
                                />
                            </div>
                            <div className="text-xs text-muted-foreground">
                                أول <strong>{config.navbarTopCount}</strong> عناصر مفعّلة في الشريط العلوي تظهر مباشرة، والبقية ضمن قائمة «المزيد».
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Items List */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-bold">
                            قائمة الأقسام والأيقونات ({config.items.length})
                        </CardTitle>
                        <CardDescription>
                            استخدم الأسهم لتغيير الترتيب، أو أزرار التبديل لإخفاء/إظهار أي أداة فوراً من الرئيسية أو الشريط العلوي أو تطبيق الجوال.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2.5">
                        {config.items.map((item, idx) => {
                            const isEnabled = item.enabled !== false;
                            const isTopNavbar =
                                isEnabled &&
                                item.showInNavbar !== false &&
                                config.items
                                    .filter((i) => i.enabled !== false && i.showInNavbar !== false)
                                    .findIndex((i) => i.id === item.id) < config.navbarTopCount;

                            return (
                                <div
                                    key={item.id || item.href}
                                    className={`flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors ${
                                        isEnabled
                                            ? 'bg-card border-border/80'
                                            : 'bg-muted/30 border-border/40 opacity-65'
                                    }`}
                                >
                                    {/* Left: Order arrows + Icon + Info */}
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex flex-col gap-1 shrink-0">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                disabled={idx === 0}
                                                onClick={() => moveItem(idx, -1)}
                                                aria-label="تحريك لأعلى"
                                            >
                                                <ArrowUp className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                disabled={idx === config.items.length - 1}
                                                onClick={() => moveItem(idx, 1)}
                                                aria-label="تحريك لأسفل"
                                            >
                                                <ArrowDown className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>

                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
                                            {renderItemIcon(item)}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-bold text-sm sm:text-base text-foreground">
                                                    {item.title || item.text}
                                                </span>
                                                <Badge variant="outline" className="font-mono text-[10px]" dir="ltr">
                                                    id: {item.id}
                                                </Badge>
                                                <Badge
                                                    variant={item.type === 'native' ? 'default' : 'secondary'}
                                                    className="text-[10px]"
                                                >
                                                    {item.type === 'native'
                                                        ? 'Native / شاشة أصلية'
                                                        : item.type === 'external'
                                                        ? 'رابط خارجي'
                                                        : 'Web'}
                                                </Badge>
                                                {!item.isInternal && (
                                                    <Badge variant="outline" className="text-[10px]">
                                                        قسم خارجي
                                                    </Badge>
                                                )}
                                                {isTopNavbar && (
                                                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                                                        مثبّت في الشريط العلوي
                                                    </Badge>
                                                )}
                                                {item.subCategories && item.subCategories.length > 0 && (
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {item.subCategories.length} أقسام فرعية
                                                    </Badge>
                                                )}
                                            </div>
                                            {item.subtitle && (
                                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                    {item.subtitle}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-muted-foreground font-mono" dir="ltr">
                                                <span>href: {item.href}</span>
                                                {item.target && item.target !== item.href && (
                                                    <span>target: {item.target}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Visibility Switches & Edit/Delete */}
                                    <div className="flex flex-wrap items-center justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/50 shrink-0">
                                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
                                            <Switch
                                                checked={isEnabled}
                                                onCheckedChange={(v) => updateItemField(idx, 'enabled', v)}
                                            />
                                            <span className="inline-flex items-center gap-1">
                                                {isEnabled ? (
                                                    <Eye className="w-3.5 h-3.5 text-emerald-500" />
                                                ) : (
                                                    <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                                                )}
                                                مفعّل
                                            </span>
                                        </label>

                                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
                                            <Switch
                                                checked={isEnabled && item.showOnHome !== false}
                                                disabled={!isEnabled}
                                                onCheckedChange={(v) => updateItemField(idx, 'showOnHome', v)}
                                            />
                                            <span>الرئيسية</span>
                                        </label>

                                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
                                            <Switch
                                                checked={isEnabled && item.showInNavbar !== false}
                                                disabled={!isEnabled}
                                                onCheckedChange={(v) => updateItemField(idx, 'showInNavbar', v)}
                                            />
                                            <span>النافبار</span>
                                        </label>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openEditModal(idx)}
                                            className="h-8 gap-1 text-xs"
                                        >
                                            <Edit className="w-3.5 h-3.5" />
                                            تعديل
                                        </Button>

                                        {item.isCustom && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteCustomItem(idx)}
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                aria-label="حذف العنصر"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                {/* Edit / Create Modal */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                {editingIndex !== null ? 'تعديل بيانات القسم / الأيقونة' : 'إضافة قسم أو أيقونة جديدة'}
                            </DialogTitle>
                            <DialogDescription>
                                هذه البيانات تُستخدم في الموقع وفي تطبيق الجوال عبر واجهة <code dir="ltr">/api/v1/navigation</code>.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="item-id">المعرّف الفريد (id)</Label>
                                    <Input
                                        id="item-id"
                                        dir="ltr"
                                        value={draftItem.id}
                                        disabled={editingIndex !== null && !draftItem.isCustom}
                                        onChange={(e) => setDraftItem((d) => ({ ...d, id: e.target.value }))}
                                        placeholder="transit"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="item-title">الاسم الظاهر (title)</Label>
                                    <Input
                                        id="item-title"
                                        value={draftItem.title || draftItem.text}
                                        onChange={(e) =>
                                            setDraftItem((d) => ({
                                                ...d,
                                                title: e.target.value,
                                                text: e.target.value,
                                            }))
                                        }
                                        placeholder="ترانزيت"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="item-subtitle">الوصف المختصر (subtitle)</Label>
                                <Input
                                    id="item-subtitle"
                                    value={draftItem.subtitle || ''}
                                    onChange={(e) => setDraftItem((d) => ({ ...d, subtitle: e.target.value }))}
                                    placeholder="شبكة وخطوط النقل العام"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="item-href">رابط الويب (href)</Label>
                                    <Input
                                        id="item-href"
                                        dir="ltr"
                                        value={draftItem.href}
                                        onChange={(e) => setDraftItem((d) => ({ ...d, href: e.target.value }))}
                                        placeholder="/transit"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="item-type">نوع الوجهة (type)</Label>
                                    <select
                                        id="item-type"
                                        value={draftItem.type || 'web'}
                                        onChange={(e) =>
                                            setDraftItem((d) => ({
                                                ...d,
                                                type: e.target.value as 'native' | 'web' | 'external',
                                            }))
                                        }
                                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-2xs"
                                    >
                                        <option value="native">native (شاشة أصلية بالتطبيق)</option>
                                        <option value="web">web (صفحة ويب داخلية)</option>
                                        <option value="external">external (رابط خارجي)</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="item-target">هدف التطبيق (target)</Label>
                                    <Input
                                        id="item-target"
                                        dir="ltr"
                                        value={draftItem.target || ''}
                                        onChange={(e) => setDraftItem((d) => ({ ...d, target: e.target.value }))}
                                        placeholder="transit_map"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="item-iconKey">الأيقونة المدمجة (iconKey)</Label>
                                    <select
                                        id="item-iconKey"
                                        value={draftItem.iconKey || ''}
                                        onChange={(e) =>
                                            setDraftItem((d) => ({
                                                ...d,
                                                iconKey: e.target.value || null,
                                            }))
                                        }
                                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-2xs"
                                    >
                                        <option value="">بدون (استخدام رابط صورة خارجي)</option>
                                        {SITE_ICON_OPTIONS.map((opt) => (
                                            <option key={opt.key} value={opt.key}>
                                                {opt.label} ({opt.key})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="item-iconUrl">رابط أيقونة مخصص (iconUrl)</Label>
                                    <Input
                                        id="item-iconUrl"
                                        dir="ltr"
                                        value={draftItem.iconUrl || ''}
                                        onChange={(e) =>
                                            setDraftItem((d) => ({
                                                ...d,
                                                iconUrl: e.target.value || null,
                                                image: e.target.value || null,
                                            }))
                                        }
                                        placeholder="https://... أو /assets/..."
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                                <label className="flex items-center justify-between rounded-lg border p-3 text-xs font-semibold cursor-pointer">
                                    <span>قسم داخلي بالمنصة</span>
                                    <Switch
                                        checked={draftItem.isInternal}
                                        onCheckedChange={(v) => setDraftItem((d) => ({ ...d, isInternal: v }))}
                                    />
                                </label>
                                <label className="flex items-center justify-between rounded-lg border p-3 text-xs font-semibold cursor-pointer">
                                    <span>يظهر بالرئيسية</span>
                                    <Switch
                                        checked={draftItem.showOnHome}
                                        onCheckedChange={(v) => setDraftItem((d) => ({ ...d, showOnHome: v }))}
                                    />
                                </label>
                                <label className="flex items-center justify-between rounded-lg border p-3 text-xs font-semibold cursor-pointer">
                                    <span>يظهر بالنافبار</span>
                                    <Switch
                                        checked={draftItem.showInNavbar}
                                        onCheckedChange={(v) => setDraftItem((d) => ({ ...d, showInNavbar: v }))}
                                    />
                                </label>
                            </div>

                            {/* SubCategories Editor */}
                            <div className="space-y-2 border-t pt-4">
                                <div className="flex items-center justify-between">
                                    <Label className="flex items-center gap-1.5 font-bold">
                                        <Smartphone className="w-4 h-4 text-primary" />
                                        الأقسام الفرعية (subCategories)
                                    </Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addSubCategory}
                                        className="h-7 text-xs gap-1"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        إضافة فرع
                                    </Button>
                                </div>

                                {(draftItem.subCategories || []).length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        لا توجد أقسام فرعية مضافة لهذا العنصر.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {(draftItem.subCategories || []).map((sub, subIdx) => (
                                            <div
                                                key={subIdx}
                                                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-lg border bg-muted/20 p-2.5"
                                            >
                                                <Input
                                                    className="sm:col-span-3 h-8 text-xs"
                                                    placeholder="الاسم (مثال: مواقيت الصلاة)"
                                                    value={sub.title}
                                                    onChange={(e) =>
                                                        updateSubCategory(subIdx, 'title', e.target.value)
                                                    }
                                                />
                                                <Input
                                                    className="sm:col-span-3 h-8 text-xs"
                                                    placeholder="الوصف المختصر"
                                                    value={sub.subtitle || ''}
                                                    onChange={(e) =>
                                                        updateSubCategory(subIdx, 'subtitle', e.target.value)
                                                    }
                                                />
                                                <Input
                                                    dir="ltr"
                                                    className="sm:col-span-3 h-8 text-xs font-mono"
                                                    placeholder="/muslim/prayer"
                                                    value={sub.href}
                                                    onChange={(e) =>
                                                        updateSubCategory(subIdx, 'href', e.target.value)
                                                    }
                                                />
                                                <Input
                                                    dir="ltr"
                                                    className="sm:col-span-2 h-8 text-xs font-mono"
                                                    placeholder="target"
                                                    value={sub.target}
                                                    onChange={(e) =>
                                                        updateSubCategory(subIdx, 'target', e.target.value)
                                                    }
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeSubCategory(subIdx)}
                                                    className="sm:col-span-1 h-8 w-8 text-destructive"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <DialogFooter className="gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                إلغاء
                            </Button>
                            <Button type="button" onClick={handleSaveModalItem}>
                                تأكيد التغييرات
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </MainLayout>
    );
}
