import { useState, useMemo, useEffect } from 'react';
import { Globe, Send, Link as LinkIcon, MessageCircle, Pencil, Settings } from 'lucide-react';
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from '@/Components/ui/icons';
import { Button } from "@/Components/ui/button";
import { Card, CardContent } from "@/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import { Badge } from "@/Components/ui/badge";
import MainLayout from '@/Layouts/MainLayout';
import { useCanAny, useCanModule } from '@/Lib/useCan';
import { formatEntityImage } from '@/Lib/entityImage';
import { socialPlatformLabel } from '@/Domain/syofficial/social';
import type { OfficialCategory, OfficialEntity } from '@/Domain/syofficial/types';
import DirectoryEmptyState from '@/Components/directory/DirectoryEmptyState';
import DirectoryFilterChips from '@/Components/directory/DirectoryFilterChips';
import DirectoryResultCount from '@/Components/directory/DirectoryResultCount';
import { DirectorySearch } from '@/Components/directory/DirectorySearch';
import DirectoryViewToggle, { type DirectoryView } from '@/Components/directory/DirectoryViewToggle';
import { useDirectory, type DirectoryFacet } from '@/Components/directory/useDirectory';

interface SyOfficialClientProps {
    initialData: OfficialEntity[];
    categories?: OfficialCategory[];
}

type Language = 'ar' | 'en' | 'tr' | 'ku';

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
        description: 'Suriye devlet kurumları ve kamu figürleri için resmi sosyal medya hesapları rehberi',
        searchPlaceholder: 'İsim veya açıklamaya göre resmi hesapları arayın...',
        noResults: 'Resmi hesap bulunamadı',
        noResultsDesc: 'Arama terimlerinizi veya filtrelerinizi değiştirmeyi deneyin.',
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
        title: 'Girêdanên Fermî yên Sûriyê',
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

const entitySearchText = (item: OfficialEntity) => [item.name, item.name_ar, item.description, item.description_ar]
    .filter((value): value is string => Boolean(value))
    .join(' ');

const nonEmptySocials = (entity: OfficialEntity) => Object.entries(entity.socials ?? {})
    .filter(([, url]) => url && typeof url === 'string' && url.trim().length > 0);

export default function SyOfficialIndex({ initialData = [], categories = [] }: SyOfficialClientProps) {
    const [language, setLanguage] = useState<Language>('ar');
    const [viewMode, setViewMode] = useState<DirectoryView>('grid');

    const categoryList = useMemo(() => {
        const dynamicCats = categories.map(c => ({
            key: c.id,
            label_ar: c.label_ar,
            label_en: c.label_en,
        }));
        return [{ key: 'all', label_ar: 'الكل', label_en: 'All' }, ...dynamicCats];
    }, [categories]);

    const facets = useMemo<DirectoryFacet<OfficialEntity>[]>(() => [{
        key: 'category',
        label: 'التصنيف',
        options: categoryList
            .filter(cat => cat.key !== 'all')
            .map(cat => ({ value: cat.key, label: language === 'ar' ? cat.label_ar : cat.label_en })),
        valueOf: (item) => item.category,
    }], [categoryList, language]);

    const directory = useDirectory<OfficialEntity>({
        items: initialData,
        searchText: entitySearchText,
        facets,
    });

    // A shared link carries `?q=`. It arrives after hydration, exactly as before.
    const applyInitialQuery = directory.setQuery;
    useEffect(() => {
        const q = new URLSearchParams(window.location.search).get('q');
        if (q) applyInitialQuery(q);
    }, [applyInitialQuery]);

    const currentCategory = directory.filters.category?.[0] ?? 'all';
    const filteredData = directory.results;

    const canModule = useCanModule();
    const canAny = useCanAny();
    // Gated per action, matching the route each link opens. This used to test
    // three role strings including syofficial_admin — a role that stopped
    // granting anything when the role prefixes were removed, so a
    // syofficial_admin account was shown edit controls that all 403.
    //   panel link   -> syofficial_admin:any
    //   edit pencil  -> syofficial.edit (the save it leads to)
    const canOpenPanel = canModule('syofficial');
    const canEditEntries = canAny('syofficial.edit');

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
            

            {/* Header / Hero Section */}
            <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background py-12 md:py-16 border-b border-border/40">
                <div className="container mx-auto px-4 text-center relative z-10 max-w-4xl">

                    <div className="flex items-center justify-center gap-3 mb-4">
                        <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight leading-tight">
                            {t.title}
                        </h1>
                        {canOpenPanel && (
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
                    <div className="flex justify-center gap-2 mb-6">
                        {(['ar', 'en', 'tr', 'ku'] as Language[]).map(lang => (
                            <Button
                                key={lang}
                                variant={language === lang ? "default" : "secondary"}
                                size="sm"
                                onClick={() => setLanguage(lang)}
                                className="rounded-full gap-1.5 px-3"
                            >
                                <img src={`/assets/${lang}.svg`} alt="" className="w-4 h-3 object-cover rounded shadow-2xs" />
                                <span className="uppercase text-xs font-semibold">{lang}</span>
                            </Button>
                        ))}
                    </div>

                    {/* Social List Links */}
                    <div className="flex justify-center gap-4 mb-8">
                        <a
                            href="https://x.com/i/lists/1906101934660174006"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 rounded-full gap-2 shadow-2xs"
                        >
                            <Twitter className="h-4 w-4 text-sky-400" />
                            <span>قائمة تويتر</span>
                        </a>
                        <a
                            href="https://t.me/addlist/fKrhEy2yNeEwODQ0"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 rounded-full gap-2 shadow-2xs"
                        >
                            <Send className="h-4 w-4 text-sky-500" />
                            <span>قائمة تلغرام</span>
                        </a>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto items-center">
                        <DirectorySearch
                            size="lg"
                            value={directory.query}
                            onChange={directory.setQuery}
                            placeholder={t.searchPlaceholder}
                            ariaLabel={t.searchPlaceholder}
                        />
                    </div>

                    <DirectoryFilterChips
                        label="التصنيف"
                        allLabel={language === 'ar' ? 'الكل' : 'All'}
                        className="mt-6"
                        options={facets[0].options}
                        value={directory.filters.category ?? []}
                        onChange={(next) => directory.setFilters({ ...directory.filters, category: next })}
                    />
                </div>
            </section>

            {/* Main Content / Entity Grid */}
            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <DirectoryResultCount>
                        {filteredData.length > 0 ? (
                            language === 'ar' ? `عرض ${filteredData.length} حساب رسمي` : `Showing ${filteredData.length} official accounts`
                        ) : t.noResults}
                    </DirectoryResultCount>

                    {/* View Switcher (Grid / Table) */}
                    <div className="flex items-center gap-2">
                        <DirectoryViewToggle value={viewMode} onChange={setViewMode} className="rounded-xl bg-muted" />
                    </div>
                </div>

                {filteredData.length === 0 ? (
                    <DirectoryEmptyState
                        icon={Globe}
                        title={t.noResults}
                        description={t.noResultsDesc}
                        directory={directory}
                        className="border-border py-16"
                    />
                ) : (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="space-y-12">
                                {Object.entries(groupedData).map(([catKey, items]) => (
                                    <div key={catKey}>
                                        <h2 className="text-2xl font-bold text-foreground mb-6 border-b pb-2 border-border">
                                            {getCategoryLabel(catKey)}
                                        </h2>
                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5 sm:gap-4">
                                            {items.map(item => (
                                                <Card
                                                    key={item.id}
                                                    className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                                                >
                                                    <div className="relative aspect-square w-full overflow-hidden bg-muted/40">
                                                        {canEditEntries && (
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
                                                            alt=""
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

                                                        {nonEmptySocials(item).length > 0 && (
                                                            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                                                                {nonEmptySocials(item).map(([plat, url]) => (
                                                                    <a
                                                                        key={plat}
                                                                        href={url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className={`p-1.5 rounded-lg border border-border/50 bg-muted/50 text-muted-foreground transition-all duration-200 hover:scale-105 shadow-2xs ${getSocialStyle(plat)}`}
                                                                        title={socialPlatformLabel(plat, language === 'ar' ? 'ar' : 'en')}
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
                                            {canEditEntries && <TableHead className="text-end font-bold">إجراءات الإدارة</TableHead>}
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
                                                                alt=""
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
                                                        {nonEmptySocials(item).map(([plat, url]) => (
                                                            <a
                                                                key={plat}
                                                                href={url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={`p-1.5 rounded-lg border border-border/40 bg-muted/40 text-muted-foreground transition-all duration-200 hover:scale-105 ${getSocialStyle(plat)}`}
                                                                title={socialPlatformLabel(plat, language === 'ar' ? 'ar' : 'en')}
                                                            >
                                                                {getSocialIcon(plat)}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                {canEditEntries && (
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
