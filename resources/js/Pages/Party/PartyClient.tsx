"use client";

import React, { useState, useMemo } from 'react';
import { formatSocialUrl, getLanguageName } from './data';
import { Organization } from './types';
import {
    Search, X, FilterX, MapPin, Globe, FileText, Users,
    LayoutGrid, List, Plus, ExternalLink, Send
} from 'lucide-react';
import { Twitter, Facebook, Instagram, Youtube } from '@/components/ui/icons';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface PartyClientProps {
    initialOrganizations: Organization[];
}

const ITEMS_PER_PAGE = 15;

export default function PartyClient({ initialOrganizations }: PartyClientProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [countryFilter, setCountryFilter] = useState('all');
    const [cityFilter, setCityFilter] = useState('all');
    const [langFilter, setLangFilter] = useState('all');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);

    // --- Derive Filter Options ---
    const categories = useMemo(() => Array.from(new Set(initialOrganizations.map(o => o.type).filter(Boolean))).sort(), [initialOrganizations]);
    const countries = useMemo(() => Array.from(new Set(initialOrganizations.map(o => o.country).filter(Boolean))).sort(), [initialOrganizations]);
    const cities = useMemo(() => Array.from(new Set(initialOrganizations.map(o => o.city).filter(Boolean))).sort(), [initialOrganizations]);
    const languages = useMemo(() => Array.from(new Set(initialOrganizations.map(o => o.lang).filter(Boolean))).sort(), [initialOrganizations]);

    // --- Filter Logic ---
    const filteredOrganizations = useMemo(() => {
        return initialOrganizations.filter(org => {
            const matchSearch = searchTerm === '' ||
                org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                org.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                org.formattedLocation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                org.type?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchCategory = categoryFilter === 'all' || org.type === categoryFilter;
            const matchCountry = countryFilter === 'all' || org.country === countryFilter;
            const matchCity = cityFilter === 'all' || org.city === cityFilter;
            const matchLang = langFilter === 'all' || org.lang === langFilter;

            return matchSearch && matchCategory && matchCountry && matchCity && matchLang;
        });
    }, [initialOrganizations, searchTerm, categoryFilter, countryFilter, cityFilter, langFilter]);

    const displayedOrganizations = filteredOrganizations.slice(0, displayCount);

    // --- Handlers ---
    const handleLoadMore = () => {
        setDisplayCount(prev => prev + ITEMS_PER_PAGE);
    };

    const clearFilters = () => {
        setCategoryFilter('all');
        setCountryFilter('all');
        setCityFilter('all');
        setLangFilter('all');
        setSearchTerm('');
    };

    // Reset display count when filters change
    React.useEffect(() => {
        setDisplayCount(ITEMS_PER_PAGE);
    }, [searchTerm, categoryFilter, countryFilter, cityFilter, langFilter]);

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

                    {/* SyOfficial-styled Search Box */}
                    <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto items-center">
                        <div className="relative w-full">
                            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                            <Input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="ابحث في المنظمات السياسية بالاسم أو النوع أو المكان..."
                                className="w-full ps-12 pe-10 h-14 text-lg bg-card border-border rounded-xl shadow-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                            {searchTerm && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute end-3 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Filter Dropdowns */}
                    <div className="flex flex-wrap gap-3 justify-center items-center pt-2">
                        <div className="min-w-[140px]">
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-full bg-card border-border text-foreground">
                                    <SelectValue placeholder="نوع المنظمة" />
                                </SelectTrigger>
                                <SelectContent className="bg-card text-foreground">
                                    <SelectItem value="all">جميع الأنواع</SelectItem>
                                    {categories.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="min-w-[140px]">
                            <Select value={countryFilter} onValueChange={setCountryFilter}>
                                <SelectTrigger className="w-full bg-card border-border text-foreground">
                                    <SelectValue placeholder="البلد" />
                                </SelectTrigger>
                                <SelectContent className="bg-card text-foreground">
                                    <SelectItem value="all">جميع البلدان</SelectItem>
                                    {countries.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="min-w-[140px]">
                            <Select value={cityFilter} onValueChange={setCityFilter}>
                                <SelectTrigger className="w-full bg-card border-border text-foreground">
                                    <SelectValue placeholder="المدينة" />
                                </SelectTrigger>
                                <SelectContent className="bg-card text-foreground">
                                    <SelectItem value="all">جميع المدن</SelectItem>
                                    {cities.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="min-w-[140px]">
                            <Select value={langFilter} onValueChange={setLangFilter}>
                                <SelectTrigger className="w-full bg-card border-border text-foreground">
                                    <SelectValue placeholder="اللغة" />
                                </SelectTrigger>
                                <SelectContent className="bg-card text-foreground">
                                    <SelectItem value="all">جميع اللغات</SelectItem>
                                    {languages.map((l: any) => <SelectItem key={l} value={l}>{getLanguageName(l)}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {(categoryFilter !== 'all' || countryFilter !== 'all' || cityFilter !== 'all' || langFilter !== 'all' || searchTerm) && (
                            <Button
                                variant="outline"
                                onClick={clearFilters}
                                className="border-border text-muted-foreground hover:text-foreground gap-2"
                                size="sm"
                            >
                                <FilterX className="h-4 w-4" />
                                مسح الفلاتر
                            </Button>
                        )}
                    </div>
                </div>
            </section>

            {/* Content Area */}
            <div className="container mx-auto px-4 py-8">
                {/* Visual Controls */}
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <span className="text-sm text-muted-foreground font-medium">
                        {filteredOrganizations.length === 0
                            ? 'لم يتم العثور على نتائج'
                            : `عرض ${displayedOrganizations.length} من أصل ${filteredOrganizations.length} منظمة`}
                    </span>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">عرض:</span>
                            <div className="bg-card rounded-lg p-1 shadow-xs border border-border flex gap-1">
                                <Button
                                    variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                                    size="icon"
                                    onClick={() => setViewMode('table')}
                                    className="h-8 w-8"
                                    title="عرض كجدول"
                                >
                                    <List className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                                    size="icon"
                                    onClick={() => setViewMode('grid')}
                                    className="h-8 w-8"
                                    title="عرض كبطاقات"
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {filteredOrganizations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-dashed border-border shadow-xs text-center">
                        <Search className="h-16 w-16 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">لم يتم العثور على منظمات</h3>
                        <p className="text-muted-foreground text-sm">جرب تغيير مصطلحات البحث أو الفلاتر</p>
                        <Button onClick={clearFilters} variant="link" className="mt-2 text-primary">
                            مسح جميع الفلاتر
                        </Button>
                    </div>
                ) : (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
                                {displayedOrganizations.map(org => {
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
                                                        <h3 className="text-base font-bold text-foreground mb-2 group-hover:text-primary transition-colors leading-snug line-clamp-2">
                                                            {org.name}
                                                        </h3>
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
                                        {displayedOrganizations.map(org => (
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

                        {/* Load More */}
                        {displayedOrganizations.length < filteredOrganizations.length && (
                            <div className="flex justify-center mt-12 pb-8">
                                <Button
                                    onClick={handleLoadMore}
                                    size="lg"
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[200px] rounded-full font-bold shadow-md hover:shadow-lg transition-all"
                                >
                                    تحميل المزيد
                                </Button>
                            </div>
                        )}
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
