import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    BookOpen,
    Bus,
    Gamepad2,
    Globe,
    Loader2,
    MapPin,
    Phone,
    Search,
    ShieldCheck,
    Signpost,
    Smartphone,
    Sparkles,
    X,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/Components/ui/dialog';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
} from '@/Components/ui/command';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { cn } from '@/lib/utils';
import { useSiteNavigation } from '@/Lib/siteLinks';
import { GAMES } from '@/Pages/Games/_lib/games';
import { TOOLS as MUSLIM_TOOLS } from '@/Pages/Muslim/_lib/tools';
import { useMuslimNav } from '@/Pages/Muslim/_lib/nav';
import { crossings, statusOf, syriaMinutes } from '@/Pages/Crossings/_lib/crossings';
import citiesData from '@/Pages/Transit/_data/cities.json';

interface TransitCityItem {
    id: string;
    nameAr: string;
    nameEn: string;
    status: string;
    routeCount?: number;
}

const CITIES = citiesData as TransitCityItem[];

const CITY_NAME_MAP: Record<string, string> = Object.fromEntries(
    CITIES.map((c) => [c.id, c.nameAr]),
);

// Descriptions & search keywords for SITE_LINKS items (keyed by href)
const SITE_LINK_DESCRIPTIONS: Record<string, string> = {
    '/roznama': 'التقويم السوري والهجري والمناسبات ومواقيت الصلاة',
    '/muslim': 'مواقيت الصلاة، القرآن الكريم، وإذاعة القرآن',
    '/games': 'ألعاب ورق وذكاء جماعية وفردية: تركس، طرنيب، مين، سوليتير، 2048',
    '/transit': 'خريطة خطوط النقل العام والسرفيس والباصات في المدن السورية',
    '/mishwar': 'دليل الأماكن والمطاعم والمقاهي والفنادق في سوريا',
    '/board': 'لوحة أدوات ومعلومات سورية مخصصة قابلة للترتيب',
    '/compass': 'اختبار البوصلة السياسية السورية وتحديد توجهاتك',
    '/tierlist': 'تقييم أداء الوزراء والجهات الحكومية ومشاركة الترتيب',
    '/priorities': 'استبيان وترتيب أولويات إعادة الإعمار والتنمية في سوريا',
    '/crossings': 'حالة المعابر البرية والمطارات والمرافئ السورية لحظة بلحظة',
    'https://food.syrian.zone': 'موسوعة وصفات المطبخ السوري التقليدي الأصيل',
    'https://answers.syrian.zone': 'منصة الأسئلة والأجوبة المجتمعية حول سوريا',
    '/syofficial': 'دليل الحسابات والصفحات الرسمية للوزارات والمؤسسات السورية',
    '/phonebook': 'أرقام الطوارئ والاستعلامات والخدمات العامة في المحافظات',
    '/sites': 'دليل المواقع والمنصات والمبادرات الرقمية السورية',
    '/syrian-contributors': 'لوحة المساهمين والمطورين في المشاريع السورية مفتوحة المصدر',
    '/govapps': 'دليل التطبيقات الحكومية والخدمية الرسمية في سوريا',
    '/party': 'دليل الأحزاب والتيارات والكيانات السياسية السورية',
    '/house': 'مرصد المجلس التشريعي وتوزيع المقاعد والأعضاء',
    '/justice': 'العدالة الانتقالية والتوثيق والمحاسبة',
    '/syid': 'دليل الهوية البصرية السورية الرسمية، الألوان والخطوط والشعارات',
    '/atlas': 'أطلس السكان والخرائط الديمغرافية والتقسيمات الإدارية',
    'https://discord.gg/NqE8849VzA': 'مجتمع المبرمجين والمصممين السوريين على ديسكورد',
    'https://chromewebstore.google.com/detail/syrian-flag-replacer/dngipobppehfhfggmbdiiiodgcibdeog': 'إضافة متصفح لاستبدال العلم القديم بالعلم السوري',
    'https://joory.chat': 'مساعد ذكي باللغة العربية',
    'https://jard.chat': 'منصة جرد',
    'https://news.jard.chat': 'متابعة آخر أخبار سوريا من المصادر الموثوقة',
};

// All 114 Surahs (1-based index)
const SURAHS: Array<{ number: number; name: string; ayahs: number }> = [
    { number: 1, name: 'سورة الفاتحة', ayahs: 7 },
    { number: 2, name: 'سورة البقرة', ayahs: 286 },
    { number: 3, name: 'سورة آل عمران', ayahs: 200 },
    { number: 4, name: 'سورة النساء', ayahs: 176 },
    { number: 5, name: 'سورة المائدة', ayahs: 120 },
    { number: 6, name: 'سورة الأنعام', ayahs: 165 },
    { number: 7, name: 'سورة الأعراف', ayahs: 206 },
    { number: 8, name: 'سورة الأنفال', ayahs: 75 },
    { number: 9, name: 'سورة التوبة', ayahs: 129 },
    { number: 10, name: 'سورة يونس', ayahs: 109 },
    { number: 11, name: 'سورة هود', ayahs: 123 },
    { number: 12, name: 'سورة يوسف', ayahs: 111 },
    { number: 13, name: 'سورة الرعد', ayahs: 43 },
    { number: 14, name: 'سورة إبراهيم', ayahs: 52 },
    { number: 15, name: 'سورة الحجر', ayahs: 99 },
    { number: 16, name: 'سورة النحل', ayahs: 128 },
    { number: 17, name: 'سورة الإسراء', ayahs: 111 },
    { number: 18, name: 'سورة الكهف', ayahs: 110 },
    { number: 19, name: 'سورة مريم', ayahs: 98 },
    { number: 20, name: 'سورة طه', ayahs: 135 },
    { number: 21, name: 'سورة الأنبياء', ayahs: 112 },
    { number: 22, name: 'سورة الحج', ayahs: 78 },
    { number: 23, name: 'سورة المؤمنون', ayahs: 118 },
    { number: 24, name: 'سورة النور', ayahs: 64 },
    { number: 25, name: 'سورة الفرقان', ayahs: 77 },
    { number: 26, name: 'سورة الشعراء', ayahs: 227 },
    { number: 27, name: 'سورة النمل', ayahs: 93 },
    { number: 28, name: 'سورة القصص', ayahs: 88 },
    { number: 29, name: 'سورة العنكبوت', ayahs: 69 },
    { number: 30, name: 'سورة الروم', ayahs: 60 },
    { number: 31, name: 'سورة لقمان', ayahs: 34 },
    { number: 32, name: 'سورة السجدة', ayahs: 30 },
    { number: 33, name: 'سورة الأحزاب', ayahs: 73 },
    { number: 34, name: 'سورة سبأ', ayahs: 54 },
    { number: 35, name: 'سورة فاطر', ayahs: 45 },
    { number: 36, name: 'سورة يس', ayahs: 83 },
    { number: 37, name: 'سورة الصافات', ayahs: 182 },
    { number: 38, name: 'سورة ص', ayahs: 88 },
    { number: 39, name: 'سورة الزمر', ayahs: 75 },
    { number: 40, name: 'سورة غافر', ayahs: 85 },
    { number: 41, name: 'سورة فصلت', ayahs: 54 },
    { number: 42, name: 'سورة الشورى', ayahs: 53 },
    { number: 43, name: 'سورة الزخرف', ayahs: 89 },
    { number: 44, name: 'سورة الدخان', ayahs: 59 },
    { number: 45, name: 'سورة الجاثية', ayahs: 37 },
    { number: 46, name: 'سورة الأحقاف', ayahs: 35 },
    { number: 47, name: 'سورة محمد', ayahs: 38 },
    { number: 48, name: 'سورة الفتح', ayahs: 29 },
    { number: 49, name: 'سورة الحجرات', ayahs: 18 },
    { number: 50, name: 'سورة ق', ayahs: 45 },
    { number: 51, name: 'سورة الذاريات', ayahs: 60 },
    { number: 52, name: 'سورة الطور', ayahs: 49 },
    { number: 53, name: 'سورة النجم', ayahs: 62 },
    { number: 54, name: 'سورة القمر', ayahs: 55 },
    { number: 55, name: 'سورة الرحمن', ayahs: 78 },
    { number: 56, name: 'سورة الواقعة', ayahs: 96 },
    { number: 57, name: 'سورة الحديد', ayahs: 29 },
    { number: 58, name: 'سورة المجادلة', ayahs: 22 },
    { number: 59, name: 'سورة الحشر', ayahs: 24 },
    { number: 60, name: 'سورة الممتحنة', ayahs: 13 },
    { number: 61, name: 'سورة الصف', ayahs: 14 },
    { number: 62, name: 'سورة الجمعة', ayahs: 11 },
    { number: 63, name: 'سورة المنافقون', ayahs: 11 },
    { number: 64, name: 'سورة التغابن', ayahs: 18 },
    { number: 65, name: 'سورة الطلاق', ayahs: 12 },
    { number: 66, name: 'سورة التحريم', ayahs: 12 },
    { number: 67, name: 'سورة الملك', ayahs: 30 },
    { number: 68, name: 'سورة القلم', ayahs: 52 },
    { number: 69, name: 'سورة الحاقة', ayahs: 52 },
    { number: 70, name: 'سورة المعارج', ayahs: 44 },
    { number: 71, name: 'سورة نوح', ayahs: 28 },
    { number: 72, name: 'سورة الجن', ayahs: 28 },
    { number: 73, name: 'سورة المزمل', ayahs: 20 },
    { number: 74, name: 'سورة المدثر', ayahs: 56 },
    { number: 75, name: 'سورة القيامة', ayahs: 40 },
    { number: 76, name: 'سورة الإنسان', ayahs: 31 },
    { number: 77, name: 'سورة المرسلات', ayahs: 50 },
    { number: 78, name: 'سورة النبأ', ayahs: 40 },
    { number: 79, name: 'سورة النازعات', ayahs: 46 },
    { number: 80, name: 'سورة عبس', ayahs: 42 },
    { number: 81, name: 'سورة التكوير', ayahs: 29 },
    { number: 82, name: 'سورة الانفطار', ayahs: 19 },
    { number: 83, name: 'سورة المطففين', ayahs: 36 },
    { number: 84, name: 'سورة الانشقاق', ayahs: 25 },
    { number: 85, name: 'سورة البروج', ayahs: 22 },
    { number: 86, name: 'سورة الطارق', ayahs: 17 },
    { number: 87, name: 'سورة الأعلى', ayahs: 19 },
    { number: 88, name: 'سورة الغاشية', ayahs: 26 },
    { number: 89, name: 'سورة الفجر', ayahs: 30 },
    { number: 90, name: 'سورة البلد', ayahs: 20 },
    { number: 91, name: 'سورة الشمس', ayahs: 15 },
    { number: 92, name: 'سورة الليل', ayahs: 21 },
    { number: 93, name: 'سورة الضحى', ayahs: 11 },
    { number: 94, name: 'سورة الشرح', ayahs: 8 },
    { number: 95, name: 'سورة التين', ayahs: 8 },
    { number: 96, name: 'سورة العلق', ayahs: 19 },
    { number: 97, name: 'سورة القدر', ayahs: 5 },
    { number: 98, name: 'سورة البينة', ayahs: 8 },
    { number: 99, name: 'سورة الزلزلة', ayahs: 8 },
    { number: 100, name: 'سورة العاديات', ayahs: 11 },
    { number: 101, name: 'سورة القارعة', ayahs: 11 },
    { number: 102, name: 'سورة التكاثر', ayahs: 8 },
    { number: 103, name: 'سورة العصر', ayahs: 3 },
    { number: 104, name: 'سورة الهمزة', ayahs: 9 },
    { number: 105, name: 'سورة الفيل', ayahs: 5 },
    { number: 106, name: 'سورة قريش', ayahs: 4 },
    { number: 107, name: 'سورة الماعون', ayahs: 7 },
    { number: 108, name: 'سورة الكوثر', ayahs: 3 },
    { number: 109, name: 'سورة الكافرون', ayahs: 6 },
    { number: 110, name: 'سورة النصر', ayahs: 3 },
    { number: 111, name: 'سورة المسد', ayahs: 5 },
    { number: 112, name: 'سورة الإخلاص', ayahs: 4 },
    { number: 113, name: 'سورة الفلق', ayahs: 5 },
    { number: 114, name: 'سورة الناس', ayahs: 6 },
];

function normalizeArabic(text: string): string {
    return text
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .trim();
}

function matchesSearch(query: string, ...targets: Array<string | undefined | null>): boolean {
    const q = normalizeArabic(query);
    if (!q) return true;
    const tokens = q.split(/\s+/).filter(Boolean);
    const haystack = targets
        .filter(Boolean)
        .map((t) => normalizeArabic(String(t)))
        .join(' ');
    return tokens.every((tok) => haystack.includes(tok));
}

export interface RemoteSearchResults {
    routes: Array<{ id: string; cityId: string; nameAr: string; nameEn?: string }>;
    places: Array<{ id: number; name: string; category?: string }>;
    phonebook: Array<{ id: string; nameAr: string; nameEn?: string; number: string }>;
    officials: Array<{ id: string; nameAr: string; nameEn?: string; categoryId?: string }>;
    govapps: Array<{ id: string; nameAr: string; nameEn?: string }>;
}

export const EMPTY_REMOTE: RemoteSearchResults = {
    routes: [],
    places: [],
    phonebook: [],
    officials: [],
    govapps: [],
};

export type FilterScope = 'all' | 'tools' | 'transit' | 'muslim' | 'games' | 'directory';

export const FILTER_TABS: Array<{ id: FilterScope; label: string }> = [
    { id: 'all', label: 'الكل' },
    { id: 'tools', label: 'الأقسام' },
    { id: 'transit', label: 'ترانزيت' },
    { id: 'muslim', label: 'الركن الإسلامي' },
    { id: 'games', label: 'الألعاب' },
    { id: 'directory', label: 'الأدلة والمعابر' },
];

export function useGlobalSearchData(query: string, scope: FilterScope, enabled = true) {
    const [remote, setRemote] = useState<RemoteSearchResults>(EMPTY_REMOTE);
    const [loadingRemote, setLoadingRemote] = useState(false);
    const { allLinks } = useSiteNavigation();

    useEffect(() => {
        const trimmed = query.trim();
        if (!enabled || trimmed.length < 2) {
            setRemote(EMPTY_REMOTE);
            setLoadingRemote(false);
            return;
        }

        const controller = new AbortController();
        setLoadingRemote(true);

        const timer = setTimeout(() => {
            fetch(`/api/v1/global-search?q=${encodeURIComponent(trimmed)}`, {
                signal: controller.signal,
                headers: { Accept: 'application/json' },
            })
                .then((res) => (res.ok ? res.json() : EMPTY_REMOTE))
                .then((data: RemoteSearchResults) => {
                    setRemote({
                        routes: Array.isArray(data.routes) ? data.routes : [],
                        places: Array.isArray(data.places) ? data.places : [],
                        phonebook: Array.isArray(data.phonebook) ? data.phonebook : [],
                        officials: Array.isArray(data.officials) ? data.officials : [],
                        govapps: Array.isArray(data.govapps) ? data.govapps : [],
                    });
                })
                .catch(() => {
                    // Offline or aborted: keep client-side results working smoothly
                })
                .finally(() => {
                    if (!controller.signal.aborted) {
                        setLoadingRemote(false);
                    }
                });
        }, 200);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query, enabled]);

    const trimmedQuery = query.trim();

    const matchedSiteLinks = useMemo(() => {
        if (scope !== 'all' && scope !== 'tools') return [];
        return allLinks.filter((item) =>
            matchesSearch(
                trimmedQuery,
                item.text,
                item.subtitle,
                SITE_LINK_DESCRIPTIONS[item.href],
                item.href,
            ),
        );
    }, [trimmedQuery, scope, allLinks]);

    const matchedCities = useMemo(() => {
        if (scope !== 'all' && scope !== 'transit') return [];
        const list = CITIES.filter((c) =>
            matchesSearch(trimmedQuery, c.nameAr, c.nameEn, c.id, 'ترانزيت سرفيس باص محافظة مدينة'),
        );
        if (!trimmedQuery && scope !== 'transit') {
            return list.filter((c) => (c.routeCount ?? 0) > 0 || c.status === 'active').slice(0, 6);
        }
        return scope === 'transit' && !trimmedQuery ? list : list.slice(0, 8);
    }, [trimmedQuery, scope]);

    const matchedMuslimTools = useMemo(() => {
        if (scope !== 'all' && scope !== 'muslim') return [];
        return MUSLIM_TOOLS.filter((t) =>
            matchesSearch(trimmedQuery, t.title, t.subtitle, t.description, 'صلاة قرآن اذاعة قبلة'),
        );
    }, [trimmedQuery, scope]);

    const matchedSurahs = useMemo(() => {
        if (scope !== 'all' && scope !== 'muslim') return [];
        if (!trimmedQuery && scope !== 'muslim') return [];
        const list = SURAHS.filter((s) =>
            matchesSearch(trimmedQuery, s.name, `سورة ${s.number}`, String(s.number)),
        );
        return list.slice(0, 8);
    }, [trimmedQuery, scope]);

    const matchedGames = useMemo(() => {
        if (scope !== 'all' && scope !== 'games') return [];
        return GAMES.filter((g) =>
            matchesSearch(trimmedQuery, g.title, g.subtitle, g.description, 'لعبة العاب شدة ورق'),
        );
    }, [trimmedQuery, scope]);

    const matchedCrossings = useMemo(() => {
        if (scope !== 'all' && scope !== 'directory') return [];
        if (!trimmedQuery && scope !== 'directory') return [];
        const nowMin = syriaMinutes();
        return crossings
            .filter((c) =>
                matchesSearch(trimmedQuery, c.name, c.intl, c.country, 'معبر منفذ حدود مرفأ'),
            )
            .slice(0, 6)
            .map((c) => ({
                ...c,
                liveStatus: statusOf(c, nowMin),
            }));
    }, [trimmedQuery, scope]);

    const showRemoteRoutes = (scope === 'all' || scope === 'transit') && remote.routes.length > 0;
    const showRemotePlaces = (scope === 'all' || scope === 'tools' || scope === 'directory') && remote.places.length > 0;
    const showRemotePhonebook = (scope === 'all' || scope === 'directory') && remote.phonebook.length > 0;
    const showRemoteOfficials = (scope === 'all' || scope === 'directory') && remote.officials.length > 0;
    const showRemoteGovApps = (scope === 'all' || scope === 'directory' || scope === 'tools') && remote.govapps.length > 0;

    const totalVisibleResults =
        matchedSiteLinks.length +
        matchedCities.length +
        matchedMuslimTools.length +
        matchedSurahs.length +
        matchedGames.length +
        matchedCrossings.length +
        (showRemoteRoutes ? remote.routes.length : 0) +
        (showRemotePlaces ? remote.places.length : 0) +
        (showRemotePhonebook ? remote.phonebook.length : 0) +
        (showRemoteOfficials ? remote.officials.length : 0) +
        (showRemoteGovApps ? remote.govapps.length : 0);

    return {
        trimmedQuery,
        remote,
        loadingRemote,
        matchedSiteLinks,
        matchedCities,
        matchedMuslimTools,
        matchedSurahs,
        matchedGames,
        matchedCrossings,
        showRemoteRoutes,
        showRemotePlaces,
        showRemotePhonebook,
        showRemoteOfficials,
        showRemoteGovApps,
        totalVisibleResults,
    };
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent || '');
const SHORTCUT_LABEL = IS_MAC ? '⌘ K' : 'Ctrl K';
const SHORTCUT_ARIA = IS_MAC ? 'بحث سريع في المنصة (⌘K)' : 'بحث سريع في المنصة (Ctrl+K)';

export function DesktopSearchTrigger({ className = '' }: { className?: string }) {
    const setSearchOpen = useMuslimNav((s) => s.setSearchOpen);
    return (
        <Button
            type="button"
            variant="outline"
            onClick={() => setSearchOpen(true)}
            aria-label={SHORTCUT_ARIA}
            className={`hidden lg:inline-flex h-9 items-center justify-between gap-3 rounded-xl border-border/80 bg-muted/40 px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors ${className}`}
        >
            <span className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>بحث سريع...</span>
            </span>
            <kbd
                dir="ltr"
                className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded-md border border-border bg-background px-1.5 font-mono text-[10px] font-semibold text-muted-foreground shadow-2xs"
            >
                {SHORTCUT_LABEL}
            </kbd>
        </Button>
    );
}

/**
 * Shared rendering of all searchable groups (Tools TileGrid + Cities + Muslim/Surahs + Games + Crossings + Live API results).
 * - When `useCmdkPrimitives` is true (Desktop Ctrl+K modal), items render as `<CommandGroup>` + `<CommandItem>` for arrow-key navigation.
 * - When `useCmdkPrimitives` is false (Mobile Menu Sheet / Homepage inline search), items render as plain native `<section>` + `<button>` elements so cmdk never calls `scrollIntoView()` and never jumps the viewport.
 */
export function SearchResultsContent({
    data,
    pathname,
    onClose,
    gridColsClass = 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6',
    useCmdkPrimitives = true,
}: {
    data: ReturnType<typeof useGlobalSearchData>;
    pathname: string;
    onClose: () => void;
    gridColsClass?: string;
    useCmdkPrimitives?: boolean;
}) {
    const setTargetAyah = useMuslimNav((s) => s.setTargetAyah);

    const navigateTo = (url: string, external = false) => {
        onClose();
        if (external) {
            window.open(url, '_blank', 'noopener,noreferrer');
        } else {
            router.visit(url);
        }
    };

    const jumpToSurah = (surahNumber: number) => {
        onClose();
        setTargetAyah(`${surahNumber}:1`);
        router.visit('/muslim/quran');
    };

    const {
        trimmedQuery,
        remote,
        loadingRemote,
        matchedSiteLinks,
        matchedCities,
        matchedMuslimTools,
        matchedSurahs,
        matchedGames,
        matchedCrossings,
        showRemoteRoutes,
        showRemotePlaces,
        showRemotePhonebook,
        showRemoteOfficials,
        showRemoteGovApps,
        totalVisibleResults,
    } = data;

    const GroupWrapper = ({
        heading,
        children,
    }: {
        heading: string;
        children: React.ReactNode;
    }) => {
        if (useCmdkPrimitives) {
            return <CommandGroup heading={heading}>{children}</CommandGroup>;
        }
        return (
            <div className="py-1.5 text-foreground">
                <p className="px-1 pb-1.5 text-xs font-bold text-muted-foreground/80">
                    {heading}
                </p>
                <div className="flex flex-col gap-1">{children}</div>
            </div>
        );
    };

    const ItemRow = ({
        value,
        onSelect,
        className,
        children,
    }: {
        value: string;
        onSelect: () => void;
        className?: string;
        children: React.ReactNode;
    }) => {
        if (useCmdkPrimitives) {
            return (
                <CommandItem value={value} onSelect={onSelect} className={className}>
                    {children}
                </CommandItem>
            );
        }
        return (
            <button
                type="button"
                onClick={onSelect}
                className={cn(
                    'w-full text-right outline-none hover:bg-accent/60 active:bg-accent transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                    className,
                )}
            >
                {children}
            </button>
        );
    };

    return (
        <>
            {totalVisibleResults === 0 && !loadingRemote && (
                useCmdkPrimitives ? (
                    <CommandEmpty className="py-10 text-center">
                        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <Search className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                            لا توجد نتائج مطابقة لـ «{trimmedQuery}»
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            جرّب البحث باسم مدينة، سورة، لعبة، معبر حدودي، أو جهة رسمية
                        </p>
                    </CommandEmpty>
                ) : (
                    <div className="py-10 text-center">
                        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <Search className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                            لا توجد نتائج مطابقة لـ «{trimmedQuery}»
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            جرّب البحث باسم مدينة، سورة، لعبة، معبر حدودي، أو جهة رسمية
                        </p>
                    </div>
                )
            )}

            {/* 1. Site Sections & Tools — Grid matching Home & Mobile Menu */}
            {matchedSiteLinks.length > 0 && (
                <div className="px-1 py-2">
                    <p className="mb-2 px-1 text-xs font-bold text-muted-foreground/80">
                        أقسام وأدوات المنصة
                    </p>
                    <ul className={cn('grid gap-x-2 gap-y-4 py-1', gridColsClass)}>
                        {matchedSiteLinks.map(({ id, href, text, icon: Icon, image, isFlag, external }) => {
                            const isActive = pathname === href;
                            const tileClassName =
                                'group flex h-full select-none flex-col items-center gap-2 rounded-lg px-1 py-2 text-center no-underline outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring transition-colors';
                            const body = (
                                <>
                                    {isFlag ? (
                                        <img
                                            src="/flag-replacer/1f1f8-1f1fe.svg"
                                            alt=""
                                            className="h-12 w-12 shrink-0 object-contain transition-transform group-hover:scale-110"
                                        />
                                    ) : image ? (
                                        <img
                                            src={image}
                                            alt=""
                                            loading="lazy"
                                            decoding="async"
                                            className="h-12 w-12 shrink-0 object-contain transition-transform group-hover:scale-110"
                                        />
                                    ) : Icon ? (
                                        <Icon
                                            className={cn(
                                                'h-12 w-12 shrink-0 transition-all group-hover:scale-110',
                                                isActive ? 'text-primary' : 'text-foreground group-hover:text-primary',
                                            )}
                                        />
                                    ) : (
                                        <Globe className="h-12 w-12 shrink-0 text-foreground transition-all group-hover:scale-110 group-hover:text-primary" />
                                    )}
                                    <span
                                        className={cn(
                                            'line-clamp-2 text-xs font-medium leading-tight transition-colors',
                                            isActive ? 'text-primary' : 'text-foreground group-hover:text-primary',
                                        )}
                                    >
                                        {text}
                                    </span>
                                </>
                            );

                            return (
                                <li key={id || href}>
                                    {external ? (
                                        <a
                                            href={href}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={onClose}
                                            className={tileClassName}
                                        >
                                            {body}
                                        </a>
                                    ) : (
                                        <Link
                                            href={href}
                                            onClick={onClose}
                                            className={tileClassName}
                                        >
                                            {body}
                                        </Link>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {/* 2. Live Transit Routes from Backend */}
            {showRemoteRoutes && (
                <GroupWrapper heading="خطوط السرفيس والباصات (ترانزيت)">
                    {remote.routes.map((route) => (
                        <ItemRow
                            key={`route-${route.id}`}
                            value={`route-${route.id}-${route.nameAr}`}
                            onSelect={() =>
                                navigateTo(`/transit/city/${route.cityId}?route=${encodeURIComponent(route.id)}`)
                            }
                            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 cursor-pointer"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    <Bus className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <span className="font-semibold text-sm text-foreground block truncate">
                                        {route.nameAr}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        خط نقل عام · {CITY_NAME_MAP[route.cityId] || route.cityId}
                                    </span>
                                </div>
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                                {CITY_NAME_MAP[route.cityId] || route.cityId}
                            </Badge>
                        </ItemRow>
                    ))}
                </GroupWrapper>
            )}

            {/* 3. Transit Cities */}
            {matchedCities.length > 0 && (
                <GroupWrapper heading="مدن ومحافظات ترانزيت">
                    {matchedCities.map((city) => {
                        const count = city.routeCount ?? 0;
                        return (
                            <ItemRow
                                key={`city-${city.id}`}
                                value={`city-${city.id}-${city.nameAr}`}
                                onSelect={() => navigateTo(`/transit/city/${city.id}`)}
                                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 cursor-pointer"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/50 text-foreground">
                                        <Bus className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="font-semibold text-sm text-foreground">
                                            {city.nameAr}
                                        </span>
                                        <span className="ms-2 text-xs text-muted-foreground">
                                            ({city.nameEn})
                                        </span>
                                    </div>
                                </div>
                                <Badge
                                    variant={count > 0 ? 'secondary' : 'outline'}
                                    className="text-[10px] shrink-0"
                                >
                                    {count > 0 ? `${count} خط` : 'ساهم بإضافة خط'}
                                </Badge>
                            </ItemRow>
                        );
                    })}
                </GroupWrapper>
            )}

            {/* 4. Muslim Corner Tools & Quran Surahs */}
            {(matchedMuslimTools.length > 0 || matchedSurahs.length > 0) && (
                <GroupWrapper heading="الركن الإسلامي والقرآن الكريم">
                    {matchedMuslimTools.map((tool) => {
                        const Icon = tool.icon;
                        return (
                            <ItemRow
                                key={`muslim-${tool.id}`}
                                value={`muslim-${tool.id}-${tool.title}`}
                                onSelect={() => navigateTo(tool.href)}
                                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 cursor-pointer"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="font-semibold text-sm text-foreground block truncate">
                                            {tool.title}
                                        </span>
                                        <span className="text-xs text-muted-foreground block truncate">
                                            {tool.subtitle}
                                        </span>
                                    </div>
                                </div>
                                <Badge variant="outline" className="text-[10px] shrink-0">
                                    الركن الإسلامي
                                </Badge>
                            </ItemRow>
                        );
                    })}

                    {matchedSurahs.map((surah) => (
                        <ItemRow
                            key={`surah-${surah.number}`}
                            value={`surah-${surah.number}-${surah.name}`}
                            onSelect={() => jumpToSurah(surah.number)}
                            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 cursor-pointer"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold">
                                    {surah.number}
                                </div>
                                <div className="min-w-0">
                                    <span className="font-semibold text-sm text-foreground">
                                        {surah.name}
                                    </span>
                                    <span className="ms-2 text-xs text-muted-foreground">
                                        · {surah.ayahs} آية
                                    </span>
                                </div>
                            </div>
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                                <BookOpen className="h-3.5 w-3.5" />
                                قراءة السورة
                            </span>
                        </ItemRow>
                    ))}
                </GroupWrapper>
            )}

            {/* 5. Games */}
            {matchedGames.length > 0 && (
                <GroupWrapper heading="الألعاب">
                    {matchedGames.map((game) => {
                        const Icon = game.icon;
                        return (
                            <ItemRow
                                key={`game-${game.id}`}
                                value={`game-${game.id}-${game.title}`}
                                onSelect={() => navigateTo(game.href, game.external)}
                                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 cursor-pointer"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/50 text-primary">
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="font-semibold text-sm text-foreground">
                                            {game.title}
                                        </span>
                                        <span className="ms-2 text-xs text-muted-foreground">
                                            · {game.subtitle}
                                        </span>
                                    </div>
                                </div>
                                <Gamepad2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            </ItemRow>
                        );
                    })}
                </GroupWrapper>
            )}

            {/* 6. Border Crossings */}
            {matchedCrossings.length > 0 && (
                <GroupWrapper heading="المنافذ والمعابر الحدودية">
                    {matchedCrossings.map((crossing) => {
                        const isOpen = crossing.liveStatus.status === 'open';
                        return (
                            <ItemRow
                                key={`crossing-${crossing.n}`}
                                value={`crossing-${crossing.n}-${crossing.name}`}
                                onSelect={() => navigateTo(`/crossings?c=${crossing.n}`)}
                                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 cursor-pointer"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/50 text-foreground">
                                        <Signpost className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="font-semibold text-sm text-foreground">
                                            معبر {crossing.name}
                                        </span>
                                        <span className="ms-2 text-xs text-muted-foreground">
                                            ({crossing.intl}{crossing.country ? ` · ${crossing.country}` : ''})
                                        </span>
                                    </div>
                                </div>
                                <Badge
                                    variant="outline"
                                    className={`text-[10px] shrink-0 ${
                                        isOpen
                                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                            : 'border-border text-muted-foreground'
                                    }`}
                                >
                                    {crossing.liveStatus.headline}
                                </Badge>
                            </ItemRow>
                        );
                    })}
                </GroupWrapper>
            )}

            {/* 7. Live Mishwar Places */}
            {showRemotePlaces && (
                <GroupWrapper heading="أماكن مشوار">
                    {remote.places.map((place) => (
                        <ItemRow
                            key={`place-${place.id}`}
                            value={`place-${place.id}-${place.name}`}
                            onSelect={() => navigateTo(`/mishwar?place=${place.id}`)}
                            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 cursor-pointer"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/50 text-primary">
                                    <MapPin className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-sm text-foreground truncate">
                                    {place.name}
                                </span>
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                                مشوار
                            </Badge>
                        </ItemRow>
                    ))}
                </GroupWrapper>
            )}

            {/* 8. Live Phonebook & Emergency Numbers */}
            {showRemotePhonebook && (
                <GroupWrapper heading="دليل الهاتف والطوارئ">
                    {remote.phonebook.map((entry) => (
                        <ItemRow
                            key={`phone-${entry.id}`}
                            value={`phone-${entry.id}-${entry.nameAr}-${entry.number}`}
                            onSelect={() =>
                                navigateTo(`/phonebook?q=${encodeURIComponent(entry.nameAr)}`)
                            }
                            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 cursor-pointer"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/50 text-primary">
                                    <Phone className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-sm text-foreground truncate">
                                    {entry.nameAr}
                                </span>
                            </div>
                            <span
                                dir="ltr"
                                className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs font-bold text-foreground shrink-0"
                            >
                                {entry.number}
                            </span>
                        </ItemRow>
                    ))}
                </GroupWrapper>
            )}

            {/* 9. Live Official Entities */}
            {showRemoteOfficials && (
                <GroupWrapper heading="الحسابات والجهات الرسمية">
                    {remote.officials.map((official) => (
                        <ItemRow
                            key={`official-${official.id}`}
                            value={`official-${official.id}-${official.nameAr}`}
                            onSelect={() =>
                                navigateTo(`/syofficial?q=${encodeURIComponent(official.nameAr)}`)
                            }
                            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 cursor-pointer"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/50 text-primary">
                                    <ShieldCheck className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-sm text-foreground truncate">
                                    {official.nameAr}
                                </span>
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                                حساب رسمي
                            </Badge>
                        </ItemRow>
                    ))}
                </GroupWrapper>
            )}

            {/* 10. Live Government Apps */}
            {showRemoteGovApps && (
                <GroupWrapper heading="تطبيقات الحكومة">
                    {remote.govapps.map((app) => (
                        <ItemRow
                            key={`govapp-${app.id}`}
                            value={`govapp-${app.id}-${app.nameAr}`}
                            onSelect={() => navigateTo('/govapps')}
                            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 cursor-pointer"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/50 text-primary">
                                    <Smartphone className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-sm text-foreground truncate">
                                    {app.nameAr}
                                </span>
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                                تطبيق حكومي
                            </Badge>
                        </ItemRow>
                    ))}
                </GroupWrapper>
            )}
        </>
    );
}

/**
 * Always-on Search & Navigation Panel for the Mobile Menu Sheet.
 * - Replaces the classic static menu so search, category filter pills, the 3-column sections grid,
 *   and searchable items (cities, surahs, games, crossings, phonebook) are always available immediately.
 * - Uses native DOM buttons/links (`useCmdkPrimitives={false}`) instead of cmdk's `<Command>` wrapper
 *   so clicking the search input never triggers cmdk's `scrollIntoView()` viewport jump.
 */
export function MobileMenuSearchSection({
    pathname,
    onNavigate,
}: {
    pathname: string;
    onNavigate: () => void;
}) {
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState<FilterScope>('all');
    const inputRef = useRef<HTMLInputElement | null>(null);

    const data = useGlobalSearchData(query, scope, true);

    return (
        <div className="flex flex-col gap-3">
            {/* Sticky Search Bar + Filter Pills at the top of the mobile menu */}
            <div className="flex flex-col gap-2.5">
                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="sz-mobile-menu-search"
                        className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-muted-foreground"
                    >
                        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>ابحث في: الأقسام · المدن وخطوط السرفيس · سور القرآن · المعابر · دليل الهاتف</span>
                    </label>

                    <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/30 px-3 py-2.5 transition-all focus-within:border-primary focus-within:bg-muted/50 focus-within:ring-2 focus-within:ring-primary/20">
                        <Search className="h-4 w-4 text-primary shrink-0" />
                        <input
                            id="sz-mobile-menu-search"
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="اكتب للبحث الفوري في المنصة..."
                            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                        />
                        {data.loadingRemote && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                        )}
                        {query && (
                            <button
                                type="button"
                                onClick={() => {
                                    setQuery('');
                                    inputRef.current?.focus();
                                }}
                                aria-label="مسح البحث"
                                className="rounded-lg p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Category Filter Pills — always visible */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {FILTER_TABS.map((tab) => {
                        const active = scope === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setScope(tab.id)}
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                                    active
                                        ? 'bg-primary text-primary-foreground shadow-2xs'
                                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Always-on Searchable Content (Sections Grid + Cities + Muslim + Games + Crossings + Live Results) */}
            <div className="flex flex-col gap-2">
                <SearchResultsContent
                    data={data}
                    pathname={pathname}
                    onClose={onNavigate}
                    gridColsClass="grid-cols-3"
                    useCmdkPrimitives={false}
                />
            </div>
        </div>
    );
}

/**
 * Homepage inline search & links section (PC & Mobile).
 * - Displays a prominent search bar and category filter pills above the homepage grid.
 * - When idle (`query === '' && scope === 'all'`), renders `children` (the classic Internal & External link grids).
 * - When the user types a query or selects a category filter pill, replaces the grids in-place with the
 *   unified search results (`SearchResultsContent` using the homepage's 3..9 column grid).
 */
export function HomeInlineSearchSection({
    children,
}: {
    children: React.ReactNode;
}) {
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState<FilterScope>('all');
    const inputRef = useRef<HTMLInputElement | null>(null);

    const isSearching = query.trim().length > 0 || scope !== 'all';
    const data = useGlobalSearchData(query, scope, isSearching);

    const handleReset = () => {
        setQuery('');
        setScope('all');
        inputRef.current?.focus();
    };

    return (
        <div className="mb-12">
            {/* Search Bar + Category Filter Pills */}
            <div className="mx-auto mb-8 max-w-2xl flex flex-col gap-2.5">
                <div className="flex items-center justify-between px-1">
                    <label
                        htmlFor="sz-home-inline-search"
                        className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground"
                    >
                        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>ابحث في: الأقسام · المدن وخطوط السرفيس · سور القرآن · المعابر · دليل الهاتف</span>
                    </label>
                    {isSearching && (
                        <button
                            type="button"
                            onClick={handleReset}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline shrink-0 ms-2"
                        >
                            <X className="h-3.5 w-3.5" />
                            <span>عرض كل الأقسام</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2.5 rounded-2xl border border-border/80 bg-card/80 px-4 py-3 shadow-2xs transition-all focus-within:border-primary focus-within:bg-card focus-within:ring-2 focus-within:ring-primary/20">
                    <Search className="h-5 w-5 text-primary shrink-0" />
                    <input
                        id="sz-home-inline-search"
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape' && isSearching) {
                                e.preventDefault();
                                setQuery('');
                                setScope('all');
                            }
                        }}
                        placeholder="ابحث عن أداة، مدينة، خط سرفيس، سورة، معبر، أو رقم طوارئ..."
                        className="flex-1 bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                    {data.loadingRemote && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                    )}
                    {query ? (
                        <button
                            type="button"
                            onClick={() => {
                                setQuery('');
                                inputRef.current?.focus();
                            }}
                            aria-label="مسح البحث"
                            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    ) : (
                        <kbd
                            dir="ltr"
                            className="hidden sm:inline-flex h-6 select-none items-center gap-0.5 rounded-md border border-border bg-muted/60 px-2 font-mono text-[11px] font-semibold text-muted-foreground shrink-0"
                        >
                            {SHORTCUT_LABEL}
                        </kbd>
                    )}
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center justify-start sm:justify-center gap-1.5 overflow-x-auto pt-0.5 pb-1 no-scrollbar">
                    {FILTER_TABS.map((tab) => {
                        const active = scope === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setScope(tab.id)}
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                                    active
                                        ? 'bg-primary text-primary-foreground shadow-2xs'
                                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* In-Place Replacement: Search Results when active, Default Homepage Grids when idle */}
            {isSearching ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-6">
                    <SearchResultsContent
                        data={data}
                        pathname="/"
                        onClose={() => {}}
                        gridColsClass="grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9"
                        useCmdkPrimitives={false}
                    />
                </div>
            ) : (
                children
            )}
        </div>
    );
}

export default function GlobalCommandPalette() {
    const { url } = usePage();
    const pathname = url.split('?')[0];
    const open = useMuslimNav((s) => s.searchOpen);
    const setOpen = useMuslimNav((s) => s.setSearchOpen);

    const [query, setQuery] = useState('');
    const [scope, setScope] = useState<FilterScope>('all');
    const inputRef = useRef<HTMLInputElement | null>(null);

    const data = useGlobalSearchData(query, scope, open);

    // Global keyboard shortcut: Ctrl+K or Cmd+K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (window.location.pathname === '/') {
                    const homeInput = document.getElementById('sz-home-inline-search') as HTMLInputElement | null;
                    if (homeInput) {
                        homeInput.focus();
                        homeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        return;
                    }
                }
                setOpen(!useMuslimNav.getState().searchOpen);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setOpen]);

    // Reset state when closed
    useEffect(() => {
        if (!open) {
            setQuery('');
            setScope('all');
        }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent
                dir="rtl"
                style={{ fontFamily: 'var(--site-font, inherit)' }}
                className="top-[6%] sm:top-[13%] translate-y-0 w-[calc(100vw-1.25rem)] max-w-2xl rounded-2xl border-border/80 bg-card p-0 shadow-2xl overflow-hidden gap-0 [&>button:last-child]:hidden"
            >
                <DialogTitle className="sr-only">بحث شامل في المساحة السورية</DialogTitle>
                <DialogDescription className="sr-only">
                    ابحث في أقسام المنصة، خطوط ومدن ترانزيت، سور القرآن الكريم، الألعاب، المعابر الحدودية، ودليل الهاتف
                </DialogDescription>

                <Command
                    shouldFilter={false}
                    className="bg-transparent text-foreground"
                >
                    {/* Top Search Input Row */}
                    <div className="flex items-center gap-2.5 border-b border-border/80 px-3.5 py-3 bg-muted/25">
                        <Search className="h-5 w-5 text-primary shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="ابحث عن أداة، مدينة، خط سرفيس، سورة، معبر، أو رقم طوارئ..."
                            aria-label="ابحث في المنصة"
                            autoFocus
                            className="flex-1 bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
                        />
                        {data.loadingRemote && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                        )}
                        {query && (
                            <button
                                type="button"
                                onClick={() => {
                                    setQuery('');
                                    inputRef.current?.focus();
                                }}
                                aria-label="مسح البحث"
                                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            aria-label="إغلاق نافذة البحث"
                            className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
                        >
                            Esc
                        </button>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border/60 bg-background/60 px-3 py-2 no-scrollbar">
                        {FILTER_TABS.map((tab) => {
                            const active = scope === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setScope(tab.id)}
                                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                                        active
                                            ? 'bg-primary text-primary-foreground shadow-2xs'
                                            : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Results List */}
                    <CommandList className="max-h-[60vh] sm:max-h-[420px] overflow-y-auto p-2">
                        <SearchResultsContent
                            data={data}
                            pathname={pathname}
                            onClose={() => setOpen(false)}
                        />
                    </CommandList>

                    {/* Footer Bar */}
                    <div className="flex items-center justify-between border-t border-border/70 bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-3">
                            <span className="hidden sm:inline-flex items-center gap-1">
                                <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd>
                                <span>للتنقل</span>
                            </span>
                            <span className="hidden sm:inline-flex items-center gap-1">
                                <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
                                <span>للفتح</span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Sparkles className="h-3 w-3 text-primary" />
                                <span>بحث فوري في الأدوات، المدن، السور، والمعابر</span>
                            </span>
                        </div>
                        <span dir="ltr" className="font-mono text-[10px] opacity-75">
                            {IS_MAC ? '⌘ + K' : 'Ctrl + K'}
                        </span>
                    </div>
                </Command>
            </DialogContent>
        </Dialog>
    );
}
