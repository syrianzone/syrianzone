import React, { useMemo } from 'react';
import { Banknote, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/Components/ui/alert';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader } from '@/Components/ui/card';
import { breakdown, formatCurrencyNumber } from '@/Domain/currency/converter';
import { CURRENCY_FACTS, type NewDenomination } from '@/Domain/currency/facts';

interface PaymentBreakdownProps {
    newAmount: number | null;
}

export function PaymentBreakdown({ newAmount }: PaymentBreakdownProps) {
    const denomByValue = useMemo(() => {
        const map = new Map<number, NewDenomination>();
        for (const item of CURRENCY_FACTS.new_denominations) {
            map.set(item.value, item);
        }
        return map;
    }, []);

    const result = useMemo(
        () => (newAmount === null ? null : breakdown(newAmount)),
        [newAmount],
    );

    const screenReaderSummary = useMemo(() => {
        if (!result || result.target <= 0) return 'لا يوجد مبلغ محسوب بعد.';
        if (result.rows.length === 0) {
            return `لا يمكن دفع ${formatCurrencyNumber(result.target)} ليرة جديدة بالأوراق النقدية المتداولة، لأن أصغر فئة هي 10 ليرات جديدة.`;
        }
        const parts = result.rows.map(
            (row) => `${formatCurrencyNumber(row.count, 0)} × فئة ${formatCurrencyNumber(row.denomination, 0)} ليرة`,
        );
        return `إجمالي الأوراق المطلوبة: ${formatCurrencyNumber(result.totalNotes, 0)} ورقة (${parts.join('، ')}).`;
    }, [result]);

    return (
        <Card className="border-border/80 shadow-sm">
            <CardHeader className="px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
                <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Banknote className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold leading-snug tracking-tight sm:text-xl">كيف أدفع هذا المبلغ؟</h2>
                        <CardDescription className="mt-1">
                            أقل عدد ممكن من الأوراق النقدية السورية الجديدة (فئات: 10، 25، 50، 100، 200، 500 ليرة جديدة فقط)
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4 px-4 pb-5 sm:px-6 sm:pb-6">
                {result === null ? (
                    <p className="text-sm text-muted-foreground">
                        أدخل مبلغاً صحيحاً في المحوّل أعلاه لعرض تقسيم الأوراق النقدية الجديدة.
                    </p>
                ) : result.target === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        المبلغ يساوي صفراً؛ لا توجد أوراق نقدية مطلوبة للدفع.
                    </p>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-sm">
                            <span>
                                المبلغ المطلوب بالعملة الجديدة:{' '}
                                <strong className="text-foreground tabular-nums">
                                    {formatCurrencyNumber(result.target)} ل.س جديدة
                                </strong>
                            </span>
                            {result.totalNotes > 0 && (
                                <Badge variant="secondary" className="tabular-nums">
                                    {formatCurrencyNumber(result.totalNotes, 0)} ورقة نقدية
                                </Badge>
                            )}
                        </div>

                        <p className="sr-only" role="status" aria-live="polite">
                            {screenReaderSummary}
                        </p>

                        {result.rows.length > 0 && (
                            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {result.rows.map((row) => {
                                    const info = denomByValue.get(row.denomination);
                                    return (
                                        <li
                                            key={row.denomination}
                                            className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-3"
                                        >
                                            {info ? (
                                                <img
                                                    src={info.front_image.path}
                                                    alt={info.front_image.alt}
                                                    width={info.front_image.width}
                                                    height={info.front_image.height}
                                                    loading="lazy"
                                                    decoding="async"
                                                    className="h-12 w-24 shrink-0 rounded-md border border-border/60 object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-12 w-24 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-bold">
                                                    {formatCurrencyNumber(row.denomination, 0)}
                                                </div>
                                            )}

                                            <div className="min-w-0 flex-1 space-y-0.5">
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-base font-bold text-primary tabular-nums">
                                                        {formatCurrencyNumber(row.count, 0)} ×
                                                    </span>
                                                    <span className="text-sm font-semibold text-foreground">
                                                        فئة {formatCurrencyNumber(row.denomination, 0)} ل.س
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground tabular-nums">
                                                    المجموع: {formatCurrencyNumber(row.subtotal, 0)} ل.س جديدة
                                                </p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        {!result.exact && (
                            <Alert variant="warning">
                                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                <AlertDescription className="space-y-1 text-xs leading-relaxed text-foreground/90">
                                    <p className="font-semibold text-foreground">
                                        {result.payable > 0 ? (
                                            <>
                                                أقرب مبلغ يمكن دفعه بالأوراق المتداولة (أقل أو يساوي المطلوب) هو{' '}
                                                <span className="tabular-nums">
                                                    {formatCurrencyNumber(result.payable, 0)} ليرة جديدة
                                                </span>
                                                ، ويتبقى فرق قدره{' '}
                                                <span className="tabular-nums">
                                                    {formatCurrencyNumber(result.remainder)} ليرة جديدة
                                                </span>{' '}
                                                (يعادل{' '}
                                                <span className="tabular-nums">
                                                    {formatCurrencyNumber(result.remainder * CURRENCY_FACTS.ratio.old_per_new)} ليرة قديمة
                                                </span>
                                                ).
                                            </>
                                        ) : (
                                            <>
                                                لا يمكن دفع{' '}
                                                <span className="tabular-nums">
                                                    {formatCurrencyNumber(result.target)} ليرة جديدة
                                                </span>{' '}
                                                نقداً بالأوراق المتداولة وحدها (يتبقى كامل المبلغ:{' '}
                                                <span className="tabular-nums">
                                                    {formatCurrencyNumber(result.remainder)} ليرة جديدة
                                                </span>
                                                ).
                                            </>
                                        )}
                                    </p>
                                    <p>
                                        السبب: أصغر ورقة نقدية مطروحة في التداول هي فئة 10 ليرات جديدة، ولا توجد
                                        أوراق أو قطع نقدية لفئات أصغر (مثل 5 ليرات أو 1 ليرة أو القروش) للتعامل
                                        النقدي المباشر.
                                    </p>
                                </AlertDescription>
                            </Alert>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
