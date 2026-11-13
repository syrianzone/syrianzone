import { promisesApi } from '@/Domain/promises/api';
import { useEffect, useRef, useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Textarea } from '@/Components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { ArrowRight, CheckCircle2, Loader2, LogIn, Plus, Trash2 } from 'lucide-react';
import { notify } from '@/Lib/notify';
import { apiErrorMessage, apiFieldErrors } from '@/Lib/api';
import FieldError, { fieldA11y } from '@/Components/ui/field-error';
import SpeakerPicker from '@/Domain/promises/SpeakerPicker';
import { VENUE_LABEL } from '@/Domain/promises/status';
import type { SpeakerOption } from '@/Domain/promises/types';

interface Props {
    venues: string[];
    earliestDate: string;
    today: string;
}

const MAX_SOURCES = 5;

interface FormState {
    speaker: SpeakerOption | null;
    newSpeaker: boolean;
    speakerName: string;
    speakerTitle: string;
    title: string;
    quote: string;
    statementDate: string;
    venue: string;
    deadlineWording: string;
    sources: string[];
    note: string;
}

const emptyForm = (): FormState => ({
    speaker: null,
    newSpeaker: false,
    speakerName: '',
    speakerTitle: '',
    title: '',
    quote: '',
    statementDate: '',
    venue: 'other',
    deadlineWording: '',
    sources: [''],
    note: '',
});

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <h2 className="text-base font-semibold leading-none text-foreground">{children}</h2>;
}

export default function PromisesSuggest({ venues, earliestDate, today }: Props) {
    const { auth } = usePage().props as { auth?: { user?: { id: number } | null } };
    const user = auth?.user ?? null;

    const [form, setForm] = useState<FormState>(emptyForm);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);
    const doneRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    // Bumped only when a submit fails, so the effect below runs after the errors
    // are in the DOM — never on an ordinary re-render or while the user types.
    const [failedSubmit, setFailedSubmit] = useState(0);

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
    const sourceError = (i: number) => errors[`source_urls.${i}`];

    // Move focus to the confirmation so keyboard and screen-reader users land
    // on it instead of on <body> when the submitted form unmounts.
    useEffect(() => {
        if (done) doneRef.current?.focus();
    }, [done]);

    // After a failed submit, land on the first control marked invalid instead
    // of leaving focus on the submit button.
    useEffect(() => {
        if (!failedSubmit) return;
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }, [failedSubmit]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setErrors({});
        try {
            await promisesApi.suggest({
                speaker_ref: form.newSpeaker ? null : form.speaker?.ref ?? null,
                speaker_name: form.newSpeaker ? form.speakerName : null,
                speaker_title: form.newSpeaker ? form.speakerTitle || null : null,
                title: form.title,
                quote: form.quote,
                statement_date: form.statementDate,
                statement_venue: form.venue,
                deadline_wording: form.deadlineWording || null,
                source_urls: form.sources.map((s) => s.trim()).filter(Boolean),
                note: form.note || null,
            });
            setDone(true);
        } catch (err) {
            setErrors(apiFieldErrors(err));
            setFailedSubmit((n) => n + 1);
            notify.error(apiErrorMessage(err, 'تعذّر إرسال الاقتراح'));
        } finally {
            setSaving(false);
        }
    };

    const startOver = () => {
        setForm(emptyForm());
        setErrors({});
        setDone(false);
    };

    return (
        <MainLayout>
            <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
                <nav aria-label="مسار التنقل">
                    <Link href="/promises" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />عداد الوعود
                    </Link>
                </nav>

                <header className="space-y-2">
                    <h1 className="text-2xl font-black text-foreground md:text-3xl">اقترح وعداً</h1>
                    <p className="leading-relaxed text-muted-foreground">
                        سمعت مسؤولاً يعد بشيء علناً منذ 8 كانون الأول 2024؟ أرسله مع رابط المصدر، وسيتحقق منه المحررون قبل إضافته إلى العداد.
                    </p>
                </header>

                {!user ? (
                    <Card>
                        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
                            <p className="text-foreground">سجّل الدخول لإرسال اقتراح، حتى نتمكن من التواصل معك إن احتجنا إلى توضيح.</p>
                            <Button asChild className="gap-2">
                                <a href={`/auth/google?redirect=${encodeURIComponent('/promises/suggest')}`}>
                                    <LogIn className="h-4 w-4" aria-hidden="true" />تسجيل الدخول بحساب Google
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                ) : done ? (
                    <Card>
                        <CardContent
                            ref={doneRef}
                            tabIndex={-1}
                            role="status"
                            className="flex flex-col items-center gap-4 py-10 text-center focus:outline-none"
                        >
                            <CheckCircle2 className="h-12 w-12 text-primary" aria-hidden="true" />
                            <p className="text-lg font-bold text-foreground">شكراً لك، وصل اقتراحك</p>
                            <p className="text-muted-foreground">سيراجعه المحررون ويتحققون من مصدره قبل نشره.</p>
                            <div className="flex flex-wrap justify-center gap-2">
                                <Button asChild variant="outline"><Link href="/promises">العودة إلى العداد</Link></Button>
                                <Button onClick={startOver}>اقتراح وعد آخر</Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <form ref={formRef} onSubmit={submit} className="space-y-6" noValidate>
                        <Card>
                            <CardHeader>
                                <SectionTitle>من قطع الوعد؟</SectionTitle>
                                <CardDescription>ابحث في قائمة المسؤولين، أو أضف الاسم إن لم تجده.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {!form.newSpeaker ? (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="speaker">المسؤول</Label>
                                        <SpeakerPicker
                                            id="speaker"
                                            endpoint="/api/v1/promises/speakers"
                                            value={form.speaker}
                                            onChange={(s) => set('speaker', s)}
                                            invalid={!!errors.speaker_ref}
                                            describedBy={errors.speaker_ref ? 'speaker-error' : undefined}
                                        />
                                        <FieldError id="speaker-error" message={errors.speaker_ref} />
                                    </div>
                                ) : (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="speaker-name">الاسم</Label>
                                            <Input id="speaker-name" value={form.speakerName} onChange={(e) => set('speakerName', e.target.value)} {...fieldA11y('speaker-name-error', errors.speaker_name)} />
                                            <FieldError id="speaker-name-error" message={errors.speaker_name} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="speaker-title">المنصب وقت التصريح</Label>
                                            <Input id="speaker-title" value={form.speakerTitle} onChange={(e) => set('speakerTitle', e.target.value)} placeholder="مثال: وزير الطاقة" {...fieldA11y('speaker-title-error', errors.speaker_title)} />
                                            <FieldError id="speaker-title-error" message={errors.speaker_title} />
                                        </div>
                                    </div>
                                )}
                                <Button type="button" variant="link" className="h-auto p-0" onClick={() => set('newSpeaker', !form.newSpeaker)}>
                                    {form.newSpeaker ? 'العودة إلى البحث في القائمة' : 'لم أجده في القائمة'}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <SectionTitle>الوعد</SectionTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="title">عنوان مختصر</Label>
                                    <Input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={200} placeholder="مثال: 12 ساعة كهرباء يومياً قبل الصيف" {...fieldA11y('title-error', errors.title)} />
                                    <FieldError id="title-error" message={errors.title} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="quote">ماذا قال بالضبط؟</Label>
                                    <Textarea id="quote" value={form.quote} onChange={(e) => set('quote', e.target.value)} rows={4} maxLength={5000} {...fieldA11y('quote-error', errors.quote)} />
                                    <FieldError id="quote-error" message={errors.quote} />
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="statement-date">متى قاله؟</Label>
                                        <Input id="statement-date" type="date" dir="ltr" min={earliestDate} max={today} value={form.statementDate} onChange={(e) => set('statementDate', e.target.value)} {...fieldA11y('statement-date-error', errors.statement_date)} />
                                        <FieldError id="statement-date-error" message={errors.statement_date} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="venue">أين قاله؟</Label>
                                        <Select value={form.venue} onValueChange={(v) => set('venue', v)}>
                                            <SelectTrigger id="venue" {...fieldA11y('venue-error', errors.statement_venue)}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {venues.map((v) => <SelectItem key={v} value={v}>{VENUE_LABEL[v] ?? v}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FieldError id="venue-error" message={errors.statement_venue} />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="deadline">الموعد كما ذكره (إن وُجد)</Label>
                                    <Input id="deadline" value={form.deadlineWording} onChange={(e) => set('deadlineWording', e.target.value)} placeholder="مثال: قبل نهاية العام، خلال ثلاثة أشهر" {...fieldA11y('deadline-error', errors.deadline_wording)} />
                                    <FieldError id="deadline-error" message={errors.deadline_wording} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <SectionTitle>المصادر</SectionTitle>
                                <CardDescription>رابط المنشور أو المقابلة أو الخبر. كلما زادت المصادر كان التحقق أسرع.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {form.sources.map((s, i) => (
                                    <div key={i} className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="url"
                                                dir="ltr"
                                                inputMode="url"
                                                placeholder="https://"
                                                value={s}
                                                onChange={(e) => set('sources', form.sources.map((v, j) => (j === i ? e.target.value : v)))}
                                                aria-label={`رابط المصدر ${i + 1}`}
                                                {...fieldA11y(`source-${i}-error`, sourceError(i) ?? (i === 0 ? errors.source_urls : undefined))}
                                            />
                                            {form.sources.length > 1 && (
                                                <Button type="button" variant="ghost" size="icon" aria-label={`حذف المصدر ${i + 1}`} onClick={() => set('sources', form.sources.filter((_, j) => j !== i))}>
                                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                </Button>
                                            )}
                                        </div>
                                        <FieldError id={`source-${i}-error`} message={sourceError(i) ?? (i === 0 ? errors.source_urls : undefined)} />
                                    </div>
                                ))}
                                {form.sources.length < MAX_SOURCES && (
                                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => set('sources', [...form.sources, ''])}>
                                        <Plus className="h-4 w-4" aria-hidden="true" />مصدر آخر
                                    </Button>
                                )}
                                <div className="space-y-1.5 pt-2">
                                    <Label htmlFor="note">ملاحظات للمحررين (اختياري)</Label>
                                    <Textarea id="note" value={form.note} onChange={(e) => set('note', e.target.value)} rows={2} maxLength={2000} {...fieldA11y('note-error', errors.note)} />
                                    <FieldError id="note-error" message={errors.note} />
                                </div>
                            </CardContent>
                        </Card>

                        <Button type="submit" size="lg" disabled={saving} className="w-full gap-2 sm:w-auto">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}إرسال الاقتراح
                        </Button>
                    </form>
                )}
            </div>
        </MainLayout>
    );
}
