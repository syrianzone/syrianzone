import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/Components/ui/dialog";
import { Label } from "@/Components/ui/label";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import { X } from 'lucide-react';
import { CustomLink } from './AddLinkDialog';

export interface EditLinkDialogProps {
    link: CustomLink | null;
    onOpenChange: (open: boolean) => void;
    onSave: (link: CustomLink) => void;
    onDelete: (id: string) => void;
    language: 'ar' | 'en';
}

export default function EditLinkDialog({
    link,
    onOpenChange,
    onSave,
    onDelete,
    language
}: EditLinkDialogProps) {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [icon, setIcon] = useState('');
    const [urlError, setUrlError] = useState('');

    useEffect(() => {
        if (link) {
            setName(link.name || '');
            setUrl(link.url || '');
            setIcon(link.icon === '🔗' ? '' : (link.icon || ''));
            setUrlError('');
        }
    }, [link]);

    if (!link) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        const trimmedUrl = url.trim();
        if (!trimmedName || !trimmedUrl) return;
        if (!(trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://'))) {
            setUrlError(language === 'ar' ? 'الرابط يجب أن يبدأ بـ http:// أو https://' : 'URL must start with http:// or https://');
            return;
        }
        setUrlError('');

        onSave({
            ...link,
            name: trimmedName,
            url: trimmedUrl,
            icon: icon.trim()
        });

        onOpenChange(false);
    };

    const handleDelete = () => {
        onDelete(link.id);
        onOpenChange(false);
    };

    return (
        <Dialog open={!!link} onOpenChange={onOpenChange}>
            <DialogContent dir={language === 'ar' ? 'rtl' : 'ltr'}>
                <DialogHeader className="text-start sm:text-start">
                    <DialogTitle>{language === 'ar' ? 'تعديل الرابط المخصص' : 'Edit Custom Link'}</DialogTitle>
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
                    <div className="flex justify-between items-center pt-2">
                        <Button type="button" variant="destructive" size="sm" onClick={handleDelete} className="gap-1.5">
                            <X className="w-4 h-4" />
                            {language === 'ar' ? 'حذف الرابط' : 'Remove Link'}
                        </Button>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                                {language === 'ar' ? 'إلغاء' : 'Cancel'}
                            </Button>
                            <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                                {language === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
