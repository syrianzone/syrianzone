import React, { useState, useMemo } from 'react';
import { OfficialEntity } from './types';
import { Search, X, Table as TableIcon, LayoutGrid, Globe, Send, Link as LinkIcon, MessageCircle, Pencil, Settings } from 'lucide-react';
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from '@/Components/ui/icons';
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import { Card, CardContent } from "@/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import { Badge } from "@/Components/ui/badge";
import MainLayout from '@/Layouts/MainLayout';
import { Head, usePage } from '@inertiajs/react';

const R2_BASE = 'https://pub-1d51b625c56e4fd085c58a79672e1b15.r2.dev/syofficial/entities/';

export function formatEntityImage(img: string | null | undefined): string {
    if (!img || img.trim().length === 0) return '/placeholder-user.jpg';
    if (img.startsWith('http://') || img.startsWith('https://')) return img;
    if (img.startsWith('/assets/') || img.startsWith('/storage/')) return img;
    const filename = img.split('/').pop() || img;
    return `${R2_BASE}${filename}`;
}

interface CategoryData {
    id: string;
    label_ar: string;
    label_en: string;
    icon?: string;
    order_column: number;
}

interface SyOfficialClientProps {
    initialData: OfficialEntity[];
    categories?: CategoryData[];
}

type Language = 'ar' | 'en' | 'tr' | 'ku';
type ViewMode = 'grid' | 'table';

const FALLBACK_CATEGORIES = [
    { key: 'all', label_ar: 'الكل', label_en: 'All' },
    { key: 'governorates', label_ar: 'المحافظات', label_en: 'Governorates' },
    { key: 'ministries', label_ar: 'الوزارات', label_en: 'Ministries' },
    { key: 'ministers', label_ar: 'الوزراء', label_en: 'Ministers' },
    { key: 'public_figures', label_ar: 'الشخصيات العامة', label_en: 'Public Figures' },
    { key: 'syndicates', label_ar: 'النقابات', label_en: 'Syndicates' },
    { key: 'universities', label_ar: 'الجامعات', label_en: 'Universities' },
    { key: 'embassies', label_ar: 'السفارات', label_en: 'Embassies' },
    { key: 'other', label_ar: 'أخرى', label_en: 'Other' },
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
        tableName: 'الجهة / المؤسسة',
        tableCategory: 'التصنيف',
        tableDesc: 'الوصف',
        tableSocial: 'الحسابات الرسمية',
    },
    en: {
        title: 'Official Syrian Social Links',
        description: 'Directory of official social media accounts for Syrian government entities and public figures',
        searchPlaceholder: 'Search official accounts by name or description...',
        noResults: 'No official accounts found',
        noResultsDesc: 'Try adjusting your search terms or filters.',
        loading: 'Loading official accounts...',
        view: 'View',
        table: 'Table',
        grid: 'Grid',
        tableName: 'Entity / Institution',
        tableCategory: 'Category',
        tableDesc: 'Description',
        tableSocial: 'Official Accounts',
    },
    tr: {
        title: 'Resmi Suriye Sosyal Medya Bağlantıları',
        description: 'Resmi Suriye kurumları ve kamu figürleri için sosyal medya hesapları rehberi',
        searchPlaceholder: 'Resmi hesapları isim veya açıklamaya göre arayın...',
        noResults: 'Resmi hesap bulunamadı',
        noResultsDesc: 'Arama terimlerinizi veya filtrelerinizi ayarlamayı deneyin.',
        loading: 'Resmi hesaplar yükleniyor...',
        view: 'Görünüm',
        table: 'Tablo',
        grid: 'Izgara',
        tableName: 'Kurum / Kuruluş',
        tableCategory: 'Kategori',
        tableDesc: 'Açıklama',
        tableSocial: 'Resmi Hesaplar',
    },
    ku: {
        title: 'Girêdanên Medyaya Civakî yên Fermî yên Sûrî',
        description: 'Rêberê hesabên medyaya civakî ji bo saziyên fermî û kesayetên giştî yên Sûrî',
        searchPlaceholder: 'Li hesabên fermî li gorî nav an ravekirinê bigerin...',
        noResults: 'Tu hesabên fermî nehatin dîtin',
        noResultsDesc: 'Meylên lêgerînê an fîlterên xwe biguherînin.',
        loading: 'Hesabên fermî têne barkirin...',
        view: 'Dîtin',
        table: 'Jadwal',
        grid: 'Tor',
        tableName: 'Sazî / Dezgeh',
        tableCategory: 'Kategorî',
        tableDesc: 'Ravekirin',
        tableSocial: 'Hesabên Fermî',
    }
};

const getSocialIcon = (platform: string) => {
    switch (platform) {
        case 'facebook':
        case 'facebook_secondary':
            return <Facebook className="w-4 h-4 text-[#1877F2]" />;
        case 'instagram':
        case 'instagram_secondary':
            return <Instagram className="w-4 h-4 text-[#E4405F]" />;
        case 'twitter':
        case 'twitter_secondary':
            return <Twitter className="w-4 h-4 text-[#1DA1F2]" />;
        case 'telegram':
        case 'telegram_secondary':
            return <Send className="w-4 h-4 text-[#26A5E4]" />;
        case 'linkedin':
            return <Linkedin className="w-4 h-4 text-[#0A66C2]" />;
        case 'youtube':
            return <Youtube className="w-4 h-4 text-[#FF0000]" />;
        case 'whatsapp':
            return <MessageCircle className="w-4 h-4 text-[#25D366]" />;
        case 'website':
            return <Globe className="w-4 h-4 text-primary" />;
        default:
            return <LinkIcon className="w-4 h-4" />;
    }
};

const getSocialTitle = (platform: string, lang: Language) => {
    const isAr = lang === 'ar';
    switch (platform) {
        case 'facebook':
            return isAr ? 'فيسبوك' : 'Facebook';
        case 'facebook_secondary':
            return isAr ? 'فيسبوك (احتياطي)' : 'Facebook (Secondary)';
        case 'instagram':
            return isAr ? 'إنستغرام' : 'Instagram';
        case 'instagram_secondary':
            return isAr ? 'إنستغرام (احتياطي)' : 'Instagram (Secondary)';
        case 'twitter':
            return isAr ? 'تويتر / منصة إكس' : 'Twitter / X';
        case 'twitter_secondary':
            return isAr ? 'تويتر / منصة إكس (احتياطي)' : 'Twitter / X (Secondary)';
        case 'telegram':
            return isAr ? 'تلغرام' : 'Telegram';
        case 'telegram_secondary':
            return isAr ? 'تلغرام (احتياطي)' : 'Telegram (Secondary)';
        case 'linkedin':
            return isAr ? 'لينكد إن' : 'LinkedIn';
        case 'youtube':
            return isAr ? 'يوتيوب' : 'YouTube';
        case 'whatsapp':
            return isAr ? 'واتساب' : 'WhatsApp';
        case 'website':
            return isAr ? 'الموقع الرسمي' : 'Official Website';
        default:
            return platform;
    }
};

const getSocialStyle = (platform: string) => {
    switch (platform) {
        case 'facebook':
        case 'facebook_secondary':
            return 'hover:border-[#1877F2]/50 hover:bg-[#1877F2]/10';
        case 'instagram':
        case 'instagram_secondary':
            return 'hover:border-[#E4405F]/50 hover:bg-[#E4405F]/10';
        case 'twitter':
        case 'twitter_secondary':
            return 'hover:border-[#1DA1F2]/50 hover:bg-[#1DA1F2]/10';
        case 'telegram':
        case 'telegram_secondary':
            return 'hover:border-[#26A5E4]/50 hover:bg-[#26A5E4]/10';
        case 'linkedin':
            return 'hover:border-[#0A66C2]/50 hover:bg-[#0A66C2]/10';
        case 'youtube':
            return 'hover:border-[#FF0000]/50 hover:bg-[#FF0000]/10';
        case 'whatsapp':
            return 'hover:border-[#25D366]/50 hover:bg-[#25D366]/10';
        case 'website':
            return 'hover:border-primary/50 hover:bg-primary/10';
        default:
            return '';
    }
};

export default function SyOfficialIndex({ initialData = [], categories = [] }: SyOfficialClientProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentCategory, setCurrentCategory] = useState('all');
    const [language, setLanguage] = useState<Language>('ar');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');

    const categoryList = useMemo(() => {
        if (categories && categories.length > 0) {
            const dynamicCats = categories.map(c => ({
                key: c.id,
                label_ar: c.label_ar,
                label_en: c.label_en,
            }));
            return [{ key: 'all', label_ar: 'الكل', label_en: 'All' }, ...dynamicCats];
        }
        return FALLBACK_CATEGORIES;
    }, [categories]);

    const filteredData = useMemo(() => {
        let items = initialData;

        if (currentCategory !== 'all') {
            items = items.filter(item => item.category === currentCategory);
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            items = items.filter(item =>
                item.name.toLowerCase().includes(term) ||
                item.name_ar.toLowerCase().includes(term) ||
                (item.description && item.description.toLowerCase().includes(term)) ||
                (item.description_ar && item.description_ar.toLowerCase().includes(term))
            );
        }

        return items;
    }, [initialData, searchTerm, currentCategory]);

    const { auth } = usePage().props as any;
    const userRole = auth?.user?.role;
    const isSuperAdmin = userRole === 'superadmin' || userRole === 'admin' || userRole === 'syofficial_admin';

    const groupedData = useMemo(() => {
        if (currentCategory !== 'all') {
            return { [currentCategory]: filteredData };
        }

        const groups: { [key: string]: OfficialEntity[] } = {};
        categoryList.forEach(cat => {
            if (cat.key !== 'all') {
                groups[cat.key] = filteredData.filter(item => item.category === cat.key);
            }
        });

        Object.keys(groups).forEach(key => {
            if (groups[key].length === 0) delete groups[key];
        });

        return groups;
    }, [filteredData, currentCategory, categoryList]);

    const t = TRANSLATIONS[language];

    const getCategoryLabel = (key: string) => {
        const cat = categoryList.find(c => c.key === key);
        return cat ? (language === 'ar' ? cat.label_ar : cat.label_en) : key;
    };

    return (
        <MainLayout>
            <Head>
                <title>{`${t.title} | syrian.zone`}</title>
                <meta name="description" content={t.description} />
                <meta name="keywords" content="روابط الحسابات الرسمية السورية, وزارات سوريا, سفارات سوريا, نقابات سوريا, الشخصيات العامة في سوريا, syrian zone" />
                <meta property="og:title" content={`${t.title} | syrian.zone`} />
                <meta property="og:description" content={t.description} />
                <meta property="og:type" content="website" />
                <meta property="og:image" content="/assets/ar.svg" />
                <meta name="twitter:card" content="summary" />
                <meta name="twitter:title" content={`${t.title} | syrian.zone`} />
                <meta name="twitter:description" content={t.description} />
            </Head>

            {/* Header / Hero Section */}
            <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background py-12 md:py-16 border-b border-border/40">
                <div className="container mx-auto px-4 text-center relative z-10 max-w-4xl">

                    <div className="flex items-center justify-center gap-3 mb-4">
                        <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight leading-tight">
                            {t.title}
                        </h1>
                        {isSuperAdmin && (
                            <a
                                href="/admin/syofficial"
                                className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md flex items-center gap-1 text-xs font-bold shrink-0"
                                title="إدارة وإضافة وتعديل الحسابات الرسمية"
                            >
                                <Settings className="w-4 h-4" />
                                <span className="hidden sm:inline">لوحة التحكم</span>
                            </a>
                        )}
                    </div>

                    <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto mb-8 leading-relaxed">
                        {t.description}
                    </p>

                    {/* Language Switcher */}
                    <div className="flex justify-center gap-2 mb-8">
                        {(['ar', 'en', 'tr', 'ku'] as Language[]).map(lang => (
                            <Button
                                key={lang}
                                variant={language === lang ? "default" : "secondary"}
                                size="sm"
                                onClick={() => setLanguage(lang)}
                                className="rounded-full gap-1.5 px-3"
                            >
                                <img src={`/assets/${lang}.svg`} alt={lang} className="w-4 h-3 object-cover rounded shadow-2xs" />
                                <span className="uppercase text-xs font-semibold">{lang}</span>
                            </Button>
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

                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                        {categoryList.map(cat => (
                            <Button
                                key={cat.key}
                                variant={currentCategory === cat.key ? "default" : "outline"}
                                onClick={() => setCurrentCategory(cat.key)}
                                className="rounded-full"
                                size="sm"
                            >
                                {language === 'ar' ? cat.label_ar : cat.label_en}
                            </Button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Main Content / Entity Grid */}
            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <div className="text-sm text-muted-foreground font-medium">
                        {filteredData.length > 0 ? (
                            language === 'ar' ? `عرض ${filteredData.length} حساب رسمي` : `Showing ${filteredData.length} official accounts`
                        ) : t.noResults}
                    </div>

                    {/* View Switcher (Grid / Table) */}
                    <div className="flex items-center gap-2">
                        <div className="bg-muted p-1 rounded-xl flex items-center gap-1 border border-border">
                            <Button
                                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                                size="icon"
                                onClick={() => setViewMode('table')}
                                className="h-8 w-8"
                            >
                                <TableIcon className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                                size="icon"
                                onClick={() => setViewMode('grid')}
                                className="h-8 w-8"
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
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
                                                                href={`/admin/syofficial?edit=${item.id}`}
                                                                className="absolute top-2 start-2 z-10 p-1.5 rounded-lg bg-background/90 hover:bg-primary hover:text-primary-foreground text-foreground backdrop-blur-md border border-border/70 shadow-md transition-all duration-200 opacity-90 hover:opacity-100 hover:scale-110 flex items-center gap-1 text-xs font-bold"
                                                                title="تعديل هذا الكرت في لوحة التحكم"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                                <span className="hidden sm:inline">تعديل</span>
                                                            </a>
                                                        )}
                                                        <img
                                                            src={formatEntityImage(item.image)}
                                                            alt={language === 'ar' ? item.name_ar : item.name}
                                                            loading="lazy"
                                                            decoding="async"
                                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = '/placeholder-user.jpg';
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

                                                        {item.socials && Object.entries(item.socials).filter(([_, url]) => url && typeof url === 'string' && url.trim().length > 0).length > 0 && (
                                                            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                                                                {Object.entries(item.socials)
                                                                    .filter(([_, url]) => url && typeof url === 'string' && url.trim().length > 0)
                                                                    .map(([plat, url]) => (
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
                                                                src={formatEntityImage(item.image)}
                                                                alt={language === 'ar' ? item.name_ar : item.name}
                                                                loading="lazy"
                                                                decoding="async"
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src = '/placeholder-user.jpg';
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
                                                        {Object.entries(item.socials || {})
                                                            .filter(([_, url]) => url && typeof url === 'string' && url.trim().length > 0)
                                                            .map(([plat, url]) => (
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
                                                            href={`/admin/syofficial?edit=${item.id}`}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground text-xs font-bold transition-colors"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                            تعديل
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
        </MainLayout>
    );
}
