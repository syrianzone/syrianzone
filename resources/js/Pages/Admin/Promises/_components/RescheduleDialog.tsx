import { useState } from 'react';
import axios from '@/Lib/axios';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Textarea } from '@/Components/ui/textarea';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/Components/ui/dialog';
import { CalendarClock, Loader2 } from 'lucide-react';
import { notify } from '@/Lib/notify';
import { extractApiErrorMessage, extractApiFieldErrors } from '@/Lib/apiError';
import FieldError, { fieldA11y } from '@/Components/ui/field-error';
import type { AdminPromiseDetail } from '../_lib/types';

interface Props {
    promise: AdminPromiseDetail;
    today: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved?: (promise: AdminPromiseDetail) => void;
}

export default function RescheduleDialog({ promise, today, open, onOpenChange, onSaved }: Props) {
    const [deadlineDate, setDeadlineDate] = useState(promise.deadlineDate ?? '');
    const [deadlineWording, setDeadlineWording] = useState(promise.deadlineWording ?? '');
    const [deadlineReasoning, setDeadlineReasoning] = useState(promise.deadlineReasoning ?? '');
    const [happenedOn, setHappenedOn] = useState(today);
    const [sourceUrl, setSourceUrl] = useState('');
    const [archiveUrl, setArchiveUrl] = useState('');
    const [body, setBody] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setErrors({});

        try {
            const res = await axios.post(`/api/v1/admin/promises/${promise.id}/reschedule`, {
                deadline_date: deadlineDate,
                deadline_wording: deadlineWording.trim() || null,
                deadline_reasoning: deadlineReasoning.trim() || null,
                happened_on: happenedOn,
                source_url: sourceUrl.trim(),
                archive_url: archiveUrl.trim() || null,
                body: body.trim() || null,
            });
            notify.success('تم تأجيل/تعديل الموعد وحفظ الموعد الأصلي');
            onSaved?.(res.data.promise);
            onOpenChange(false);
        } catch (err) {
            setErrors(extractApiFieldErrors(err));
            notify.error(extractApiErrorMessage(err, 'تعذّر تعديل الموعد'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent dir="rtl" className="sm:max-w-lg">
                <form onSubmit={submit} className="space-y-4" noValidate>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CalendarClock className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                            <span>تأجيل/تعديل الموعد (مع حفظ الموعد الأصلي)</span>
                        </DialogTitle>
                        <DialogDescription>
                            يتم تحديث الموعد الحالي للوعد وحفظ الموعد الأصلي وتاريخ الإعلان ومصدره في سجل الوعد.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="reschedule-deadline-date">الموعد الجديد (مطلوب)</Label>
                            <Input
                                id="reschedule-deadline-date"
                                type="date"
                                dir="ltr"
                                value={deadlineDate}
                                onChange={(e) => setDeadlineDate(e.target.value)}
                                required
                                {...fieldA11y('reschedule-deadline-date-error', errors.deadline_date)}
                            />
                            <FieldError id="reschedule-deadline-date-error" message={errors.deadline_date} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="reschedule-happened-on">تاريخ الإعلان (مطلوب)</Label>
                            <Input
                                id="reschedule-happened-on"
                                type="date"
                                dir="ltr"
                                max={today}
                                value={happenedOn}
                                onChange={(e) => setHappenedOn(e.target.value)}
                                required
                                {...fieldA11y('reschedule-happened-on-error', errors.happened_on)}
                            />
                            <FieldError id="reschedule-happened-on-error" message={errors.happened_on} />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="reschedule-deadline-wording">العبارة الجديدة (اختياري)</Label>
                        <Input
                            id="reschedule-deadline-wording"
                            value={deadlineWording}
                            onChange={(e) => setDeadlineWording(e.target.value)}
                            placeholder="مثال: بحلول نهاية العام"
                            {...fieldA11y('reschedule-deadline-wording-error', errors.deadline_wording)}
                        />
                        <FieldError id="reschedule-deadline-wording-error" message={errors.deadline_wording} />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="reschedule-deadline-reasoning">طريقة التحويل / التفسير (اختياري)</Label>
                        <Textarea
                            id="reschedule-deadline-reasoning"
                            rows={2}
                            value={deadlineReasoning}
                            onChange={(e) => setDeadlineReasoning(e.target.value)}
                            placeholder="كيف حُدِّد هذا الموعد؟"
                            {...fieldA11y('reschedule-deadline-reasoning-error', errors.deadline_reasoning)}
                        />
                        <FieldError id="reschedule-deadline-reasoning-error" message={errors.deadline_reasoning} />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="reschedule-source-url">رابط المصدر (مطلوب)</Label>
                        <Input
                            id="reschedule-source-url"
                            type="url"
                            dir="ltr"
                            value={sourceUrl}
                            onChange={(e) => setSourceUrl(e.target.value)}
                            required
                            placeholder="https://..."
                            {...fieldA11y('reschedule-source-url-error', errors.source_url)}
                        />
                        <FieldError id="reschedule-source-url-error" message={errors.source_url} />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="reschedule-archive-url">نسخة مؤرشفة (اختياري)</Label>
                        <Input
                            id="reschedule-archive-url"
                            type="url"
                            dir="ltr"
                            value={archiveUrl}
                            onChange={(e) => setArchiveUrl(e.target.value)}
                            placeholder="https://web.archive.org/..."
                            {...fieldA11y('reschedule-archive-url-error', errors.archive_url)}
                        />
                        <FieldError id="reschedule-archive-url-error" message={errors.archive_url} />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="reschedule-body">شرح / ملاحظة للقرّاء (اختياري)</Label>
                        <Textarea
                            id="reschedule-body"
                            rows={3}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="توضيح حول أسباب التأجيل والسياق"
                            {...fieldA11y('reschedule-body-error', errors.body)}
                        />
                        <FieldError id="reschedule-body-error" message={errors.body} />
                    </div>

                    <DialogFooter className="gap-2 sm:justify-start">
                        <Button type="submit" disabled={saving} className="gap-2">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                            حفظ وتأجيل الموعد
                        </Button>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            إلغاء
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
