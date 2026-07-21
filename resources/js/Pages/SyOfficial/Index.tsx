import React, { useState, useEffect, useMemo } from 'react';
import { OfficialEntity } from './types';
import { Search, X, Table as TableIcon, LayoutGrid, Globe, Send, Link as LinkIcon, MessageCircle, Pencil, Settings } from 'lucide-react';
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from '@/Components/ui/icons';
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { Card, CardContent } from "@/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { Badge } from "@/Components/ui/badge";
import MainLayout from '@/Layouts/MainLayout';
import { Head, usePage, Link } from '@inertiajs/react';

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
    const base = platform.replace('_secondary', '');
    switch (base) {
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

const getSocialTitle = (platform: string, lang: Language) => {
    const titles: Record<string, { ar: string; en: string }> = {
        facebook: { ar: 'فيسبوك', en: 'Facebook' },
        facebook_secondary: { ar: 'فيسبوك (إعلامي/فرعي)', en: 'Facebook (Secondary)' },
        twitter: { ar: 'إكس / تويتر', en: 'X / Twitter' },
        twitter_secondary: { ar: 'إكس / تويتر (إعلامي/فرعي)', en: 'X / Twitter (Secondary)' },
        instagram: { ar: 'إنستغرام', en: 'Instagram' },
        instagram_secondary: { ar: 'إنستغرام (إعلامي/فرعي)', en: 'Instagram (Secondary)' },
        telegram: { ar: 'تلغرام', en: 'Telegram' },
        telegram_secondary: { ar: 'تلغرام (إعلامي/فرعي)', en: 'Telegram (Secondary)' },
        linkedin: { ar: 'لينكد إن', en: 'LinkedIn' },
        youtube: { ar: 'يوتيوب', en: 'YouTube' },
        whatsapp: { ar: 'واتساب', en: 'WhatsApp' },
        website: { ar: 'الموقع الرسمي', en: 'Official Website' },
    };
    const t = titles[platform];
    if (!t) return platform;
    return lang === 'ar' || lang === 'ku' ? t.ar : t.en;
};

const getSocialStyle = (platform: string) => {
    const base = platform.replace('_secondary', '');
    switch (base) {
        case 'facebook': return 'hover:bg-blue-500/15 hover:text-blue-500 hover:border-blue-500/40 dark:hover:text-blue-400';
        case 'twitter': return 'hover:bg-sky-500/15 hover:text-sky-400 hover:border-sky-500/40 dark:hover:text-sky-400';
        case 'instagram': return 'hover:bg-pink-500/15 hover:text-pink-500 hover:border-pink-500/40 dark:hover:text-pink-400';
        case 'telegram': return 'hover:bg-sky-400/15 hover:text-sky-400 hover:border-sky-400/40 dark:hover:text-sky-300';
        case 'youtube': return 'hover:bg-red-500/15 hover:text-red-500 hover:border-red-500/40 dark:hover:text-red-400';
        case 'whatsapp': return 'hover:bg-emerald-500/15 hover:text-emerald-500 hover:border-emerald-500/40 dark:hover:text-emerald-400';
        case 'linkedin': return 'hover:bg-blue-700/15 hover:text-blue-600 hover:border-blue-700/40 dark:hover:text-blue-400';
        case 'website': return 'hover:bg-indigo-500/15 hover:text-indigo-500 hover:border-indigo-500/40 dark:hover:text-indigo-400';
        default: return 'hover:bg-primary/15 hover:text-primary hover:border-primary/40';
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

    const { auth } = usePage().props as any;
    const userRole = auth?.user?.role;
    const isSuperAdmin = userRole === 'superadmin' || userRole === 'admin' || userRole === 'syofficial_admin';

    const groupedData = useMemo(() => {
        if (currentCategory !== 'all') {
            return { [currentCategory]: filteredData };
        }

        const groups: { [key: string]: OfficialEntity[] } = {};
        CATEGORIES.forEach(cat => {
            if (cat.key !== 'all') {
                groups[cat.key] = filteredData.filter(item => item.category === cat.key);
            }
        });

        Object.keys(groups).forEach(key => {
            if (groups[key].length === 0) delete groups[key];
        });

        return groups;
    }, [filteredData, currentCategory]);

    const t = TRANSLATIONS[language];

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

            <section className="bg-card py-10 shadow-sm border-b border-border">
                <div className="container mx-auto px-4 text-center max-w-4xl">
                    {isSuperAdmin && (
                        <div className="mb-6 flex justify-center">
                            <a
                                href="/admin/syofficial"
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-lg hover:bg-primary/90 transition-all transform hover:-translate-y-0.5"
                            >
                                <Settings className="w-4 h-4" />
                                <span>لوحة تحكم إدارة الحسابات (Admin Panel)</span>
                            </a>
                        </div>
                    )}
                    <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">{t.title}</h1>
                    <p className="text-lg text-muted-foreground mb-8">{t.description}</p>

                    <div className="flex justify-center gap-4 mb-8">
                        <a href="https://x.com/i/lists/1906101934660174006" target="_blank" rel="noopener" className="flex items-center gap-2 px-5 py-2 rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors font-medium border border-border text-sm">
                            <Twitter className="h-4 w-4 text-blue-400" />
                            <span>{t.socialTwitterList}</span>
                        </a>
                        <a href="https://t.me/addlist/fKrhEy2yNeEwODQ0" target="_blank" rel="noopener" className="flex items-center gap-2 px-5 py-2 rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors font-medium border border-border text-sm">
                            <Send className="h-4 w-4 text-blue-500" />
                            <span>{t.socialTelegramList}</span>
                        </a>
                    </div>

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

                    <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto items-center">
                        <div className="relative w-full">
                            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                            <Input
                                type="text"
                                placeholder={t.searchPlaceholder}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full ps-12 pe-10 h-14 text-lg bg-card border-border rounded-xl shadow-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute end-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

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

            <div className="container mx-auto px-4 py-8">

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
                            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                                <SelectTrigger className="w-[140px] bg-card border-border rounded-lg shadow-sm">
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
                    <div className="text-center py-16 bg-card rounded-2xl border border-border shadow-xs">
                        <Globe className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2 text-foreground">{t.noResults}</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto">{t.noResultsDesc}</p>
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
                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5 sm:gap-4">
                                            {items.map(item => (
                                                <Card
                                                    key={item.id}
                                                    className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                                                >
                                                    <div className="relative aspect-square w-full overflow-hidden bg-muted/40">
                                                        {isSuperAdmin && (
                                                            <a
                                                                href="/admin/syofficial"
                                                                className="absolute top-2 start-2 z-10 p-1.5 rounded-lg bg-background/90 hover:bg-primary hover:text-primary-foreground text-foreground backdrop-blur-md border border-border/70 shadow-md transition-all duration-200 opacity-90 hover:opacity-100 hover:scale-110 flex items-center gap-1 text-xs font-bold"
                                                                title="تعديل هذا الكرت في لوحة التحكم"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                                <span className="hidden sm:inline">تعديل</span>
                                                            </a>
                                                        )}
                                                        <img
                                                            src={item.image?.startsWith('http') || item.image?.startsWith('/') ? item.image : `/syofficial-assets/${item.image}`}
                                                            alt={language === 'ar' ? item.name_ar : item.name}
                                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = '/syofficial-assets/images/placeholder.png';
                                                            }}
                                                        />
                                                    </div>

                                                    <CardContent className="p-3.5 text-center flex-1 flex flex-col justify-between">
                                                        <div>
                                                            <h3 className="font-bold text-sm sm:text-base text-foreground mb-1.5 leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                                                {language === 'ar' ? item.name_ar : item.name}
                                                            </h3>
                                                            {(item.description || item.description_ar) && (
                                                                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                                                                    {language === 'ar' ? (item.description_ar || item.description) : item.description}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {item.socials && Object.keys(item.socials).length > 0 && (
                                                            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                                                                {Object.entries(item.socials).map(([plat, url]) => (
                                                                    <a
                                                                        key={plat}
                                                                        href={url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className={`p-1.5 rounded-lg border border-border/50 bg-muted/50 text-muted-foreground transition-all duration-200 hover:scale-105 shadow-2xs ${getSocialStyle(plat)}`}
                                                                        title={getSocialTitle(plat, language)}
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
                            <div className="bg-card/90 rounded-2xl shadow-sm border border-border/60 overflow-hidden backdrop-blur-sm">
                                <Table>
                                    <TableHeader className="bg-muted/60">
                                        <TableRow className="border-border/60">
                                            <TableHead className="text-start font-bold">{t.tableName}</TableHead>
                                            <TableHead className="text-start font-bold">{t.tableCategory}</TableHead>
                                            <TableHead className="text-start font-bold">{t.tableDesc}</TableHead>
                                            <TableHead className="text-start font-bold">{t.tableSocial}</TableHead>
                                            {isSuperAdmin && <TableHead className="text-end font-bold">إجراءات الإدارة</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredData.map(item => (
                                            <TableRow key={item.id} className="hover:bg-muted/40 transition-colors border-border/40">
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted flex-shrink-0 ring-1 ring-border/50 shadow-2xs">
                                                            <img
                                                                src={item.image?.startsWith('http') || item.image?.startsWith('/') ? item.image : `/syofficial-assets/${item.image}`}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src = '/syofficial-assets/images/placeholder.png';
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="text-foreground font-semibold text-sm">{language === 'ar' ? item.name_ar : item.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="font-normal bg-accent/80 text-accent-foreground border-border/40 rounded-lg">
                                                        {getCategoryLabel(item.category)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-xs max-w-xs truncate">
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
                                                                className={`p-1.5 rounded-lg border border-border/40 bg-muted/40 text-muted-foreground transition-all duration-200 hover:scale-105 ${getSocialStyle(plat)}`}
                                                                title={getSocialTitle(plat, language)}
                                                            >
                                                                {getSocialIcon(plat)}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                {isSuperAdmin && (
                                                    <TableCell className="text-end">
                                                        <a
                                                            href="/admin/syofficial"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground text-xs font-bold transition-all border border-primary/20"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                            <span>تعديل</span>
                                                        </a>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </>
                )}
            </div>


        </div>
        </MainLayout>
    );
}
