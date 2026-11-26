import React, { useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Alert, AlertDescription } from '@/Components/ui/alert';
import { CurrencyIcon } from '@/Components/Icons/ProjectIcons';
import {
    convert,
    parseAmount,
    type ConvertDirection,
} from '@/Domain/currency/converter';
import { CURRENCY_FACTS, type CurrencyFacts } from '@/Domain/currency/facts';
import { ConverterCard } from './_components/ConverterCard';
import { PaymentBreakdown } from './_components/PaymentBreakdown';
import { CommonAmountsTable } from './_components/CommonAmountsTable';
import { BanknoteGallery } from './_components/BanknoteGallery';
import { TimelineAndExchange } from './_components/TimelineAndExchange';
import { FaqSection } from './_components/FaqSection';

interface CurrencyPageProps {
    currency?: CurrencyFacts;
}

export default function CurrencyIndex({ currency }: CurrencyPageProps) {
    const facts = currency ?? CURRENCY_FACTS;

    // Default to 10,000 old SYP -> 100 new SYP so SSR renders a complete example without JS.
    const [amountInput, setAmountInput] = useState('10000');
    const [direction, setDirection] = useState<ConvertDirection>('old-to-new');

    const newEquivalentAmount = useMemo(() => {
        const parsed = parseAmount(amountInput);
        if (parsed === null) return null;
        return direction === 'old-to-new' ? convert(parsed, 'old-to-new') : parsed;
    }, [amountInput, direction]);

    const handleSelectOldAmount = (oldAmount: number) => {
        setDirection('old-to-new');
        setAmountInput(String(oldAmount));
    };

    return (
        <MainLayout>
            <div className="min-h-screen bg-background text-foreground" dir="rtl">
                <section className="border-b border-border bg-card py-7 shadow-xs sm:py-10">
                    <div className="mx-auto max-w-4xl px-4 text-center">
                        <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-background shadow-xs sm:h-14 sm:w-14">
                            <CurrencyIcon className="h-7 w-7 sm:h-8 sm:w-8" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                            تحويل الليرة السورية الجديدة والقديمة
                        </h1>
                        <p className="mx-auto mt-2.5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                            أداة حساب تحويل العملة السورية بمعيار حذف صفرين (100 قديمة = 1 جديدة)، مع تقسيم الفئات للدفع ومعرض الأوراق النقدية الرسمية.
                        </p>
                    </div>
                </section>

                <div className="mx-auto w-full max-w-6xl space-y-6 px-3.5 py-5 sm:space-y-8 sm:px-6 sm:py-8">
                    <Alert variant="warning" className="px-3.5 py-3 sm:px-4 sm:py-3.5">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <div className="min-w-0 space-y-1">
                            <p className="text-xs font-bold leading-snug text-foreground sm:text-sm">
                                {facts.legal_status.headline_ar}
                            </p>
                            <AlertDescription className="text-xs leading-relaxed text-foreground/90 sm:text-sm">
                                {facts.legal_status.summary_ar}{' '}
                                <a
                                    href={facts.legal_status.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 py-0.5 font-semibold text-primary underline underline-offset-2 hover:no-underline"
                                >
                                    <span>القرار رقم (372/ح)</span>
                                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                                </a>
                            </AlertDescription>
                        </div>
                    </Alert>

                    <ConverterCard
                        amountInput={amountInput}
                        direction={direction}
                        onAmountChange={setAmountInput}
                        onDirectionChange={setDirection}
                    />

                    <PaymentBreakdown newAmount={newEquivalentAmount} />

                    <CommonAmountsTable
                        commonAmountsOld={facts.common_amounts_old}
                        onSelectOldAmount={handleSelectOldAmount}
                    />

                    <BanknoteGallery
                        newDenominations={facts.new_denominations}
                        oldDenominations={facts.old_denominations}
                        denominationsNote={facts.denominations_note_ar}
                        denominationsNoteSourceUrl={facts.denominations_note_source_url}
                    />

                    <TimelineAndExchange
                        exchangeInfo={facts.exchange_info}
                        timeline={facts.timeline}
                    />

                    <FaqSection items={facts.faq} />

                    <footer className="space-y-2 border-t border-border pt-6 text-xs text-muted-foreground">
                        <p className="font-semibold text-foreground">المصادر الرسمية المرجعية:</p>
                        <ul className="flex flex-wrap gap-x-4 gap-y-2">
                            {facts.meta.sources.map((src) => (
                                <li key={src.url}>
                                    <a
                                        href={src.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 py-1 text-primary underline underline-offset-2 hover:no-underline"
                                    >
                                        <span>{src.label_ar}</span>
                                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </footer>
                </div>
            </div>
        </MainLayout>
    );
}
