import { useState, useMemo } from 'react';
import { formatSocialUrl, getLanguageName } from './data';
import { Organization } from './types';
import {
    Search, MapPin, Globe, FileText, Users,
    Plus, Send
} from 'lucide-react';
import { Twitter, Facebook, Instagram, Youtube } from '@/components/ui/icons';
import { Button } from "@/components/ui/button";
import DirectoryEmptyState from '@/Components/directory/DirectoryEmptyState';
import DirectoryLoadMore from '@/Components/directory/DirectoryLoadMore';
import DirectoryResultCount from '@/Components/directory/DirectoryResultCount';
import { DirectorySmartSearch } from '@/Components/directory/DirectorySearch';
import DirectoryViewToggle from '@/Components/directory/DirectoryViewToggle';
import { useDirectory, type DirectoryFacet } from '@/Components/directory/useDirectory';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface PartyClientProps {
    initialOrganizations: Organization[];
}

const ITEMS_PER_PAGE = 15;

const organizationSearchText = (org: Organization) => `${org.name} ${org.description ?? ''} ${org.formattedLocation ?? ''} ${org.type ?? ''}`;

export default function PartyClient({ initialOrganizations }: PartyClientProps) {
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    // --- Derive Filter Options ---
    const categories = useMemo(() => Array.from(new Set(initialOrganizations.map(o => o.type).filter((v): v is string => Boolean(v)))).sort(), [initialOrganizations]);
    const countries = useMemo(() => Array.from(new Set(initialOrganizations.map(o => o.country).filter((v): v is string => Boolean(v)))).sort(), [initialOrganizations]);
    const cities = useMemo(() => Array.from(new Set(initialOrganizations.map(o => o.city).filter((v): v is string => Boolean(v)))).sort(), [initialOrganizations]);
    const languages = useMemo(() => Array.from(new Set(initialOrganizations.map(o => o.lang).filter((v): v is string => Boolean(v)))).sort(), [initialOrganizations]);
    const facets = useMemo<DirectoryFacet<Organization>[]>(() => [
        { key: 'category', label: 'نوع المنظمة', aliases: ['النوع'], options: categories.map(value => ({ value, label: value })), valueOf: (org: Organization) => org.type },
        { key: 'country', label: 'البلد', options: countries.map(value => ({ value, label: value })), valueOf: (org: Organization) => org.country },
        { key: 'city', label: 'المدينة', options: cities.map(value => ({ value, label: value })), valueOf: (org: Organization) => org.city },
        { key: 'lang', label: 'اللغة', options: languages.map(value => ({ value, label: getLanguageName(value) })), valueOf: (org: Organization) => org.lang },
    ].filter(facet => facet.options.length > 0), [categories, countries, cities, languages]);

    const directory = useDirectory<Organization>({
        items: initialOrganizations,
        searchText: organizationSearchText,
        facets,
        pageSize: ITEMS_PER_PAGE,
    });

    return (
        <div className="min-h-screen transition-colors font-sans" dir="rtl">
            {/* Header & Hero Section */}
            <section className="bg-card py-10 shadow-xs border-b border-border">
                <div className="container mx-auto px-4 text-center max-w-4xl space-y-6">
                    <div className="relative">
                        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">دليل المنظمات السياسية السورية</h1>
                        <p className="text-lg text-muted-foreground">تصفح واكتشف المنظمات والأحزاب والحركات السياسية السورية العاملة في مختلف أنحاء العالم</p>

                        <div className="mt-4 flex justify-center">
                            <Button
                                asChild
                                variant="outline"
                                className="gap-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
                            >
                                <a
                                    href="https://forms.gle/vLAxoz5RNt6z6qyj9"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Plus size={16} />
                                    إضافة منظمة جديدة
                                </a>
                            </Button>
                        </div>
                    </div>

                </div>
            </section>

            {/* Content Area */}
            <div className="container mx-auto px-4 py-8">
                {initialOrganizations.length > 0 && (
                    <DirectorySmartSearch
                        className="mb-5"
                        facets={directory.searchFacets} value={directory.value} onChange={directory.setValue}
                        placeholder="ابحث بالاسم أو النوع أو المكان أو اختر تصفية..." ariaLabel="ابحث في المنظمات السياسية"
                    />
                )}
                {/* Visual Controls */}
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <DirectoryResultCount>
                        {directory.results.length === 0
                            ? 'لم يتم العثور على نتائج'
                            : `عرض ${directory.shown} من أصل ${directory.results.length} منظمة`}
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
                        title="لم يتم العثور على منظمات"
                        description="جرب تغيير مصطلحات البحث أو الفلاتر"
                        directory={directory}
                    />
                ) : (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
                                {directory.visible.map(org => {
                                    const socials = [
                                        { url: org.socialFb, icon: Facebook, key: 'facebook' as const },
                                        { url: org.socialX, icon: Twitter, key: 'x' as const },
                                        { url: org.socialInsta, icon: Instagram, key: 'instagram' as const },
                                        { url: org.youtube, icon: Youtube, key: 'youtube' as const },
                                        { url: org.telegram, icon: Send, key: 'telegram' as const }
                                    ].filter(s => s.url);

                                    return (
                                        <Card key={org.id} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-full">
                                            <CardContent className="p-4 flex flex-col justify-between h-full">
                                                <div>
                                                    <div className="mb-3">
                                                        <h2 className="text-base font-bold text-foreground mb-2 group-hover:text-primary transition-colors leading-snug line-clamp-2">
                                                            {org.name}
                                                        </h2>
                                                        <div className="flex flex-wrap gap-1.5 text-xs">
                                                            {org.type && (
                                                                <Badge variant="secondary" className="font-normal text-[10px] text-muted-foreground bg-muted/60 border-border/40 px-2 py-0.5">
                                                                    {org.type}
                                                                </Badge>
                                                            )}
                                                            {org.politicalLeanings?.map((l: string, idx: number) => (
                                                                <Badge key={idx} variant="outline" className="font-normal text-[10px] text-primary border-primary/20 bg-primary/5 px-2 py-0.5">
                                                                    {l}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {org.description && (
                                                        <p className="text-muted-foreground text-xs leading-relaxed mb-4 line-clamp-3">
                                                            {org.description}
                                                        </p>
                                                    )}
                                                </div>

                                                <div>
                                                    <div className="space-y-2 pt-3 border-t border-border/50 text-xs">
                                                        {org.formattedLocation && (
                                                            <div className="flex items-start gap-1.5 text-muted-foreground">
                                                                <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                                                                <span className="line-clamp-1">{org.formattedLocation}</span>
                                                            </div>
                                                        )}
                                                        {org.website && (
                                                            <div className="flex items-start gap-1.5">
                                                                <Globe className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                                                                <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate font-medium">
                                                                    {org.website.replace(/^https?:\/\//, '')}
                                                                </a>
                                                            </div>
                                                        )}
                                                        {org.manifesto && (
                                                            <div className="flex items-start gap-1.5">
                                                                <FileText className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                                                                <a href={org.manifesto} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                                                                    البيان التأسيسي
                                                                </a>
                                                            </div>
                                                        )}
                                                        {org.mvpMembers && (
                                                            <div className="flex items-start gap-1.5 text-muted-foreground text-[11px]">
                                                                <Users className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                                                                <span className="line-clamp-1">{org.mvpMembers}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Social Links */}
                                                    {socials.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/50">
                                                            {socials.map(s => {
                                                                const Icon = s.icon;
                                                                return (
                                                                    <a
                                                                        key={s.key}
                                                                        href={formatSocialUrl(s.key, s.url || '')}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        aria-label={`رابط ${s.key} — ${org.name}`}
                                                                        className="p-1.5 rounded-md bg-muted/60 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all border border-border/40"
                                                                    >
                                                                        <Icon className="h-3.5 w-3.5" />
                                                                    </a>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="bg-card rounded-2xl shadow-xs border border-border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted">
                                        <TableRow>
                                            <TableHead className="text-start font-bold">المنظمة</TableHead>
                                            <TableHead className="text-start font-bold">النوع</TableHead>
                                            <TableHead className="text-start font-bold">الموقع</TableHead>
                                            <TableHead className="text-start font-bold">تواصل</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {directory.visible.map(org => (
                                            <TableRow key={org.id} className="hover:bg-muted/50 border-border transition-colors">
                                                <TableCell className="font-medium align-top">
                                                    <div className="text-base text-foreground font-semibold">{org.name}</div>
                                                    {org.description && (
                                                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2 max-w-sm">
                                                            {org.description}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap align-top">
                                                    {org.type && <Badge variant="secondary" className="font-normal">{org.type}</Badge>}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap align-top text-muted-foreground">
                                                    <div className="flex flex-col gap-1">
                                                        {org.formattedLocation && <span>{org.formattedLocation}</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="align-top">
                                                    <div className="flex flex-wrap gap-2 text-muted-foreground">
                                                        {org.website && (
                                                            <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary">
                                                                <a href={org.website} target="_blank" rel="noopener noreferrer" title="الموقع الإلكتروني">
                                                                    <Globe className="h-4 w-4" />
                                                                </a>
                                                            </Button>
                                                        )}
                                                        {org.socialX && (
                                                            <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                                <a href={formatSocialUrl('x', org.socialX)} target="_blank" rel="noopener noreferrer" title="X">
                                                                    <Twitter className="h-4 w-4" />
                                                                </a>
                                                            </Button>
                                                        )}
                                                        {org.socialFb && (
                                                            <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary">
                                                                <a href={formatSocialUrl('facebook', org.socialFb)} target="_blank" rel="noopener noreferrer" title="Facebook">
                                                                    <Facebook className="h-4 w-4" />
                                                                </a>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {directory.hasMore && <DirectoryLoadMore onClick={directory.loadMore} />}
                    </>
                )}
            </div>

            {/* About Section */}
            <section className="bg-card border-t border-border py-16 px-4 mt-12">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-3xl font-bold mb-6 text-foreground">حول دليل المنظمات السياسية السورية</h2>
                    <p className="text-muted-foreground mb-8 leading-relaxed">
                        يعتبر دليل المنظمات السياسية السورية مرجعاً شاملاً للتعرف على المنظمات والأحزاب والحركات السياسية السورية العاملة في مختلف أنحاء العالم.
                    </p>
                    <Button
                        asChild
                        size="lg"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full shadow-md"
                    >
                        <a
                            href="https://forms.gle/vLAxoz5RNt6z6qyj9"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            إرسال طلب إضافة للقائمة
                        </a>
                    </Button>
                </div>
            </section>
        </div>
    );
}
