import { useState, useMemo } from 'react';
import { formatSocialUrl, getLanguageName, safeHttpUrl, SOCIAL_LABEL } from './data';
import { Organization } from './types';
import {
    Search, MapPin, Globe, FileText, Users,
    Plus, Send
} from 'lucide-react';
import { Twitter, Facebook, Instagram, Youtube } from '@/Components/ui/icons';
import { Button } from "@/Components/ui/button";
import DirectoryEmptyState from '@/Components/directory/DirectoryEmptyState';
import DirectoryLoadMore from '@/Components/directory/DirectoryLoadMore';
import DirectoryResultCount from '@/Components/directory/DirectoryResultCount';
import { DirectorySmartSearch } from '@/Components/directory/DirectorySearch';
import DirectoryViewToggle from '@/Components/directory/DirectoryViewToggle';
import { useDirectory, type DirectoryFacet } from '@/Components/directory/useDirectory';
import { Card, CardContent } from "@/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import { Badge } from "@/Components/ui/badge";
import { PageBody, PageHeader, PageToolbar } from '@/Components/layout';
import { PartyIcon } from '@/Components/Icons/ProjectIcons';

interface PartyClientProps {
    initialOrganizations: Organization[];
}

const ITEMS_PER_PAGE = 15;

const organizationSearchText = (org: Organization) => `${org.name} ${org.description ?? ''} ${org.formattedLocation ?? ''} ${org.type ?? ''}`;

export default function PartyClient({ initialOrganizations }: PartyClientProps) {
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

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
            <PageHeader
                title="دليل المنظمات السياسية السورية"
                description="تصفح واكتشف المنظمات والأحزاب والحركات السياسية السورية العاملة في مختلف أنحاء العالم."
                actions={
                    <Button asChild variant="outline" size="sm" className="h-9 bg-card shadow-none">
                        <a
                            href="https://forms.gle/vLAxoz5RNt6z6qyj9"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Plus size={16} aria-hidden="true" />
                            <span>إضافة منظمة</span>
                        </a>
                    </Button>
                }
            />

            <PageBody>
                {initialOrganizations.length > 0 && (
                    <DirectorySmartSearch
                        className="mb-5"
                        facets={directory.searchFacets}
                        value={directory.value}
                        onChange={directory.setValue}
                        placeholder="ابحث بالاسم أو النوع أو المكان أو اختر تصفية..."
                        ariaLabel="ابحث في المنظمات السياسية"
                    />
                )}
                <PageToolbar
                    count={
                        <DirectoryResultCount>
                            {directory.results.length === 0
                                ? 'لم يتم العثور على نتائج'
                                : `عرض ${directory.shown} من أصل ${directory.results.length} منظمة`}
                        </DirectoryResultCount>
                    }
                >
                    <span className="text-sm text-muted-foreground">عرض:</span>
                    <DirectoryViewToggle value={viewMode} onChange={setViewMode} className="shadow-xs" />
                </PageToolbar>

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
                                    ].filter(s => s.url && formatSocialUrl(s.key, s.url));
                                    const website = safeHttpUrl(org.website);
                                    const manifesto = safeHttpUrl(org.manifesto);

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
                                                        {website && (
                                                            <div className="flex items-start gap-1.5">
                                                                <Globe className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                                                                <a href={website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate font-medium">
                                                                    {org.website?.replace(/^https?:\/\//, '')}
                                                                </a>
                                                            </div>
                                                        )}
                                                        {manifesto && (
                                                            <div className="flex items-start gap-1.5">
                                                                <FileText className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                                                                <a href={manifesto} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
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
                                                                        aria-label={`${SOCIAL_LABEL[s.key]} — ${org.name}`}
                                                                        className="p-1.5 rounded-md bg-muted/60 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all border border-border/40"
                                                                    >
                                                                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
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
                            <div className="bg-card rounded-lg border border-border overflow-hidden">
                                {/* Mobile 2-row-per-item list */}
                                <ul className="md:hidden divide-y divide-border" aria-label="قائمة المنظمات">
                                    {directory.visible.map(org => (
                                        <li key={org.id} className="px-3.5 py-3 space-y-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-semibold text-foreground leading-snug">{org.name}</div>
                                                    {org.description && (
                                                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{org.description}</div>
                                                    )}
                                                </div>
                                                {org.type && (
                                                    <Badge variant="secondary" className="font-normal text-[10px] shrink-0 whitespace-nowrap">{org.type}</Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs text-muted-foreground truncate">{org.formattedLocation || '—'}</span>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {safeHttpUrl(org.website) && (
                                                        <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary">
                                                            <a href={safeHttpUrl(org.website)} target="_blank" rel="noopener noreferrer" title="الموقع الإلكتروني" aria-label={`الموقع الإلكتروني — ${org.name}`}>
                                                                <Globe className="h-4 w-4" aria-hidden="true" />
                                                            </a>
                                                        </Button>
                                                    )}
                                                    {org.socialX && formatSocialUrl('x', org.socialX) && (
                                                        <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                            <a href={formatSocialUrl('x', org.socialX)} target="_blank" rel="noopener noreferrer" title={SOCIAL_LABEL.x} aria-label={`${SOCIAL_LABEL.x} — ${org.name}`}>
                                                                <Twitter className="h-4 w-4" aria-hidden="true" />
                                                            </a>
                                                        </Button>
                                                    )}
                                                    {org.socialFb && formatSocialUrl('facebook', org.socialFb) && (
                                                        <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary">
                                                            <a href={formatSocialUrl('facebook', org.socialFb)} target="_blank" rel="noopener noreferrer" title={SOCIAL_LABEL.facebook} aria-label={`${SOCIAL_LABEL.facebook} — ${org.name}`}>
                                                                <Facebook className="h-4 w-4" aria-hidden="true" />
                                                            </a>
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>

                                {/* Desktop table */}
                                <div className="hidden md:block">
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
                                                            {safeHttpUrl(org.website) && (
                                                                <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary">
                                                                    <a href={safeHttpUrl(org.website)} target="_blank" rel="noopener noreferrer" title="الموقع الإلكتروني" aria-label={`الموقع الإلكتروني — ${org.name}`}>
                                                                        <Globe className="h-4 w-4" aria-hidden="true" />
                                                                    </a>
                                                                </Button>
                                                            )}
                                                            {org.socialX && formatSocialUrl('x', org.socialX) && (
                                                                <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                                    <a href={formatSocialUrl('x', org.socialX)} target="_blank" rel="noopener noreferrer" title={SOCIAL_LABEL.x} aria-label={`${SOCIAL_LABEL.x} — ${org.name}`}>
                                                                        <Twitter className="h-4 w-4" aria-hidden="true" />
                                                                    </a>
                                                                </Button>
                                                            )}
                                                            {org.socialFb && formatSocialUrl('facebook', org.socialFb) && (
                                                                <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary">
                                                                    <a href={formatSocialUrl('facebook', org.socialFb)} target="_blank" rel="noopener noreferrer" title={SOCIAL_LABEL.facebook} aria-label={`${SOCIAL_LABEL.facebook} — ${org.name}`}>
                                                                        <Facebook className="h-4 w-4" aria-hidden="true" />
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
                            </div>
                        )}

                        {directory.hasMore && <DirectoryLoadMore onClick={directory.loadMore} />}
                    </>
                )}
            </PageBody>

            <section className="bg-card border-t border-border py-12 px-4">
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
