import React, { useMemo } from 'react';
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
import { breakdown, convert, formatArabicNumber } from '@/Domain/currency/converter';

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
                            `${formatArabicNumber(r.count, 0)} × ${formatArabicNumber(r.denomination, 0)}`,
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
                <CardHeader className="pb-3">
                    <h2 id="common-amounts-heading" className="text-lg sm:text-xl font-semibold leading-none tracking-tight">
                        جدول التحويل السريع للمبالغ الشائعة
                    </h2>
                    <CardDescription>
                        مقارنة سريعة لأبرز المبالغ من الليرة القديمة إلى الليرة السورية الجديدة وأقل عدد من الأوراق للدفع.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>بالليرة القديمة</TableHead>
                                <TableHead>بالليرة الجديدة</TableHead>
                                <TableHead>أقل تقسيم بالأوراق الجديدة</TableHead>
                                <TableHead className="text-end">إجراء</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow key={row.oldAmount}>
                                    <TableCell className="font-medium tabular-nums">
                                        {formatArabicNumber(row.oldAmount, 0)} ل.س قديمة
                                    </TableCell>
                                    <TableCell className="font-bold text-primary tabular-nums">
                                        {formatArabicNumber(row.newAmount)} ل.س جديدة
                                    </TableCell>
                                    <TableCell className="text-muted-foreground tabular-nums">
                                        {row.notesSummary}{' '}
                                        <span className="text-xs">
                                            ({formatArabicNumber(row.totalNotes, 0)} ورقة)
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-end">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onSelectOldAmount(row.oldAmount)}
                                            aria-label={`تطبيق مبلغ ${formatArabicNumber(row.oldAmount, 0)} ليرة قديمة في المحوّل`}
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
