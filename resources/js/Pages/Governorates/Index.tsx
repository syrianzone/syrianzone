import React, { useMemo } from 'react';
import { Link } from '@inertiajs/react';
import { ChevronLeft, Compass, ExternalLink, MapPin, Users } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { PageHeader } from '@/Components/layout';
import { Card, CardContent } from '@/Components/ui/card';
import { SyriaGovernoratesMap } from './_components/SyriaGovernoratesMap';
import type { GovernoratesHubProps } from './_types';

function formatNumber(n: number): string {
    return n.toLocaleString('en-US');
}

export default function GovernoratesIndex({
    governorates,
    populationMeta,
    svgMap,
    iconCredit,
}: GovernoratesHubProps) {
    const populationById = useMemo(
        () => Object.fromEntries(governorates.map((g) => [g.id, g.population?.value])),
        [governorates],
    );

    return (
        <MainLayout>
            <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
                <div className="space-y-4">
                    <PageHeader
                        title="محافظات سوريا الأربع عشرة"
                        description="دليل موحّد لمحافظات الجمهورية العربية السورية الـ 14 يجمع البيانات السكانية، المراكز الإدارية، المحافظين الحاليين، مواقيت الصلاة اليومية وإمساكية رمضان، خطوط المواصلات العامة، المعابر الحدودية، الأماكن والأرقام الخدمية لكل محافظة."
                        divider
                    />

                    {populationMeta && (
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground">
                                <Users className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                <span>إجمالي السكان (تقدير {populationMeta.year ?? 'مرجعي'}):</span>
                                <strong dir="ltr" className="font-mono tabular-nums">
                                    {formatNumber(populationMeta.total)}
                                </strong>
                                <span>نسمة</span>
                            </span>
                            {populationMeta.source_url && (
                                <a
                                    href={populationMeta.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4 hover:no-underline"
                                >
                                    <span>مصدر التقديرات السكانية</span>
                                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                </a>
                            )}
                            <Link
                                href="/atlas"
                                className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4 hover:no-underline"
                            >
                                <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>استعراض أطلس السكان الكامل</span>
                            </Link>
                        </div>
                    )}
                </div>

                {/* Interactive SSR Syria Map */}
                <SyriaGovernoratesMap svgMap={svgMap} populationById={populationById} />

                {/* Accessible Grid of All 14 Governorates */}
                <section aria-labelledby="governorates-list-heading" className="space-y-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 id="governorates-list-heading" className="text-xl font-bold text-foreground">
                            قائمة المحافظات السورية
                        </h2>
                        <span className="text-xs text-muted-foreground">
                            14 محافظة — مرتّبة بحسب الدليل الإداري
                        </span>
                    </div>

                    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {governorates.map((gov) => (
                            <li key={gov.id} className="flex">
                                <Link
                                    href={`/governorates/${gov.id}`}
                                    className="group flex w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                >
                                    <Card className="w-full border-border bg-card/70 transition-all group-hover:border-primary/50 group-hover:shadow-sm">
                                        <CardContent className="flex items-center gap-4 p-4">
                                            {gov.icon_path && (
                                                <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background p-1.5">
                                                    <img
                                                        src={gov.icon_path}
                                                        alt={`أيقونة محافظة ${gov.name_ar}${gov.landmark_ar ? ` — ${gov.landmark_ar}` : ''}`}
                                                        loading="lazy"
                                                        decoding="async"
                                                        width={64}
                                                        height={80}
                                                        className="h-full w-full object-contain"
                                                    />
                                                </div>
                                            )}

                                            <div className="min-w-0 flex-1 space-y-1.5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <h3 className="truncate text-base font-bold text-foreground group-hover:text-primary">
                                                        محافظة {gov.name_ar}
                                                    </h3>
                                                    <ChevronLeft
                                                        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:text-primary"
                                                        aria-hidden="true"
                                                    />
                                                </div>

                                                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden="true" />
                                                    <span>المركز الإداري: {gov.centre_ar}</span>
                                                </p>

                                                {gov.population && (
                                                    <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                                                        <Users className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden="true" />
                                                        <span>السكان:</span>
                                                        <span dir="ltr" className="font-mono font-semibold tabular-nums text-foreground">
                                                            {formatNumber(gov.population.value)}
                                                        </span>
                                                        {gov.population.year && (
                                                            <span>({gov.population.year})</span>
                                                        )}
                                                    </p>
                                                )}

                                                {gov.area_sqkm !== null && (
                                                    <p className="text-[11px] text-muted-foreground">
                                                        المساحة:{' '}
                                                        <span dir="ltr" className="font-mono tabular-nums">
                                                            {formatNumber(gov.area_sqkm)}
                                                        </span>{' '}
                                                        كم²
                                                    </p>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Attribution Footer */}
                <footer className="space-y-2 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
                    <p>
                        أيقونات المحافظات السورية من إعداد وتصميم{' '}
                        <span className="font-semibold text-foreground">{iconCredit.name_ar}</span>{' '}
                        (
                        <a
                            href={iconCredit.x_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary underline underline-offset-4 hover:no-underline"
                        >
                            X / Twitter
                        </a>
                        {' · '}
                        <a
                            href={iconCredit.instagram_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary underline underline-offset-4 hover:no-underline"
                        >
                            Instagram
                        </a>
                        ) — متوفرة للتحميل ضمن صفحة{' '}
                        <Link href="/syid" className="font-medium text-primary underline underline-offset-4 hover:no-underline">
                            الهوية البصرية
                        </Link>
                        .
                    </p>
                    <p>
                        حدود المحافظات ومساحاتها مستمدة من بيانات OCHA الإدارية (COD-AB) المستخدمة في{' '}
                        <Link href="/atlas" className="font-medium text-primary underline underline-offset-4 hover:no-underline">
                            أطلس سوريا
                        </Link>
                        {populationMeta?.source_url ? (
                            <>
                                {'، '}وتقديرات السكان ({populationMeta.year ?? 'مرجعي'}) من{' '}
                                <a
                                    href={populationMeta.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-primary underline underline-offset-4 hover:no-underline"
                                >
                                    geo-ref.net
                                </a>
                                .
                            </>
                        ) : (
                            '.'
                        )}
                    </p>
                </footer>
            </div>
        </MainLayout>
    );
}
