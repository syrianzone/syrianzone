import { promisesApi } from '@/Domain/promises/api';
import { useRef, useState } from 'react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { ImageUp, Loader2, Plus, Star, Trash2 } from 'lucide-react';
import { notify } from '@/Lib/notify';
import { apiErrorMessage } from '@/Lib/api';
import FieldError, { fieldA11y } from '@/Components/ui/field-error';
import { SOURCE_TYPE_LABEL } from '@/Domain/promises/status';

export interface SourceForm {
    /** Client-only identity for React keys and upload tracking; never sent. */
    key: string;
    url: string;
    outlet: string;
    type: string;
    publishedDate: string;
    language: string;
    archiveUrl: string;
    screenshotUrl: string;
    videoTimestamp: string;
    isPrimary: boolean;
}

let nextKey = 0;
export const sourceKey = () => `source-${++nextKey}`;

export const emptySource = (): SourceForm => ({
    key: sourceKey(), url: '', outlet: '', type: 'news_article', publishedDate: '', language: 'ar',
    archiveUrl: '', screenshotUrl: '', videoTimestamp: '', isPrimary: false,
});

type SourcesUpdater = (sources: SourceForm[]) => SourceForm[];

/**
 * One statement reported by several outlets is one promise with several
 * sources, each with its own publish date. The primary source is the one
 * closest to the speaker (their own post, the interview video).
 *
 * Changes go through a functional updater so a slow upload can never
 * overwrite edits made to other sources while it was in flight.
 */
export default function SourcesEditor({ sources, onChange, sourceTypes, errors }: {
    sources: SourceForm[];
    onChange: (update: SourcesUpdater) => void;
    sourceTypes: string[];
    errors: Record<string, string>;
}) {
    const [uploading, setUploading] = useState<string | null>(null);
    const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const update = (key: string, patch: Partial<SourceForm>) =>
        onChange((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));

    const makePrimary = (key: string) => onChange((list) => list.map((s) => ({ ...s, isPrimary: s.key === key })));

    const upload = async (key: string, file: File) => {
        setUploading(key);
        try {
            const fd = new FormData();
            fd.append('image', file);
            fd.append('kind', 'source');
            const res = await promisesApi.uploadImage(file, 'source');
            update(key, { screenshotUrl: res.url });
        } catch (e) {
            notify.error(apiErrorMessage(e, 'تعذّر رفع لقطة الشاشة'));
        } finally {
            setUploading(null);
            const input = fileRefs.current[key];
            if (input) input.value = '';
        }
    };

    return (
        <div className="space-y-4">
            {sources.map((s, i) => {
                const err = (field: string) => errors[`sources.${i}.${field}`];
                const fid = (field: string) => `source-${i}-${field}`;
                return (
                    <fieldset key={s.key} className="space-y-3 rounded-lg border border-border p-4">
                        <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
                            المصدر {i + 1}
                            {s.isPrimary && <span className="inline-flex items-center gap-1 text-xs font-normal text-primary"><Star className="h-3 w-3" aria-hidden="true" />أساسي</span>}
                        </legend>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1.5 md:col-span-2">
                                <Label htmlFor={fid('url')}>الرابط</Label>
                                <Input id={fid('url')} type="url" dir="ltr" value={s.url} onChange={(e) => update(s.key, { url: e.target.value })} {...fieldA11y(`${fid('url')}-error`, err('url'))} />
                                <FieldError id={`${fid('url')}-error`} message={err('url')} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor={fid('outlet')}>الجهة الناشرة</Label>
                                <Input id={fid('outlet')} value={s.outlet} onChange={(e) => update(s.key, { outlet: e.target.value })} placeholder="مثال: سانا، عنب بلدي، حساب الوزير" {...fieldA11y(`${fid('outlet')}-error`, err('outlet'))} />
                                <FieldError id={`${fid('outlet')}-error`} message={err('outlet')} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor={fid('type')}>النوع</Label>
                                <Select value={s.type} onValueChange={(v) => update(s.key, { type: v })}>
                                    <SelectTrigger id={fid('type')}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {sourceTypes.map((t) => <SelectItem key={t} value={t}>{SOURCE_TYPE_LABEL[t] ?? t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor={fid('date')}>تاريخ النشر</Label>
                                <Input id={fid('date')} type="date" dir="ltr" value={s.publishedDate} onChange={(e) => update(s.key, { publishedDate: e.target.value })} {...fieldA11y(`${fid('date')}-error`, err('published_date'))} />
                                <FieldError id={`${fid('date')}-error`} message={err('published_date')} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor={fid('language')}>اللغة</Label>
                                <Select value={s.language || 'ar'} onValueChange={(v) => update(s.key, { language: v })}>
                                    <SelectTrigger id={fid('language')}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ar">العربية</SelectItem>
                                        <SelectItem value="en">الإنكليزية</SelectItem>
                                        <SelectItem value="other">أخرى</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor={fid('archive')}>نسخة مؤرشفة</Label>
                                <Input id={fid('archive')} type="url" dir="ltr" value={s.archiveUrl} onChange={(e) => update(s.key, { archiveUrl: e.target.value })} placeholder="https://web.archive.org/..." {...fieldA11y(`${fid('archive')}-error`, err('archive_url'))} />
                                <FieldError id={`${fid('archive')}-error`} message={err('archive_url')} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor={fid('timestamp')}>الدقيقة في الفيديو</Label>
                                <Input id={fid('timestamp')} dir="ltr" value={s.videoTimestamp} onChange={(e) => update(s.key, { videoTimestamp: e.target.value })} placeholder="12:34" {...fieldA11y(`${fid('timestamp')}-error`, err('video_timestamp'))} />
                                <FieldError id={`${fid('timestamp')}-error`} message={err('video_timestamp')} />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <Label htmlFor={fid('screenshot')}>لقطة شاشة</Label>
                                <div className="flex items-center gap-2">
                                    <Input id={fid('screenshot')} dir="ltr" value={s.screenshotUrl} onChange={(e) => update(s.key, { screenshotUrl: e.target.value })} placeholder="رابط الصورة أو ارفعها" {...fieldA11y(`${fid('screenshot')}-error`, err('screenshot_url'))} />
                                    <input
                                        ref={(el) => { fileRefs.current[s.key] = el; }}
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        className="hidden"
                                        aria-hidden="true"
                                        tabIndex={-1}
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(s.key, f); }}
                                    />
                                    <Button type="button" variant="outline" size="icon" disabled={uploading === s.key} onClick={() => fileRefs.current[s.key]?.click()} aria-label={`رفع لقطة شاشة للمصدر ${i + 1}`}>
                                        {uploading === s.key ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImageUp className="h-4 w-4" aria-hidden="true" />}
                                    </Button>
                                </div>
                                <FieldError id={`${fid('screenshot')}-error`} message={err('screenshot_url')} />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {!s.isPrimary && (
                                <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => makePrimary(s.key)}>
                                    <Star className="h-3.5 w-3.5" aria-hidden="true" />اجعله المصدر الأساسي
                                </Button>
                            )}
                            {sources.length > 1 && (
                                <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => onChange((list) => list.filter((x) => x.key !== s.key))}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />حذف المصدر {i + 1}
                                </Button>
                            )}
                        </div>
                    </fieldset>
                );
            })}
            <Button type="button" variant="outline" className="gap-1" onClick={() => onChange((list) => [...list, emptySource()])}>
                <Plus className="h-4 w-4" aria-hidden="true" />إضافة مصدر
            </Button>
        </div>
    );
}
