import React, { useState, useEffect, useMemo } from 'react';
import { OfficialEntity } from './types';
import { Search, X, Table as TableIcon, LayoutGrid, Globe, Send, Link as LinkIcon, MessageCircle } from 'lucide-react';
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from '@/Components/ui/icons';
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { Card, CardContent } from "@/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { Badge } from "@/Components/ui/badge";
import MainLayout from '@/Layouts/MainLayout';
import { Head } from '@inertiajs/react';

interface SyOfficialClientProps {
    initialData: OfficialEntity[];
}

type Language = 'ar' | 'en' | 'tr' | 'ku';
type ViewMode = 'grid' | 'table';
type SortOption = 'name-asc' | 'name-desc' | 'category';

const CATEGORIES = [
    { key: 'all', label: { ar: 'الكل', en: 'All' } },
    { key: 'governorates', label: { ar: 'المحافظات', en: 'Governorates' } },
    { key: 'ministries', label: { ar: 'الوزارات', en: 'Ministries' } },
    { key: 'ministers', label: { ar: 'الوزراء', en: 'Ministers' } },
    { key: 'public_figures', label: { ar: 'الشخصيات العامة', en: 'Public Figures' } },
    { key: 'syndicates', label: { ar: 'النقابات', en: 'Syndicates' } },
    { key: 'universities', label: { ar: 'الجامعات', en: 'Universities' } },
    { key: 'embassies', label: { ar: 'السفارات', en: 'Embassies' } },
    { key: 'other', label: { ar: 'أخرى', en: 'Other' } },
];

const TRANSLATIONS = {
    ar: {
        title: 'روابط الحسابات الرسمية السورية',
        description: 'دليل وسائل التواصل الاجتماعي للجهات السورية الرسمية - اضغط على اسم الجهة للوصول إلى صفحاتها الرسمية',
        searchPlaceholder: 'ابحث في الحسابات الرسمية بالاسم أو الوصف...',
        noResults: 'لم يتم العثور على حسابات رسمية',
        noResultsDesc: 'جرب تعديل كلمات البحث أو الفلاتر.',
        loading: 'جاري تحميل الحسابات الرسمية...',
        view: 'عرض',
        table: 'جدول',
        grid: 'شبكة',
        sortBy: 'ترتيب حسب',
        sortNameAsc: 'الاسم (أ-ي)',
        sortNameDesc: 'الاسم (ي-أ)',
        sortCategory: 'الفئة',
        tableCategory: 'الفئة',
        tableName: 'الاسم',
        tableDesc: 'الوصف',
        tableSocial: 'روابط التواصل',
        socialTwitterList: 'قائمة تويتر',
        socialTelegramList: 'قائمة تلغرام',
    },
    en: {
        title: 'Syrian Official Accounts Links',
        description: 'Social media directory for Syrian official entities - Click on the entity name to visit their official pages',
        searchPlaceholder: 'Search official accounts by name or description...',
        noResults: 'No official accounts found',
        noResultsDesc: 'Try adjusting your search terms or filters.',
        loading: 'Loading official accounts...',
        view: 'View',
        table: 'Table',
        grid: 'Grid',
        sortBy: 'Sort by',
        sortNameAsc: 'Name (A-Z)',
        sortNameDesc: 'Name (Z-A)',
        sortCategory: 'Category',
        tableCategory: 'Category',
        tableName: 'Name',
        tableDesc: 'Description',
        tableSocial: 'Social Links',
        socialTwitterList: 'Twitter List',
        socialTelegramList: 'Telegram List',
    },
    tr: {
        title: 'Suriye Resmi Hesap Bağlantıları',
        description: 'Suriye resmi kurumlarının sosyal medya rehberi - Resmi sayfalarına ulaşmak için kurum adına tıklayın',
        searchPlaceholder: 'İsim veya açıklama ile arayın...',
        noResults: 'Resmi hesap bulunamadı',
        noResultsDesc: 'Arama terimlerini veya filtreleri değiştirmeyi deneyin.',
        loading: 'Yükleniyor...',
        view: 'Görünüm',
        table: 'Tablo',
        grid: 'Izgara',
        sortBy: 'Sıralama',
        sortNameAsc: 'İsim (A-Z)',
        sortNameDesc: 'İsim (Z-A)',
        sortCategory: 'Kategori',
        tableCategory: 'Kategori',
        tableName: 'İsim',
        tableDesc: 'Açıklama',
        tableSocial: 'Sosyal Bağlantılar',
        socialTwitterList: 'Twitter Listesi',
        socialTelegramList: 'Telegram Listesi',
    },
    ku: {
        title: 'Girêdanên Hesabên Fermî yên Sûriyê',
        description: 'Rêberê medyaya civakî ji bo saziyên fermî yên Sûriyê - Li ser navê saziyê bitikînin da ku hûn bigihîjin rûpelên wan ên fermî',
        searchPlaceholder: 'Li gorî nav an ravekirinê bigerin...',
        noResults: 'Hesabên fermî nehatin dîtin',
        noResultsDesc: 'Hewl bidin ku peyvên lêgerînê an fîlteran biguherînin.',
        loading: 'Tê barkirin...',
        view: 'Dîtin',
        table: 'Tablo',
        grid: 'Tor',
        sortBy: 'Rêzkirin',
        sortNameAsc: 'Nav (A-Z)',
        sortNameDesc: 'Nav (Z-A)',
        sortCategory: 'Kategorî',
        tableCategory: 'Kategorî',
        tableName: 'Nav',
        tableDesc: 'Ravekirin',
        tableSocial: 'Girêdanên Civakî',
        socialTwitterList: 'Lîsteya Twitter',
        socialTelegramList: 'Lîsteya Telegram',
    }
};

const getSocialIcon = (platform: string) => {
    switch (platform) {
        case 'facebook': return <Facebook className="h-4 w-4" />;
        case 'twitter': return <Twitter className="h-4 w-4" />;
        case 'instagram': return <Instagram className="h-4 w-4" />;
        case 'linkedin': return <Linkedin className="h-4 w-4" />;
        case 'telegram': return <Send className="h-4 w-4" />;
        case 'youtube': return <Youtube className="h-4 w-4" />;
        case 'whatsapp': return <MessageCircle className="h-4 w-4" />;
        case 'website': return <Globe className="h-4 w-4" />;
        default: return <LinkIcon className="h-4 w-4" />;
    }
};

export default function Index({ initialData }: SyOfficialClientProps) {
    const [language, setLanguage] = useState<Language>('ar');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentCategory, setCurrentCategory] = useState('all');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [sortOption, setSortOption] = useState<SortOption>('name-asc');
    const [loading, setLoading] = useState(false); // Since data passed from server, mostly used for client-side ops if needed

    // Filter and Sort Data
    const filteredData = useMemo(() => {
        let items = initialData;

        // Filter by Category
        if (currentCategory !== 'all') {
            items = items.filter(item => item.category === currentCategory);
        }

        // Search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            items = items.filter(item =>
                item.name.toLowerCase().includes(term) ||
                item.name_ar.toLowerCase().includes(term) ||
                (item.description && item.description.toLowerCase().includes(term)) ||
                (item.description_ar && item.description_ar.toLowerCase().includes(term))
            );
        }

        // Sort
        items.sort((a, b) => {
            if (sortOption === 'category') {
                return a.category.localeCompare(b.category);
            }

            const nameA = language === 'ar' ? a.name_ar : a.name;
            const nameB = language === 'ar' ? b.name_ar : b.name;

            return sortOption === 'name-asc'
                ? nameA.localeCompare(nameB, language === 'ar' ? 'ar' : 'en')
                : nameB.localeCompare(nameA, language === 'ar' ? 'ar' : 'en');
        });

        return items;
    }, [initialData, searchTerm, currentCategory, sortOption, language]);

    // Group items for Grid View if "All" is selected, or just list them
    // Original implementation grouped by category section when "All" was selected in grid view.
    // For simplicity and better UX in Shadcn, we can just show a flat grid or grouped.
    // Let's stick to flat grid for "All" or grouped? The original had sections.
    // Let's implement grouped sections for "All" in Grid View.
    const groupedData = useMemo(() => {
        if (currentCategory !== 'all') return { [currentCategory]: filteredData };

        const groups: { [key: string]: OfficialEntity[] } = {};

        // Initialize groups in specific order based on CATEGORIES
        CATEGORIES.forEach(cat => {
            if (cat.key !== 'all') groups[cat.key] = [];
        });

        filteredData.forEach(item => {
            if (groups[item.category]) {
                groups[item.category].push(item);
            } else {
                // Fallback for unknown categories
                if (!groups['other']) groups['other'] = [];
                groups['other'].push(item);
            }
        });

        // Remove empty groups
        Object.keys(groups).forEach(key => {
            if (groups[key].length === 0) delete groups[key];
        });

        return groups;
    }, [filteredData, currentCategory]);

    const t = TRANSLATIONS[language];

    // Helper to get category label
    const getCategoryLabel = (key: string) => {
        const cat = CATEGORIES.find(c => c.key === key);
        return cat ? (language === 'ar' ? cat.label.ar : cat.label.en) : key;
    };

    return (
        <MainLayout>
            <Head>
                <title>{t.title}</title>
                <meta name="description" content={t.description} />
            </Head>
            <div className="min-h-screen transition-colors" dir={language === 'ar' || language === 'ku' ? 'rtl' : 'ltr'}>

            {/* Header / Hero */}
            <section className="bg-card py-10 shadow-sm border-b border-border">
                <div className="container mx-auto px-4 text-center max-w-4xl">
                    <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">{t.title}</h1>
                    <p className="text-lg text-muted-foreground mb-8">{t.description}</p>

                    {/* Language Switcher */}
                    <div className="flex justify-center gap-2 mb-8">
                        {(['ar', 'en', 'tr', 'ku'] as Language[]).map(lang => (
                            <button
                                key={lang}
                                onClick={() => setLanguage(lang)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${language === lang
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }`}
                            >
                                <img src={`/syofficial-assets/assets/flags/${lang}.svg`} alt={lang} className="w-5 h-3.5 object-cover rounded shadow-sm" />
                                <span className="uppercase">{lang}</span>
                            </button>
                        ))}
                    </div>

                    {/* Search & Filter Bar */}
                    <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto items-center">
                        <div className="relative w-full">
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder={t.searchPlaceholder}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-4 pr-12 h-14 text-lg bg-card border-border rounded-xl shadow-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className={`absolute top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground ${language === 'ar' || language === 'ku' ? 'left-3' : 'right-3'}`}
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Category Tabs (Desktop) / Scrollable (Mobile) */}
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                        {CATEGORIES.map(cat => (
                            <Button
                                key={cat.key}
                                variant={currentCategory === cat.key ? "default" : "outline"}
                                onClick={() => setCurrentCategory(cat.key)}
                                className="rounded-full"
                                size="sm"
                            >
                                {language === 'ar' ? cat.label.ar : cat.label.en}
                            </Button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Content Area */}
            <div className="container mx-auto px-4 py-8">

                {/* Visual Controls */}
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <div className="text-sm text-muted-foreground font-medium">
                        {filteredData.length > 0 ? (
                            language === 'ar' ? `عرض ${filteredData.length} حساب رسمي` : `Showing ${filteredData.length} official accounts`
                        ) : t.noResults}
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{t.view}:</span>
                            <div className="bg-card rounded-lg p-1 shadow-sm border border-border flex">
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`p-1.5 rounded transition-all ${viewMode === 'table' ? 'bg-accent text-primary' : 'text-muted-foreground'}`}
                                >
                                    <TableIcon className="h-4 w-4" />
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
                            <span className="text-sm text-muted-foreground">{t.sortBy}:</span>
                            <Select value={sortOption} onValueChange={(val: SortOption) => setSortOption(val)}>
                                <SelectTrigger className="w-[140px] h-8 text-sm bg-card border-border">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="name-asc">{t.sortNameAsc}</SelectItem>
                                    <SelectItem value="name-desc">{t.sortNameDesc}</SelectItem>
                                    <SelectItem value="category">{t.sortCategory}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {filteredData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-card rounded-lg shadow-sm border border-dashed border-border">
                        <Search className="h-16 w-16 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">{t.noResults}</h3>
                        <p className="text-muted-foreground">{t.noResultsDesc}</p>
                    </div>
                ) : (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="space-y-12">
                                {Object.entries(groupedData).map(([catKey, items]) => (
                                    <div key={catKey}>
                                        {currentCategory === 'all' && (
                                            <h2 className="text-2xl font-bold text-foreground mb-6 border-b pb-2 border-border">
                                                {getCategoryLabel(catKey)}
                                            </h2>
                                        )}
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                                            {items.map(item => (
                                                <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-md bg-card group">
                                                    <div className="aspect-square w-full bg-muted relative overflow-hidden">
                                                        <img
                                                            src={`/syofficial-assets/${item.image}`}
                                                            alt={language === 'ar' ? item.name_ar : item.name}
                                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = '/syofficial-assets/images/placeholder.png'; // Fallback
                                                            }}
                                                        />
                                                    </div>
                                                    <CardContent className="p-4 text-center">
                                                        <h3 className="font-bold text-foreground mb-2 leading-tight">
                                                            {language === 'ar' ? item.name_ar : item.name}
                                                        </h3>
                                                        {(item.description || item.description_ar) && (
                                                            <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                                                                {language === 'ar' ? (item.description_ar || item.description) : item.description}
                                                            </p>
                                                        )}

                                                        {item.socials && Object.keys(item.socials).length > 0 && (
                                                            <div className="flex flex-wrap justify-center gap-2 pt-2 border-t border-border">
                                                                {Object.entries(item.socials).map(([plat, url]) => (
                                                                    <a
                                                                        key={plat}
                                                                        href={url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-muted-foreground hover:text-primary transition-colors p-1"
                                                                        title={plat}
                                                                    >
                                                                        {getSocialIcon(plat)}
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted">
                                        <TableRow>
                                            <TableHead className={`text-${language === 'ar' || language === 'ku' ? 'right' : 'left'}`}>{t.tableName}</TableHead>
                                            <TableHead className={`text-${language === 'ar' || language === 'ku' ? 'right' : 'left'}`}>{t.tableCategory}</TableHead>
                                            <TableHead className={`text-${language === 'ar' || language === 'ku' ? 'right' : 'left'}`}>{t.tableDesc}</TableHead>
                                            <TableHead className={`text-${language === 'ar' || language === 'ku' ? 'right' : 'left'}`}>{t.tableSocial}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredData.map(item => (
                                            <TableRow key={item.id} className="hover:bg-muted/50">
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                                                            <img
                                                                src={`/syofficial-assets/${item.image}`}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src = '/syofficial-assets/images/placeholder.png';
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="text-foreground">{language === 'ar' ? item.name_ar : item.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="font-normal bg-accent text-accent-foreground border-transparent">
                                                        {getCategoryLabel(item.category)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground max-w-xs truncate">
                                                    {language === 'ar' ? (item.description_ar || item.description) : item.description}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {Object.entries(item.socials).map(([plat, url]) => (
                                                            <a
                                                                key={plat}
                                                                href={url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="bg-muted hover:bg-primary hover:text-primary-foreground text-foreground rounded p-1.5 transition-colors"
                                                            >
                                                                {getSocialIcon(plat)}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Social Lists Links (Footer area of the content) */}
            <div className="container mx-auto px-4 pb-12 text-center">
                <div className="inline-flex gap-4">
                    <a href="https://x.com/i/lists/1906101934660174006" target="_blank" rel="noopener" className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors font-medium border border-border">
                        <Twitter className="h-5 w-5 text-blue-400" />
                        <span>{t.socialTwitterList}</span>
                    </a>
                    <a href="https://t.me/addlist/fKrhEy2yNeEwODQ0" target="_blank" rel="noopener" className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors font-medium border border-border">
                        <Send className="h-5 w-5 text-blue-500" />
                        <span>{t.socialTelegramList}</span>
                    </a>
                </div>
            </div>
        </div>
        </MainLayout>
    );
}
