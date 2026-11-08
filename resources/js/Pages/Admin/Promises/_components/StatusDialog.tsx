import { useState } from 'react';
import axios from '@/Lib/axios';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Textarea } from '@/Components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/Components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { notify } from '@/Lib/notify';
import { extractApiErrorMessage, extractApiFieldErrors } from '@/Lib/apiError';
import FieldError, { fieldA11y } from '@/Pages/Promises/_components/FieldError';
import { STATE_META, STATUS_ORDER } from '@/Pages/Promises/_lib/status';
import type { PromiseStatus } from '@/Pages/Promises/_lib/types';
import type { AdminPromiseDetail } from '../_lib/types';

/**
 * A verdict or status change. It always writes a public change-log entry and
 * always needs a source: the site never rules on a promise without evidence.
 */
export default function StatusDialog({ promise, today, open, onOpenChange, onSaved }: {
    promise: AdminPromiseDetail;
    today: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: (promise: AdminPromiseDetail) => void;
}) {
    const choices = STATUS_ORDER.filter((s) => s !== promise.status);
    const [status, setStatus] = useState<PromiseStatus>(choices[0]);
    const [happenedOn, setHappenedOn] = useState(today);
    const [body, setBody] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [archiveUrl, setArchiveUrl] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setErrors({});
        try {
            const res = await axios.post(`/api/v1/admin/promises/${promise.id}/status`, {
                status,
                happened_on: happenedOn,
                body: body || null,
                source_url: sourceUrl,
                archive_url: archiveUrl || null,
            });
            notify.success('تغيّرت حالة الوعد');
            onSaved(res.data.promise);
            onOpenChange(false);
        } catch (err) {
            setErrors(extractApiFieldErrors(err));
            notify.error(extractApiErrorMessage(err, 'تعذّر تغيير الحالة'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent dir="rtl" className="sm:max-w-lg">
                <form onSubmit={submit} className="space-y-4" noValidate>
                    <DialogHeader>
                        <DialogTitle>تغيير حالة الوعد</DialogTitle>
                        <DialogDescription>
                            الحالة الحالية: {STATE_META[promise.status].label}. يظهر التغيير في سجل الوعد العام مع مصدره.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="status-to">الحالة الجديدة</Label>
                            <Select value={status} onValueChange={(v) => setStatus(v as PromiseStatus)}>
                                <SelectTrigger id="status-to" {...fieldA11y('status-to-error', errors.status)}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {choices.map((s) => <SelectItem key={s} value={s}>{STATE_META[s].label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FieldError id="status-to-error" message={errors.status} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="status-date">تاريخ الحدث</Label>
                            <Input id="status-date" type="date" dir="ltr" max={today} value={happenedOn} onChange={(e) => setHappenedOn(e.target.value)} {...fieldA11y('status-date-error', errors.happened_on)} />
                            <FieldError id="status-date-error" message={errors.happened_on} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="status-body">التوضيح للقرّاء</Label>
                        <Textarea id="status-body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="ما الذي حدث، ولماذا تغيّرت الحالة؟" {...fieldA11y('status-body-error', errors.body)} />
                        <FieldError id="status-body-error" message={errors.body} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="status-source">رابط المصدر (مطلوب)</Label>
                        <Input id="status-source" type="url" dir="ltr" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} {...fieldA11y('status-source-error', errors.source_url)} />
                        <FieldError id="status-source-error" message={errors.source_url} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="status-archive">نسخة مؤرشفة</Label>
                        <Input id="status-archive" type="url" dir="ltr" value={archiveUrl} onChange={(e) => setArchiveUrl(e.target.value)} {...fieldA11y('status-archive-error', errors.archive_url)} />
                        <FieldError id="status-archive-error" message={errors.archive_url} />
                    </div>
                    <DialogFooter className="gap-2 sm:justify-start">
                        <Button type="submit" disabled={saving} className="gap-2">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}حفظ الحالة
                        </Button>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
