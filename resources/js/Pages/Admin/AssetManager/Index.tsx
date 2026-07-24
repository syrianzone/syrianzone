import React, { useState } from 'react';
import { Head } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Upload, Copy, Check, CloudUpload, FileCheck } from 'lucide-react';
import axios from 'axios';

interface UploadResult {
    url: string;
    filename: string;
    size: number;
}

export default function AssetManagerIndex() {
    const [file, setFile] = useState<File | null>(null);
    const [folder, setFolder] = useState<string>('downloads');
    const [uploading, setUploading] = useState<boolean>(false);
    const [result, setResult] = useState<UploadResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<boolean>(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setResult(null);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        setUploading(true);
        setError(null);
        setResult(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        try {
            const res = await axios.post('/api/v1/admin/assets/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-dir',
                },
            });
            setResult(res.data);
            setFile(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'حدث خطأ أثناء رفع الملف إلى Cloudflare R2');
        } finally {
            setUploading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <MainLayout>
            <Head title="إدارة ملفات R2" />
            <div className="max-w-4xl mx-auto py-8 px-4">
                <Card className="shadow-lg border-border">
                    <CardHeader>
                        <CardTitle className="text-2xl flex items-center gap-2">
                            <CloudUpload className="h-6 w-6 text-primary" />
                            رفع الملفات إلى Cloudflare R2
                        </CardTitle>
                        <CardDescription>
                            قم برفع الملفات والأرشيفات الكبيرة (مثل BrandKit.zip أو خرائط GeoJSON) للحصول على رابط مباشر يخدم عبر R2 CDN.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleUpload} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="folder">مجلد الحفظ في R2</Label>
                                <Input
                                    id="folder"
                                    type="text"
                                    value={folder}
                                    onChange={(e) => setFolder(e.target.value)}
                                    placeholder="مثال: downloads أو assets"
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
                                        الملف المحدد: <span className="font-semibold text-foreground">{file.name}</span> ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                                    </p>
                                )}
                            </div>

                            {error && (
                                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
                                    {error}
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

                        {result && (
                            <div className="mt-8 p-4 bg-muted/50 border border-border rounded-xl space-y-3">
                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                                    <FileCheck className="h-5 w-5" />
                                    تم رفع الملف بنجاح!
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">الرابط المباشر للملف (R2 CDN URL)</Label>
                                    <div className="flex gap-2">
                                        <Input readOnly value={result.url} className="font-mono text-xs bg-background" />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => copyToClipboard(result.url)}
                                            className="shrink-0"
                                        >
                                            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                            {copied ? 'تم النسخ' : 'نسخ'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
