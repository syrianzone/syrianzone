import type { ReactNode } from 'react';
import { Link } from '@inertiajs/react';
import { AlertTriangle, ChevronLeft, ExternalLink, Flag, ListChecks, Share2 } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { GOVERNORATES_BY_ID } from '@/Domain/geography/governorates';
import {
    GROUP_LABEL_ONE,
    HABITAT_LABELS,
    correctionUrl,
    formatReviewDate,
    imageSourceUrl,
    imageSrcSet,
    imageUrl,
    shareSpecies,
    type CitedText,
    type WildShowProps,
} from '@/Domain/wildlife/wildlife';
import { IucnBadge, StatusBadge } from './_components/Badges';
import { SpeciesCard } from './_components/SpeciesCard';

/** The photo's rendered width: the 5/11 column on wide screens, full width below. */
const HERO_SIZES = '(min-width: 1152px) 500px, (min-width: 1024px) 45vw, 100vw';

/** Superscript links from a statement to the numbered entries of the source list. */
function Cites({ sources }: { sources: number[] }) {
    return (
        <span className="whitespace-nowrap">
            {sources.map((index) => (
                <sup key={index} className="ms-0.5">
                    <a
                        href={`#src-${index + 1}`}
                        className="font-mono text-[10px] font-semibold text-primary hover:underline"
                        aria-label={`المصدر ${index + 1}`}
                    >
                        [{index + 1}]
                    </a>
                </sup>
            ))}
        </span>
    );
}

function CitedList({ items }: { items: CitedText[] }) {
    return (
        <ul className="space-y-3">
            {items.map((item) => (
                <li key={item.text} className="flex gap-3 text-sm leading-relaxed text-foreground">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    <span>
                        {item.text}
                        <Cites sources={item.sources} />
                    </span>
                </li>
            ))}
        </ul>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-1 border-b border-border/50 py-2.5 last:border-b-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm text-foreground">{children}</dd>
        </div>
    );
}

export default function WildShow({ species: s, related }: WildShowProps) {
    const gone = s.syriaStatus === 'possibly-extinct' || s.syriaStatus === 'extinct-in-syria';

    return (
        <MainLayout>
            <div className="min-h-screen bg-background pb-16" dir="rtl">
                <section className="border-b border-border bg-card">
                    <div className="container mx-auto max-w-6xl px-4 py-6">
                        <nav aria-label="مسار التنقل" className="mb-6 text-xs text-muted-foreground">
                            <ol className="flex flex-wrap items-center gap-1.5">
                                <li className="flex items-center gap-1.5">
                                    <Link href="/" className="transition-colors hover:text-foreground">
                                        الرئيسية
                                    </Link>
                                    <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <Link href="/wild" className="transition-colors hover:text-foreground">
                                        الحياة البرية
                                    </Link>
                                    <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                </li>
                                <li className="min-w-0">
                                    <span aria-current="page" className="block truncate font-medium text-foreground">
                                        {s.nameAr}
                                    </span>
                                </li>
                            </ol>
                        </nav>

                        <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
                            <figure className="overflow-hidden rounded-2xl border border-border/70 bg-muted">
                                <img
                                    src={imageUrl(s.image, 960)}
                                    srcSet={imageSrcSet(s.image)}
                                    sizes={HERO_SIZES}
                                    alt={s.image.captionAr}
                                    width={960}
                                    height={720}
                                    fetchPriority="high"
                                    decoding="async"
                                    className="aspect-[4/3] h-auto w-full object-cover"
                                />
                                <figcaption className="space-y-0.5 bg-card px-4 py-3 text-xs text-muted-foreground">
                                    <p className="text-foreground">{s.image.captionAr}</p>
                                    <p>
                                        تصوير{' '}
                                        <a
                                            href={imageSourceUrl(s.image)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                                        >
                                            <bdi>{s.image.author}</bdi>
                                            <span className="sr-only"> (صفحة الصورة على ويكيميديا كومنز، تفتح في نافذة جديدة)</span>
                                        </a>
                                        {' · '}
                                        {s.image.licenseUrl ? (
                                            <a
                                                href={s.image.licenseUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                                                dir="ltr"
                                            >
                                                {s.image.license}
                                            </a>
                                        ) : (
                                            'ملكية عامة'
                                        )}
                                    </p>
                                </figcaption>
                            </figure>

                            <div className="space-y-4">
                                <p className="text-sm font-medium text-primary">{GROUP_LABEL_ONE[s.group]}</p>
                                <div className="space-y-1.5">
                                    <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl">{s.nameAr}</h1>
                                    <p className="text-sm text-muted-foreground">
                                        <span className="italic" dir="ltr" lang="la">
                                            {s.subspecies ?? s.scientific}
                                        </span>
                                        <span aria-hidden="true"> · </span>
                                        <span dir="ltr" lang="en">
                                            {s.nameEn}
                                        </span>
                                    </p>
                                    {s.altNamesAr.length > 0 && (
                                        <p className="text-sm text-muted-foreground">يُعرف أيضاً باسم: {s.altNamesAr.join('، ')}</p>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <IucnBadge category={s.iucn.category} />
                                    <StatusBadge status={s.syriaStatus} />
                                </div>
                                <p className="max-w-2xl text-base leading-loose text-foreground">
                                    {s.summaryAr}
                                    <Cites sources={s.summarySources} />
                                </p>
                                {s.statusNoteAr && (
                                    <p className="max-w-2xl rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground">
                                        <span className="font-semibold">في سوريا: </span>
                                        {s.statusNoteAr}
                                    </p>
                                )}
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void shareSpecies(s)}>
                                        <Share2 className="h-4 w-4" aria-hidden="true" />
                                        مشاركة
                                    </Button>
                                    <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground">
                                        <a href={correctionUrl(s)} target="_blank" rel="noopener noreferrer">
                                            <Flag className="h-4 w-4" aria-hidden="true" />
                                            أبلغ عن خطأ
                                            <span className="sr-only">(يفتح في نافذة جديدة)</span>
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="container mx-auto max-w-6xl px-4 pt-8">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <div className="space-y-6 lg:col-span-2">
                            <Card className="border-border/70">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-lg font-bold">
                                        <ListChecks className="h-5 w-5 text-primary" aria-hidden="true" />
                                        <h2>{gone ? 'ما نعرفه عنه في سوريا' : 'حقائق موثّقة'}</h2>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <CitedList items={s.factsAr} />
                                </CardContent>
                            </Card>

                            {s.threatsAr.length > 0 && (
                                <Card className="border-border/70">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-lg font-bold">
                                            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
                                            <h2>{gone ? 'أسباب تراجعه' : 'ما يهدده'}</h2>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <CitedList items={s.threatsAr} />
                                    </CardContent>
                                </Card>
                            )}

                            <section aria-labelledby="wild-sources" className="rounded-2xl border border-border/70 bg-card p-6">
                                <h2 id="wild-sources" className="text-lg font-bold text-foreground">
                                    المصادر
                                </h2>
                                <ol className="mt-3 space-y-2.5 text-sm">
                                    {s.sources.map((src, index) => (
                                        <li key={src.url} id={`src-${index + 1}`} className="flex scroll-mt-24 gap-2">
                                            <span className="font-mono text-xs font-semibold text-muted-foreground">[{index + 1}]</span>
                                            <a
                                                href={src.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex min-w-0 items-start gap-1 text-foreground underline decoration-dotted underline-offset-4 hover:text-primary"
                                            >
                                                <span dir="ltr" className="break-words text-start">
                                                    {src.title}
                                                </span>
                                                <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                                                <span className="sr-only">(يفتح في نافذة جديدة)</span>
                                            </a>
                                        </li>
                                    ))}
                                </ol>
                                <p className="mt-4 text-xs text-muted-foreground">
                                    آخر مراجعة لهذه الصفحة مقابل مصادرها:{' '}
                                    <time dateTime={s.lastReviewed}>{formatReviewDate(s.lastReviewed)}</time>
                                </p>
                            </section>
                        </div>

                        <aside className="space-y-6">
                            <Card className="border-border/70">
                                <CardHeader className="pb-1">
                                    <CardTitle className="text-base font-bold">
                                        <h2>بطاقة النوع</h2>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <dl>
                                        <Row label="الاسم العلمي">
                                            <span className="italic" dir="ltr" lang="la">
                                                {s.scientific}
                                            </span>
                                        </Row>
                                        {s.subspecies && (
                                            <Row label="النُّويع في سوريا">
                                                <span className="italic" dir="ltr" lang="la">
                                                    {s.subspecies}
                                                </span>
                                            </Row>
                                        )}
                                        <Row label="التصنيف العالمي (القائمة الحمراء)">
                                            <span className="flex flex-col items-start gap-1.5">
                                                <IucnBadge category={s.iucn.category} />
                                                {s.iucnNoteAr && <span className="text-xs text-muted-foreground">{s.iucnNoteAr}</span>}
                                                <a
                                                    href={s.iucn.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs text-primary underline decoration-dotted underline-offset-2"
                                                >
                                                    التقييم على موقع IUCN
                                                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                                    <span className="sr-only">(يفتح في نافذة جديدة)</span>
                                                </a>
                                            </span>
                                        </Row>
                                        <Row label="الوضع في سوريا">
                                            <StatusBadge status={s.syriaStatus} />
                                        </Row>
                                        <Row label="البيئة">{s.habitats.map((h) => HABITAT_LABELS[h]).join('، ')}</Row>
                                        {s.governorates.length > 0 && (
                                            <Row label={gone ? 'سُجّل سابقاً في محافظات' : 'سجلات موثّقة في محافظات'}>
                                                <ul className="flex flex-wrap gap-1.5">
                                                    {s.governorates.map((id) => (
                                                        <li key={id}>
                                                            <Link
                                                                href={`/governorates/${id}`}
                                                                className="inline-flex rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-foreground hover:bg-muted"
                                                            >
                                                                {GOVERNORATES_BY_ID[id]?.nameAr ?? id}
                                                            </Link>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </Row>
                                        )}
                                    </dl>
                                </CardContent>
                            </Card>
                        </aside>
                    </div>

                    {related.length > 0 && (
                        <section aria-labelledby="wild-related" className="mt-12">
                            <div className="mb-4 flex items-baseline justify-between gap-4">
                                <h2 id="wild-related" className="text-lg font-bold text-foreground">
                                    أنواع أخرى في الدليل
                                </h2>
                                <Link href="/wild" className="text-sm text-primary hover:underline">
                                    كل الأنواع
                                </Link>
                            </div>
                            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {related.map((o) => (
                                    <SpeciesCard key={o.slug} species={o} />
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
