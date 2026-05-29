"use client";

import React, { useState, useMemo } from 'react';
import { formatSocialUrl, getLanguageName } from './data';
import { Organization } from './types';
import {
    Search, X, FilterX, MapPin, Globe, FileText, Users,
    LayoutGrid, Table as TableIcon, Send, ExternalLink
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

const ITEMS_PER_PAGE = 12;

export default function PartyClient({ initialOrganizations }: PartyClientProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [countryFilter, setCountryFilter] = useState('all');
    const [cityFilter, setCityFilter] = useState('all');
    const [langFilter, setLangFilter] = useState('all');
    const [sortOption, setSortOption] = useState('name');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);

    // --- Derive Filter Options ---
    const categories = useMemo(() => Array.from(new Set(initialOrganizations.map(o => o.type).filter(Boolean))).sort(), [initialOrganizations]);
    const countries = useMemo(() => Array.from(new Set(initialOrganizations.map(o => o.country).filter(Boolean))).sort(), [initialOrganizations]);
    const cities = useMemo(() => Array.from(new Set(initialOrganizations.map(o => o.city).filter(Boolean))).sort(), [initialOrganizations]);
    const languages = useMemo(() => Array.from(new Set(initialOrganizations.map(o => o.lang).filter(Boolean))).sort(), [initialOrganizations]);

    // --- Filter & Sort Logic ---
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
        }).sort((a, b) => {
            switch (sortOption) {
                case 'name': return a.name.localeCompare(b.name, 'ar');
                case 'name-desc': return b.name.localeCompare(a.name, 'ar');
                case 'category': return (a.type || '').localeCompare(b.type || '', 'ar');
                case 'country': return (a.country || '').localeCompare(b.country || '', 'ar');
                case 'city': return (a.city || '').localeCompare(b.city || '', 'ar');
                default: return 0;
            }
        });
    }, [initialOrganizations, searchTerm, categoryFilter, countryFilter, cityFilter, langFilter, sortOption]);

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

    return (
        <div className="bg-background min-h-screen font-sans" dir="rtl">
            {/* Header & Filters */}
            <section className="bg-card py-10 shadow-sm border-b border-border">
                <div className="container mx-auto px-4 text-center max-w-4xl space-y-6">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">دليل المنظمات السياسية السورية</h1>
                        <p className="text-lg text-muted-foreground">تصفح واكتشف المنظمات والأحزاب والحركات السياسية السورية العاملة في مختلف أنحاء العالم</p>
                    </div>

                    {/* Search Box */}
                    <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto items-center">
                        <div className="relative w-full">
                            <Search className="absolute top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground right-3" />
                            <Input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="ابحث في المنظمات السياسية بالاسم أو النوع أو المكان..."
                                className="w-full pr-10 pl-10 bg-background"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground left-3"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 justify-center items-center">
                        <div className="flex flex-col space-y-1 min-w-[150px]">
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-full bg-background text-foreground">
                                    <SelectValue placeholder="نوع المنظمة" />
                                </SelectTrigger>
                                <SelectContent className="bg-card text-foreground">
                                    <SelectItem value="all">جميع الأنواع</SelectItem>
                                    {categories.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col space-y-1 min-w-[150px]">
                            <Select value={countryFilter} onValueChange={setCountryFilter}>
                                <SelectTrigger className="w-full bg-background text-foreground">
                                    <SelectValue placeholder="البلد" />
                                </SelectTrigger>
                                <SelectContent className="bg-card text-foreground">
                                    <SelectItem value="all">جميع البلدان</SelectItem>
                                    {countries.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col space-y-1 min-w-[150px]">
                            <Select value={cityFilter} onValueChange={setCityFilter}>
                                <SelectTrigger className="w-full bg-background text-foreground">
                                    <SelectValue placeholder="المدينة" />
                                </SelectTrigger>
                                <SelectContent className="bg-card text-foreground">
                                    <SelectItem value="all">جميع المدن</SelectItem>
                                    {cities.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col space-y-1 min-w-[150px]">
                            <Select value={langFilter} onValueChange={setLangFilter}>
                                <SelectTrigger className="w-full bg-background text-foreground">
                                    <SelectValue placeholder="اللغة" />
                                </SelectTrigger>
                                <SelectContent className="bg-card text-foreground">
                                    <SelectItem value="all">جميع اللغات</SelectItem>
                                    {languages.map((l: any) => <SelectItem key={l} value={l}>{getLanguageName(l)}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            variant="outline"
                            onClick={clearFilters}
                            disabled={categoryFilter === 'all' && countryFilter === 'all' && cityFilter === 'all' && langFilter === 'all' && !searchTerm}
                            className="bg-muted hover:bg-accent text-muted-foreground border-border"
                        >
                            <FilterX className="mr-2 h-4 w-4 ml-2" />
                            مسح الفلاتر
                        </Button>
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
                            <div className="bg-card rounded-lg p-1 shadow-sm border border-border flex">
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`p-1.5 rounded transition-all ${viewMode === 'table' ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
                                >
                                    <TableIcon className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Select value={sortOption} onValueChange={setSortOption}>
                                <SelectTrigger className="w-[180px] h-9 text-sm">
                                    <SelectValue placeholder="ترتيب حسب" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="name">الاسم (أ-ي)</SelectItem>
                                    <SelectItem value="name-desc">الاسم (ي-أ)</SelectItem>
                                    <SelectItem value="category">النوع</SelectItem>
                                    <SelectItem value="country">البلد</SelectItem>
                                    <SelectItem value="city">المدينة</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {filteredOrganizations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-card rounded-lg shadow-sm border border-dashed border-border text-center">
                        <Search className="h-16 w-16 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">لم يتم العثور على منظمات</h3>
                        <p className="text-muted-foreground">جرب تغيير مصطلحات البحث أو الفلاتر</p>
                        <Button onClick={clearFilters} variant="link" className="mt-2 text-primary">
                            مسح جميع الفلاتر
                        </Button>
                    </div>
                ) : (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {displayedOrganizations.map(org => {
                                    // Helper for social links inside the map
                                    const socials = [
                                        { url: org.socialFb, icon: Facebook, key: 'facebook' as const },
                                        { url: org.socialX, icon: Twitter, key: 'x' as const },
                                        { url: org.socialInsta, icon: Instagram, key: 'instagram' as const },
                                        { url: org.youtube, icon: Youtube, key: 'youtube' as const },
                                        { url: org.telegram, icon: ExternalLink, key: 'telegram' as const } // Fallback icon
                                    ].filter(s => s.url);

                                    return (
                                        <Card key={org.id} className="group hover:shadow-lg transition-shadow border border-border bg-card flex flex-col h-full">
                                            <CardContent className="p-6 flex flex-col h-full">
                                                <div className="mb-4">
                                                    <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                                                        {org.name}
                                                    </h3>
                                                    <div className="flex flex-wrap gap-2 text-xs">
                                                        {org.type && <Badge variant="secondary" className="font-normal text-muted-foreground">{org.type}</Badge>}
                                                        {org.politicalLeanings?.map((l: string, idx: number) => (
                                                            <Badge key={idx} variant="outline" className="font-normal text-primary border-primary/30 bg-primary/5">
                                                                {l}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>

                                                {org.description && (
                                                    <p className="text-muted-foreground text-sm leading-relaxed mb-6 line-clamp-3 overflow-hidden">
                                                        {org.description}
                                                    </p>
                                                )}

                                                <div className="space-y-3 mt-auto pt-4 border-t border-border text-sm">
                                                    {org.formattedLocation && (
                                                        <div className="flex items-start gap-2 text-muted-foreground">
                                                            <MapPin className="h-4 w-4 text-primary mt-1 shrink-0" />
                                                            <span>{org.formattedLocation}</span>
                                                        </div>
                                                    )}
                                                    {org.website && (
                                                        <div className="flex items-start gap-2">
                                                            <Globe className="h-4 w-4 text-primary mt-1 shrink-0" />
                                                            <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline truncate">
                                                                {org.website.replace(/^https?:\/\//, '')}
                                                            </a>
                                                        </div>
                                                    )}
                                                    {org.manifesto && (
                                                        <div className="flex items-start gap-2">
                                                            <FileText className="h-4 w-4 text-primary mt-1 shrink-0" />
                                                            <a href={org.manifesto} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                                                                البيان التأسيسي
                                                            </a>
                                                        </div>
                                                    )}
                                                    {org.mvpMembers && (
                                                        <div className="flex items-start gap-2 text-muted-foreground text-xs">
                                                            <Users className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                                                            <span className="line-clamp-1">{org.mvpMembers}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Social Links */}
                                                {socials.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                                                        {socials.map(s => {
                                                            const Icon = s.icon;
                                                            return (
                                                                <a
                                                                    key={s.key}
                                                                    href={formatSocialUrl(s.key, s.url || '')}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="p-1.5 rounded bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                                                                >
                                                                    <Icon className="h-4 w-4" />
                                                                </a>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted">
                                        <TableRow>
                                            <TableHead className="text-right">المنظمة</TableHead>
                                            <TableHead className="text-right">النوع</TableHead>
                                            <TableHead className="text-right">الموقع</TableHead>
                                            <TableHead className="text-right">تواصل</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {displayedOrganizations.map(org => (
                                            <TableRow key={org.id} className="hover:bg-muted/50 border-border">
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
                                                        {org.website && <a href={org.website} target="_blank" className="text-blue-600 dark:text-blue-400 hover:text-blue-800"><Globe className="h-4 w-4" /></a>}
                                                        {org.socialX && <a href={formatSocialUrl('x', org.socialX)} target="_blank" className="hover:text-foreground"><Twitter className="h-4 w-4" /></a>}
                                                        {org.socialFb && <a href={formatSocialUrl('facebook', org.socialFb)} target="_blank" className="text-blue-600 dark:text-blue-400 hover:text-blue-800"><Facebook className="h-4 w-4" /></a>}
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
                            <div className="flex justify-center mt-12">
                                <Button
                                    onClick={handleLoadMore}
                                    size="lg"
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                >
                                    تحميل المزيد
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* About Section */}
            <section className="bg-background border-t border-border py-16 px-4">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-3xl font-bold mb-6 text-foreground">حول دليل المنظمات السياسية السورية</h2>
                    <p className="text-muted-foreground mb-8 leading-relaxed">
                        يعتبر دليل المنظمات السياسية السورية مرجعاً شاملاً للتعرف على المنظمات والأحزاب والحركات السياسية السورية العاملة في مختلف أنحاء العالم.
                    </p>
                    <Button
                        asChild
                        size="lg"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
