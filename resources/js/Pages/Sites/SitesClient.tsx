"use client";

import React, { useState, useMemo } from 'react';
import { Website } from './types';
import { Search, X, FilterX, Globe, Building, Newspaper, User, ExternalLink, List, LayoutGrid, ChevronDown, Plus } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SitesClientProps {
    initialWebsites: Website[];
}

const ITEMS_PER_PAGE = 24;

export default function SitesClient({ initialWebsites }: SitesClientProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [sortOption, setSortOption] = useState('name');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);

    const categories = useMemo(() => Array.from(new Set(initialWebsites.map(w => w.type).filter(Boolean))).sort(), [initialWebsites]);

    const filteredWebsites = useMemo(() => {
        return initialWebsites.filter(site => {
            const matchSearch = searchTerm === '' ||
                site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                site.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                site.url.toLowerCase().includes(searchTerm.toLowerCase());

            const matchType = typeFilter === '' || site.type === typeFilter;

            return matchSearch && matchType;
        }).sort((a, b) => {
            switch (sortOption) {
                case 'name': return a.name.localeCompare(b.name, 'ar');
                case 'name-desc': return b.name.localeCompare(a.name, 'ar');
                case 'type': return a.type.localeCompare(b.type, 'ar');
                default: return 0;
            }
        });
    }, [initialWebsites, searchTerm, typeFilter, sortOption]);

    const displayedWebsites = filteredWebsites.slice(0, displayCount);

    const handleLoadMore = () => setDisplayCount(prev => prev + ITEMS_PER_PAGE);

    const clearFilters = () => {
        setTypeFilter('all');
        setSearchTerm('');
    };

    // Reset display count when filters change
    React.useEffect(() => {
        setDisplayCount(ITEMS_PER_PAGE);
    }, [searchTerm, typeFilter, sortOption]);

    const getTypeDisplayName = (type: string) => {
        if (type.includes('مدونة شخصية')) return 'المدونات الشخصية';
        if (type.includes('شركة') || type.includes('مبادرة')) return 'المواقع التعريفية';
        if (type.includes('مجلة') || type.includes('إخباري')) return 'المدونات والمواقع الإخبارية';
        return type;
    };

    const getFaviconUrl = (url: string) => {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        } catch {
            return '';
        }
    };

    return (
        <div className="min-h-screen transition-colors" dir="rtl">
            {/* Header & Filters */}
            <section className="bg-card py-10 shadow-sm border-b border-border">
                <div className="container mx-auto px-4 text-center max-w-4xl space-y-6">
                    <div className="relative">
                        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">المواقع السورية</h1>
                        <p className="text-lg text-muted-foreground">قاعدة بيانات المواقع السورية مصنفة حسب القطاعات</p>

                        <div className="mt-4 flex justify-center">
                            <Button
                                asChild
                                variant="outline"
                                className="gap-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
                            >
                                <a
                                    href="https://docs.google.com/forms/d/e/1FAIpQLSdIu8TFwSmT7fHxzsVlOwt35X9Myfhg0RZ6jwEkIMxxvyctqA/viewform"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Plus size={16} />
                                    إضافة موقع جديد
                                </a>
                            </Button>
                        </div>
                    </div>

                    {/* Search Box */}
                    <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto items-center">
                        <div className="relative w-full">
                            <Search className="absolute top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 right-3" />
                            <Input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="ابحث في المواقع السورية..."
                                className="w-full pr-10 pl-10 bg-card"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 left-3"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filters Grid */}
                    <div className="flex flex-wrap gap-4 justify-center items-center">
                        <div className="flex flex-col space-y-1 min-w-[200px]">
                            <Select value={typeFilter || 'all'} onValueChange={(val) => setTypeFilter(val === 'all' ? '' : val)}>
                                <SelectTrigger className="w-full bg-card">
                                    <SelectValue placeholder="نوع الموقع" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">جميع الأنواع</SelectItem>
                                    {categories.map((c) => (
                                        <SelectItem key={c} value={c}>
                                            {getTypeDisplayName(c)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            variant="outline"
                            onClick={clearFilters}
                            disabled={!typeFilter && !searchTerm}
                            className="bg-muted hover:bg-muted/80 text-foreground"
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
                        {filteredWebsites.length === 0
                            ? 'لم يتم العثور على نتائج'
                            : `عرض ${displayedWebsites.length} من أصل ${filteredWebsites.length} موقع`}
                    </span>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">عرض:</span>
                            <div className="bg-card rounded-lg p-1 shadow-sm border border-border flex">
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`p-1.5 rounded transition-all ${viewMode === 'table' ? 'bg-accent text-primary' : 'text-muted-foreground'}`}
                                >
                                    <List className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-accent text-primary' : 'text-muted-foreground'}`}
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Select value={sortOption} onValueChange={setSortOption}>
                                <SelectTrigger className="w-[160px] h-9 text-sm">
                                    <SelectValue placeholder="ترتيب حسب" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="name">الاسم (أ-ي)</SelectItem>
                                    <SelectItem value="name-desc">الاسم (ي-أ)</SelectItem>
                                    <SelectItem value="type">النوع</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {filteredWebsites.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-card rounded-lg shadow-sm border border-dashed border-border text-center">
                        <Search className="h-16 w-16 text-muted-foreground mb-4 opacity-20" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">لم يتم العثور على مواقع</h3>
                        <p className="text-muted-foreground">جرب تغيير مصطلحات البحث أو الفلاتر</p>
                        <Button onClick={clearFilters} variant="link" className="mt-2 text-primary">
                            مسح جميع الفلاتر
                        </Button>
                    </div>
                ) : (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                                {displayedWebsites.map(site => (
                                    <a
                                        key={site.id}
                                        href={site.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block h-full group"
                                    >
                                        <Card className="h-full hover:shadow-lg transition-all duration-300 border-border hover:border-primary bg-card flex flex-col items-center text-center">
                                            <CardContent className="p-5 flex flex-col items-center h-full w-full">
                                                <div className="w-16 h-16 mb-4 bg-muted rounded-xl p-2 flex items-center justify-center relative overflow-hidden ring-1 ring-border">
                                                    <img
                                                        src={getFaviconUrl(site.url)}
                                                        alt={site.name}
                                                        className="w-10 h-10 object-contain"
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                        }}
                                                    />
                                                    <Globe className="w-8 h-8 text-muted-foreground hidden" />
                                                </div>

                                                <h3 className="font-bold text-foreground mb-2 group-hover:text-primary line-clamp-2 leading-tight">
                                                    {site.name}
                                                </h3>

                                                <Badge variant="secondary" className="mb-3 text-[10px] font-normal px-2 py-0.5 bg-muted text-muted-foreground">
                                                    {getTypeDisplayName(site.type)}
                                                </Badge>

                                                {site.description && (
                                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-auto w-full pt-3 border-t border-border">
                                                        {site.description}
                                                    </p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted">
                                        <TableRow>
                                            <TableHead className="text-right">الموقع</TableHead>
                                            <TableHead className="text-right">النوع</TableHead>
                                            <TableHead className="text-right w-1/3">الوصف</TableHead>
                                            <TableHead className="text-right">الرابط</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {displayedWebsites.map(site => (
                                            <TableRow key={site.id} className="hover:bg-muted/50 transition-colors">
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                                                            <img
                                                                src={getFaviconUrl(site.url)}
                                                                alt=""
                                                                className="w-5 h-5 object-contain"
                                                                onError={(e) => {
                                                                    e.currentTarget.style.display = 'none';
                                                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                                }}
                                                            />
                                                            <Globe className="w-4 h-4 text-muted-foreground hidden" />
                                                        </div>
                                                        <span className="text-foreground">{site.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-normal">
                                                        {getTypeDisplayName(site.type)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm max-w-xs truncate" title={site.description}>
                                                    {site.description}
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="link" asChild className="h-auto p-0 text-primary">
                                                        <a href={site.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 dir-ltr">
                                                            <span className="text-xs">زيارة</span>
                                                            <ExternalLink size={12} />
                                                        </a>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {displayedWebsites.length < filteredWebsites.length && (
                            <div className="flex justify-center mt-12 pb-8">
                                <Button
                                    onClick={handleLoadMore}
                                    size="lg"
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[200px]"
                                >
                                    تحميل المزيد
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* About Section */}
            <section className="bg-card py-16 px-4 border-t border-border mt-12">
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
