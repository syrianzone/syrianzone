import React, { useId, useMemo } from 'react';
import { ArrowLeftRight, Check, Copy, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/Components/ui/alert';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import {
    convert,
    formatArabicNumber,
    parseAmount,
    type ConvertDirection,
} from '@/Domain/currency/converter';
import { CURRENCY_FACTS } from '@/Domain/currency/facts';
import { copyText } from '@/Lib/copy';
import { useTabList } from '@/Lib/useTabList';
import { cn } from '@/Lib/utils';

const DIRECTION_TABS = ['old-to-new', 'new-to-old'] as const;

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
    const [copiedRecently, setCopiedRecently] = React.useState(false);

    const tabs = useTabList({
        ids: DIRECTION_TABS,
        active: direction,
        onChange: onDirectionChange,
        dir: 'rtl',
    });

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
        const formatted = formatArabicNumber(converted);
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
            <CardHeader className="space-y-3 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg sm:text-xl font-semibold leading-none tracking-tight">حاسبة تحويل الليرة السورية</h2>
                        <CardDescription className="mt-1">
                            {CURRENCY_FACTS.ratio.summary_ar}
                        </CardDescription>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSwap}
                        aria-label="تبديل اتجاه التحويل"
                        className="gap-2"
                    >
                        <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                        <span>عكس الاتجاه</span>
                    </Button>
                </div>

                <div
                    {...tabs.tabListProps}
                    aria-label="اتجاه التحويل"
                    className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-muted/40 p-1"
                >
                    <button
                        type="button"
                        {...tabs.tabProps('old-to-new')}
                        className={cn(
                            'rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            direction === 'old-to-new'
                                ? 'bg-card text-foreground shadow-xs border border-border/70'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        قديمة ← جديدة (÷ 100)
                    </button>
                    <button
                        type="button"
                        {...tabs.tabProps('new-to-old')}
                        className={cn(
                            'rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            direction === 'new-to-old'
                                ? 'bg-card text-foreground shadow-xs border border-border/70'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        جديدة ← قديمة (× 100)
                    </button>
                </div>
            </CardHeader>

            <CardContent className="space-y-5">
                <div
                    role="tabpanel"
                    id={tabs.panelProps(direction).id}
                    aria-labelledby={tabs.panelProps(direction)['aria-labelledby']}
                    className="space-y-5"
                >
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <Label htmlFor={inputId} className="text-sm font-semibold">
                                المبلغ بالـ{sourceUnit}
                            </Label>
                            <span className="text-xs text-muted-foreground">
                                يقبل الأرقام العربية (٠-٩) والإنجليزية
                            </span>
                        </div>
                        <Input
                            id={inputId}
                            type="text"
                            inputMode="decimal"
                            value={amountInput}
                            onChange={(e) => onAmountChange(e.target.value)}
                            placeholder={direction === 'old-to-new' ? 'مثال: 10000 أو ١٠٠٠٠' : 'مثال: 100 أو ١٠٠'}
                            aria-invalid={hasError || undefined}
                            aria-describedby={hasError ? errorId : undefined}
                            className="h-12 text-lg font-semibold tabular-nums"
                        />
                        {hasError && (
                            <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
                                أدخل رقماً صحيحاً موجباً (يُسمح بالأرقام العربية أو الإنجليزية وفواصل الآلاف).
                            </p>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-xs text-muted-foreground me-1">أمثلة سريعة:</span>
                            {presets.map((preset) => (
                                <Button
                                    key={preset}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onAmountChange(String(preset))}
                                    className="h-7 px-2.5 text-xs tabular-nums"
                                >
                                    {formatArabicNumber(preset, 0)}
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
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">
                                    النتيجة بالـ{targetUnit}
                                </p>
                                <p className="text-2xl sm:text-3xl font-bold text-primary tabular-nums">
                                    {parsedAmount === null ? '—' : formatArabicNumber(converted)}{' '}
                                    <span className="text-sm sm:text-base font-semibold text-foreground">
                                        {targetUnit}
                                    </span>
                                </p>
                                {parsedAmount !== null && (
                                    <p className="text-xs text-muted-foreground">
                                        {formatArabicNumber(validAmount)} {sourceUnit} ={' '}
                                        {formatArabicNumber(converted)} {targetUnit}
                                    </p>
                                )}
                            </div>

                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={handleCopy}
                                disabled={parsedAmount === null}
                                className="gap-2 shrink-0"
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
                                <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
                                <AlertDescription className="text-xs leading-relaxed">
                                    النتيجة تحتوي على كسور عشرية؛ يحدد المرسوم رقم 293 لعام 2025 القرش وحدةً
                                    صغرى (كل 1 ليرة جديدة = 100 قرش)، بينما أصغر ورقة نقدية مطروحة في
                                    التداول الفعلي هي فئة 10 ليرات جديدة (1,000 ليرة قديمة).
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
