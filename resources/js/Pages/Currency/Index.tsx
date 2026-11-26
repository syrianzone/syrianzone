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
            <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
                <header className="space-y-3">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-card shadow-xs">
                            <CurrencyIcon className="h-7 w-7" />
                        </span>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                                تحويل الليرة السورية الجديدة والقديمة
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                أداة حساب تحويل العملة السورية بمعيار حذف صفرين (100 قديمة = 1 جديدة)، مع تقسيم الفئات للدفع ومعرض الأوراق النقدية الرسمية.
                            </p>
                        </div>
                    </div>

                    <Alert variant="warning">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="space-y-1">
                            <p className="text-sm font-bold leading-none tracking-tight text-foreground">
                                {facts.legal_status.headline_ar}
                            </p>
                            <AlertDescription className="text-xs sm:text-sm leading-relaxed">
                                {facts.legal_status.summary_ar}{' '}
                                <a
                                    href={facts.legal_status.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2 hover:no-underline"
                                >
                                    <span>القرار رقم (372/ح)</span>
                                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                </a>
                            </AlertDescription>
                        </div>
                    </Alert>
                </header>

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

                <footer className="border-t border-border pt-6 text-xs text-muted-foreground space-y-2">
                    <p className="font-semibold text-foreground">المصادر الرسمية المرجعية:</p>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {facts.meta.sources.map((src) => (
                            <li key={src.url}>
                                <a
                                    href={src.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:no-underline"
                                >
                                    <span>{src.label_ar}</span>
                                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                </a>
                            </li>
                        ))}
                    </ul>
                </footer>
            </div>
        </MainLayout>
    );
}
