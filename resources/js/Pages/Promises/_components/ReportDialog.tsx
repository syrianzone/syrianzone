import { promisesApi } from '@/Domain/promises/api';
import { useState } from 'react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Textarea } from '@/Components/ui/textarea';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/Components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { notify } from '@/Lib/notify';
import { apiErrorMessage, apiFieldErrors } from '@/Lib/api';
import FieldError, { fieldA11y } from '@/Components/ui/field-error';

export type ReportKind = 'progress' | 'error';

const COPY: Record<ReportKind, { title: string; description: string; bodyLabel: string; sourceLabel: string }> = {
    progress: {
        title: 'أرسل تحديثاً عن هذا الوعد',
        description: 'هل تحقق شيء منه، أو أُعلن عن تأجيله، أو صدر ردّ رسمي؟ أرفق رابطاً يثبت ذلك، وسيراجعه المحررون قبل إضافته إلى سجل الوعد.',
        bodyLabel: 'ما الذي حدث؟',
        sourceLabel: 'رابط المصدر (مطلوب)',
    },
    error: {
        title: 'أبلغ عن خطأ',
        description: 'تاريخ خاطئ، أو اقتباس غير دقيق، أو رابط لا يعمل؟ أخبرنا وسنصححه.',
        bodyLabel: 'ما الخطأ؟',
        sourceLabel: 'رابط يوضّح التصحيح (اختياري)',
    },
};

export default function ReportDialog({ number, kind, open, onOpenChange }: {
    number: number;
    kind: ReportKind;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [body, setBody] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const copy = COPY[kind];

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setErrors({});
        try {
            const res = await promisesApi.report(number, { kind, body, source_url: sourceUrl || null });
            notify.success(res.message ?? 'شكراً لك');
            setBody('');
            setSourceUrl('');
            onOpenChange(false);
        } catch (err) {
            setErrors(apiFieldErrors(err));
            notify.error(apiErrorMessage(err, 'تعذّر الإرسال'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent dir="rtl" className="sm:max-w-lg">
                <form onSubmit={submit} className="space-y-4" noValidate>
                    <DialogHeader>
                        <DialogTitle>{copy.title}</DialogTitle>
                        <DialogDescription>{copy.description}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label htmlFor="report-body">{copy.bodyLabel}</Label>
                        <Textarea
                            id="report-body"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={4}
                            maxLength={2000}
                            {...fieldA11y('report-body-error', errors.body)}
                        />
                        <FieldError id="report-body-error" message={errors.body} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="report-source">{copy.sourceLabel}</Label>
                        <Input
                            id="report-source"
                            type="url"
                            dir="ltr"
                            inputMode="url"
                            placeholder="https://"
                            value={sourceUrl}
                            onChange={(e) => setSourceUrl(e.target.value)}
                            {...fieldA11y('report-source-error', errors.source_url)}
                        />
                        <FieldError id="report-source-error" message={errors.source_url} />
                    </div>
                    <DialogFooter className="gap-2 sm:justify-start">
                        <Button type="submit" disabled={saving} className="gap-2">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}إرسال
                        </Button>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
