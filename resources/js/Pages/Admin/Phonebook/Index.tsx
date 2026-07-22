import React, { useState, useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
import {
    Plus, Edit, Trash2, Eye, EyeOff, Search, ArrowUp, ArrowDown, Settings, Check, X, Phone, MessageSquare, ExternalLink, ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Badge } from "@/Components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/Components/ui/dialog";
import { Label } from "@/Components/ui/label";
import { Switch } from "@/Components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import MainLayout from '@/Layouts/MainLayout';

interface PhonebookCategory {
    id: string;
    label_ar: string;
    label_en: string;
    icon?: string;
    order_column: number;
    is_active: boolean;
}

interface PhonebookEntry {
    id: string;
    category_id: string;
    name_ar: string;
    name_en?: string;
    number: string;
    is_whatsapp: boolean;
    source_url?: string;
    order_column: number;
    is_active: boolean;
    category?: PhonebookCategory;
}

interface AdminPhonebookProps {
    categories: PhonebookCategory[];
    entries: PhonebookEntry[];
}

export default function PhonebookAdminIndex({ categories, entries }: AdminPhonebookProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // Dialog States
    const [categoryModalOpen, setCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<PhonebookCategory | null>(null);
    const [catForm, setCatForm] = useState({ id: '', label_ar: '', label_en: '', is_active: true });

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
        setCatForm({ id: '', label_ar: '', label_en: '', is_active: true });
        setCategoryModalOpen(true);
    };

    const openEditCategory = (cat: PhonebookCategory) => {
        setEditingCategory(cat);
        setCatForm({
            id: cat.id,
            label_ar: cat.label_ar,
            label_en: cat.label_en,
            is_active: cat.is_active,
        });
        setCategoryModalOpen(true);
    };

    const handleSaveCategory = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingCategory) {
            router.put(`/api/v1/admin/phonebook/categories/${editingCategory.id}`, catForm, {
                onSuccess: () => setCategoryModalOpen(false),
            });
        } else {
            router.post('/api/v1/admin/phonebook/categories', catForm, {
                onSuccess: () => setCategoryModalOpen(false),
            });
        }
    };

    const handleDeleteCategory = (id: string) => {
        if (confirm('هل أنت تأكد من حذف هذه الفئة بالكامل؟')) {
            router.delete(`/api/v1/admin/phonebook/categories/${id}`);
        }
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
            category_id: entry.category_id,
            name_ar: entry.name_ar,
            name_en: entry.name_en || '',
            number: entry.number,
            is_whatsapp: entry.is_whatsapp,
            source_url: entry.source_url || '',
            is_active: entry.is_active,
        });
        setEntryModalOpen(true);
    };

    const handleSaveEntry = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingEntry) {
            router.post(`/api/v1/admin/phonebook/entries/${editingEntry.id}`, entryForm, {
                onSuccess: () => setEntryModalOpen(false),
            });
        } else {
            router.post('/api/v1/admin/phonebook/entries', entryForm, {
                onSuccess: () => setEntryModalOpen(false),
            });
        }
    };

    const handleToggleActive = (id: string) => {
        router.post(`/api/v1/admin/phonebook/entries/${id}/toggle`);
    };

    const handleDeleteEntry = (id: string) => {
        if (confirm('هل أنت تأكد من حذف هذا الرقم؟')) {
            router.delete(`/api/v1/admin/phonebook/entries/${id}`);
        }
    };

    return (
        <MainLayout>
            <Head>
                <title>إدارة دليل الهاتف والواتساب الخدمي | Admin</title>
            </Head>

            <div className="min-h-screen bg-background py-8" dir="rtl">
                <div className="container mx-auto px-4 max-w-7xl space-y-6">

                    {/* Top Breadcrumb & Controls */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-2xl border border-border shadow-xs">
                        <div className="flex items-center gap-3">
                            <Button variant="outline" size="icon" asChild className="rounded-xl">
                                <a href="/phonebook">
                                    <ArrowRight className="h-4 w-4" />
                                </a>
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">لوحة إدارة دليل الهاتف والواتساب</h1>
                                <p className="text-sm text-muted-foreground">إضافة، تعديل، ترتيب، وإخفاء أرقام الطوارئ والجهات الرسمية.</p>
                            </div>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            <Button onClick={openCreateCategory} variant="outline" className="gap-2 rounded-xl">
                                <Plus className="h-4 w-4" />
                                <span>إضافة فئة جديدة</span>
                            </Button>
                            <Button onClick={openCreateEntry} className="gap-2 rounded-xl">
                                <Plus className="h-4 w-4" />
                                <span>إضافة رقم جديد</span>
                            </Button>
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
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => openEditCategory(cat)}
                                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                        title="تعديل الفئة"
                                    >
                                        <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card p-4 rounded-xl border border-border">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
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
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleToggleActive(item.id)}
                                                className="gap-1.5 text-xs h-8 px-2"
                                                title={item.is_active ? 'انقر لإخفاء الرقم من الواجهة' : 'انقر لإظهار الرقم في الواجهة'}
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
                                                    <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </a>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-end">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => openEditEntry(item)}
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                    title="تعديل"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteEntry(item.id)}
                                                    className="h-8 w-8 text-destructive hover:text-destructive/80"
                                                    title="حذف"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
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
                                    <Input
                                        required
                                        value={entryForm.name_ar}
                                        onChange={(e) => setEntryForm({ ...entryForm, name_ar: e.target.value })}
                                        placeholder="مثال: الهلال الأحمر العربي السوري"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label>الاسم (بالإنكليزية - اختياري)</Label>
                                    <Input
                                        value={entryForm.name_en}
                                        onChange={(e) => setEntryForm({ ...entryForm, name_en: e.target.value })}
                                        placeholder="Example: Syrian Arab Red Crescent"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label>رقم الهاتف</Label>
                                        <Input
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
                                    <Input
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

                    {/* Category Create/Edit Modal */}
                    <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
                        <DialogContent className="max-w-md" dir="rtl">
                            <DialogHeader>
                                <DialogTitle>{editingCategory ? 'تعديل بيانات الفئة' : 'إضافة فئة جديدة'}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSaveCategory} className="space-y-4 py-2">
                                {!editingCategory && (
                                    <div className="space-y-1">
                                        <Label>معرف الفئة (Slug)</Label>
                                        <Input
                                            required
                                            value={catForm.id}
                                            onChange={(e) => setCatForm({ ...catForm, id: e.target.value })}
                                            placeholder="emergency, governorates, hospitals..."
                                            className="font-mono text-sm"
                                        />
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <Label>اسم الفئة (بالعربية)</Label>
                                    <Input
                                        required
                                        value={catForm.label_ar}
                                        onChange={(e) => setCatForm({ ...catForm, label_ar: e.target.value })}
                                        placeholder="مثال: المستشفيات والمراكز الصحية"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label>اسم الفئة (بالإنكليزية)</Label>
                                    <Input
                                        required
                                        value={catForm.label_en}
                                        onChange={(e) => setCatForm({ ...catForm, label_en: e.target.value })}
                                        placeholder="Example: Hospitals & Health Centers"
                                    />
                                </div>

                                <div className="flex items-center gap-2 pt-2 border-t border-border">
                                    <Switch
                                        checked={catForm.is_active}
                                        onCheckedChange={(val) => setCatForm({ ...catForm, is_active: val })}
                                    />
                                    <Label className="cursor-pointer text-sm">الفئة مفعّلة في الواجهة العامة</Label>
                                </div>

                                <DialogFooter className="gap-2 pt-4">
                                    {editingCategory && (
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            onClick={() => handleDeleteCategory(editingCategory.id)}
                                            className="me-auto"
                                        >
                                            حذف الفئة
                                        </Button>
                                    )}
                                    <Button type="button" variant="outline" onClick={() => setCategoryModalOpen(false)}>
                                        إلغاء
                                    </Button>
                                    <Button type="submit">
                                        حفظ الفئة
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                </div>
            </div>
        </MainLayout>
    );
}
