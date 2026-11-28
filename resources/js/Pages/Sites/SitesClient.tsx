import { useMemo, useState } from 'react';
import { Search, Globe, ExternalLink, Plus } from 'lucide-react';
import { Button } from "@/Components/ui/button";
import { Card, CardContent } from "@/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import { Badge } from "@/Components/ui/badge";
import type { Website } from './types';
import DirectoryEmptyState from '@/Components/directory/DirectoryEmptyState';
import { DirectoryFacetFilter } from '@/Components/directory/DirectoryFacetFilter';
import { ResponsiveTable } from '@/Components/directory/ResponsiveTable';
import DirectoryLoadMore from '@/Components/directory/DirectoryLoadMore';
import DirectoryResultCount from '@/Components/directory/DirectoryResultCount';
import { DirectorySearch } from '@/Components/directory/DirectorySearch';
import DirectoryViewToggle from '@/Components/directory/DirectoryViewToggle';
import { useDirectory, type DirectoryFacet } from '@/Components/directory/useDirectory';
import { PageBody, PageHeader } from '@/Components/layout';

interface SitesClientProps {
    initialWebsites: Website[];
}

const ITEMS_PER_PAGE = 24;

function formatSiteTotal(count: number): string {
    if (count === 1) return 'موقع واحد';
    if (count === 2) return 'موقعين';
    const mod100 = count % 100;
    if (mod100 >= 3 && mod100 <= 10) return `${count} مواقع`;
    if (mod100 === 0 || mod100 === 1 || mod100 === 2) return `${count} موقع`;
    return `${count} موقعاً`;
}

const getTypeDisplayName = (type: string) => {
    if (type.includes('مدونة شخصية')) return 'المدونات الشخصية';
    if (type.includes('شركة') || type.includes('مبادرة')) return 'المواقع التعريفية';
    if (type.includes('مجلة') || type.includes('إخباري')) return 'المدونات والمواقع الإخبارية';
    return type;
};

const getFaviconUrl = (url: string) => {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
    } catch {
        return '';
    }
};

/** The list comes from an external sheet: only ever link to http(s) URLs. */
const safeSiteUrl = (url: string): string | null => {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
    } catch {
        return null;
    }
};

const siteSearchText = (site: Website) => `${site.name} ${site.description} ${site.url}`;

const TYPE_FACET: DirectoryFacet<Website> = {
    key: 'type',
    label: 'النوع',
    options: [],
    valueOf: (site) => site.type,
};

export default function SitesClient({ initialWebsites }: SitesClientProps) {
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    const categories = useMemo(
        () => Array.from(new Set(initialWebsites.map(w => w.type).filter(Boolean))).sort(),
        [initialWebsites],
    );
    const facets = useMemo<DirectoryFacet<Website>[]>(
        () => [{ ...TYPE_FACET, options: categories.map(type => ({ value: type, label: getTypeDisplayName(type) })) }],
        [categories],
    );
    const directory = useDirectory<Website>({
        items: initialWebsites,
        searchText: siteSearchText,
        facets,
        pageSize: ITEMS_PER_PAGE,
    });

    return (
        <div className="min-h-screen transition-colors" dir="rtl">
            <PageHeader
                title="المواقع السورية"
                description="قاعدة بيانات المواقع السورية مصنفة حسب القطاعات."
                actions={
                    <Button asChild variant="outline" size="sm" className="h-9 bg-card shadow-none">
                        <a
                            href="https://docs.google.com/forms/d/e/1FAIpQLSdIu8TFwSmT7fHxzsVlOwt35X9Myfhg0RZ6jwEkIMxxvyctqA/viewform"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Plus size={16} aria-hidden="true" />
                            <span>إضافة موقع</span>
                        </a>
                    </Button>
                }
            />

            <PageBody>
                <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                    <DirectorySearch
                        className="sm:max-w-xs"
                        value={directory.query}
                        onChange={directory.setQuery}
                        placeholder="ابحث في المواقع السورية..."
                        ariaLabel="ابحث في المواقع السورية"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 sm:flex-1">
                        <DirectoryFacetFilter
                            label="النوع"
                            options={facets[0].options}
                            value={directory.filters.type ?? []}
                            onChange={(next) => directory.setFilters({ ...directory.filters, type: next })}
                        />
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <DirectoryResultCount>
                        {directory.results.length === 0
                            ? 'لا توجد نتائج مطابقة'
                            : `عرض ${directory.shown} من أصل ${formatSiteTotal(directory.results.length)}`}
                    </DirectoryResultCount>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">عرض:</span>
                            <DirectoryViewToggle value={viewMode} onChange={setViewMode} className="shadow-xs" />
                        </div>
                    </div>
                </div>

                {directory.results.length === 0 ? (
                    <DirectoryEmptyState
                        icon={Search}
                        title="لا توجد مواقع مطابقة"
                        description="جرّب تعديل كلمات البحث أو خيارات التصفية."
                        directory={directory}
                    />
                ) : (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3.5 sm:gap-4">
                                {directory.visible.map(site => {
                                    const href = safeSiteUrl(site.url);
                                    const CardShell = href ? 'a' : 'div';
                                    return (
                                    <CardShell
                                        key={site.id}
                                        {...(href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {})}
                                        className="block h-full group"
                                    >
                                        <Card className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all duration-200 flex flex-col justify-between h-full text-center">
                                            <CardContent className="p-4 flex flex-col items-center h-full w-full justify-between">
                                                <div className="flex flex-col items-center w-full">
                                                    {/* Light-shaded icon frame for optimal icon contrast even in dark mode */}
                                                    <div className="w-14 h-14 mb-3.5 bg-white dark:bg-slate-100 rounded-xl p-2.5 flex items-center justify-center relative overflow-hidden shadow-xs ring-1 ring-border/80 group-hover:scale-105 transition-transform shrink-0">
                                                        <img
                                                            src={getFaviconUrl(site.url)}
                                                            alt=""
                                                            width={36}
                                                            height={36}
                                                            loading="lazy"
                                                            decoding="async"
                                                            referrerPolicy="no-referrer"
                                                            className="w-9 h-9 object-contain"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                            }}
                                                        />
                                                        <Globe className="w-8 h-8 text-zinc-700 hidden" aria-hidden="true" />
                                                    </div>

                                                    <h2 className="font-bold text-sm text-foreground mb-1.5 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                                                        {site.name}
                                                    </h2>

                                                    <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 bg-primary/5 text-primary border-primary/20 shrink-0">
                                                        {getTypeDisplayName(site.type)}
                                                    </Badge>
                                                </div>

                                                {site.description && (
                                                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mt-3 pt-2.5 border-t border-border/50 w-full">
                                                        {site.description}
                                                    </p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </CardShell>
                                    );
                                })}
                            </div>
                        ) : (
                            <ResponsiveTable
                                items={directory.visible}
                                getKey={(site) => site.id}
                                mobileLabel="قائمة المواقع"
                                headerClassName="bg-muted"
                                renderMobileItem={(site) => {
                                    const href = safeSiteUrl(site.url);
                                    return (
                                        <>
                                            <div className="flex items-center justify-between gap-2.5">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-100 border border-border/80 flex items-center justify-center shrink-0 p-1">
                                                        <img
                                                            src={getFaviconUrl(site.url)}
                                                            alt=""
                                                            width={20}
                                                            height={20}
                                                            loading="lazy"
                                                            decoding="async"
                                                            referrerPolicy="no-referrer"
                                                            className="w-5 h-5 object-contain"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                            }}
                                                        />
                                                        <Globe className="w-4 h-4 text-zinc-700 hidden" aria-hidden="true" />
                                                    </div>
                                                    <span className="text-foreground font-semibold text-sm truncate">{site.name}</span>
                                                </div>
                                                {href && (
                                                    <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                                                        <span>زيارة<span className="sr-only"> {site.name} (يفتح في نافذة جديدة)</span></span>
                                                        <ExternalLink size={12} aria-hidden="true" />
                                                    </a>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-xs text-muted-foreground truncate flex-1">{site.description}</p>
                                                <Badge variant="outline" className="font-normal text-[10px] shrink-0 whitespace-nowrap">
                                                    {getTypeDisplayName(site.type)}
                                                </Badge>
                                            </div>
                                        </>
                                    );
                                }}
                                desktopHeader={
                                    <TableRow>
                                        <TableHead className="text-start font-bold">الموقع</TableHead>
                                        <TableHead className="text-start font-bold">النوع</TableHead>
                                        <TableHead className="text-start font-bold w-1/3">الوصف</TableHead>
                                        <TableHead className="text-start font-bold">الرابط</TableHead>
                                    </TableRow>
                                }
                                renderDesktopRow={(site) => {
                                    const href = safeSiteUrl(site.url);
                                    return (
                                        <TableRow key={site.id} className="hover:bg-muted/50 transition-colors">
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-100 border border-border/80 flex items-center justify-center shrink-0 p-1">
                                                        <img
                                                            src={getFaviconUrl(site.url)}
                                                            alt=""
                                                            width={20}
                                                            height={20}
                                                            loading="lazy"
                                                            decoding="async"
                                                            referrerPolicy="no-referrer"
                                                            className="w-5 h-5 object-contain"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                            }}
                                                        />
                                                        <Globe className="w-4 h-4 text-zinc-700 hidden" aria-hidden="true" />
                                                    </div>
                                                    <span className="text-foreground font-semibold">{site.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-normal text-[11px]">
                                                    {getTypeDisplayName(site.type)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm max-w-xs truncate" title={site.description}>
                                                {site.description}
                                            </TableCell>
                                            <TableCell>
                                                {href ? (
                                                    <Button variant="link" asChild className="h-auto p-0 text-primary font-semibold">
                                                        <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                                                            <span className="text-xs">زيارة<span className="sr-only"> {site.name} (يفتح في نافذة جديدة)</span></span>
                                                            <ExternalLink size={12} aria-hidden="true" />
                                                        </a>
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                }}
                            />
                        )}

                        {directory.hasMore && <DirectoryLoadMore onClick={directory.loadMore} />}
                    </>
                )}
            </PageBody>

            <section className="bg-card py-12 px-4 border-t border-border">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-3xl font-bold mb-6 text-foreground">حول المواقع السورية</h2>
                    <p className="text-muted-foreground mb-8 leading-relaxed">
                        دليل شامل للمواقع السورية في مختلف المجالات، يهدف إلى تسهيل الوصول إلى المحتوى السوري الرقمي.
                    </p>
                </div>
            </section>
        </div>
    );
}
