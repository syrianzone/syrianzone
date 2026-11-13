import React, { useState, useEffect, useMemo } from 'react';

import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { FilterChip } from '@/Components/ui/filter-chip';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Badge } from '@/Components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import { 
    Upload, Copy, Check, CloudUpload, FileCheck, Folder, Download, 
    Trash2, RefreshCw, ExternalLink, FileText, Image as ImageIcon, Archive
} from 'lucide-react';
import { api, apiErrorMessage } from '@/Lib/api';
import JSZip from 'jszip';
import { notify } from '@/Lib/notify';
import { copyText } from '@/Lib/copy';
import { confirmDialog } from '@/Lib/confirm';
import DirectoryResultCount from '@/Components/directory/DirectoryResultCount';
import { DirectorySearch } from '@/Components/directory/DirectorySearch';
import { useDirectory, type DirectoryFacet } from '@/Components/directory/useDirectory';

interface R2File {
    path: string;
    filename: string;
    folder: string;
    size: number;
    last_modified: number | null;
    url: string;
}

interface AssetListResponse {
    success: boolean;
    files: R2File[];
    total_size: number;
    next_cursor?: string | null;
    has_more?: boolean;
}

interface UploadResult {
    url: string;
    filename: string;
    size: number;
}

export default function AssetManagerIndex() {
    const [file, setFile] = useState<File | null>(null);
    const [folder, setFolder] = useState<string>('downloads');
    const [uploading, setUploading] = useState<boolean>(false);
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const [files, setFiles] = useState<R2File[]>([]);
    const [totalSize, setTotalSize] = useState<number>(0);
    const [loadingFiles, setLoadingFiles] = useState<boolean>(true);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState<boolean>(false);
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
    const [downloadingZip, setDownloadingZip] = useState<boolean>(false);
    const [zipProgress, setZipProgress] = useState<number>(0);

    const fetchFiles = async (refresh: boolean = false) => {
        setLoadingFiles(true);
        setFiles([]);
        setNextCursor(null);
        setHasMore(false);
        setTotalSize(0);
        try {
            const res = await api.get<AssetListResponse>('/api/v1/admin/assets/list', {
                params: { refresh: refresh ? 1 : 0 }
            });
            if (res.success) {
                setFiles(res.files);
                setTotalSize(res.total_size);
                setNextCursor(res.next_cursor ?? null);
                setHasMore(res.has_more ?? false);
            }
        } catch (err) {
            notify.error(apiErrorMessage(err, 'تعذّر جلب ملفات التخزين'));
        } finally {
            setLoadingFiles(false);
        }
    };

    const loadMore = async () => {
        if (!nextCursor || loadingMore) return;
        setLoadingMore(true);
        try {
            const res = await api.get<AssetListResponse>('/api/v1/admin/assets/list', {
                params: { cursor: nextCursor }
            });
            if (res.success) {
                setFiles(prev => [...prev, ...res.files]);
                setTotalSize(prev => prev + res.total_size);
                setNextCursor(res.next_cursor ?? null);
                setHasMore(res.has_more ?? false);
            }
        } catch (err) {
            notify.error(apiErrorMessage(err, 'تعذّر تحميل مزيد من الملفات'));
        } finally {
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setUploadError(null);
            setUploadResult(null);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        setUploading(true);
        setUploadError(null);
        setUploadResult(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        try {
            const res = await api.post<UploadResult>('/api/v1/admin/assets/upload', formData);
            setUploadResult(res);
            setFile(null);
            fetchFiles(true);
        } catch (err) {
            setUploadError(apiErrorMessage(err, 'حدث خطأ أثناء رفع الملف إلى Cloudflare R2'));
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (path: string) => {
        const ok = await confirmDialog({ title: 'حذف هذا الملف؟', description: path, destructive: true, confirmText: 'حذف' });
        if (!ok) return;
        try {
            await api.delete('/api/v1/admin/assets/delete', { path });
            notify.success('تم حذف الملف');
            fetchFiles(true);
        } catch (err) {
            notify.error(apiErrorMessage(err, 'فشل حذف الملف من R2'));
        }
    };

    const copyToClipboard = async (url: string) => {
        if (!(await copyText(url))) return;
        setCopiedUrl(url);
        setTimeout(() => setCopiedUrl(null), 2000);
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const foldersList = useMemo(() => Array.from(new Set(files.map(f => f.folder))), [files]);

    const folderFacet = useMemo<DirectoryFacet<R2File>>(() => ({
        key: 'folder',
        label: 'المجلد',
        options: foldersList.map(folderName => ({ value: folderName, label: folderName })),
        valueOf: (file) => file.folder,
    }), [foldersList]);
    const directory = useDirectory<R2File>({
        items: files,
        searchText: (file) => `${file.filename} ${file.path}`,
        facets: [folderFacet],
    });
    const selectedFolder = directory.filters.folder?.[0] ?? 'all';
    const filteredFiles = directory.results;
    const selectFolder = (folderName: string) =>
        directory.setFilters({ ...directory.filters, folder: folderName === 'all' ? [] : [folderName] });

    const handleDownloadAll = async () => {
        if (files.length === 0) return;
        setDownloadingZip(true);
        setZipProgress(0);

        try {
            const zip = new JSZip();
            let completed = 0;
            const failed: string[] = [];

            for (const item of files) {
                try {
                    const response = await fetch(item.url);
                    if (response.ok) {
                        const blob = await response.blob();
                        zip.file(item.path, blob);
                    } else {
                        failed.push(item.path);
                    }
                } catch {
                    failed.push(item.path);
                }
                completed++;
                setZipProgress(Math.round((completed / files.length) * 100));
            }

            if (failed.length > 0) {
                notify.error(`تعذّر تنزيل ${failed.length} من الملفات، والملف المضغوط ناقص`);
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `r2-assets-backup-${new Date().toISOString().slice(0, 10)}.zip`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (err) {
            console.error('Failed to create ZIP', err);
            notify.error('حدث خطأ أثناء تجميع الملفات للتنزيل');
        } finally {
            setDownloadingZip(false);
            setZipProgress(0);
        }
    };

    const isImageFile = (filename: string) => {
        return /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(filename);
    };

    return (
        <MainLayout>
            
            <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-6 rounded-2xl shadow-sm">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <CloudUpload className="h-7 w-7 text-primary" />
                            إدارة ملفات Cloudflare R2 CDN
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            رفع، تصفح، وتنزيل جميع الأصول الرقمية والملفات المخزنة على خوادم Cloudflare R2
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => fetchFiles(true)}
                            disabled={loadingFiles}
                        >
                            <RefreshCw className={`h-4 w-4 me-2 ${loadingFiles ? 'animate-spin' : ''}`} />
                            تحديث
                        </Button>
                        <Button 
                            onClick={handleDownloadAll} 
                            disabled={downloadingZip || files.length === 0}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <Archive className="h-4 w-4 me-2" />
                            {downloadingZip ? `جاري التجميع (${zipProgress}%)` : 'تنزيل الكل (ZIP)'}
                        </Button>
                    </div>
                </div>

                <Tabs defaultValue="browser" className="space-y-6">
                    <TabsList className="grid grid-cols-2 max-w-md">
                        <TabsTrigger value="browser" className="flex items-center gap-2">
                            <Folder className="h-4 w-4" />
                            تصفح الملفات ({files.length})
                        </TabsTrigger>
                        <TabsTrigger value="upload" className="flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            رفع ملف جديد
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="browser" className="space-y-4">
                        <Card className="shadow-md border-border">
                            <CardHeader className="pb-4">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <CardTitle className="text-lg">مستكشف ملفات R2</CardTitle>
                                        <CardDescription>
                                            الحجم المحمّل: <span className="font-semibold text-foreground">{formatBytes(totalSize)}</span> | الملفات المحمّلة: <span className="font-semibold text-foreground">{files.length}</span>{hasMore && <span className="text-muted-foreground"> (يوجد المزيد)</span>}
                                        </CardDescription>
                                    </div>

                                    <DirectorySearch
                                        className="w-full md:w-auto md:min-w-[200px]"
                                        value={directory.query}
                                        onChange={directory.setQuery}
                                        placeholder="بحث باسم الملف..."
                                        ariaLabel="بحث باسم الملف..."
                                    />
                                </div>

                                {foldersList.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-3">
                                        <FilterChip
                                            active={selectedFolder === 'all'}
                                            onClick={() => selectFolder('all')}
                                        >
                                            الكل ({files.length})
                                        </FilterChip>
                                        {foldersList.map(folderName => {
                                            const count = files.filter(f => f.folder === folderName).length;
                                            return (
                                                <FilterChip
                                                    key={folderName}
                                                    active={selectedFolder === folderName}
                                                    onClick={() => selectFolder(folderName)}
                                                >
                                                    <Folder className="h-3 w-3 me-1" />
                                                    {folderName} ({count})
                                                </FilterChip>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardHeader>
                            <CardContent>
                                <DirectoryResultCount className="mb-3 text-xs">
                                    عرض {filteredFiles.length} من أصل {files.length} ملف
                                </DirectoryResultCount>
                                {loadingFiles ? (
                                    <div className="py-12 text-center text-muted-foreground space-y-2">
                                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
                                        <p>جاري تحميل الصفحة الأولى من ملفات R2...</p>
                                    </div>
                                ) : filteredFiles.length === 0 ? (
                                    <div className="py-12 text-center text-muted-foreground">
                                        لا توجد ملفات مطابقة للبحث.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filteredFiles.map((item) => (
                                            <div 
                                                key={item.path} 
                                                className="p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-all flex flex-col justify-between space-y-3"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        {isImageFile(item.filename) ? (
                                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0 border">
                                                                <img src={item.url} alt="" className="w-full h-full object-cover" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                                                                <FileText className="h-5 w-5" />
                                                            </div>
                                                        )}
                                                        <div className="truncate">
                                                            <h4 className="font-semibold text-sm truncate" title={item.filename}>
                                                                {item.filename}
                                                            </h4>
                                                            <span className="text-xs text-muted-foreground">
                                                                {formatBytes(item.size)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Badge variant="secondary" className="text-[10px] shrink-0 font-mono">
                                                        {item.folder}
                                                    </Badge>
                                                </div>

                                                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                                                    <a 
                                                        href={item.url} 
                                                        target="_blank" 
                                                        rel="noreferrer" 
                                                        className="text-primary hover:underline flex items-center gap-1"
                                                    >
                                                        معاينة <ExternalLink className="h-3 w-3" />
                                                    </a>

                                                    <div className="flex items-center gap-1">
                                                        <Button aria-label="نسخ الرابط المباشر"
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8"
                                                            title="نسخ الرابط المباشر"
                                                            onClick={() => void copyToClipboard(item.url)}
                                                        >
                                                            {copiedUrl === item.url ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                                        </Button>

                                                        <a href={item.url} download target="_blank" rel="noreferrer">
                                                            <Button aria-label="تنزيل الملف" size="icon" variant="ghost" className="h-8 w-8" title="تنزيل الملف">
                                                                <Download className="h-4 w-4" />
                                                            </Button>
                                                        </a>

                                                        <Button aria-label="حذف الملف"
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            title="حذف الملف"
                                                            onClick={() => handleDelete(item.path)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {hasMore && !loadingFiles && (
                                    <div className="mt-6 text-center">
                                        <Button
                                            variant="outline"
                                            onClick={loadMore}
                                            disabled={loadingMore}
                                            className="min-w-[180px]"
                                        >
                                            {loadingMore ? (
                                                <><RefreshCw className="h-4 w-4 me-2 animate-spin" /> جاري التحميل...</>
                                            ) : (
                                                <><Download className="h-4 w-4 me-2" /> تحميل المزيد ({files.length} محمّل حتى الآن)</>
                                            )}
                                        </Button>
                                    </div>
                                )}

                                {!hasMore && files.length > 0 && !loadingFiles && (
                                    <p className="mt-4 text-center text-xs text-muted-foreground">
                                        تم تحميل جميع الملفات ({files.length})
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="upload">
                        <Card className="shadow-md border-border">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <CloudUpload className="h-5 w-5 text-primary" />
                                    رفع ملف جديد إلى R2 Storage
                                </CardTitle>
                                <CardDescription>
                                    رفع الملفات الكبيرة (مثل صور التقييمات، BrandKit، الخرائط) للحصول على رابط CDN مباشر
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleUpload} className="space-y-6 max-w-xl">
                                    <div className="space-y-2">
                                        <Label htmlFor="folder">مجلد الحفظ في R2</Label>
                                        <Input
                                            id="folder"
                                            type="text"
                                            value={folder}
                                            onChange={(e) => setFolder(e.target.value)}
                                            placeholder="مثال: downloads أو tierlist/candidates"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="file">اختر الملف للرفع</Label>
                                        <Input
                                            id="file"
                                            type="file"
                                            onChange={handleFileChange}
                                            className="cursor-pointer"
                                        />
                                        {file && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                الملف المحدد: <span className="font-semibold text-foreground">{file.name}</span> ({formatBytes(file.size)})
                                            </p>
                                        )}
                                    </div>

                                    {uploadError && (
                                        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
                                            {uploadError}
                                        </div>
                                    )}

                                    <Button type="submit" disabled={!file || uploading} className="w-full">
                                        {uploading ? (
                                            <span className="flex items-center gap-2">
                                                <Upload className="h-4 w-4 animate-bounce" /> جاري الرفع إلى R2...
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <Upload className="h-4 w-4" /> بدء الرفع
                                            </span>
                                        )}
                                    </Button>
                                </form>

                                {uploadResult && (
                                    <div className="mt-8 p-4 bg-muted/50 border border-border rounded-xl space-y-3 max-w-xl">
                                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                                            <FileCheck className="h-5 w-5" />
                                            تم رفع الملف بنجاح!
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">الرابط المباشر (R2 CDN URL)</Label>
                                            <div className="flex gap-2">
                                                <Input readOnly value={uploadResult.url} className="font-mono text-xs bg-background" />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => void copyToClipboard(uploadResult.url)}
                                                    className="shrink-0"
                                                >
                                                    {copiedUrl === uploadResult.url ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                                    {copiedUrl === uploadResult.url ? 'تم النسخ' : 'نسخ'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

            </div>
        </MainLayout>
    );
}
