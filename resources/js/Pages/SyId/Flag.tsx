import React, { useState } from 'react';
import { Link } from '@inertiajs/react';
import { ArrowLeft, BookOpen, Check, Copy, Download, ExternalLink, HelpCircle, Image as ImageIcon, Palette, Ruler } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/Components/ui/accordion';
import { copyText } from '@/Lib/copy';
import { notify } from '@/Lib/notify';
import { SYID_FACTS, type SyidFacts } from '@/Domain/syid/facts';
import { PageBody, PageHeader } from '@/Components/layout';
import { DownloadRow } from './_components/DownloadRow';
import { FlagProportionsDiagram } from './_components/FlagProportionsDiagram';
import './page_custom.css';

interface SyidFlagPageProps {
    syid?: SyidFacts;
}

/**
 * Copy text using the Clipboard API with an execCommand textarea fallback
 * when navigator.clipboard is unavailable (e.g. insecure contexts or older browsers).
 */
async function copyWithFallback(text: string): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Fall through to execCommand fallback below.
        }
    }

    if (typeof document === 'undefined') {
        return false;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);

    try {
        textarea.focus();
        textarea.select();
        return document.execCommand('copy');
    } catch {
        return false;
    } finally {
        document.body.removeChild(textarea);
    }
}

export default function SyidFlagPage({ syid }: SyidFlagPageProps) {
    const facts = syid ?? SYID_FACTS;
    const { flag, palettes, meta } = facts;

    const [emojiStatus, setEmojiStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
    const [copiedColorKey, setCopiedColorKey] = useState<string | null>(null);

    const handleCopyFlagEmoji = async () => {
        const ok = await copyWithFallback(flag.emoji);
        if (ok) {
            setEmojiStatus('copied');
            notify.copy(`تم النسخ: ${flag.emoji}`);
        } else {
            setEmojiStatus('failed');
            notify.error('تعذّر النسخ إلى الحافظة، يمكنك تحديد الرمز ونسخه يدوياً');
        }
        window.setTimeout(() => setEmojiStatus('idle'), 2500);
    };

    const handleCopyColor = async (value: string, key: string) => {
        const ok = await copyText(value, { successMessage: `تم النسخ: ${value}` });
        if (!ok) return;
        setCopiedColorKey(key);
        window.setTimeout(() => setCopiedColorKey(null), 2000);
    };

    return (
        <MainLayout>
            <PageBody className="space-y-10">
                <PageHeader
                    title="علم الجمهورية العربية السورية الجديد"
                    description="تحميل علم سوريا الجديد بصيغة SVG المتّجهة وصور PNG بدقات 640 و1280 و1920 و4K، مع زر نسخ إيموجي العلم مباشرة، النسب الهندسية المعتمدة (2:3)، أكواد الألوان، والخلفيات الرسمية."
                    breadcrumbs={[
                        { label: 'الهوية البصرية', href: '/syid' },
                        { label: 'العلم السوري' },
                    ]}
                    divider
                />

                <section aria-labelledby="flag-hero-heading" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <Card className="lg:col-span-7 border border-border rounded-2xl overflow-hidden">
                        <CardContent className="p-5 sm:p-6 bg-muted/20 space-y-4">
                            <img
                                src={flag.hero_image.path}
                                alt={flag.hero_image.alt_ar}
                                width={flag.hero_image.width}
                                height={flag.hero_image.height}
                                className="w-full h-auto rounded-lg border border-border shadow-xs"
                            />
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {flag.hero_image.caption_ar}
                            </p>
                        </CardContent>
                    </Card>

                    <div className="lg:col-span-5 space-y-4">
                        <Card className="border border-primary/30 bg-primary/5 rounded-2xl">
                            <CardContent className="p-5 space-y-4">
                                <div className="space-y-1">
                                    <h2 id="flag-hero-heading" className="text-lg sm:text-xl font-bold text-foreground">
                                        نسخ إيموجي علم سوريا
                                    </h2>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        انسخ الرمز مباشرة بضغطة واحدة، أو حدّده يدوياً للصقه في المحادثات والمنشورات.
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5">
                                    <div className="flex items-center gap-3">
                                        <span
                                            className="select-all text-4xl leading-none px-2 py-1 rounded-lg bg-muted/50 border border-border"
                                            aria-label="إيموجي علم سوريا"
                                        >
                                            {flag.emoji}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            نص قابل للتحديد والنسخ
                                        </span>
                                    </div>

                                    <Button
                                        type="button"
                                        onClick={handleCopyFlagEmoji}
                                        className="h-10 px-4 gap-2"
                                    >
                                        {emojiStatus === 'copied' ? (
                                            <Check className="h-4 w-4" aria-hidden="true" />
                                        ) : (
                                            <Copy className="h-4 w-4" aria-hidden="true" />
                                        )}
                                        <span>نسخ {flag.emoji}</span>
                                    </Button>
                                </div>

                                <div
                                    id="flag-copy-status"
                                    role="status"
                                    aria-live="polite"
                                    className="min-h-5 text-xs font-medium text-primary"
                                >
                                    {emojiStatus === 'copied' && 'تم النسخ'}
                                    {emojiStatus === 'failed' && 'تعذّر النسخ التلقائي — حدّد الرمز أعلاه وانسخه يدوياً'}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border border-border rounded-2xl">
                            <CardContent className="p-5 space-y-2.5">
                                <h3 className="text-sm font-bold text-foreground">
                                    المواصفة الدستورية (المادة 6)
                                </h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {flag.specs.constitutional_article_ar}
                                </p>
                                <a
                                    href={flag.specs.constitutional_source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-2 hover:no-underline"
                                >
                                    <span>المصدر: الإعلان الدستوري 2025 (سانا)</span>
                                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                                </a>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <section aria-labelledby="flag-downloads-heading" className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 id="flag-downloads-heading" className="text-xl sm:text-2xl font-bold text-foreground">
                            تحميل علم سوريا بجميع الصيغ والأحجام
                        </h2>
                        <Badge variant="secondary" className="text-xs font-mono" dir="ltr">
                            Ratio {flag.specs.aspect_ratio}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {flag.downloads.map((file, index) => (
                            <DownloadRow
                                key={file.id}
                                file={file}
                                primary={index === 0 || index === 1}
                            />
                        ))}
                    </div>
                </section>

                <section aria-labelledby="flag-proportions-heading" className="space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Ruler className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <h2 id="flag-proportions-heading" className="text-xl sm:text-2xl font-bold text-foreground">
                            النسب الهندسية للعلم السوري ({flag.specs.grid_width} × {flag.specs.grid_height} وحدة)
                        </h2>
                    </div>

                    <Card className="border border-border rounded-2xl overflow-hidden">
                        <CardContent className="p-4 sm:p-6 overflow-x-auto">
                            <FlagProportionsDiagram ariaLabel={flag.specs.diagram_aria_label_ar} />
                        </CardContent>
                        <div className="p-4 bg-muted/20 border-t border-border flex flex-wrap justify-center gap-3">
                            {flag.proportion_downloads.map((file) => (
                                <a
                                    key={file.id}
                                    href={file.path}
                                    download={file.download_name}
                                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-card hover:bg-muted px-4 h-10 text-xs font-medium text-foreground transition-colors"
                                >
                                    <Download className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                                    <span>{file.label_ar}</span>
                                    <span dir="ltr" className="text-[11px] font-mono text-muted-foreground tabular-nums">
                                        ({file.size_label})
                                    </span>
                                </a>
                            ))}
                        </div>
                    </Card>
                </section>

                <section aria-labelledby="flag-colors-heading" className="space-y-6">
                    <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Palette className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <h2 id="flag-colors-heading" className="text-xl sm:text-2xl font-bold text-foreground">
                            أكواد ألوان العلم السوري والهوية البصرية
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {flag.colors.map((color) => {
                            const hexKey = `flag-${color.hex}-hex`;
                            const rgbKey = `flag-${color.hex}-rgb`;
                            return (
                                <Card key={color.hex} className="border border-border rounded-xl overflow-hidden">
                                    <div
                                        className="h-24 w-full border-b border-border"
                                        style={{ backgroundColor: color.hex }}
                                        aria-hidden="true"
                                    />
                                    <CardContent className="p-4 space-y-2">
                                        <h3 className="text-sm font-bold text-foreground">{color.name_ar}</h3>
                                        <div dir="ltr" className="space-y-1.5 font-mono text-xs">
                                            <button
                                                type="button"
                                                onClick={() => handleCopyColor(color.hex, hexKey)}
                                                aria-label={`نسخ كود اللون ${color.hex}`}
                                                className="flex items-center justify-between w-full rounded-md border border-border bg-muted/40 hover:bg-muted px-2.5 py-1.5 text-foreground transition-colors"
                                            >
                                                <span>{color.hex}</span>
                                                {copiedColorKey === hexKey ? (
                                                    <Check className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                                                ) : (
                                                    <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyColor(color.rgb, rgbKey)}
                                                aria-label={`نسخ كود اللون ${color.rgb}`}
                                                className="flex items-center justify-between w-full rounded-md border border-border bg-muted/40 hover:bg-muted px-2.5 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                <span className="truncate">{color.rgb}</span>
                                                {copiedColorKey === rgbKey ? (
                                                    <Check className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                                                ) : (
                                                    <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                )}
                                            </button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-bold text-foreground">
                            لوحات ألوان الهوية البصرية السورية المرافقة
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {palettes.map((palette) => (
                                <Card key={palette.name} className="border border-border rounded-xl overflow-hidden">
                                    <div className="px-4 py-2.5 bg-muted/30 border-b border-border text-xs font-semibold text-foreground">
                                        {palette.name_ar}
                                    </div>
                                    <CardContent className="p-3 grid grid-cols-3 gap-2">
                                        {palette.colors.map((color) => {
                                            const pKey = `pal-${color.hex}`;
                                            return (
                                                <button
                                                    key={color.hex}
                                                    type="button"
                                                    onClick={() => handleCopyColor(color.hex, pKey)}
                                                    aria-label={`نسخ كود اللون ${color.hex} من لوحة ${palette.name}`}
                                                    className="rounded-lg border border-border p-2.5 text-center transition-transform hover:scale-[1.02]"
                                                    style={{
                                                        backgroundColor: color.hex,
                                                        color: color.textColor,
                                                    }}
                                                >
                                                    <span
                                                        dir="ltr"
                                                        className="inline-flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground"
                                                    >
                                                        <span>{color.hex}</span>
                                                        {copiedColorKey === pKey ? (
                                                            <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                                                        ) : (
                                                            <Copy className="h-3 w-3 shrink-0 opacity-80" aria-hidden="true" />
                                                        )}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </section>

                <section aria-labelledby="wallpapers-heading" className="space-y-5">
                    <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <ImageIcon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <h2 id="wallpapers-heading" className="text-xl sm:text-2xl font-bold text-foreground">
                            خلفيات الهوية البصرية السورية
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {flag.wallpapers.map((wallpaper) => (
                            <Card key={wallpaper.id} className="border border-border rounded-2xl overflow-hidden flex flex-col">
                                <div className="bg-muted/20 border-b border-border p-4 flex items-center justify-center">
                                    <img
                                        src={wallpaper.preview_path}
                                        alt={wallpaper.alt_ar}
                                        width={wallpaper.width}
                                        height={wallpaper.height}
                                        loading="lazy"
                                        className="max-h-64 w-auto rounded-lg object-contain border border-border"
                                    />
                                </div>
                                <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                                    <div className="space-y-1">
                                        <h3 className="text-base font-bold text-foreground">
                                            {wallpaper.title_ar}
                                        </h3>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {wallpaper.description_ar}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {wallpaper.downloads.map((dl, idx) => (
                                            <a
                                                key={dl.id}
                                                href={dl.path}
                                                download={dl.download_name}
                                                className={
                                                    idx === 0
                                                        ? 'inline-flex items-center justify-center gap-2 flex-1 rounded-lg bg-primary px-3.5 h-10 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors'
                                                        : 'inline-flex items-center justify-center gap-2 flex-1 rounded-lg border border-border bg-secondary px-3.5 h-10 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors'
                                                }
                                            >
                                                <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                <span>{dl.format}</span>
                                                <span dir="ltr" className="font-mono text-[11px] tabular-nums">
                                                    ({dl.size_label})
                                                </span>
                                            </a>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                <section aria-labelledby="flag-guide-heading" className="space-y-4">
                    <h2 id="flag-guide-heading" className="text-xl sm:text-2xl font-bold text-foreground">
                        {flag.guide.title_ar}
                    </h2>
                    <Card className="border border-border rounded-2xl">
                        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                            <div className="md:col-span-5 flex justify-center">
                                <img
                                    src={flag.guide.preview_path}
                                    alt={flag.guide.alt_ar}
                                    width={flag.guide.preview_width}
                                    height={flag.guide.preview_height}
                                    loading="lazy"
                                    className="max-h-52 w-auto rounded-lg border border-border object-contain"
                                />
                            </div>
                            <div className="md:col-span-7 space-y-3">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {flag.guide.note_ar}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    إعداد ومساهمة:{' '}
                                    <a
                                        href={flag.guide.contributor_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-medium text-foreground hover:text-primary underline underline-offset-2"
                                    >
                                        {flag.guide.contributor_name_ar}
                                    </a>
                                </p>
                                <a
                                    href={flag.guide.pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 h-10 text-xs sm:text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                                >
                                    <Download className="h-4 w-4" aria-hidden="true" />
                                    <span>تحميل الدليل الإرشادي (PDF)</span>
                                </a>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <section aria-labelledby="flag-faq-heading" className="space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <HelpCircle className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <h2 id="flag-faq-heading" className="text-xl sm:text-2xl font-bold text-foreground">
                            الأسئلة الشائعة
                        </h2>
                    </div>

                    <Accordion type="single" defaultValue={flag.faq[0]?.id}>
                        {flag.faq.map((item) => (
                            <AccordionItem key={item.id} value={item.id}>
                                <AccordionTrigger className="text-sm sm:text-base">
                                    <span>{item.question_ar}</span>
                                </AccordionTrigger>
                                <AccordionContent className="text-xs sm:text-sm leading-relaxed text-muted-foreground space-y-2">
                                    <p className="text-foreground/90">{item.answer_ar}</p>
                                    {item.source_url.startsWith('https://syrian.zone') ? null : (
                                        <p>
                                            <a
                                                href={item.source_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-2 hover:no-underline"
                                            >
                                                <span>{item.source_label_ar}</span>
                                                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                                            </a>
                                        </p>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </section>

                <section aria-labelledby="flag-related-heading" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <h2 id="flag-related-heading" className="sr-only">
                        صفحات ذات صلة بالهوية البصرية السورية
                    </h2>
                    <Link
                        href="/syid/logo"
                        className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition-colors"
                    >
                        <div className="space-y-1">
                            <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors block">
                                شعار الجمهورية العربية السورية الجديد (العقاب الذهبي)
                            </span>
                            <span className="text-xs text-muted-foreground block">
                                تحميل الشعار بصيغ SVG وPNG بدقة 4K وPDF بالنسخ الذهبية والأحادية مع دلالاته الرسمية.
                            </span>
                        </div>
                        <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" aria-hidden="true" />
                    </Link>

                    <Link
                        href="/syid"
                        className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition-colors"
                    >
                        <div className="space-y-1">
                            <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors block">
                                دليل الهوية البصرية السورية الشامل
                            </span>
                            <span className="text-xs text-muted-foreground block">
                                الخطوط، أيقونات المحافظات الأربع عشرة، وخريطة سوريا الرقمية.
                            </span>
                        </div>
                        <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" aria-hidden="true" />
                    </Link>
                </section>

                <footer className="border-t border-border pt-6 text-xs text-muted-foreground space-y-2">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                        <span>المصادر المرجعية:</span>
                    </p>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {meta.sources.map((src) => (
                            <li key={src.id}>
                                <a
                                    href={src.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:no-underline"
                                >
                                    <span>{src.label_ar}</span>
                                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                                </a>
                            </li>
                        ))}
                    </ul>
                </footer>
            </PageBody>
        </MainLayout>
    );
}
