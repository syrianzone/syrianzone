import React, { useMemo } from 'react';
import { Coins } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader } from '@/Components/ui/card';
import { Button } from '@/Components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/Components/ui/table';
import { breakdown, convert, formatCurrencyNumber } from '@/Domain/currency/converter';

interface CommonAmountsTableProps {
    commonAmountsOld: readonly number[];
    onSelectOldAmount: (oldAmount: number) => void;
}

export function CommonAmountsTable({
    commonAmountsOld,
    onSelectOldAmount,
}: CommonAmountsTableProps) {
    const rows = useMemo(
        () =>
            commonAmountsOld.map((oldAmount) => {
                const newAmount = convert(oldAmount, 'old-to-new');
                const bd = breakdown(newAmount);
                const notesSummary = bd.rows
                    .map(
                        (r) =>
                            `${formatCurrencyNumber(r.count, 0)} × ${formatCurrencyNumber(r.denomination, 0)}`,
                    )
                    .join(' + ');

                return {
                    oldAmount,
                    newAmount,
                    totalNotes: bd.totalNotes,
                    notesSummary: notesSummary || '—',
                };
            }),
        [commonAmountsOld],
    );

    return (
        <section aria-labelledby="common-amounts-heading" className="space-y-3">
            <Card className="border-border/80 shadow-sm">
                <CardHeader className="px-4 pb-3 pt-5 sm:px-6 sm:pt-6">
                    <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Coins className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <h2 id="common-amounts-heading" className="text-lg font-bold leading-snug tracking-tight sm:text-xl">
                                جدول التحويل السريع للمبالغ الشائعة
                            </h2>
                            <CardDescription className="mt-1">
                                مقارنة سريعة لأبرز المبالغ من الليرة القديمة إلى الليرة السورية الجديدة وأقل عدد من الأوراق للدفع.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="px-4 pb-5 sm:px-6 sm:pb-6">
                    <Table regionLabel="تفاصيل جدول التحويل السريع للمبالغ الشائعة">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="px-2.5 sm:px-4">بالليرة القديمة</TableHead>
                                <TableHead className="px-2.5 sm:px-4">بالليرة الجديدة</TableHead>
                                <TableHead className="px-2.5 sm:px-4">أقل تقسيم بالأوراق الجديدة</TableHead>
                                <TableHead className="px-2.5 text-end sm:px-4">إجراء</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow key={row.oldAmount}>
                                    <TableCell className="whitespace-nowrap px-2.5 py-2.5 font-medium tabular-nums sm:px-4 sm:py-3">
                                        {formatCurrencyNumber(row.oldAmount, 0)} ل.س قديمة
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap px-2.5 py-2.5 font-bold text-primary tabular-nums sm:px-4 sm:py-3">
                                        {formatCurrencyNumber(row.newAmount)} ل.س جديدة
                                    </TableCell>
                                    <TableCell className="min-w-[160px] px-2.5 py-2.5 text-muted-foreground tabular-nums sm:px-4 sm:py-3">
                                        {row.notesSummary}{' '}
                                        <span className="text-xs">
                                            ({formatCurrencyNumber(row.totalNotes, 0)} ورقة)
                                        </span>
                                    </TableCell>
                                    <TableCell className="px-2.5 py-2.5 text-end sm:px-4 sm:py-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onSelectOldAmount(row.oldAmount)}
                                            aria-label={`تطبيق مبلغ ${formatCurrencyNumber(row.oldAmount, 0)} ليرة قديمة في المحوّل`}
                                            className="min-h-11 min-w-11 px-3 sm:min-h-9"
                                        >
                                            تطبيق
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </section>
    );
}
