import { useMemo, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import axios from '@/Lib/axios';
import MainLayout from '@/Layouts/MainLayout';
import { Alert, AlertDescription } from '@/Components/ui/alert';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/Components/ui/card';
import { FilterChip } from '@/Components/ui/filter-chip';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Switch } from '@/Components/ui/switch';
import { Textarea } from '@/Components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { ArrowRight, CalendarClock, ExternalLink, EyeOff, Gavel, Loader2, Save, Upload, X, XCircle } from 'lucide-react';
import { notify } from '@/Lib/notify';
import { confirmDialog } from '@/Lib/confirm';
import { extractApiErrorMessage, extractApiFieldErrors } from '@/Lib/apiError';
import FieldError, { fieldA11y } from '@/Pages/Promises/_components/FieldError';
import SpeakerPicker from '@/Pages/Promises/_components/SpeakerPicker';
import StateBadge from '@/Pages/Promises/_components/StateBadge';
import { VENUE_LABEL } from '@/Pages/Promises/_lib/status';
import type { SpeakerOption } from '@/Pages/Promises/_lib/types';
import AdminHeader from './_components/AdminHeader';
import RescheduleDialog from './_components/RescheduleDialog';
import SourcesEditor, { emptySource, sourceKey, type SourceForm } from './_components/SourcesEditor';
import StatusDialog from './_components/StatusDialog';
import UpdatesPanel from './_components/UpdatesPanel';
import { useCan } from './_lib/useCan';
import { ORIGIN_LABEL, REVIEW_STATUS_LABEL, type AdminPromiseDetail, type EditorOptions } from './_lib/types';

interface Props {
    promise: AdminPromiseDetail | null;
    options: EditorOptions;
    queueCount: number;
}

const NONE = '__none';

interface FormState {
    speaker: SpeakerOption | null;
    speakerTitle: string;
    institutionId: string;
    sectorId: string;
    title: string;
    summary: string;
    quote: string;
    quoteIsVerbatim: boolean;
    statementDate: string;
    statementVenue: string;
    deadlineWording: string;
    deadlineDate: string;
    deadlineReasoning: string;
    targetValue: string;
    targetUnit: string;
    baselineValue: string;
    baselineNote: string;
    isNational: boolean;
    governorates: string[];
    tags: string;
    restatesPromiseId: string;
    relatedPromiseIds: string[];
    sources: SourceForm[];
}

export function initialForm(p: AdminPromiseDetail | null): FormState {
    return {
        speaker: p?.speaker ?? null,
        speakerTitle: p?.speakerTitle ?? '',
        institutionId: p?.institutionId ?? NONE,
        sectorId: p?.sectorId ?? NONE,
        title: p?.title ?? '',
        summary: p?.summary ?? '',
        quote: p?.quote ?? '',
        quoteIsVerbatim: p?.quoteIsVerbatim ?? true,
        statementDate: p?.statementDate ?? '',
        statementVenue: p?.statementVenue ?? 'official_statement',
        deadlineWording: p?.deadlineWording ?? '',
        deadlineDate: p?.deadlineDate ?? '',
        deadlineReasoning: p?.deadlineReasoning ?? '',
        targetValue: p?.targetValue?.toString() ?? '',
        targetUnit: p?.targetUnit ?? '',
        baselineValue: p?.baselineValue?.toString() ?? '',
        baselineNote: p?.baselineNote ?? '',
        isNational: p?.isNational ?? true,
        governorates: p?.governorates ?? [],
        tags: (p?.tags ?? []).join('، '),
        restatesPromiseId: p?.restatesPromiseId ?? NONE,
        relatedPromiseIds: p?.relatedPromiseIds ?? [],
        sources: p && p.sources.length > 0
            ? p.sources.map((s) => ({
                key: sourceKey(),
                url: s.url,
                outlet: s.outlet ?? '',
                type: s.type,
                publishedDate: s.publishedDate ?? '',
                language: s.language ?? 'ar',
                archiveUrl: s.archiveUrl ?? '',
                screenshotUrl: s.screenshotUrl ?? '',
                videoTimestamp: s.videoTimestamp ?? '',
                isPrimary: s.isPrimary,
            }))
            : [{ ...emptySource(), isPrimary: true }],
    };
}

export const toForm = initialForm;

/** Form content without client-only keys, for "has anything changed?". */
const fingerprint = (f: FormState) => JSON.stringify({ ...f, sources: f.sources.map(({ key: _key, ...rest }) => rest) });

const orNull = (v: string) => (v.trim() === '' ? null : v.trim());
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

export function toPayload(form: FormState) {
    return {
        speaker_ref: form.speaker?.ref ?? '',
        speaker_title: orNull(form.speakerTitle),
        institution_id: form.institutionId === NONE ? null : form.institutionId,
        sector_id: form.sectorId === NONE ? null : form.sectorId,
        title: form.title.trim(),
        summary: orNull(form.summary),
        quote: form.quote.trim(),
        quote_is_verbatim: form.quoteIsVerbatim,
        statement_date: form.statementDate,
        statement_venue: form.statementVenue,
        deadline_wording: orNull(form.deadlineWording),
        deadline_date: orNull(form.deadlineDate),
        deadline_reasoning: orNull(form.deadlineReasoning),
        target_value: numOrNull(form.targetValue),
        target_unit: orNull(form.targetUnit),
        baseline_value: numOrNull(form.baselineValue),
        baseline_note: orNull(form.baselineNote),
        is_national: form.isNational,
        governorates: form.isNational ? [] : form.governorates,
        tags: form.tags.split(/[،,]/).map((t) => t.trim()).filter(Boolean),
        restates_promise_id: form.restatesPromiseId === NONE ? null : form.restatesPromiseId,
        related_promise_ids: form.relatedPromiseIds,
        sources: form.sources.map((s) => ({
            url: s.url.trim(),
            outlet: orNull(s.outlet),
            type: s.type,
            published_date: orNull(s.publishedDate),
            language: s.language || null,
            archive_url: orNull(s.archiveUrl),
            screenshot_url: orNull(s.screenshotUrl),
            video_timestamp: orNull(s.videoTimestamp),
            is_primary: s.isPrimary,
        })),
    };
}

export default function PromiseEditor({ promise: initial, options, queueCount }: Props) {
    const can = useCan();
    const canCreate = can('promises.create');
    const canEdit = can('promises.edit');
    const canRule = can('promises.rule');
    const canReview = can('promises.review');
    const canSave = initial ? canEdit : canCreate;

    const [promise, setPromise] = useState<AdminPromiseDetail | null>(initial);
    const [form, setForm] = useState<FormState>(() => toForm(initial));
    const [saved, setSaved] = useState(() => fingerprint(toForm(initial)));
    // The version the form's fields were loaded at. Log, status and unpublish
    // responses refresh `promise` but not the form, so saving must send this,
    // not promise.version, or a stale form would pass the server's check.
    const [formVersion, setFormVersion] = useState(initial?.version ?? 0);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [statusOpen, setStatusOpen] = useState(false);
    const [rescheduleOpen, setRescheduleOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const dirty = useMemo(() => fingerprint(form) !== saved, [form, saved]);

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

    /** Take a promise returned by the server as both the record and the form. */
    const adopt = (next: AdminPromiseDetail) => {
        const nextForm = toForm(next);
        setPromise(next);
        setForm(nextForm);
        setSaved(fingerprint(nextForm));
        setFormVersion(next.version);
    };

    const restatableList = options.restatablePromises ?? options.restatable ?? [];

    const toggleGovernorate = (id: string) =>
        set('governorates', form.governorates.includes(id) ? form.governorates.filter((g) => g !== id) : [...form.governorates, id]);

    const payload = () => toPayload(form);

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setErrors({});
        try {
            if (promise) {
                const res = await axios.put(`/api/v1/admin/promises/${promise.id}`, { ...payload(), version: formVersion });
                adopt(res.data.promise);
                notify.success('حُفظت التعديلات');
            } else {
                const res = await axios.post('/api/v1/admin/promises', payload());
                notify.success('أُضيف الوعد، وهو بانتظار النشر');
                router.visit(`/admin/promises/${res.data.promise.id}/edit`);
            }
        } catch (err) {
            setErrors(extractApiFieldErrors(err));
            notify.error(extractApiErrorMessage(err, 'تعذّر الحفظ'));
        } finally {
            setSaving(false);
        }
    };

    const moderate = async (action: 'publish' | 'unpublish' | 'reject') => {
        if (!promise) return;
        if (action === 'reject') {
            const ok = await confirmDialog({ title: 'رفض هذا الوعد؟', description: 'لن يُنشر، ويبقى في القائمة بحالة «مرفوض».', destructive: true, confirmText: 'رفض' });
            if (!ok) return;
        }
        if (action === 'unpublish') {
            const ok = await confirmDialog({ title: 'إخفاء الوعد من الصفحة العامة؟', description: 'يحتفظ الوعد برقمه ويمكن نشره من جديد.', confirmText: 'إخفاء' });
            if (!ok) return;
        }
        setBusy(true);
        try {
            const res = await axios.post(`/api/v1/admin/promises/${promise.id}/${action}`);
            // Publish and reject are only offered with no unsaved edits, so the
            // form can follow the server; unpublishing must not discard edits.
            if (action === 'unpublish') setPromise(res.data.promise);
            else adopt(res.data.promise);
            notify.success(action === 'publish' ? 'نُشر الوعد' : action === 'unpublish' ? 'أُخفي الوعد' : 'رُفض الوعد');
        } catch (err) {
            notify.error(extractApiErrorMessage(err, 'تعذّر تنفيذ العملية'));
        } finally {
            setBusy(false);
        }
    };

    const errorList = Object.values(errors);

    return (
        <MainLayout>
            <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8" dir="rtl">
                <AdminHeader
                    title={promise ? (promise.number ? `الوعد رقم ${promise.number}` : 'وعد غير منشور') : 'إضافة وعد'}
                    current="promises"
                    queueCount={queueCount}
                    actions={
                        <Button asChild variant="ghost" className="gap-1">
                            <Link href="/admin/promises"><ArrowRight className="h-4 w-4" aria-hidden="true" />كل الوعود</Link>
                        </Button>
                    }
                />

                {errorList.length > 0 && (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription>
                            <p className="font-semibold">راجع الحقول التالية:</p>
                            <ul className="mt-1 list-disc ps-5">{errorList.slice(0, 8).map((m, i) => <li key={i}>{m}</li>)}</ul>
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <form onSubmit={save} className="space-y-6" noValidate>
                        <fieldset disabled={!canSave} className="space-y-6">
                            <Card>
                                <CardHeader><h2 className="text-base font-semibold leading-none">صاحب الوعد والجهة</h2></CardHeader>
                                <CardContent className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-1.5 md:col-span-2">
                                        <Label htmlFor="speaker_ref">المسؤول</Label>
                                        <SpeakerPicker
                                            id="speaker_ref"
                                            endpoint="/api/v1/admin/promises/speakers/search"
                                            value={form.speaker}
                                            onChange={(s) => setForm((f) => ({ ...f, speaker: s, speakerTitle: f.speakerTitle || s.title || '' }))}
                                            invalid={!!errors.speaker_ref}
                                            describedBy={errors.speaker_ref ? 'speaker_ref-error' : undefined}
                                        />
                                        <FieldError id="speaker_ref-error" message={errors.speaker_ref} />
                                        {form.speaker?.pending && <p className="text-xs text-muted-foreground">هذا الشخص مقترح من الزوار وسيُعتمد عند نشر الوعد.</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="speaker_title">منصبه وقت التصريح</Label>
                                        <Input id="speaker_title" value={form.speakerTitle} onChange={(e) => set('speakerTitle', e.target.value)} {...fieldA11y('speaker_title-error', errors.speaker_title)} />
                                        <FieldError id="speaker_title-error" message={errors.speaker_title} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="institution_id">الجهة المسؤولة</Label>
                                        <Select value={form.institutionId} onValueChange={(v) => set('institutionId', v)}>
                                            <SelectTrigger id="institution_id" {...fieldA11y('institution_id-error', errors.institution_id)}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NONE}>— بلا جهة —</SelectItem>
                                                {options.institutions.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FieldError id="institution_id-error" message={errors.institution_id} />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader><h2 className="text-base font-semibold leading-none">الوعد</h2></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="title">العنوان</Label>
                                        <Input id="title" value={form.title} maxLength={200} onChange={(e) => set('title', e.target.value)} {...fieldA11y('title-error', errors.title)} />
                                        <FieldError id="title-error" message={errors.title} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="quote">نص الوعد كما قيل</Label>
                                        <Textarea id="quote" rows={4} value={form.quote} onChange={(e) => set('quote', e.target.value)} {...fieldA11y('quote-error', errors.quote)} />
                                        <FieldError id="quote-error" message={errors.quote} />
                                        <div className="flex items-center gap-2 pt-1">
                                            <Switch id="quote_is_verbatim" checked={form.quoteIsVerbatim} onCheckedChange={(v) => set('quoteIsVerbatim', v)} />
                                            <Label htmlFor="quote_is_verbatim" className="font-normal">اقتباس حرفي (أوقفه إن كان النص بتصرّف)</Label>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="summary">السياق (يظهر تحت الاقتباس)</Label>
                                        <Textarea id="summary" rows={3} value={form.summary} onChange={(e) => set('summary', e.target.value)} {...fieldA11y('summary-error', errors.summary)} />
                                        <FieldError id="summary-error" message={errors.summary} />
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="statement_date">تاريخ التصريح</Label>
                                            <Input id="statement_date" type="date" dir="ltr" min={options.earliestDate} max={options.today} value={form.statementDate} onChange={(e) => set('statementDate', e.target.value)} {...fieldA11y('statement_date-error', errors.statement_date)} />
                                            <FieldError id="statement_date-error" message={errors.statement_date} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="statement_venue">مكان التصريح</Label>
                                            <Select value={form.statementVenue} onValueChange={(v) => set('statementVenue', v)}>
                                                <SelectTrigger id="statement_venue"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {options.venues.map((v) => <SelectItem key={v} value={v}>{VENUE_LABEL[v] ?? v}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="sector_id">القطاع</Label>
                                            <Select value={form.sectorId} onValueChange={(v) => set('sectorId', v)}>
                                                <SelectTrigger id="sector_id"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value={NONE}>— بلا قطاع —</SelectItem>
                                                    {options.sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <h2 className="text-base font-semibold leading-none">الموعد</h2>
                                    <CardDescription>اكتب العبارة كما قالها، ثم التاريخ الذي يعتمده العداد وكيف وصلت إليه. اترك التاريخ فارغاً إن لم يذكر موعداً.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="deadline_wording">العبارة الأصلية</Label>
                                        <Input id="deadline_wording" value={form.deadlineWording} onChange={(e) => set('deadlineWording', e.target.value)} placeholder="مثال: قبل الصيف" {...fieldA11y('deadline_wording-error', errors.deadline_wording)} />
                                        <FieldError id="deadline_wording-error" message={errors.deadline_wording} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="deadline_date">التاريخ المعتمد</Label>
                                        <Input id="deadline_date" type="date" dir="ltr" value={form.deadlineDate} onChange={(e) => set('deadlineDate', e.target.value)} {...fieldA11y('deadline_date-error', errors.deadline_date)} />
                                        <FieldError id="deadline_date-error" message={errors.deadline_date} />
                                    </div>
                                    <div className="space-y-1.5 md:col-span-2">
                                        <Label htmlFor="deadline_reasoning">طريقة التحويل (تظهر للقرّاء)</Label>
                                        <Textarea id="deadline_reasoning" rows={2} value={form.deadlineReasoning} onChange={(e) => set('deadlineReasoning', e.target.value)} placeholder="مثال: اعتمدنا نهاية آب بوصفها نهاية فصل الصيف." {...fieldA11y('deadline_reasoning-error', errors.deadline_reasoning)} />
                                        <FieldError id="deadline_reasoning-error" message={errors.deadline_reasoning} />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <h2 className="text-base font-semibold leading-none">الهدف القابل للقياس (اختياري)</h2>
                                    <CardDescription>مثل ساعات الكهرباء أو عدد الوحدات السكنية. يُحسب التقدم من قراءات السجل.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-4 md:grid-cols-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="target_value">القيمة الموعودة</Label>
                                        <Input id="target_value" type="number" dir="ltr" value={form.targetValue} onChange={(e) => set('targetValue', e.target.value)} {...fieldA11y('target_value-error', errors.target_value)} />
                                        <FieldError id="target_value-error" message={errors.target_value} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="target_unit">الوحدة</Label>
                                        <Input id="target_unit" value={form.targetUnit} onChange={(e) => set('targetUnit', e.target.value)} placeholder="ساعة يومياً" {...fieldA11y('target_unit-error', errors.target_unit)} />
                                        <FieldError id="target_unit-error" message={errors.target_unit} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="baseline_value">نقطة البداية</Label>
                                        <Input id="baseline_value" type="number" dir="ltr" value={form.baselineValue} onChange={(e) => set('baselineValue', e.target.value)} {...fieldA11y('baseline_value-error', errors.baseline_value)} />
                                        <FieldError id="baseline_value-error" message={errors.baseline_value} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="baseline_note">ملاحظة البداية</Label>
                                        <Input id="baseline_note" value={form.baselineNote} onChange={(e) => set('baselineNote', e.target.value)} {...fieldA11y('baseline_note-error', errors.baseline_note)} />
                                        <FieldError id="baseline_note-error" message={errors.baseline_note} />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader><h2 className="text-base font-semibold leading-none">النطاق والوسوم</h2></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <Switch id="is_national" checked={form.isNational} onCheckedChange={(v) => set('isNational', v)} />
                                        <Label htmlFor="is_national" className="font-normal">على مستوى البلاد</Label>
                                    </div>
                                    {!form.isNational && (
                                        <div className="flex flex-wrap gap-2" role="group" aria-label="المحافظات المعنية">
                                            {options.governorates.map((g) => (
                                                <FilterChip key={g.id} active={form.governorates.includes(g.id)} onClick={() => toggleGovernorate(g.id)}>{g.label}</FilterChip>
                                            ))}
                                        </div>
                                    )}
                                    <div className="space-y-1.5">
                                        <Label htmlFor="tags">الوسوم (افصل بينها بفاصلة)</Label>
                                        <Input id="tags" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="إعادة الإعمار، الغاز" {...fieldA11y('tags-error', errors.tags)} />
                                        <FieldError id="tags-error" message={errors.tags} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="restates_promise_id">إعادة لوعد سابق بموعد جديد؟</Label>
                                        <Select value={form.restatesPromiseId} onValueChange={(v) => set('restatesPromiseId', v)}>
                                            <SelectTrigger id="restates_promise_id" {...fieldA11y('restates_promise_id-error', errors.restates_promise_id)}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NONE}>— لا —</SelectItem>
                                                {restatableList.map((r) => <SelectItem key={r.id} value={r.id}>#{r.number} — {r.title}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FieldError id="restates_promise_id-error" message={errors.restates_promise_id} />
                                        <p className="text-xs text-muted-foreground">يُعلَّم الوعد الأصلي «أُجّل» مع رابط إلى هذا الوعد حين يُنشر هذا الوعد أو يُربط بعد نشره، إن كان لمن يفعل ذلك صلاحية الحكم على الوعود.</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="related_promise_select">وعود مرتبطة بهذا الملف</Label>
                                        {form.relatedPromiseIds.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pb-1" role="list" aria-label="الوعود المرتبطة المختارة">
                                                {form.relatedPromiseIds.map((id) => {
                                                    const r = restatableList.find((item) => item.id === id);
                                                    return (
                                                        <Badge key={id} variant="secondary" className="flex items-center gap-1.5 py-1 pe-1.5 ps-2.5 text-xs font-normal">
                                                            <span>{r ? `#{r.number} — ${r.title}` : `#${id}`}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => set('relatedPromiseIds', form.relatedPromiseIds.filter((item) => item !== id))}
                                                                className="rounded-full p-0.5 hover:bg-muted-foreground/20 focus:outline-none focus:ring-1 focus:ring-ring"
                                                                aria-label={`إزالة الوعد ${r ? `#${r.number}` : id}`}
                                                            >
                                                                <X className="h-3 w-3" aria-hidden="true" />
                                                            </button>
                                                        </Badge>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        <Select
                                            value={NONE}
                                            onValueChange={(val) => {
                                                if (val && val !== NONE && !form.relatedPromiseIds.includes(val)) {
                                                    set('relatedPromiseIds', [...form.relatedPromiseIds, val]);
                                                }
                                            }}
                                        >
                                            <SelectTrigger id="related_promise_select">
                                                <SelectValue placeholder="— اختر وعداً لإضافته —" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NONE} disabled>— اختر وعداً لإضافته —</SelectItem>
                                                {restatableList
                                                    .filter((r) => !form.relatedPromiseIds.includes(r.id))
                                                    .map((r) => (
                                                        <SelectItem key={r.id} value={r.id}>
                                                            #{r.number} — {r.title}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">تظهر هذه الوعود في قسم «وعود مرتبطة بهذا الملف» في صفحة العرض العامة.</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <h2 className="text-base font-semibold leading-none">المصادر</h2>
                                    <CardDescription>إن نقلت عدة مواقع التصريح نفسه في أيام مختلفة، أضفها كلها هنا. تاريخ التصريح أعلاه هو يوم قوله فعلاً.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <SourcesEditor
                                        sources={form.sources}
                                        onChange={(update) => setForm((f) => ({ ...f, sources: update(f.sources) }))}
                                        sourceTypes={options.sourceTypes}
                                        errors={errors}
                                    />
                                    <FieldError id="sources-error" message={errors.sources} />
                                </CardContent>
                            </Card>
                        </fieldset>

                        {canSave && (
                            <div className="sticky bottom-4 z-10 flex justify-end">
                                <Button type="submit" size="lg" disabled={saving || (!!promise && !dirty)} className="gap-2 shadow-lg">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                                    {promise ? 'حفظ التعديلات' : 'إضافة الوعد'}
                                </Button>
                            </div>
                        )}
                    </form>

                    {promise && (
                        <aside className="space-y-6" aria-label="النشر والحالة والسجل">
                            <Card>
                                <CardHeader className="pb-3"><h2 className="text-base font-semibold leading-none">النشر</h2></CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={promise.reviewStatus === 'published' ? 'secondary' : 'outline'}>{REVIEW_STATUS_LABEL[promise.reviewStatus]}</Badge>
                                        <Badge variant="outline">{ORIGIN_LABEL[promise.origin] ?? promise.origin}</Badge>
                                    </div>
                                    {promise.submitterName && <p className="text-muted-foreground">اقترحه: {promise.submitterName}</p>}
                                    {promise.submitterNote && <p className="whitespace-pre-line rounded-md bg-muted p-2 text-muted-foreground">{promise.submitterNote}</p>}
                                    {promise.rejectionReason && <p className="text-destructive">سبب الرفض: {promise.rejectionReason}</p>}
                                    {promise.reviewStatus === 'published' && promise.number && (
                                        <a href={`/promises/${promise.number}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />عرض في الصفحة العامة
                                        </a>
                                    )}
                                    {canReview && (
                                        <>
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {promise.reviewStatus !== 'published' && (
                                                    <Button size="sm" disabled={busy || dirty} onClick={() => moderate('publish')} className="gap-1">
                                                        <Upload className="h-4 w-4" aria-hidden="true" />نشر
                                                    </Button>
                                                )}
                                                {promise.reviewStatus === 'pending' && (
                                                    <Button size="sm" variant="outline" disabled={busy || dirty} onClick={() => moderate('reject')} className="gap-1">
                                                        <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />رفض
                                                    </Button>
                                                )}
                                                {promise.reviewStatus === 'published' && (
                                                    <Button size="sm" variant="outline" disabled={busy} onClick={() => moderate('unpublish')} className="gap-1">
                                                        <EyeOff className="h-4 w-4" aria-hidden="true" />إخفاء
                                                    </Button>
                                                )}
                                            </div>
                                            {dirty && promise.reviewStatus !== 'published' && (
                                                <p className="text-xs text-muted-foreground">احفظ التعديلات أولاً، فالنشر يعتمد آخر نسخة محفوظة.</p>
                                            )}
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3"><h2 className="text-base font-semibold leading-none">الحالة</h2></CardHeader>
                                <CardContent className="space-y-3">
                                    <StateBadge state={promise.state} />
                                    {canRule && (
                                        <div className="space-y-2">
                                            <Button variant="outline" className="w-full gap-2" onClick={() => setStatusOpen(true)}>
                                                <Gavel className="h-4 w-4" aria-hidden="true" />تغيير الحالة
                                            </Button>
                                            <Button variant="outline" className="w-full gap-2" onClick={() => setRescheduleOpen(true)}>
                                                <CalendarClock className="h-4 w-4" aria-hidden="true" />تأجيل/تعديل الموعد (مع حفظ الموعد الأصلي)
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3"><h2 className="text-base font-semibold leading-none">سجل الوعد</h2></CardHeader>
                                <CardContent>
                                    <UpdatesPanel promise={promise} today={options.today} canEdit={canEdit} canRule={canRule} onSaved={setPromise} />
                                </CardContent>
                            </Card>
                        </aside>
                    )}
                </div>
            </div>

            {promise && canRule && (
                <>
                    <StatusDialog
                        key={`${promise.status}-${promise.updates.length}`}
                        promise={promise}
                        today={options.today}
                        open={statusOpen}
                        onOpenChange={setStatusOpen}
                        onSaved={setPromise}
                    />
                    <RescheduleDialog
                        key={`reschedule-${promise.deadlineDate}-${promise.postponedCount ?? 0}`}
                        promise={promise}
                        today={options.today}
                        open={rescheduleOpen}
                        onOpenChange={setRescheduleOpen}
                        onSaved={adopt}
                    />
                </>
            )}
        </MainLayout>
    );
}
