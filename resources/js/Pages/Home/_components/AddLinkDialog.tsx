import React, { useId, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/Components/ui/dialog";
import { Label } from "@/Components/ui/label";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import type { CustomLink } from '../_lib/links';

interface AddLinkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdd: (link: CustomLink) => void;
}

export default function AddLinkDialog({
    open,
    onOpenChange,
    onAdd
}: AddLinkDialogProps) {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [icon, setIcon] = useState('');
    const [urlError, setUrlError] = useState('');
    const fieldId = useId();

    const isHttpUrl = (v: string) => {
        const t = v.trim();
        return t.startsWith('http://') || t.startsWith('https://');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        const trimmedUrl = url.trim();
        if (!trimmedName || !trimmedUrl) return;
        if (!isHttpUrl(trimmedUrl)) {
            setUrlError('الرابط يجب أن يبدأ بـ http:// أو https://');
            return;
        }
        setUrlError('');

        onAdd({
            id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(),
            name: trimmedName,
            url: trimmedUrl,
            icon: icon.trim()
        });

        setName('');
        setUrl('');
        setIcon('');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent dir="rtl">
                <DialogHeader className="text-start sm:text-start">
                    <DialogTitle>إضافة رابط مخصص</DialogTitle>
                    <DialogDescription className="sr-only">أدخل اسم وعنوان الرابط المخصص لإضافته إلى صفحتك</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4 text-start">
                    <div className="space-y-2">
                        <Label htmlFor={`${fieldId}-name`}>الاسم</Label>
                        <Input
                            id={`${fieldId}-name`}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="اسم الرابط"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`${fieldId}-url`}>الرابط (URL)</Label>
                        <Input
                            id={`${fieldId}-url`}
                            type="url"
                            autoComplete="url"
                            aria-invalid={urlError ? true : undefined}
                            aria-describedby={urlError ? `${fieldId}-url-error` : undefined}
                            value={url}
                            onChange={(e) => { setUrl(e.target.value); if (urlError) setUrlError(''); }}
                            placeholder="https://example.com"
                            required
                        />
                        {urlError && <p id={`${fieldId}-url-error`} role="alert" className="text-xs text-destructive">{urlError}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`${fieldId}-icon`}>أيقونة أو Emoji (اختياري - اتركها فارغة لجلب أيقونة الموقع تلقائياً)</Label>
                        <Input
                            id={`${fieldId}-icon`}
                            value={icon}
                            onChange={(e) => setIcon(e.target.value)}
                            placeholder="تلقائي (Favicon)"
                            maxLength={4}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                            إلغاء
                        </Button>
                        <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                            حفظ
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
