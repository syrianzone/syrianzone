import React, { useState } from 'react';
import { ExternalLink, Info, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/Components/ui/alert';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { formatCurrencyNumber } from '@/Domain/currency/converter';
import type { CurrencyImage, NewDenomination, OldDenomination } from '@/Domain/currency/facts';

interface NoteCardProps {
    title: string;
    equivalentLabel: string;
    typeLabel: string;
    colorLabel: string;
    motifsLabel: string;
    extraLabel?: string;
    statusLabel?: string;
    frontImage: CurrencyImage;
    backImage: CurrencyImage | null;
}

function BanknoteCard({
    title,
    equivalentLabel,
    typeLabel,
    colorLabel,
    motifsLabel,
    extraLabel,
    statusLabel,
    frontImage,
    backImage,
}: NoteCardProps) {
    const [showBack, setShowBack] = useState(false);
    const activeImage = showBack && backImage ? backImage : frontImage;

    return (
        <Card className="flex min-w-0 flex-col overflow-hidden border-border/80 shadow-xs">
            <div className="relative border-b border-border/60 bg-muted/40 p-3">
                <div className="flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-lg bg-muted/60">
                    <img
                        src={activeImage.path}
                        alt={activeImage.alt}
                        width={activeImage.width}
                        height={activeImage.height}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain"
                    />
                </div>
                {backImage && (
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                            {showBack ? 'الوجه الخلفي' : 'الوجه الأمامي'}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowBack((prev) => !prev)}
                            aria-label={`${showBack ? 'عرض الوجه الأمامي' : 'عرض الوجه الخلفي'} — ${title}`}
                            className="min-h-11 gap-1.5 px-3 text-xs sm:min-h-9"
                        >
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{showBack ? 'الوجه الأمامي' : 'الوجه الخلفي'}</span>
                        </Button>
                    </div>
                )}
            </div>

            <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base font-bold leading-snug">{title}</CardTitle>
                    <Badge variant="outline" className="text-[11px]">
                        {typeLabel}
                    </Badge>
                </div>
                <p className="text-xs font-semibold text-primary tabular-nums">{equivalentLabel}</p>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col justify-between gap-3 px-4 pb-4 text-xs leading-relaxed text-muted-foreground sm:px-5 sm:pb-5">
                <dl className="space-y-1.5">
                    <div>
                        <dt className="inline font-semibold text-foreground">اللون الأساسي: </dt>
                        <dd className="inline">{colorLabel}</dd>
                    </div>
                    <div>
                        <dt className="inline font-semibold text-foreground">أبرز المعالم والرموز: </dt>
                        <dd className="inline">{motifsLabel}</dd>
                    </div>
                    {extraLabel && (
                        <div>
                            <dt className="inline font-semibold text-foreground">الوجه الخلفي: </dt>
                            <dd className="inline">{extraLabel}</dd>
                        </div>
                    )}
                    {statusLabel && (
                        <div>
                            <dt className="inline font-semibold text-foreground">الحالة: </dt>
                            <dd className="inline">{statusLabel}</dd>
                        </div>
                    )}
                </dl>

                <p className="border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                    مصدر الصورة:{' '}
                    <a
                        href={activeImage.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 py-0.5 text-primary underline underline-offset-2 hover:no-underline"
                    >
                        <span>{activeImage.credit_ar}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                    </a>
                </p>
            </CardContent>
        </Card>
    );
}

interface BanknoteGalleryProps {
    newDenominations: readonly NewDenomination[];
    oldDenominations: readonly OldDenomination[];
    denominationsNote: string;
    denominationsNoteSourceUrl: string;
}

export function BanknoteGallery({
    newDenominations,
    oldDenominations,
    denominationsNote,
    denominationsNoteSourceUrl,
}: BanknoteGalleryProps) {
    return (
        <section aria-labelledby="gallery-heading" className="space-y-7">
            <div className="space-y-3">
                <h2 id="gallery-heading" className="text-xl font-bold text-foreground sm:text-2xl">
                    معرض فئات الليرة السورية
                </h2>
                <Alert>
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <AlertDescription className="text-xs leading-relaxed sm:text-sm">
                        {denominationsNote}{' '}
                        <a
                            href={denominationsNoteSourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 py-0.5 font-medium text-primary underline underline-offset-2 hover:no-underline"
                        >
                            <span>المصدر الرسمي (سانا)</span>
                            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                        </a>
                    </AlertDescription>
                </Alert>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-bold text-foreground">
                    1. فئات الليرة السورية الجديدة (المتداولة)
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {newDenominations.map((note) => (
                        <BanknoteCard
                            key={`new-${note.value}`}
                            title={`${formatCurrencyNumber(note.value, 0)} ليرة سورية جديدة`}
                            equivalentLabel={`تعادل ${formatCurrencyNumber(note.old_equivalent, 0)} ليرة قديمة`}
                            typeLabel={note.type_ar}
                            colorLabel={note.color_ar}
                            motifsLabel={note.motifs_ar}
                            extraLabel={note.back_ar}
                            frontImage={note.front_image}
                            backImage={note.back_image}
                        />
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-bold text-foreground">
                    2. فئات الليرة السورية القديمة (المسحوبة من التداول)
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {oldDenominations.map((note) => (
                        <BanknoteCard
                            key={`old-${note.value}`}
                            title={`${formatCurrencyNumber(note.value, 0)} ليرة سورية قديمة`}
                            equivalentLabel={`تعادل ${formatCurrencyNumber(note.new_equivalent)} ليرة جديدة`}
                            typeLabel={note.type_ar}
                            colorLabel={note.color_ar}
                            motifsLabel={note.motifs_ar}
                            statusLabel={`${note.status_ar} — ${note.withdrawal_phase_ar}`}
                            frontImage={note.front_image}
                            backImage={note.back_image}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
