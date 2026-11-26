import React, { useState } from 'react';
import { ExternalLink, Info, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/Components/ui/alert';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { formatArabicNumber } from '@/Domain/currency/converter';
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
    eager?: boolean;
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
    eager = false,
}: NoteCardProps) {
    const [showBack, setShowBack] = useState(false);
    const activeImage = showBack && backImage ? backImage : frontImage;

    return (
        <Card className="flex flex-col overflow-hidden border-border/80 shadow-xs">
            <div className="relative bg-muted/40 p-3 border-b border-border/60">
                <div className="aspect-[16/9] w-full overflow-hidden rounded-lg bg-muted/60 flex items-center justify-center">
                    <img
                        src={activeImage.path}
                        alt={activeImage.alt}
                        width={activeImage.width}
                        height={activeImage.height}
                        loading={eager ? 'eager' : 'lazy'}
                        decoding="async"
                        className="h-full w-full object-contain"
                    />
                </div>
                {backImage && (
                    <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-muted-foreground">
                            {showBack ? 'الوجه الخلفي' : 'الوجه الأمامي'}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowBack((prev) => !prev)}
                            aria-label={`${showBack ? 'عرض الوجه الأمامي' : 'عرض الوجه الخلفي'} — ${title}`}
                            className="h-7 gap-1.5 px-2.5 text-xs"
                        >
                            <RefreshCw className="h-3 w-3" aria-hidden="true" />
                            <span>{showBack ? 'الوجه الأمامي' : 'الوجه الخلفي'}</span>
                        </Button>
                    </div>
                )}
            </div>

            <CardHeader className="pb-2 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base font-bold">{title}</CardTitle>
                    <Badge variant="outline" className="text-[11px]">
                        {typeLabel}
                    </Badge>
                </div>
                <p className="text-xs font-semibold text-primary tabular-nums">{equivalentLabel}</p>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col justify-between gap-3 text-xs leading-relaxed text-muted-foreground">
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
                        className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:no-underline"
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
        <section aria-labelledby="gallery-heading" className="space-y-8">
            <div className="space-y-3">
                <h2 id="gallery-heading" className="text-xl sm:text-2xl font-bold text-foreground">
                    معرض فئات الليرة السورية
                </h2>
                <Alert>
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
                    <AlertDescription className="text-xs sm:text-sm leading-relaxed">
                        {denominationsNote}{' '}
                        <a
                            href={denominationsNoteSourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:no-underline"
                        >
                            <span>المصدر الرسمي (سانا)</span>
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                    </AlertDescription>
                </Alert>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-bold text-foreground">
                    1. فئات الليرة السورية الجديدة (المتداولة)
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {newDenominations.map((note, idx) => (
                        <BanknoteCard
                            key={`new-${note.value}`}
                            title={`${formatArabicNumber(note.value, 0)} ليرة سورية جديدة`}
                            equivalentLabel={`تعادل ${formatArabicNumber(note.old_equivalent, 0)} ليرة قديمة`}
                            typeLabel={note.type_ar}
                            colorLabel={note.color_ar}
                            motifsLabel={note.motifs_ar}
                            extraLabel={note.back_ar}
                            frontImage={note.front_image}
                            backImage={note.back_image}
                            eager={idx === 0}
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
                            title={`${formatArabicNumber(note.value, 0)} ليرة سورية قديمة`}
                            equivalentLabel={`تعادل ${formatArabicNumber(note.new_equivalent)} ليرة جديدة`}
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
