import { useState } from 'react';
import axios from '@/Lib/axios';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Textarea } from '@/Components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Loader2, Plus, Trash2, Undo2 } from 'lucide-react';
import { notify } from '@/Lib/notify';
import { confirmDialog } from '@/Lib/confirm';
import { extractApiErrorMessage, extractApiFieldErrors } from '@/Lib/apiError';
import FieldError, { fieldA11y } from '@/Components/ui/field-error';
import Timeline from '@/Domain/promises/Timeline';
import type { PromiseUpdateData } from '@/Domain/promises/types';
import type { AdminPromiseDetail } from '../_lib/types';

type EntryType = 'progress' | 'official_response' | 'note';

/**
 * The public change log of one promise, as readers see it, with editing
 * controls. Progress readings, official responses and notes are added and
 * removed here (promises.edit). Status changes come from the status dialog;
 * before the promise is ever published, its latest one can be undone
 * (promises.rule). After that the log is permanent.
 */
export default function UpdatesPanel({ promise, today, canEdit, canRule, onSaved }: {
    promise: AdminPromiseDetail;
    today: string;
    canEdit: boolean;
    canRule: boolean;
    onSaved: (promise: AdminPromiseDetail) => void;
}) {
    const [type, setType] = useState<EntryType>(promise.targetValue !== null ? 'progress' : 'note');
    const [happenedOn, setHappenedOn] = useState(today);
    const [value, setValue] = useState('');
    const [body, setBody] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [archiveUrl, setArchiveUrl] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const undoableStatusId = promise.publishedAt === null
        ? [...promise.updates].reverse().find((u) => u.type === 'status_change')?.id ?? null
        : null;

    const add = async () => {
        setSaving(true);
        setErrors({});
        try {
            const res = await axios.post(`/api/v1/admin/promises/${promise.id}/updates`, {
                type,
                happened_on: happenedOn,
                value: type === 'progress' && value !== '' ? Number(value) : null,
                body: body || null,
                source_url: sourceUrl || null,
                archive_url: archiveUrl || null,
            });
            onSaved(res.data.promise);
            setValue('');
            setBody('');
            setSourceUrl('');
            setArchiveUrl('');
            notify.success('أُضيف إلى السجل');
        } catch (err) {
            setErrors(extractApiFieldErrors(err));
            notify.error(extractApiErrorMessage(err, 'تعذّرت الإضافة'));
        } finally {
            setSaving(false);
        }
    };

    const remove = async (update: PromiseUpdateData) => {
        const undo = update.type === 'status_change';
        const ok = await confirmDialog(undo
            ? { title: 'التراجع عن تغيير الحالة هذا؟', description: 'تعود الحالة إلى ما كانت عليه قبله. هذا متاح فقط قبل نشر الوعد أول مرة.', confirmText: 'تراجع' }
            : { title: 'حذف هذا البند من السجل؟', destructive: true, confirmText: 'حذف' });
        if (!ok) return;
        try {
            const res = await axios.delete(undo
                ? `/api/v1/admin/promises/${promise.id}/status/${update.id}`
                : `/api/v1/admin/promises/${promise.id}/updates/${update.id}`);
            onSaved(res.data.promise);
        } catch (err) {
            notify.error(extractApiErrorMessage(err, 'تعذّر الحذف'));
        }
    };

    const actions = (u: PromiseUpdateData) => {
        if (u.type === 'status_change') {
            return canRule && u.id === undoableStatusId ? (
                <Button variant="ghost" size="icon" onClick={() => remove(u)} aria-label="التراجع عن تغيير الحالة">
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                </Button>
            ) : null;
        }
        return canEdit ? (
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove(u)} aria-label="حذف البند من السجل">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
        ) : null;
    };

    return (
        <div className="space-y-5">
            <Timeline
                statementDate={promise.statementDate}
                statementVenue={promise.statementVenue}
                updates={promise.updates}
                unit={promise.targetUnit}
                actions={actions}
            />

            {canEdit && (
                <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
                    <h3 className="text-sm font-semibold text-foreground">إضافة إلى السجل</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="update-type">النوع</Label>
                            <Select value={type} onValueChange={(v) => setType(v as EntryType)}>
                                <SelectTrigger id="update-type"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="progress">قراءة تقدّم</SelectItem>
                                    <SelectItem value="official_response">ردّ رسمي</SelectItem>
                                    <SelectItem value="note">ملاحظة</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="update-date">التاريخ</Label>
                            <Input id="update-date" type="date" dir="ltr" max={today} value={happenedOn} onChange={(e) => setHappenedOn(e.target.value)} {...fieldA11y('update-date-error', errors.happened_on)} />
                            <FieldError id="update-date-error" message={errors.happened_on} />
                        </div>
                        {type === 'progress' && (
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="update-value">القيمة المحققة{promise.targetUnit ? ` (${promise.targetUnit})` : ''}</Label>
                                <Input id="update-value" type="number" dir="ltr" value={value} onChange={(e) => setValue(e.target.value)} {...fieldA11y('update-value-error', errors.value)} />
                                <FieldError id="update-value-error" message={errors.value} />
                            </div>
                        )}
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="update-body">النص</Label>
                            <Textarea id="update-body" rows={2} value={body} onChange={(e) => setBody(e.target.value)} {...fieldA11y('update-body-error', errors.body)} />
                            <FieldError id="update-body-error" message={errors.body} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="update-source">رابط المصدر{type !== 'note' ? ' (مطلوب)' : ''}</Label>
                            <Input id="update-source" type="url" dir="ltr" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} {...fieldA11y('update-source-error', errors.source_url)} />
                            <FieldError id="update-source-error" message={errors.source_url} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="update-archive">نسخة مؤرشفة</Label>
                            <Input id="update-archive" type="url" dir="ltr" value={archiveUrl} onChange={(e) => setArchiveUrl(e.target.value)} {...fieldA11y('update-archive-error', errors.archive_url)} />
                            <FieldError id="update-archive-error" message={errors.archive_url} />
                        </div>
                    </div>
                    <Button type="button" variant="outline" disabled={saving} onClick={add} className="gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}إضافة
                    </Button>
                </div>
            )}
        </div>
    );
}
