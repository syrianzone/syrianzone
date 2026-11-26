import React, { useId, useMemo } from 'react';
import { ArrowLeftRight, Calculator, Check, Copy, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/Components/ui/alert';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import {
    convert,
    formatCurrencyNumber,
    parseAmount,
    type ConvertDirection,
} from '@/Domain/currency/converter';
import { CURRENCY_FACTS } from '@/Domain/currency/facts';
import { copyText } from '@/Lib/copy';

const PRESETS: Record<ConvertDirection, readonly number[]> = {
    'old-to-new': [1000, 5000, 10000, 50000, 100000],
    'new-to-old': [10, 25, 50, 100, 500],
};

interface ConverterCardProps {
    amountInput: string;
    direction: ConvertDirection;
    onAmountChange: (value: string) => void;
    onDirectionChange: (direction: ConvertDirection) => void;
}

export function ConverterCard({
    amountInput,
    direction,
    onAmountChange,
    onDirectionChange,
}: ConverterCardProps) {
    const inputId = useId();
    const errorId = useId();
    const hintId = useId();
    const [copiedRecently, setCopiedRecently] = React.useState(false);

    const trimmed = amountInput.trim();
    const parsedAmount = useMemo(() => parseAmount(amountInput), [amountInput]);
    const hasError = trimmed !== '' && parsedAmount === null;
    const validAmount = parsedAmount ?? 0;
    const converted = useMemo(
        () => (parsedAmount === null ? 0 : convert(parsedAmount, direction)),
        [parsedAmount, direction],
    );

    const sourceUnit = direction === 'old-to-new' ? 'ليرة سورية قديمة' : 'ليرة سورية جديدة';
    const targetUnit = direction === 'old-to-new' ? 'ليرة سورية جديدة' : 'ليرة سورية قديمة';
    const hasFractionInNew =
        direction === 'old-to-new' && parsedAmount !== null && !Number.isInteger(converted);

    const handleSwap = () => {
        const nextDirection: ConvertDirection =
            direction === 'old-to-new' ? 'new-to-old' : 'old-to-new';
        if (parsedAmount !== null) {
            onAmountChange(String(converted));
        }
        onDirectionChange(nextDirection);
    };

    const handleCopy = async () => {
        if (parsedAmount === null) return;
        const formatted = formatCurrencyNumber(converted);
        const text = `${formatted} ${targetUnit}`;
        const ok = await copyText(text, { successMessage: 'تم نسخ النتيجة' });
        if (ok) {
            setCopiedRecently(true);
            window.setTimeout(() => setCopiedRecently(false), 1800);
        }
    };

    const presets = PRESETS[direction];

    return (
        <Card className="border-border/80 shadow-sm">
            <Tabs
                value={direction}
                onValueChange={(value) => onDirectionChange(value as ConvertDirection)}
                dir="rtl"
            >
                <CardHeader className="space-y-4 px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2.5">
                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Calculator className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                                <h2 className="text-lg font-bold leading-snug tracking-tight sm:text-xl">
                                    حاسبة تحويل الليرة السورية
                                </h2>
                                <CardDescription className="mt-1">
                                    {CURRENCY_FACTS.ratio.summary_ar}
                                </CardDescription>
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleSwap}
                            aria-label="تبديل اتجاه التحويل"
                            className="min-h-11 shrink-0 gap-2 sm:min-h-9"
                        >
                            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                            <span>عكس الاتجاه</span>
                        </Button>
                    </div>

                    <TabsList
                        aria-label="اتجاه التحويل"
                        className="grid h-auto w-full grid-cols-2 gap-1.5 rounded-xl border border-border bg-muted/50 p-1"
                    >
                        <TabsTrigger
                            value="old-to-new"
                            className="min-h-11 rounded-lg px-2.5 py-2 text-xs font-semibold data-[state=active]:border data-[state=active]:border-border/70 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs sm:min-h-10 sm:text-sm"
                        >
                            قديمة ← جديدة (÷ 100)
                        </TabsTrigger>
                        <TabsTrigger
                            value="new-to-old"
                            className="min-h-11 rounded-lg px-2.5 py-2 text-xs font-semibold data-[state=active]:border data-[state=active]:border-border/70 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs sm:min-h-10 sm:text-sm"
                        >
                            جديدة ← قديمة (× 100)
                        </TabsTrigger>
                    </TabsList>
                </CardHeader>

                <CardContent className="px-4 pb-5 sm:px-6 sm:pb-6">
                    <TabsContent value={direction} className="mt-0 space-y-5">
                        <div className="space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Label htmlFor={inputId} className="text-sm font-semibold">
                                    المبلغ بالـ{sourceUnit}
                                </Label>
                                <span id={hintId} className="text-xs text-muted-foreground">
                                    يقبل الأرقام العربية والمشرقية والإنجليزية (0-9)
                                </span>
                            </div>
                            <Input
                                id={inputId}
                                type="text"
                                inputMode="decimal"
                                value={amountInput}
                                onChange={(e) => onAmountChange(e.target.value)}
                                placeholder={direction === 'old-to-new' ? 'مثال: 10000' : 'مثال: 100'}
                                aria-invalid={hasError || undefined}
                                aria-describedby={hasError ? `${hintId} ${errorId}` : hintId}
                                className="h-12 text-lg font-semibold tabular-nums"
                            />
                            {hasError && (
                                <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
                                    أدخل رقماً صحيحاً موجباً (يُسمح بالأرقام العربية أو الإنجليزية وفواصل الآلاف).
                                </p>
                            )}

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <span className="text-xs text-muted-foreground me-0.5">أمثلة سريعة:</span>
                                {presets.map((preset) => (
                                    <Button
                                        key={preset}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onAmountChange(String(preset))}
                                        className="min-h-11 min-w-11 px-3 text-xs tabular-nums sm:min-h-9"
                                    >
                                        {formatCurrencyNumber(preset, 0)}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div
                            role="status"
                            aria-live="polite"
                            className="rounded-xl border border-primary/25 bg-primary/5 p-4 sm:p-5"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                    <p className="text-xs font-medium text-foreground/80">
                                        النتيجة بالـ{targetUnit}
                                    </p>
                                    <p className="text-2xl font-bold text-primary tabular-nums sm:text-3xl">
                                        {parsedAmount === null ? '—' : formatCurrencyNumber(converted)}{' '}
                                        <span className="text-sm font-semibold text-foreground sm:text-base">
                                            {targetUnit}
                                        </span>
                                    </p>
                                    {parsedAmount !== null && (
                                        <p className="text-xs text-foreground/80 tabular-nums">
                                            {formatCurrencyNumber(validAmount)} {sourceUnit} ={' '}
                                            {formatCurrencyNumber(converted)} {targetUnit}
                                        </p>
                                    )}
                                </div>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleCopy}
                                    disabled={parsedAmount === null}
                                    className="min-h-11 shrink-0 gap-2 px-4 sm:min-h-9"
                                >
                                    {copiedRecently ? (
                                        <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                                    ) : (
                                        <Copy className="h-4 w-4" aria-hidden="true" />
                                    )}
                                    <span>نسخ النتيجة</span>
                                </Button>
                            </div>

                            {hasFractionInNew && (
                                <Alert className="mt-4 bg-card/80">
                                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                    <AlertDescription className="text-xs leading-relaxed">
                                        النتيجة تحتوي على كسور عشرية؛ يحدد المرسوم رقم 293 لعام 2025 القرش وحدةً
                                        صغرى (كل 1 ليرة جديدة = 100 قرش)، بينما أصغر ورقة نقدية مطروحة في
                                        التداول الفعلي هي فئة 10 ليرات جديدة (1,000 ليرة قديمة).
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    </TabsContent>
                </CardContent>
            </Tabs>
        </Card>
    );
}
