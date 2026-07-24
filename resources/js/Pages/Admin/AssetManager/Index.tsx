import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Badge } from '@/Components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import { 
    Upload, Copy, Check, CloudUpload, FileCheck, Folder, Download, 
    Trash2, RefreshCw, Search, ExternalLink, FileText, Image as ImageIcon, Archive
} from 'lucide-react';
import axios from 'axios';
import JSZip from 'jszip';

interface R2File {
    path: string;
    filename: string;
    folder: string;
    size: number;
    last_modified: number | null;
    url: string;
}

interface UploadResult {
    url: string;
    filename: string;
    size: number;
}

export default function AssetManagerIndex() {
    // Upload state
    const [file, setFile] = useState<File | null>(null);
    const [folder, setFolder] = useState<string>('downloads');
    const [uploading, setUploading] = useState<boolean>(false);
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Browser state
    const [files, setFiles] = useState<R2File[]>([]);
    const [totalSize, setTotalSize] = useState<number>(0);
    const [loadingFiles, setLoadingFiles] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedFolder, setSelectedFolder] = useState<string>('all');
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
    const [downloadingZip, setDownloadingZip] = useState<boolean>(false);
    const [zipProgress, setZipProgress] = useState<number>(0);

    const fetchFiles = async (refresh: boolean = false) => {
        setLoadingFiles(true);
        try {
            const res = await axios.get('/api/v1/admin/assets/list', {
                params: { refresh: refresh ? 1 : 0 }
            });
            if (res.data.success) {
                setFiles(res.data.files);
                setTotalSize(res.data.total_size);
            }
        } catch (err) {
            console.error('Failed to fetch R2 files:', err);
        } finally {
            setLoadingFiles(false);
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
            const res = await axios.post('/api/v1/admin/assets/upload', formData);
            setUploadResult(res.data);
            setFile(null);
            fetchFiles(true);
        } catch (err: any) {
            setUploadError(err.response?.data?.message || 'حدث خطأ أثناء رفع الملف إلى Cloudflare R2');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (path: string) => {
        if (!confirm(`هل أنت تأكد من حذف الملف: ${path}؟`)) return;
        try {
            await axios.delete('/api/v1/admin/assets/delete', { data: { path } });
            fetchFiles(true);
        } catch (err) {
            alert('فشل حذف الملف من R2');
        }
    };

    const copyToClipboard = (url: string) => {
        navigator.clipboard.writeText(url);
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

    // Filter files
    const foldersList = Array.from(new Set(files.map(f => f.folder)));

    const filteredFiles = files.filter(f => {
        const matchesFolder = selectedFolder === 'all' || f.folder === selectedFolder;
        const matchesSearch = f.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              f.path.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFolder && matchesSearch;
    });

    // Bulk download all files as ZIP
    const handleDownloadAll = async () => {
        if (files.length === 0) return;
        setDownloadingZip(true);
        setZipProgress(0);

        try {
            const zip = new JSZip();
            let completed = 0;

            for (const item of files) {
                try {
                    const response = await fetch(item.url);
                    if (response.ok) {
                        const blob = await response.blob();
                        zip.file(item.path, blob);
                    }
                } catch (err) {
                    console.error(`Failed to download ${item.path} for zip`, err);
                }
                completed++;
                setZipProgress(Math.round((completed / files.length) * 100));
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `r2-assets-backup-${new Date().toISOString().slice(0, 10)}.zip`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (err) {
            console.error('Failed to create ZIP', err);
            alert('حدث خطأ أثناء تجميع الملفات للتنزيل');
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
            <Head title="إدارة ملفات Cloudflare R2" />
            <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
                
                {/* Header Stats */}
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
                            <RefreshCw className={`h-4 w-4 ml-2 ${loadingFiles ? 'animate-spin' : ''}`} />
                            تحديث
                        </Button>
                        <Button 
                            onClick={handleDownloadAll} 
                            disabled={downloadingZip || files.length === 0}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <Archive className="h-4 w-4 ml-2" />
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

                    {/* TAB 1: FILE BROWSER */}
                    <TabsContent value="browser" className="space-y-4">
                        <Card className="shadow-md border-border">
                            <CardHeader className="pb-4">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <CardTitle className="text-lg">مستكشف ملفات R2</CardTitle>
                                        <CardDescription>
                                            إجمالي الحجم: <span className="font-semibold text-foreground">{formatBytes(totalSize)}</span> | عدد الملفات: <span className="font-semibold text-foreground">{files.length}</span>
                                        </CardDescription>
                                    </div>

                                    {/* Search & Folder Filters */}
                                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                        <div className="relative flex-1 min-w-[200px]">
                                            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="بحث باسم الملف..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="pr-9"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Folder Pills */}
                                {foldersList.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-3">
                                        <Badge
                                            variant={selectedFolder === 'all' ? 'default' : 'outline'}
                                            className="cursor-pointer"
                                            onClick={() => setSelectedFolder('all')}
                                        >
                                            الكل ({files.length})
                                        </Badge>
                                        {foldersList.map(folderName => {
                                            const count = files.filter(f => f.folder === folderName).length;
                                            return (
                                                <Badge
                                                    key={folderName}
                                                    variant={selectedFolder === folderName ? 'default' : 'outline'}
                                                    className="cursor-pointer"
                                                    onClick={() => setSelectedFolder(folderName)}
                                                >
                                                    <Folder className="h-3 w-3 ml-1" />
                                                    {folderName} ({count})
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardHeader>
                            <CardContent>
                                {loadingFiles ? (
                                    <div className="py-12 text-center text-muted-foreground space-y-2">
                                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
                                        <p>جاري تحميل قائمة ملفات R2...</p>
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
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8"
                                                            title="نسخ الرابط المباشر"
                                                            onClick={() => copyToClipboard(item.url)}
                                                        >
                                                            {copiedUrl === item.url ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                                        </Button>

                                                        <a href={item.url} download target="_blank" rel="noreferrer">
                                                            <Button size="icon" variant="ghost" className="h-8 w-8" title="تنزيل الملف">
                                                                <Download className="h-4 w-4" />
                                                            </Button>
                                                        </a>

                                                        <Button
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
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 2: FILE UPLOAD */}
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
                                                    onClick={() => copyToClipboard(uploadResult.url)}
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
