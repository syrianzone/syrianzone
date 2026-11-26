import React from 'react';
import { ExternalLink, HelpCircle } from 'lucide-react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/Components/ui/accordion';
import type { CurrencyFaqItem } from '@/Domain/currency/facts';

interface FaqSectionProps {
    items: readonly CurrencyFaqItem[];
}

export function FaqSection({ items }: FaqSectionProps) {
    return (
        <section aria-labelledby="faq-heading" className="space-y-4">
            <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <HelpCircle className="h-4 w-4" aria-hidden="true" />
                </span>
                <h2 id="faq-heading" className="text-xl sm:text-2xl font-bold text-foreground">
                    الأسئلة الشائعة
                </h2>
            </div>

            <Accordion type="single" defaultValue={items[0]?.id}>
                {items.map((item) => (
                    <AccordionItem key={item.id} value={item.id}>
                        <AccordionTrigger className="text-sm sm:text-base">
                            <span>{item.question_ar}</span>
                        </AccordionTrigger>
                        <AccordionContent className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                            <p className="text-foreground/90">{item.answer_ar}</p>
                            <p>
                                <a
                                    href={item.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-2 hover:no-underline"
                                >
                                    <span>المرجع الرسمي</span>
                                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                </a>
                            </p>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </section>
    );
}
