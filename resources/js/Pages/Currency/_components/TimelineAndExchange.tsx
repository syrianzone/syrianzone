import React from 'react';
import { CalendarDays, CheckCircle2, ExternalLink, Landmark } from 'lucide-react';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader } from '@/Components/ui/card';
import type { CurrencyFacts } from '@/Domain/currency/facts';

interface TimelineAndExchangeProps {
    exchangeInfo: CurrencyFacts['exchange_info'];
    timeline: CurrencyFacts['timeline'];
}

export function TimelineAndExchange({ exchangeInfo, timeline }: TimelineAndExchangeProps) {
    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="exchange-heading">
                <Card className="h-full border-border/80 shadow-sm">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Landmark className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div>
                                <h2 id="exchange-heading" className="text-lg sm:text-xl font-semibold leading-none tracking-tight">
                                    {exchangeInfo.title_ar}
                                </h2>
                                <CardDescription className="mt-1">
                                    {exchangeInfo.fees_ar}
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                        <p className="text-foreground">{exchangeInfo.summary_ar}</p>

                        <ul className="space-y-2.5">
                            {exchangeInfo.rules_ar.map((rule, index) => (
                                <li key={index} className="flex items-start gap-2">
                                    <CheckCircle2
                                        className="mt-1 h-4 w-4 shrink-0 text-primary"
                                        aria-hidden="true"
                                    />
                                    <span>{rule}</span>
                                </li>
                            ))}
                        </ul>

                        <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 text-xs space-y-2">
                            <p className="font-semibold text-foreground">البوابة الرسمية لحجز المواعيد:</p>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <a
                                    href={exchangeInfo.portal_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 font-semibold text-primary underline underline-offset-2 hover:no-underline"
                                >
                                    <span>{exchangeInfo.portal_label_ar}</span>
                                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                </a>
                                <a
                                    href={exchangeInfo.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-2 hover:text-foreground"
                                >
                                    <span>بيان المصرف المركزي</span>
                                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                </a>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </section>

            <section aria-labelledby="timeline-heading">
                <Card className="h-full border-border/80 shadow-sm">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div>
                                <h2 id="timeline-heading" className="text-lg sm:text-xl font-semibold leading-none tracking-tight">
                                    الجدول الزمني للتحول النقدي
                                </h2>
                                <CardDescription className="mt-1">
                                    المحطات الرسمية لإطلاق الليرة الجديدة وسحب العملة القديمة
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ol className="relative space-y-4 border-s border-border ps-4">
                            {timeline.map((item) => (
                                <li key={`${item.date}-${item.title_ar}`} className="relative space-y-1">
                                    <span
                                        aria-hidden="true"
                                        className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background"
                                    />
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline" className="text-[11px] font-semibold">
                                            {item.date_label_ar}
                                        </Badge>
                                        <a
                                            href={item.source_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[11px] text-primary underline underline-offset-2 hover:no-underline"
                                        >
                                            <span>{item.source_label_ar}</span>
                                            <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                                        </a>
                                    </div>
                                    <h3 className="text-sm font-bold text-foreground">{item.title_ar}</h3>
                                    <p className="text-xs leading-relaxed text-muted-foreground">
                                        {item.detail_ar}
                                    </p>
                                </li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
