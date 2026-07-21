import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { Badge } from '@/Components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Plus, Search, Edit3, Trash2, Layers, FolderPlus, ArrowUpDown, Globe, Eye, EyeOff } from 'lucide-react';
import CategoryDialog, { CategoryData } from './_components/CategoryDialog';
import EntityDialog, { EntityData } from './_components/EntityDialog';
import SortableList from './_components/SortableList';

interface AdminSyOfficialProps {
    categories: CategoryData[];
    entities: (EntityData & { category?: CategoryData })[];
}

export default function SyOfficialAdminIndex({ categories, entities }: AdminSyOfficialProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

    // Dialog States
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<CategoryData | null>(null);

    const [entityDialogOpen, setEntityDialogOpen] = useState(false);
    const [selectedEntity, setSelectedEntity] = useState<EntityData | null>(null);

    // Filter Entities
    const filteredEntities = entities.filter((item) => {
        const matchesCategory = selectedCategoryFilter === 'all' || item.category_id === selectedCategoryFilter;
        const term = searchTerm.toLowerCase();
        const matchesSearch =
            !searchTerm ||
            item.name.toLowerCase().includes(term) ||
            item.name_ar.toLowerCase().includes(term) ||
            item.id.toLowerCase().includes(term);
        return matchesCategory && matchesSearch;
    });

    const handleDeleteCategory = (catId: string) => {
        if (confirm('هل أنت تأكد من حذف هذه الفئة؟ سيتم حذف جميع الحسابات التابعة لها.')) {
            router.delete(`/api/v1/admin/syofficial/categories/${catId}`);
        }
    };

    const handleDeleteEntity = (entId: string) => {
        if (confirm('هل أنت تأكد من حذف هذه الجهة الرسمية؟')) {
            router.delete(`/api/v1/admin/syofficial/entities/${entId}`);
        }
    };

    return (
        <MainLayout>
            <Head title="إدارة الحسابات الرسمية" />

            <div className="min-h-screen py-8 bg-background" dir="rtl">
                <div className="container mx-auto px-4 max-w-7xl">
                    
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 pb-6 border-b border-border">
                        <div>
                            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                                <Globe className="w-8 h-8 text-primary" />
                                <span>لوحة إدارة الحسابات الرسمية (SyOfficial)</span>
                            </h1>
                            <p className="text-muted-foreground mt-1">إضافة، تعديل، وترتيب الجهات الرسمية والفئات واستضافة الصور عبر Cloudflare R2</p>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSelectedCategory(null);
                                    setCategoryDialogOpen(true);
                                }}
                                className="gap-2"
                            >
                                <FolderPlus className="w-4 h-4" />
                                <span>إضافة فئة جديدة</span>
                            </Button>

                            <Button
                                onClick={() => {
                                    setSelectedEntity(null);
                                    setEntityDialogOpen(true);
                                }}
                                className="gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                <span>إضافة جهة جديدة</span>
                            </Button>
                        </div>
                    </div>

                    {/* Main Tabs */}
                    <Tabs defaultValue="entities" className="space-y-6">
                        <TabsList className="bg-card border border-border p-1 rounded-xl">
                            <TabsTrigger value="entities" className="gap-2 text-sm">
                                <Globe className="w-4 h-4" />
                                <span>الجهات الرسمية ({entities.length})</span>
                            </TabsTrigger>
                            <TabsTrigger value="categories" className="gap-2 text-sm">
                                <Layers className="w-4 h-4" />
                                <span>الفئات ({categories.length})</span>
                            </TabsTrigger>
                            <TabsTrigger value="sorting" className="gap-2 text-sm">
                                <ArrowUpDown className="w-4 h-4" />
                                <span>إعادة الترتيب (Drag & Drop)</span>
                            </TabsTrigger>
                        </TabsList>

                        {/* Tab 1: Entities Catalog Table */}
                        <TabsContent value="entities" className="space-y-4">
                            <Card className="border-border">
                                <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                    <div>
                                        <CardTitle className="text-lg">دليل الجهات الرسمية</CardTitle>
                                        <CardDescription>عرض وتصفية وتعديل الحسابات الرسمية السورية</CardDescription>
                                    </div>

                                    {/* Search & Filter */}
                                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                        <div className="relative w-full sm:w-64">
                                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                placeholder="بحث بالاسم أو ID..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="ps-9 h-9"
                                            />
                                        </div>

                                        <select
                                            value={selectedCategoryFilter}
                                            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                                            className="h-9 px-3 rounded-md border border-input bg-card text-sm text-foreground focus:ring-2 focus:ring-primary"
                                        >
                                            <option value="all">جميع الفئات</option>
                                            {categories.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.label_ar}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </CardHeader>

                                <CardContent>
                                    <div className="rounded-xl border border-border overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead className="text-start font-bold">الجهة</TableHead>
                                                    <TableHead className="text-start font-bold">الفئة</TableHead>
                                                    <TableHead className="text-start font-bold">الوصف</TableHead>
                                                    <TableHead className="text-start font-bold">وسائل التواصل</TableHead>
                                                    <TableHead className="text-start font-bold">الحالة</TableHead>
                                                    <TableHead className="text-end font-bold">الإجراءات</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredEntities.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                            لا توجد نتائج مطابقة للبحث.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    filteredEntities.map((ent) => (
                                                        <TableRow key={ent.id} className="hover:bg-muted/30">
                                                            <TableCell>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0 border">
                                                                        <img
                                                                            src={ent.image ? (ent.image.startsWith('http') || ent.image.startsWith('/') ? ent.image : `/syofficial-assets/${ent.image}`) : '/syofficial-assets/images/placeholder.png'}
                                                                            alt=""
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-bold text-sm text-foreground">{ent.name_ar}</h4>
                                                                        <p className="text-xs text-muted-foreground">{ent.name}</p>
                                                                    </div>
                                                                </div>
                                                            </TableCell>

                                                            <TableCell>
                                                                <Badge variant="secondary" className="font-normal">
                                                                    {categories.find((c) => c.id === ent.category_id)?.label_ar || ent.category_id}
                                                                </Badge>
                                                            </TableCell>

                                                            <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                                                                {ent.description_ar || ent.description || '-'}
                                                            </TableCell>

                                                            <TableCell>
                                                                <span className="text-xs font-semibold text-muted-foreground">
                                                                    {ent.socials ? Object.keys(ent.socials).length : 0} روابط
                                                                </span>
                                                            </TableCell>

                                                            <TableCell>
                                                                {ent.is_active ? (
                                                                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30 gap-1 font-normal">
                                                                        <Eye className="w-3 h-3" />
                                                                        <span>مفعلة</span>
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-muted-foreground gap-1 font-normal">
                                                                        <EyeOff className="w-3 h-3" />
                                                                        <span>معطلة</span>
                                                                    </Badge>
                                                                )}
                                                            </TableCell>

                                                            <TableCell className="text-end">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        onClick={() => {
                                                                            setSelectedEntity(ent);
                                                                            setEntityDialogOpen(true);
                                                                        }}
                                                                    >
                                                                        <Edit3 className="w-4 h-4 text-muted-foreground" />
                                                                    </Button>
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        onClick={() => handleDeleteEntity(ent.id)}
                                                                    >
                                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Tab 2: Categories Management Table */}
                        <TabsContent value="categories" className="space-y-4">
                            <Card className="border-border">
                                <CardHeader>
                                    <CardTitle className="text-lg">فئات الحسابات الرسمية</CardTitle>
                                    <CardDescription>إدارة تصنيفات الجهات الرسمية التي تظهر في التبويبات الفوقية</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="rounded-xl border border-border overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead className="text-start font-bold">معرف الفئة (Slug)</TableHead>
                                                    <TableHead className="text-start font-bold">الاسم بالعربية</TableHead>
                                                    <TableHead className="text-start font-bold">الاسم بالإنجليزية</TableHead>
                                                    <TableHead className="text-start font-bold">عدد الجهات التابعة</TableHead>
                                                    <TableHead className="text-start font-bold">الحالة</TableHead>
                                                    <TableHead className="text-end font-bold">الإجراءات</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {categories.map((cat) => {
                                                    const count = entities.filter((e) => e.category_id === cat.id).length;
                                                    return (
                                                        <TableRow key={cat.id} className="hover:bg-muted/30">
                                                            <TableCell className="font-mono text-xs text-muted-foreground">{cat.id}</TableCell>
                                                            <TableCell className="font-bold text-sm text-foreground">{cat.label_ar}</TableCell>
                                                            <TableCell className="text-sm text-muted-foreground">{cat.label_en}</TableCell>
                                                            <TableCell>
                                                                <Badge variant="secondary" className="font-normal">{count} جهة</Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                {cat.is_active ? (
                                                                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-normal">مفعلة</Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="font-normal">معطلة</Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-end">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        onClick={() => {
                                                                            setSelectedCategory(cat);
                                                                            setCategoryDialogOpen(true);
                                                                        }}
                                                                    >
                                                                        <Edit3 className="w-4 h-4 text-muted-foreground" />
                                                                    </Button>
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        onClick={() => handleDeleteCategory(cat.id)}
                                                                    >
                                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Tab 3: Drag & Drop Sorting */}
                        <TabsContent value="sorting" className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="border-border">
                                    <CardHeader>
                                        <CardTitle className="text-lg">ترتيب الفئات</CardTitle>
                                        <CardDescription>تحديد ترتيب ظهور أزرار الفئات الفوقية في الصفحة</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <SortableList
                                            items={categories.map((c) => ({ id: c.id, label: c.label_ar, subtitle: c.label_en }))}
                                            endpoint="/api/v1/admin/syofficial/reorder/categories"
                                            onSaveSuccess={() => router.reload()}
                                        />
                                    </CardContent>
                                </Card>

                                <Card className="border-border">
                                    <CardHeader>
                                        <CardTitle className="text-lg">ترتيب جهات فئة محددة</CardTitle>
                                        <CardDescription>اختر فئة لإعادة ترتيب كروت الجهات التابعة لها</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <select
                                            value={selectedCategoryFilter}
                                            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                                            className="w-full h-9 px-3 rounded-md border border-input bg-card text-sm text-foreground mb-4"
                                        >
                                            {categories.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.label_ar}
                                                </option>
                                            ))}
                                        </select>

                                        <SortableList
                                            key={selectedCategoryFilter}
                                            items={entities
                                                .filter((e) => selectedCategoryFilter === 'all' || e.category_id === selectedCategoryFilter)
                                                .map((e) => ({ id: e.id, label: e.name_ar, subtitle: e.name, image: e.image }))}
                                            endpoint="/api/v1/admin/syofficial/reorder/entities"
                                            onSaveSuccess={() => router.reload()}
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Dialogs */}
            <CategoryDialog
                open={categoryDialogOpen}
                onOpenChange={setCategoryDialogOpen}
                category={selectedCategory}
            />

            <EntityDialog
                open={entityDialogOpen}
                onOpenChange={setEntityDialogOpen}
                entity={selectedEntity}
                categories={categories}
            />
        </MainLayout>
    );
}
