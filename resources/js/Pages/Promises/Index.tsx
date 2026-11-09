import { useEffect, useMemo, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { FilterChip } from '@/Components/ui/filter-chip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/Components/ui/accordion';
import { Plus, Search, SearchX } from 'lucide-react';
import { PromisesIcon } from '@/Components/Icons/ProjectIcons';
import { normalizeArabic } from '@/Lib/arabic';
import PromiseCard from './_components/PromiseCard';
import Scoreboard from './_components/Scoreboard';
import type { Option, PromiseCardData, PromiseStats, SectorOption } from './_lib/types';

interface Props {
    promises: PromiseCardData[];
    stats: PromiseStats;
    filters: {
        sectors: SectorOption[];
        governorates: Option[];
        institutions: Array<{ id: string; name: string }>;
        speakers: Array<{ id: string; name: string }>;
        tags: string[];
    };
    dueSoonDays: number;
}

type StateFilter = 'all' | 'overdue' | 'due_soon' | 'open' | 'fulfilled' | 'partial' | 'broken' | 'other';
type SortKey = 'urgency' | 'newest' | 'deadline';

const ALL = 'all';

/** Same groups, same order and same names as the scoreboard tiles. */
const STATE_FILTERS: Array<{ key: StateFilter; label: string }> = [
    { key: 'all', label: 'الكل' },
    { key: 'overdue', label: 'متأخرة' },
    { key: 'due_soon', label: 'تقترب مواعيدها' },
    { key: 'open', label: 'لم تُحسم بعد' },
    { key: 'fulfilled', label: 'تحققت' },
    { key: 'partial', label: 'تحققت جزئياً' },
    { key: 'broken', label: 'لم تتحقق' },
    { key: 'other', label: 'أُجّلت أو سُحبت' },
];

/** Filters that live in the address bar, so a filtered view can be shared. */
const URL_FILTERS = ['state', 'sector', 'governorate', 'institution', 'speaker', 'tag'] as const;

function matchesState(p: PromiseCardData, filter: StateFilter, dueSoonDays: number): boolean {
    switch (filter) {
        case 'all': return true;
        case 'overdue': return p.state === 'overdue';
        case 'due_soon': return (p.state === 'pending' || p.state === 'in_progress') && p.daysLeft !== null && p.daysLeft <= dueSoonDays;
        case 'open': return p.state === 'pending' || p.state === 'in_progress';
        case 'fulfilled': return p.state === 'fulfilled';
        case 'partial': return p.state === 'partially_fulfilled';
        case 'broken': return p.state === 'broken';
        case 'other': return p.state === 'postponed' || p.state === 'retracted';
    }
}

function queryOf(url: string): URLSearchParams {
    const q = url.indexOf('?');
    return new URLSearchParams(q === -1 ? '' : url.slice(q + 1));
}

export default function PromisesIndex({ promises, stats, filters, dueSoonDays }: Props) {
    const page = usePage();
    // Read once on mount: the page URL (server and client alike) is the
    // source of the initial filters, so a shared link opens filtered.
    const [initial] = useState(() => queryOf(page.url));
    const fromUrl = (key: string) => initial.get(key) ?? ALL;

    const [state, setState] = useState<StateFilter>(() => {
        const v = initial.get('state') as StateFilter | null;
        return v && STATE_FILTERS.some((f) => f.key === v) ? v : 'all';
    });
    const [sector, setSector] = useState(() => fromUrl('sector'));
    const [governorate, setGovernorate] = useState(() => fromUrl('governorate'));
    const [institution, setInstitution] = useState(() => fromUrl('institution'));
    const [speaker, setSpeaker] = useState(() => fromUrl('speaker'));
    const [tag, setTag] = useState(() => fromUrl('tag'));
    const [sort, setSort] = useState<SortKey>('urgency');
    const [q, setQ] = useState('');

    // Mirror the filters into the URL with a client-side Inertia visit, so the
    // page URL Inertia stores in history matches: Back from a promise returns
    // to the same filtered list.
    useEffect(() => {
        const values: Record<(typeof URL_FILTERS)[number], string> = { state, sector, governorate, institution, speaker, tag };
        const next = new URLSearchParams();
        for (const key of URL_FILTERS) {
            if (values[key] !== ALL) next.set(key, values[key]);
        }
        const qs = next.toString();
        const url = qs ? `/promises?${qs}` : '/promises';
        if (url !== page.url) router.replace({ url, preserveState: true, preserveScroll: true });
    }, [state, sector, governorate, institution, speaker, tag]); // eslint-disable-line react-hooks/exhaustive-deps

    // Everything except the state chip, so each chip can show its own count.
    const base = useMemo(() => {
        const needle = normalizeArabic(q);
        return promises.filter((p) => {
            if (sector !== ALL && p.sector?.id !== sector) return false;
            if (governorate === 'national' && !p.isNational) return false;
            if (governorate !== ALL && governorate !== 'national' && !p.governorates.includes(governorate)) return false;
            if (institution !== ALL && p.institution?.id !== institution) return false;
            if (speaker !== ALL && p.speaker.id !== speaker) return false;
            if (tag !== ALL && !p.tags.includes(tag)) return false;
            if (needle && !normalizeArabic(`${p.title} ${p.speaker.name ?? ''}`).includes(needle)) return false;
            return true;
        });
    }, [promises, sector, governorate, institution, speaker, tag, q]);

    const counts = useMemo(() => {
        const c = {} as Record<StateFilter, number>;
        for (const f of STATE_FILTERS) c[f.key] = base.filter((p) => matchesState(p, f.key, dueSoonDays)).length;
        return c;
    }, [base, dueSoonDays]);

    const visible = useMemo(() => {
        const list = base.filter((p) => matchesState(p, state, dueSoonDays));
        if (sort === 'newest') return [...list].sort((a, b) => b.statementDate.localeCompare(a.statementDate));
        if (sort === 'deadline') {
            return [...list].sort((a, b) => (a.deadlineDate ?? '9999').localeCompare(b.deadlineDate ?? '9999'));
        }
        return list; // server order: most urgent first
    }, [base, state, sort, dueSoonDays]);

    const resetFilters = () => {
        setState('all');
        setSector(ALL);
        setGovernorate(ALL);
        setInstitution(ALL);
        setSpeaker(ALL);
        setTag(ALL);
        setQ('');
    };

    return (
        <MainLayout>
            <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-primary/10 via-background to-background py-12 md:py-16">
                <div className="container relative z-10 mx-auto max-w-4xl px-4 text-center">
                    <div className="mb-4 flex items-center justify-center gap-3">
                        <PromisesIcon className="h-10 w-10 md:h-12 md:w-12" />
                        <h1 className="text-3xl font-black leading-tight tracking-tight text-foreground md:text-5xl">عداد الوعود</h1>
                    </div>
                    <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
                        سجل علني لما وعد به المسؤولون السوريون منذ 8 كانون الأول 2024، بالمصدر والتاريخ والموعد،
                        مع عدّاد لكل وعد يبيّن ما بقي من الوقت أو ما مضى على انقضائه.
                    </p>
                    <div className="mt-6 flex justify-center">
                        <Button asChild className="gap-2">
                            <Link href="/promises/suggest"><Plus className="h-4 w-4" aria-hidden="true" />اقترح وعداً</Link>
                        </Button>
                    </div>
                </div>
            </section>

            <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
                <Scoreboard stats={stats} />

                <Card>
                    <CardContent className="space-y-4 p-5">
                        <div className="flex flex-wrap gap-2" role="group" aria-label="تصفية حسب الحالة">
                            {STATE_FILTERS.map((f) => (
                                <FilterChip key={f.key} active={state === f.key} onClick={() => setState(f.key)}>
                                    {f.label} ({counts[f.key]})
                                </FilterChip>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="relative sm:col-span-2 lg:col-span-1">
                                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                                <Input
                                    aria-label="ابحث في الوعود"
                                    placeholder="ابحث بالعنوان أو اسم المسؤول..."
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    className="ps-9"
                                />
                            </div>
                            <Select value={sector} onValueChange={setSector}>
                                <SelectTrigger aria-label="القطاع"><SelectValue placeholder="القطاع" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>كل القطاعات</SelectItem>
                                    {filters.sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={governorate} onValueChange={setGovernorate}>
                                <SelectTrigger aria-label="المحافظة"><SelectValue placeholder="المحافظة" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>كل المحافظات</SelectItem>
                                    <SelectItem value="national">على مستوى البلاد</SelectItem>
                                    {filters.governorates.map((g) => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={speaker} onValueChange={setSpeaker}>
                                <SelectTrigger aria-label="صاحب الوعد"><SelectValue placeholder="صاحب الوعد" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>كل المسؤولين</SelectItem>
                                    {filters.speakers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {filters.institutions.length > 0 && (
                                <Select value={institution} onValueChange={setInstitution}>
                                    <SelectTrigger aria-label="الجهة المسؤولة"><SelectValue placeholder="الجهة المسؤولة" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL}>كل الجهات</SelectItem>
                                        {filters.institutions.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                            {filters.tags.length > 0 && (
                                <Select value={tag} onValueChange={setTag}>
                                    <SelectTrigger aria-label="الوسم"><SelectValue placeholder="الوسم" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL}>كل الوسوم</SelectItem>
                                        {filters.tags.map((t) => <SelectItem key={t} value={t}>#{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                                <SelectTrigger aria-label="الترتيب"><SelectValue placeholder="الترتيب" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="urgency">الأكثر إلحاحاً</SelectItem>
                                    <SelectItem value="deadline">الأقرب موعداً</SelectItem>
                                    <SelectItem value="newest">الأحدث تصريحاً</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <p className="text-sm text-muted-foreground" aria-live="polite">
                    {visible.length === promises.length ? `عدد الوعود: ${promises.length}` : `الوعود المعروضة: ${visible.length} من أصل ${promises.length}`}
                </p>

                {visible.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {visible.map((p) => <PromiseCard key={p.id} promise={p} />)}
                    </div>
                ) : (
                    <Card>
                        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                            <SearchX className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                            <p className="font-semibold text-foreground">
                                {promises.length === 0 ? 'لم يُنشر أي وعد بعد' : 'لا توجد وعود تطابق هذه التصفية'}
                            </p>
                            {promises.length > 0 && <Button variant="outline" onClick={resetFilters}>إعادة ضبط التصفية</Button>}
                        </CardContent>
                    </Card>
                )}

                <Accordion type="single">
                    <AccordionItem value="method">
                        <AccordionTrigger>كيف يعمل العداد؟</AccordionTrigger>
                        <AccordionContent>
                            <ul className="list-disc space-y-2 ps-5 text-sm leading-relaxed text-muted-foreground">
                                <li>نُدرج الوعود العلنية فقط: منشورات المسؤولين ومقابلاتهم ومؤتمراتهم الصحفية وخطاباتهم وبياناتهم الرسمية، ولكل وعد مصدر واحد على الأقل مع نسخة مؤرشفة متى أمكن.</li>
                                <li>حين يذكر المسؤول موعداً غير دقيق (مثل «قبل الصيف») نحوّله إلى تاريخ محدد ونعرض عبارته الأصلية وطريقة التحويل إلى جانبه. وإن لم يذكر موعداً نعدّ الأيام منذ إطلاق الوعد.</li>
                                <li>حين ينقضي الموعد دون حكم يظهر الوعد «متأخراً». لا يتحول أي وعد إلى «لم يتحقق» تلقائياً، بل يحكم المحررون بمصدر موثّق، ويُسجَّل كل تغيير في الحالة علناً.</li>
                                <li>إذا أعاد المسؤول الوعد بموعد جديد يُسجَّل وعداً جديداً مرتبطاً بالأصلي، ويُعلَّم الأصلي «أُجّل».</li>
                                <li>يمكن لأي مستخدم مسجّل اقتراح وعد أو إرسال تحديث أو الإبلاغ عن خطأ، ولا يُنشر شيء قبل مراجعة المحررين.</li>
                            </ul>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </MainLayout>
    );
}
