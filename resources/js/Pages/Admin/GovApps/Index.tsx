import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { Badge } from '@/Components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Plus, Edit3, Trash2, Smartphone, ArrowUpDown, Globe } from 'lucide-react';
import { notify } from '@/Lib/notify';
import { confirmDialog } from '@/Lib/confirm';
import AppDialog from './_components/AppDialog';
import SortableList from '@/Components/directory/SortableList';
import DirectoryResultCount from '@/Components/directory/DirectoryResultCount';
import { DirectorySearch } from '@/Components/directory/DirectorySearch';
import { useDirectory } from '@/Components/directory/useDirectory';
import { useCan } from '@/Lib/useCan';
import { DEFAULT_GOVAPP_ICON } from '@/Domain/govapps/media';
import type { GovApp } from '@/Domain/govapps/types';

interface AdminGovAppsProps {
    apps: GovApp[];
}

const appSearchText = (app: GovApp) => `${app.name} ${app.name_ar ?? ''} ${app.id}`;

export default function GovAppsAdminIndex({ apps }: AdminGovAppsProps) {

    // Each control is gated on the capability its route requires (routes/web.php).
    const can = useCan();
    const canCreate = can('govapps.create');
    const canEdit = can('govapps.edit');
    const canDelete = can('govapps.delete');
    const canReorder = can('govapps.reorder');

    // The public listing's search, so «احمد» finds «أحمد» here too.
    const directory = useDirectory<GovApp>({ items: apps, searchText: appSearchText });
    const filteredApps = directory.results;

    const [appDialogOpen, setAppDialogOpen] = useState(false);
    const [selectedApp, setSelectedApp] = useState<GovApp | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const editId = params.get('edit');
        if (editId) {
            const target = apps.find((e) => e.id === editId);
            if (target) {
                setSelectedApp(target);
                setAppDialogOpen(true);
            }
        }
    }, [apps]);

    const handleDeleteApp = async (appId: string) => {
        const ok = await confirmDialog({ title: 'حذف هذا التطبيق الحكومي؟', destructive: true, confirmText: 'حذف' });
        if (!ok) return;
        router.delete(`/api/v1/admin/govapps/${appId}`, {
            preserveScroll: true,
            onSuccess: () => notify.success('تم حذف التطبيق'),
            onError: () => notify.error('تعذر حذف التطبيق'),
        });
    };

    return (
        <MainLayout>
            

            <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6" dir="rtl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border shadow-xs">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <Smartphone className="w-7 h-7 text-primary" />
                            <span>إدارة دليل التطبيقات الحكومية</span>
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            تحكم كامل في التطبيقات والخدمات الإلكترونية الصادرة عن الجهات الحكومية السورية.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {canCreate && (
                            <Button
                                onClick={() => {
                                    setSelectedApp(null);
                                    setAppDialogOpen(true);
                                }}
                                className="gap-2 font-bold shadow-md"
                            >
                                <Plus className="w-4 h-4" />
                                <span>إضافة تطبيق جديد</span>
                            </Button>
                        )}
                    </div>
                </div>

                <Tabs defaultValue="list" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-md bg-muted/60 p-1 rounded-xl">
                        <TabsTrigger value="list" className="rounded-lg font-bold">قائمة التطبيقات</TabsTrigger>
                        <TabsTrigger value="reorder" className="rounded-lg font-bold flex items-center gap-1.5">
                            <ArrowUpDown className="w-4 h-4" />
                            <span>ترتيب العرض</span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="list" className="mt-6 space-y-4">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <DirectorySearch
                                className="w-full sm:w-96"
                                value={directory.query}
                                onChange={directory.setQuery}
                                placeholder="ابحث بالاسم أو المعرف..."
                                ariaLabel="ابحث بالاسم أو المعرف..."
                            />

                            <DirectoryResultCount className="text-xs">
                                الإجمالي: {filteredApps.length} تطبيق
                            </DirectoryResultCount>
                        </div>

                        <Card className="overflow-hidden border">
                            <Table>
                                <TableHeader className="bg-muted/60">
                                    <TableRow>
                                        <TableHead className="font-bold">التطبيق</TableHead>
                                        <TableHead className="font-bold">المعرف</TableHead>
                                        <TableHead className="font-bold">الروابط المتاحة</TableHead>
                                        <TableHead className="font-bold">الحالة</TableHead>
                                        <TableHead className="text-end font-bold">الإجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredApps.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                                لا توجد تطبيقات مطابقة للبحث.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredApps.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-muted/30">
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted flex-shrink-0 border flex items-center justify-center">
                                                            <img
                                                                src={item.icon || DEFAULT_GOVAPP_ICON}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src = DEFAULT_GOVAPP_ICON;
                                                                }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="text-foreground font-semibold text-sm">{item.name_ar || item.name}</div>
                                                            <div className="text-xs text-muted-foreground">{item.name}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs font-mono text-muted-foreground">
                                                    {item.id}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {item.links?.android && <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Android</Badge>}
                                                        {item.links?.apple && <Badge variant="outline" className="text-[10px] bg-slate-500/10 text-slate-700 border-slate-500/20">iOS</Badge>}
                                                        {item.links?.official && <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20">Website</Badge>}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {item.is_active ? (
                                                        <Badge variant="default" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">مفعل</Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="bg-muted text-muted-foreground">مخفي</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-end">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {canEdit && (
                                                            <Button aria-label="تعديل البيانات"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => {
                                                                    setSelectedApp(item);
                                                                    setAppDialogOpen(true);
                                                                }}
                                                                title="تعديل البيانات"
                                                            >
                                                                <Edit3 className="w-4 h-4 text-muted-foreground hover:text-primary" />
                                                            </Button>
                                                        )}
                                                        {canDelete && (
                                                            <Button aria-label="حذف"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDeleteApp(item.id)}
                                                                title="حذف"
                                                            >
                                                                <Trash2 className="w-4 h-4 text-destructive" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </Card>
                    </TabsContent>

                    <TabsContent value="reorder" className="mt-6">
                        <SortableList
                            items={apps.map((app) => ({ id: app.id, label: app.name_ar || app.name, subtitle: app.id, image: app.icon ?? undefined }))}
                            endpoint="/api/v1/admin/govapps/reorder"
                            capability="govapps.reorder"
                            canReorder={canReorder}
                        />
                    </TabsContent>
                </Tabs>

                <AppDialog
                    open={appDialogOpen}
                    onOpenChange={setAppDialogOpen}
                    app={selectedApp}
                />
            </div>
        </MainLayout>
    );
}
