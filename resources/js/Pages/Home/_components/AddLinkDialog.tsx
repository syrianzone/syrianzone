import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/Components/ui/dialog";
import { Label } from "@/Components/ui/label";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";

export interface CustomLink {
    id: string;
    name: string;
    url: string;
    icon?: string;
}

export interface AddLinkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdd: (link: CustomLink) => void;
    language: 'ar' | 'en';
}

export default function AddLinkDialog({
    open,
    onOpenChange,
    onAdd,
    language
}: AddLinkDialogProps) {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [icon, setIcon] = useState('');
    const [urlError, setUrlError] = useState('');

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
            setUrlError(language === 'ar' ? 'الرابط يجب أن يبدأ بـ http:// أو https://' : 'URL must start with http:// or https://');
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
            <DialogContent dir={language === 'ar' ? 'rtl' : 'ltr'}>
                <DialogHeader className="text-start sm:text-start">
                    <DialogTitle>{language === 'ar' ? 'إضافة رابط مخصص' : 'Add Custom Link'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4 text-start">
                    <div className="space-y-2">
                        <Label>{language === 'ar' ? 'الاسم' : 'Name'}</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={language === 'ar' ? 'اسم الرابط' : 'Link name'}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{language === 'ar' ? 'الرابط (URL)' : 'URL'}</Label>
                        <Input
                            type="url"
                            value={url}
                            onChange={(e) => { setUrl(e.target.value); if (urlError) setUrlError(''); }}
                            placeholder="https://example.com"
                            required
                        />
                        {urlError && <p className="text-xs text-destructive">{urlError}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label>{language === 'ar' ? 'أيقونة أو Emoji (اختياري - اتركها فارغة لجلب أيقونة الموقع تلقائياً)' : 'Icon or Emoji (optional - leave empty for website favicon)'}</Label>
                        <Input
                            value={icon}
                            onChange={(e) => setIcon(e.target.value)}
                            placeholder={language === 'ar' ? 'تلقائي (Favicon)' : 'Auto (Favicon)'}
                            maxLength={4}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                            {language === 'ar' ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                            {language === 'ar' ? 'حفظ' : 'Save'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
