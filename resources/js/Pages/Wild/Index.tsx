import { useMemo, useState } from 'react';
import { BookOpenCheck, ExternalLink, Search } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Input } from '@/Components/ui/input';
import { FilterChip } from '@/Components/ui/filter-chip';
import { normalizeArabic } from '@/Lib/arabic';
import { useTabList } from '@/Lib/useTabList';
import {
    GROUPS,
    GROUP_LABELS,
    isThreatened,
    searchKey,
    type Group,
    type SpeciesCardData,
    type WildHubProps,
} from '@/Domain/wildlife/wildlife';
import { SpeciesCard } from './_components/SpeciesCard';

type Tab = 'all' | Group;
type Filter = 'threatened' | 'rare-or-gone';

/** Cards in the first row of the widest grid load eagerly: they are above the fold. */
const EAGER_CARDS = 4;

const TAB_LABEL = (tab: Tab) => (tab === 'all' ? 'الكل' : GROUP_LABELS[tab]);

const FILTERS: Array<{ id: Filter; label: string; test: (s: SpeciesCardData) => boolean }> = [
    { id: 'threatened', label: 'مهدد عالمياً', test: (s) => isThreatened(s.iucn.category) },
    {
        id: 'rare-or-gone',
        label: 'نادر أو مختفٍ من سوريا',
        test: (s) => ['uncertain', 'possibly-extinct', 'extinct-in-syria'].includes(s.syriaStatus),
    },
];

export default function WildIndex({ species, stats, sources }: WildHubProps) {
    const [tab, setTab] = useState<Tab>('all');
    const [query, setQuery] = useState('');
    const [filters, setFilters] = useState<Filter[]>([]);

    const keys = useMemo(() => new Map(species.map((s) => [s.slug, searchKey(s)])), [species]);
    /** Only the groups the data has entries for get a tab. */
    const tabIds = useMemo<Tab[]>(() => ['all', ...GROUPS.filter((g) => species.some((s) => s.group === g))], [species]);
    const tabs = useTabList({ ids: tabIds, active: tab, onChange: setTab });

    const visible = useMemo(() => {
        const q = normalizeArabic(query);
        return species.filter(
            (s) =>
                (tab === 'all' || s.group === tab) &&
                (q === '' || (keys.get(s.slug) ?? '').includes(q)) &&
                filters.every((id) => FILTERS.find((f) => f.id === id)?.test(s)),
        );
    }, [species, keys, tab, query, filters]);

    const toggle = (id: Filter) =>
        setFilters((current) => (current.includes(id) ? current.filter((f) => f !== id) : [...current, id]));

    return (
        <MainLayout>
            <div className="min-h-screen bg-background pb-16" dir="rtl">
                <section className="border-b border-border bg-card">
                    <div className="container mx-auto max-w-6xl px-4 py-10 sm:py-14">
                        <p className="text-sm font-medium text-primary">دليل مرجعي موثّق المصادر</p>
                        <h1 className="mt-2 text-3xl font-bold leading-tight text-foreground sm:text-4xl">
                            الحياة البرية في سوريا
                        </h1>
                        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
                            دليل لحيوانات سوريا وطيورها وزواحفها: ما يعيش منها في البلاد اليوم، وما هو مهدد بالانقراض،
                            وما انقرض منها، مع وضع كل نوع في سوريا وتصنيفه العالمي. كل معلومة هنا مأخوذة من مصدر منشور
                            ومذكور في صفحة النوع.
                        </p>
                        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                            <div>
                                <dt className="text-muted-foreground">الأنواع في الدليل</dt>
                                <dd className="text-xl font-bold tabular-nums text-foreground">{stats.total}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">مهددة بالانقراض عالمياً</dt>
                                <dd className="text-xl font-bold tabular-nums text-foreground">{stats.threatened}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">مصدر مستشهد به</dt>
                                <dd className="text-xl font-bold tabular-nums text-foreground">{stats.sources}</dd>
                            </div>
                        </dl>
                    </div>
                </section>

                <div className="container mx-auto max-w-6xl px-4 pt-8">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div
                            {...tabs.tabListProps}
                            aria-label="المجموعات"
                            className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1"
                        >
                            {tabIds.map((id) => (
                                <button
                                    key={id}
                                    type="button"
                                    {...tabs.tabProps(id)}
                                    className={
                                        tab === id
                                            ? 'rounded-lg bg-background px-3.5 py-1.5 text-sm font-semibold text-foreground shadow-sm'
                                            : 'rounded-lg px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground'
                                    }
                                >
                                    {TAB_LABEL(id)}
                                </button>
                            ))}
                        </div>
                        <div className="relative w-full lg:max-w-xs">
                            <Search
                                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <Input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="ابحث بالاسم العربي أو العلمي"
                                aria-label="ابحث في الأنواع"
                                className="ps-9"
                            />
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="تصفية">
                        {FILTERS.map((f) => (
                            <FilterChip key={f.id} active={filters.includes(f.id)} onClick={() => toggle(f.id)}>
                                {f.label}
                            </FilterChip>
                        ))}
                    </div>

                    <div {...tabs.panelProps(tab)} className="mt-6 focus-visible:outline-none">
                        <h2 className="sr-only">{TAB_LABEL(tab)}</h2>
                        <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
                            {visible.length === 0 ? 'لا توجد أنواع مطابقة.' : `يُعرض ${visible.length} من أصل ${species.length}`}
                        </p>
                        {visible.length > 0 && (
                            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {visible.map((s, i) => (
                                    <SpeciesCard key={s.slug} species={s} priority={i < EAGER_CARDS} />
                                ))}
                            </ul>
                        )}
                    </div>

                    <section aria-labelledby="wild-method" className="mt-14 rounded-2xl border border-border bg-card p-6">
                        <h2 id="wild-method" className="flex items-center gap-2 text-lg font-bold text-foreground">
                            <BookOpenCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                            كيف نتحقق من المعلومات
                        </h2>
                        <ul className="mt-3 list-disc space-y-1.5 ps-5 text-sm leading-relaxed text-muted-foreground">
                            <li>
                                لكل نوع مصدران على الأقل، ولكل معلومة رقم يشير إلى مصدرها في قائمة المراجع أسفل صفحته.
                            </li>
                            <li>
                                التصنيف العالمي مأخوذ من القائمة الحمراء للاتحاد الدولي لصون الطبيعة (IUCN)، أما الوضع في
                                سوريا فمن الدراسات الميدانية المنشورة عن البلاد.
                            </li>
                            <li>
                                حين لا تؤكد المصادر وجود نوع ما نكتب «وجوده غير مؤكد» ولا نخمّن، ونُبقي الأنواع المنقرضة
                                في الدليل لأنها جزء من تاريخ البلاد الطبيعي.
                            </li>
                            <li>الصور من ويكيميديا كومنز برخص حرة، مع اسم المصوّر والرخصة تحت كل صورة.</li>
                        </ul>
                        <h3 className="mt-5 text-sm font-semibold text-foreground">المراجع الرئيسية</h3>
                        <ul className="mt-2 space-y-1.5 text-sm">
                            {sources.map((src) => (
                                <li key={src.url}>
                                    <a
                                        href={src.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-start gap-1 text-foreground underline decoration-dotted underline-offset-4 hover:text-primary"
                                    >
                                        <span dir="ltr" className="text-start">
                                            {src.title}
                                        </span>
                                        <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                                        <span className="sr-only">(يفتح في نافذة جديدة)</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>
            </div>
        </MainLayout>
    );
}
