import { useEffect, useMemo } from 'react';
import { Link, router, usePage, useRemember } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { FilterChip } from '@/Components/ui/filter-chip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import SmartFilterSearch from '@/Components/SmartFilterSearch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/Components/ui/accordion';
import { Plus, SearchX } from 'lucide-react';
import { PromisesIcon } from '@/Components/Icons/ProjectIcons';
import { toggleFilterValue, type SmartFilterValue } from '@/Lib/smartFilterSearch';
import { cn } from '@/Lib/utils';
import PromiseCard from './_components/PromiseCard';
import Scoreboard from './_components/Scoreboard';
import { filterPromises, matchesState, promiseFilterFacets, promiseListUrl, readPromiseFilters, SORT_OPTIONS, visiblePromises, type PromiseFilterOptions } from './_lib/filters';
import type { PromiseCardData, PromiseStats } from './_lib/types';

interface Props {
    promises: PromiseCardData[];
    stats: PromiseStats;
    filters: PromiseFilterOptions;
    dueSoonDays: number;
}

export default function PromisesIndex({ promises, stats, filters, dueSoonDays }: Props) {
    const page = usePage();
    const facets = useMemo(() => promiseFilterFacets(filters), [filters]);
    // Remember free text alongside URL filters when navigating Back/Forward.
    const initialValue = useMemo(() => readPromiseFilters(page.url, facets), [page.url, facets]);
    const [value, setValue] = useRemember<SmartFilterValue>(initialValue, 'promises.filters');
    const base = useMemo(() => filterPromises(promises, value), [promises, value]);
    const visible = useMemo(() => visiblePromises(base, value, dueSoonDays), [base, value, dueSoonDays]);
    const stateFacet = useMemo(() => facets.find((facet) => facet.key === 'state'), [facets]);
    const searchFacets = useMemo(() => facets.filter((facet) => facet.key !== 'state'), [facets]);
    const stateOptions = useMemo(() => stateFacet?.options.map((option) => ({
        ...option, count: base.filter((p) => matchesState(p, option.value, dueSoonDays)).length,
    })) ?? [], [stateFacet, base, dueSoonDays]);
    const { state: selectedStates = [], ...searchFilters } = value.filters;
    const searchValue = { ...value, filters: searchFilters };
    const listUrl = promiseListUrl(value);

    useEffect(() => {
        const url = new URL(page.url, window.location.origin);
        if (!url.searchParams.has('q')) return;
        url.searchParams.delete('q');
        router.replace({ url: `${url.pathname}${url.search}${url.hash}`, preserveState: true, preserveScroll: true });
    }, [page.url]);

    function changeFilters(next: SmartFilterValue) {
        const previousUrl = promiseListUrl(value);
        setValue(next);
        const url = promiseListUrl(next);
        if (url === previousUrl) return;
        // page.url may lag behind a rapid second selection; compare local values.
        router.replace({ url, preserveState: true, preserveScroll: true });
    }

    const resetFilters = () => changeFilters({ search: '', filters: {}, sort: value.sort });

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

                <div className="rounded-xl border border-input bg-card shadow-sm transition-colors focus-within:border-foreground/25">
                    <div className="flex flex-nowrap gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain border-b border-border/70 p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible" role="group" aria-label="تصفية حسب الحالة">
                        {[{ value: 'all', label: 'الكل', count: base.length }, ...stateOptions].map((option) => {
                            const active = option.value === 'all' ? selectedStates.length === 0 : selectedStates.includes(option.value);
                            return (
                                <FilterChip key={option.value} active={active} activeVariant="outline"
                                    className={cn(
                                        'min-h-9 shrink-0 gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap shadow-none transition-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-1 focus-visible:ring-border',
                                        active ? 'border-foreground/15 bg-muted/60 text-foreground'
                                            : 'border-border/70 bg-transparent text-muted-foreground',
                                    )}
                                    onClick={() => {
                                        if (option.value === 'all') changeFilters(searchValue);
                                        else if (stateFacet) changeFilters(toggleFilterValue(value, stateFacet, option.value));
                                    }}>
                                    {option.label}
                                    <span className="text-xs tabular-nums">{option.count}</span>
                                </FilterChip>
                            );
                        })}
                    </div>
                    <SmartFilterSearch
                        embedded
                        mobileFiltersScroll
                        facets={searchFacets} value={searchValue}
                        onChange={(next) => changeFilters({
                            ...next,
                            filters: { ...next.filters, ...(selectedStates.length ? { state: selectedStates } : {}) },
                        })}
                        placeholder="ابحث بالعنوان أو اسم المسؤول..." ariaLabel="ابحث في الوعود"
                    />
                </div>

                <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 text-sm text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">
                        {visible.length === promises.length ? `عدد الوعود: ${promises.length}` : `الوعود المعروضة: ${visible.length} من أصل ${promises.length}`}
                    </p>
                    <Select value={value.sort} onValueChange={(sort) => changeFilters({ ...value, sort })}>
                        <SelectTrigger aria-label="ترتيب الوعود"
                            className="h-10 w-auto shrink-0 gap-2 border-0 px-1.5 text-muted-foreground shadow-none focus:ring-0 focus-visible:ring-1 focus-visible:ring-border focus-visible:ring-offset-0">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                            {SORT_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}
                                    className="focus:bg-muted/50 focus:text-foreground data-[highlighted]:bg-muted/50 data-[highlighted]:text-foreground">
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {visible.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {visible.map((p) => <PromiseCard key={p.id} promise={p} returnUrl={listUrl} />)}
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
