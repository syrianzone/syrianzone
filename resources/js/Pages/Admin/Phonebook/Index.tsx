import React, { useState, useMemo } from 'react';
import { router } from '@inertiajs/react';
import {
    Plus, Edit, Trash2, Eye, EyeOff, Search, ArrowUp, ArrowDown, Settings, Check, X, Phone, MessageSquare, ExternalLink, ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Badge } from "@/Components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/Components/ui/dialog";
import CategoryDialog from '@/Components/directory/CategoryDialog';
import { Label } from "@/Components/ui/label";
import { Switch } from "@/Components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import MainLayout from '@/Layouts/MainLayout';
import { useCan } from '@/Lib/useCan';
import { notify } from '@/Lib/notify';
import { confirmDialog } from '@/Lib/confirm';
import type { PhonebookCategory, PhonebookEntry } from '@/Domain/phonebook/types';

interface AdminPhonebookProps {
    categories: PhonebookCategory[];
    entries: PhonebookEntry[];
}

export default function PhonebookAdminIndex({ categories, entries }: AdminPhonebookProps) {
    const [searchTerm, setSearchTerm] = useState('');

    // Gated per capability, matching the route tags. The panel used to render
    // every control for any phonebook.* holder, so a phonebook.reorder-only
    // account was offered delete and toggle buttons it cannot use.
    const can = useCan();
    const canCreate = can('phonebook.create');
    const canEdit = can('phonebook.edit');
    const canToggle = can('phonebook.toggle');
    const canDelete = can('phonebook.delete');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // Dialog States
    const [categoryModalOpen, setCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<PhonebookCategory | null>(null);

    const [entryModalOpen, setEntryModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<PhonebookEntry | null>(null);
    const [entryForm, setEntryForm] = useState({
        id: '',
        category_id: categories[0]?.id || 'emergency',
        name_ar: '',
        name_en: '',
        number: '',
        is_whatsapp: false,
        source_url: '',
        is_active: true,
    });

    const filteredEntries = useMemo(() => {
        return entries.filter(item => {
            const matchesCat = selectedCategory === 'all' || item.category_id === selectedCategory;
            const term = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm || (
                item.name_ar.toLowerCase().includes(term) ||
                (item.name_en && item.name_en.toLowerCase().includes(term)) ||
                item.number.includes(term)
            );
            return matchesCat && matchesSearch;
        });
    }, [entries, selectedCategory, searchTerm]);

    // Category Handlers
    const openCreateCategory = () => {
        setEditingCategory(null);
        setCategoryModalOpen(true);
    };

    const openEditCategory = (cat: PhonebookCategory) => {
        setEditingCategory(cat);
        setCategoryModalOpen(true);
    };

    const handleDeleteCategory = async (id: string) => {
        const ok = await confirmDialog({ title: 'حذف هذه الفئة بالكامل؟', destructive: true, confirmText: 'حذف' });
        if (!ok) return;
        router.delete(`/api/v1/admin/phonebook/categories/${id}`, {
            preserveScroll: true,
            onSuccess: () => {
                notify.success('تم حذف الفئة');
                setCategoryModalOpen(false);
            },
            onError: () => notify.error('تعذر حذف الفئة'),
        });
    };

    // Entry Handlers
    const openCreateEntry = () => {
        setEditingEntry(null);
        setEntryForm({
            id: '',
            category_id: categories[0]?.id || 'emergency',
            name_ar: '',
            name_en: '',
            number: '',
            is_whatsapp: false,
            source_url: '',
            is_active: true,
        });
        setEntryModalOpen(true);
    };

    const openEditEntry = (entry: PhonebookEntry) => {
        setEditingEntry(entry);
        setEntryForm({
            id: entry.id,
            category_id: entry.category_id ?? categories[0]?.id ?? 'emergency',
            name_ar: entry.name_ar,
            name_en: entry.name_en || '',
            number: entry.number,
            is_whatsapp: entry.is_whatsapp,
            source_url: entry.source_url || '',
            is_active: entry.is_active ?? true,
        });
        setEntryModalOpen(true);
    };

    const handleSaveEntry = (e: React.FormEvent) => {
        e.preventDefault();
        const options = {
            onSuccess: () => setEntryModalOpen(false),
            onError: (errors: Record<string, string>) =>
                notify.error(Object.values(errors)[0] ?? 'تعذر حفظ البيانات'),
        };
        if (editingEntry) {
            router.post(`/api/v1/admin/phonebook/entries/${editingEntry.id}`, entryForm, options);
        } else {
            router.post('/api/v1/admin/phonebook/entries', entryForm, options);
        }
    };

    const handleToggleActive = (id: string) => {
        router.post(`/api/v1/admin/phonebook/entries/${id}/toggle`, {}, {
            onError: () => notify.error('تعذر تغيير حالة الرقم'),
        });
    };

    const handleDeleteEntry = async (id: string) => {
        const ok = await confirmDialog({ title: 'حذف هذا الرقم؟', destructive: true, confirmText: 'حذف' });
        if (!ok) return;
        router.delete(`/api/v1/admin/phonebook/entries/${id}`, {
            preserveScroll: true,
            onSuccess: () => notify.success('تم حذف الرقم'),
            onError: () => notify.error('تعذر حذف الرقم'),
        });
    };

    return (
        <MainLayout>
            

            <div className="min-h-screen bg-background py-8" dir="rtl">
                <div className="container mx-auto px-4 max-w-7xl space-y-6">

                    {/* Top Breadcrumb & Controls */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-2xl border border-border shadow-xs">
                        <div className="flex items-center gap-3">
                            <Button variant="outline" size="icon" asChild className="rounded-xl">
                                <a href="/phonebook" aria-label="العودة إلى دليل الهاتف">
                                    <ArrowRight className="h-4 w-4" />
                                </a>
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">لوحة إدارة دليل الهاتف والواتساب</h1>
                                <p className="text-sm text-muted-foreground">إضافة، تعديل، ترتيب، وإخفاء أرقام الطوارئ والجهات الرسمية.</p>
                            </div>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            {canCreate && (
                                <>
                                    <Button onClick={openCreateCategory} variant="outline" className="gap-2 rounded-xl">
                                        <Plus className="h-4 w-4" />
                                        <span>إضافة فئة جديدة</span>
                                    </Button>
                                    <Button onClick={openCreateEntry} className="gap-2 rounded-xl">
                                        <Plus className="h-4 w-4" />
                                        <span>إضافة رقم جديد</span>
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Category Selector Cards */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        <Button
                            variant={selectedCategory === 'all' ? 'default' : 'outline'}
                            onClick={() => setSelectedCategory('all')}
                            className="rounded-full text-xs font-semibold shrink-0"
                        >
                            الكل ({entries.length})
                        </Button>
                        {categories.map(cat => {
                            const count = entries.filter(e => e.category_id === cat.id).length;
                            return (
                                <div key={cat.id} className="flex items-center gap-1 shrink-0">
                                    <Button
                                        variant={selectedCategory === cat.id ? 'default' : 'outline'}
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className="rounded-full text-xs font-semibold gap-1.5"
                                    >
                                        <span>{cat.label_ar}</span>
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                            {count}
                                        </Badge>
                                    </Button>
                                    {canEdit && (
                                        <Button aria-label="تعديل الفئة"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEditCategory(cat)}
                                            className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                            title="تعديل الفئة"
                                        >
                                            <Edit className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card p-4 rounded-xl border border-border">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input aria-label="ابحث بالاسم أو الرقم..."
                                placeholder="ابحث بالاسم أو الرقم..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="ps-9 h-10 text-sm"
                            />
                        </div>
                        <div className="text-xs text-muted-foreground">
                            عرض <span className="font-bold text-foreground">{filteredEntries.length}</span> من أصل {entries.length} رقم
                        </div>
                    </div>

                    {/* Entries Table */}
                    <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="text-start font-bold">الحالة</TableHead>
                                    <TableHead className="text-start font-bold">اسم الجهة / الرقم</TableHead>
                                    <TableHead className="text-start font-bold">الرقم</TableHead>
                                    <TableHead className="text-start font-bold">الفئة</TableHead>
                                    <TableHead className="text-start font-bold">الخدمات</TableHead>
                                    <TableHead className="text-end font-bold">الإجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEntries.map((item) => (
                                    <TableRow key={item.id} className={`hover:bg-muted/40 transition-colors ${!item.is_active ? 'opacity-60 bg-muted/20' : ''}`}>
                                        <TableCell>
                                            <Button aria-label={
                                                    !canToggle
                                                        ? 'يحتاج صلاحية phonebook.toggle'
                                                        : item.is_active
                                                          ? 'انقر لإخفاء الرقم من الواجهة'
                                                          : 'انقر لإظهار الرقم في الواجهة'
                                                }
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleToggleActive(item.id)}
                                                className="gap-1.5 text-xs h-8 px-2"
                                                disabled={!canToggle}
                                                title={
                                                    !canToggle
                                                        ? 'يحتاج صلاحية phonebook.toggle'
                                                        : item.is_active
                                                          ? 'انقر لإخفاء الرقم من الواجهة'
                                                          : 'انقر لإظهار الرقم في الواجهة'
                                                }
                                            >
                                                {item.is_active ? (
                                                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 font-semibold">
                                                        <Eye className="h-3 w-3" />
                                                        <span>ظاهر</span>
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="gap-1 text-muted-foreground font-semibold">
                                                        <EyeOff className="h-3 w-3" />
                                                        <span>مخفي</span>
                                                    </Badge>
                                                )}
                                            </Button>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <div>
                                                <span className="font-bold text-foreground text-sm block">{item.name_ar}</span>
                                                {item.name_en && (
                                                    <span className="text-xs text-muted-foreground block">{item.name_en}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono font-extrabold text-sm text-foreground">
                                            {item.number}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs font-normal">
                                                {categories.find(c => c.id === item.category_id)?.label_ar || item.category_id}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1.5 items-center">
                                                {item.is_whatsapp && (
                                                    <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 text-[10px]">
                                                        واتساب
                                                    </Badge>
                                                )}
                                                {item.source_url && (
                                                    <a href={item.source_url} target="_blank" rel="noopener noreferrer" aria-label={`المصدر: ${item.name_ar}`} title="رابط المصدر" className="text-muted-foreground hover:text-primary">
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </a>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-end">
                                            <div className="flex items-center justify-end gap-1">
                                                {canEdit && (
                                                    <Button aria-label="تعديل"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openEditEntry(item)}
                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                        title="تعديل"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {canDelete && (
                                                    <Button aria-label="حذف"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDeleteEntry(item.id)}
                                                        className="h-8 w-8 text-destructive hover:text-destructive/80"
                                                        title="حذف"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Entry Create/Edit Modal */}
                    <Dialog open={entryModalOpen} onOpenChange={setEntryModalOpen}>
                        <DialogContent className="max-w-lg" dir="rtl">
                            <DialogHeader>
                                <DialogTitle>{editingEntry ? 'تعديل بيانات الرقم' : 'إضافة رقم هاتف جديد'}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSaveEntry} className="space-y-4 py-2">
                                <div className="space-y-1">
                                    <Label>اسم الجهة / الهيئة (بالعربية)</Label>
                                    <Input aria-label="الاسم بالعربية"
                                        required
                                        value={entryForm.name_ar}
                                        onChange={(e) => setEntryForm({ ...entryForm, name_ar: e.target.value })}
                                        placeholder="مثال: الهلال الأحمر العربي السوري"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label>الاسم (بالإنكليزية - اختياري)</Label>
                                    <Input aria-label="الاسم بالإنجليزية"
                                        value={entryForm.name_en}
                                        onChange={(e) => setEntryForm({ ...entryForm, name_en: e.target.value })}
                                        placeholder="Example: Syrian Arab Red Crescent"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label>رقم الهاتف</Label>
                                        <Input aria-label="رقم الهاتف"
                                            required
                                            value={entryForm.number}
                                            onChange={(e) => setEntryForm({ ...entryForm, number: e.target.value })}
                                            placeholder="133 أو 011-2223334"
                                            className="font-mono"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <Label>الفئة</Label>
                                        <select
                                            aria-label="الفئة"
                                            value={entryForm.category_id}
                                            onChange={(e) => setEntryForm({ ...entryForm, category_id: e.target.value })}
                                            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                                        >
                                            {categories.map(c => (
                                                <option key={c.id} value={c.id}>{c.label_ar}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label>رابط المصدر الرسمي (اختياري)</Label>
                                    <Input aria-label="الموقع الإلكتروني"
                                        type="url"
                                        value={entryForm.source_url}
                                        onChange={(e) => setEntryForm({ ...entryForm, source_url: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>

                                <div className="flex justify-between items-center pt-2 border-t border-border">
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            checked={entryForm.is_whatsapp}
                                            onCheckedChange={(val) => setEntryForm({ ...entryForm, is_whatsapp: val })}
                                        />
                                        <Label className="cursor-pointer text-sm">يتوفر خط واتساب</Label>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Switch
                                            checked={entryForm.is_active}
                                            onCheckedChange={(val) => setEntryForm({ ...entryForm, is_active: val })}
                                        />
                                        <Label className="cursor-pointer text-sm">ظاهر في الواجهة</Label>
                                    </div>
                                </div>

                                <DialogFooter className="gap-2 pt-4">
                                    <Button type="button" variant="outline" onClick={() => setEntryModalOpen(false)}>
                                        إلغاء
                                    </Button>
                                    <Button type="submit">
                                        حفظ البيانات
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <CategoryDialog
                        open={categoryModalOpen}
                        onOpenChange={setCategoryModalOpen}
                        category={editingCategory}
                        endpoint="/api/v1/admin/phonebook/categories"
                        title={{ create: 'إضافة فئة جديدة', edit: 'تعديل بيانات الفئة' }}
                        submit={{ create: 'حفظ الفئة', edit: 'حفظ الفئة' }}
                        slug={{ label: 'معرف الفئة (Slug)', placeholder: 'emergency, governorates, hospitals...', maxLength: 64 }}
                        activeLabel="الفئة مفعّلة في الواجهة العامة"
                        onDelete={canDelete && editingCategory ? () => handleDeleteCategory(editingCategory.id) : undefined}
                    />

                </div>
            </div>
        </MainLayout>
    );
}
