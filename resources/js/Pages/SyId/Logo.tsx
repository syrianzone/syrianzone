import React from 'react';
import { Link } from '@inertiajs/react';
import { Archive, ArrowLeft, BookOpen, Download, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Card, CardContent } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import { MEDIA_BASE } from '@/Domain/govapps/media';
import { SYID_FACTS, type SyidFacts } from '@/Domain/syid/facts';
import { PageBody, PageHeader } from '@/Components/layout';
import { DownloadRow } from './_components/DownloadRow';

interface SyidLogoPageProps {
    syid?: SyidFacts;
}

export default function SyidLogoPage({ syid }: SyidLogoPageProps) {
    const facts = syid ?? SYID_FACTS;
    const { logo, meta } = facts;
    const primaryVariant = logo.variants[0];
    const officialZipUrl = `${MEDIA_BASE}${meta.official_zip_path}`;

    return (
        <MainLayout>
            <PageBody className="space-y-10">
                <PageHeader
                    title="شعار الجمهورية العربية السورية الجديد (العقاب الذهبي)"
                    description="تحميل الشعار الرسمي للجمهورية العربية السورية المُطلق في 3 تموز 2025 بصيغ SVG وPNG بدقة 4K و1080px وPDF للطباعة، بالنسخ الذهبية والأحادية (الأسود والأبيض)، مع دلالاته الرسمية وضوابط استخدامه الموثّقة."
                    breadcrumbs={[
                        { label: 'الهوية البصرية', href: '/syid' },
                        { label: 'الشعار' },
                    ]}
                    divider
                />

                <section aria-labelledby="emblem-hero-heading" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <Card className="lg:col-span-5 border border-border rounded-2xl overflow-hidden">
                        <CardContent className="p-6 sm:p-8 flex flex-col items-center justify-center bg-muted/20 space-y-4">
                            <img
                                src={logo.hero_image.path}
                                alt={logo.hero_image.alt_ar}
                                width={logo.hero_image.width}
                                height={logo.hero_image.height}
                                className="w-full max-w-[320px] h-auto object-contain"
                            />
                            <p className="text-xs text-muted-foreground text-center leading-relaxed">
                                {logo.hero_image.caption_ar}
                            </p>
                        </CardContent>
                    </Card>

                    <div className="lg:col-span-7 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 id="emblem-hero-heading" className="text-xl sm:text-2xl font-bold text-foreground">
                                التحميل المباشر (النسخة الذهبية الرسمية)
                            </h2>
                            <Badge variant="secondary" className="text-xs">
                                خلفية شفافة
                            </Badge>
                        </div>

                        <div className="space-y-2.5">
                            {primaryVariant.downloads.map((file, index) => (
                                <DownloadRow
                                    key={file.id}
                                    file={file}
                                    primary={index === 0 || index === 1}
                                />
                            ))}
                        </div>

                        <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <Archive className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                                    <span>الحزمة الرسمية الكاملة (SVG + PDF + EPS + PNG)</span>
                                </p>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {meta.official_site_note_ar}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <a
                                    href={officialZipUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 h-10 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                                >
                                    <Download className="h-4 w-4" aria-hidden="true" />
                                    <span>تحميل الحزمة (ZIP)</span>
                                </a>
                                <a
                                    href={meta.official_site_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3.5 h-10 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                                >
                                    <span>الموقع الرسمي</span>
                                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

                <section aria-labelledby="variants-heading" className="space-y-5">
                    <div className="space-y-1">
                        <h2 id="variants-heading" className="text-xl sm:text-2xl font-bold text-foreground">
                            النسخ اللونية والأحادية للشعار
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            جميع النسخ المتوفرة من الأصول الرسمية للشعار: الذهبية للعرض الأساسي، والسوداء للخلفيات الفاتحة، والبيضاء للخلفيات الداكنة.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {logo.variants.map((variant) => (
                            <Card key={variant.id} className="border border-border rounded-2xl overflow-hidden flex flex-col">
                                <div
                                    className="flex items-center justify-center p-6 border-b border-border min-h-[200px]"
                                    style={
                                        variant.preview_bg === 'dark'
                                            ? { backgroundColor: '#161616' }
                                            : { backgroundColor: '#edebe0' }
                                    }
                                >
                                    <img
                                        src={variant.preview_path}
                                        alt={variant.alt_ar}
                                        width={variant.preview_width}
                                        height={variant.preview_height}
                                        loading="lazy"
                                        className="max-h-36 w-auto object-contain"
                                    />
                                </div>
                                <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                                    <div className="space-y-1.5">
                                        <h3 className="text-base font-bold text-foreground">
                                            {variant.title_ar}
                                        </h3>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {variant.description_ar}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        {variant.downloads.map((file) => (
                                            <a
                                                key={file.id}
                                                href={file.path}
                                                download={file.download_name}
                                                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background hover:bg-muted/60 px-3 py-2 text-xs transition-colors"
                                            >
                                                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                                                    <Download className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                                                    <span>{file.format}</span>
                                                </span>
                                                <span dir="ltr" className="font-mono text-[11px] text-muted-foreground tabular-nums">
                                                    {file.dimensions_ar} · {file.size_label}
                                                </span>
                                            </a>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                <section aria-labelledby="symbolism-heading" className="space-y-5">
                    <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Sparkles className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <h2 id="symbolism-heading" className="text-xl sm:text-2xl font-bold text-foreground">
                            دلالات الشعار ورمزية العقاب الذهبي
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {logo.symbolism.map((item) => (
                            <Card key={item.id} className="border border-border rounded-xl">
                                <CardContent className="p-5 space-y-2.5">
                                    <h3 className="text-base font-bold text-foreground">
                                        {item.title_ar}
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {item.body_ar}
                                    </p>
                                    <p className="pt-1">
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
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                <section aria-labelledby="usage-rules-heading" className="space-y-5">
                    <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <h2 id="usage-rules-heading" className="text-xl sm:text-2xl font-bold text-foreground">
                            ضوابط الاستخدام الرسمي للشعار
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {logo.usage_rules.map((rule) => (
                            <Card key={rule.id} className="border border-border rounded-xl">
                                <CardContent className="p-5 space-y-2">
                                    <h3 className="text-base font-bold text-foreground">
                                        {rule.title_ar}
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {rule.body_ar}
                                    </p>
                                    <p className="pt-1">
                                        <a
                                            href={rule.source_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-2 hover:no-underline"
                                        >
                                            <span>{rule.source_label_ar}</span>
                                            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                                        </a>
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                <section aria-labelledby="related-syid-heading" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <h2 id="related-syid-heading" className="sr-only">
                        صفحات ذات صلة بالهوية البصرية السورية
                    </h2>
                    <Link
                        href="/syid/flag"
                        className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition-colors"
                    >
                        <div className="space-y-1">
                            <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors block">
                                علم سوريا الجديد — الصور والنسب والنسخ
                            </span>
                            <span className="text-xs text-muted-foreground block">
                                نسخ إيموجي العلم 🇸🇾 وتحميل ملفات SVG وPNG 4K والنسب الهندسية والخلفيات.
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
                                لوحات الألوان، الخطوط، أيقونات المحافظات الأربع عشرة، وخريطة سوريا الرقمية.
                            </span>
                        </div>
                        <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" aria-hidden="true" />
                    </Link>
                </section>

                <footer className="border-t border-border pt-6 text-xs text-muted-foreground space-y-2">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                        <span>المصادر الرسمية المرجعية:</span>
                    </p>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {meta.sources
                            .filter((src) => src.id !== 'constitutional-declaration')
                            .map((src) => (
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
