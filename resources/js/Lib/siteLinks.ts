import React, { useMemo } from 'react';
import { usePage } from '@inertiajs/react';
import {
    Code2, Globe, Wheat, BarChart3, HeartHandshake, Flag, Sparkles, Gift,
} from 'lucide-react';
import {
    SyOfficialIcon,
    RoznamaIcon,
    PhonebookIcon,
    SyIdIcon,
    PartyIcon,
    TierlistIcon,
    HouseIcon,
    CompassIcon,
    PrioritiesIcon,
    SitesIcon,
    PopulationIcon,
    GovAppsIcon,
    TransitIcon,
    JusticeIcon,
    CrossingsIcon,
    MishwarIcon,
    BoardIcon,
    MuslimIcon,
    QuranIcon,
    QuranRadioIcon,
    GamesIcon,
    Game2048Icon,
    SolitaireIcon,
    TarneebIcon,
    TrixIcon,
    GuessWhoIcon,
    RecipesIcon,
    NewsIcon,
    AnswersIcon,
    CodexCommunityIcon,
} from '@/Components/Icons/ProjectIcons';

export interface SiteNavigationSubCategory {
    id: string;
    title: string;
    subtitle?: string;
    href: string;
    type: 'native' | 'web' | 'external';
    target: string;
    iconKey?: string | null;
    iconUrl?: string | null;
}

export interface SiteLink {
    id?: string;
    title?: string;
    subtitle?: string;
    href: string;
    text: string;
    type?: 'native' | 'web' | 'external';
    target?: string;
    icon?: React.ComponentType<{ className?: string }> | null;
    iconKey?: string | null;
    iconUrl?: string | null;
    image?: string;
    isFlag?: boolean;
    external?: boolean;
    isInternal?: boolean;
    enabled?: boolean;
    showOnHome?: boolean;
    showInNavbar?: boolean;
    surfaces?: string[];
    subCategories?: SiteNavigationSubCategory[];
    isCustom?: boolean;
}

export interface SiteNavigationItemData {
    id: string;
    title?: string;
    subtitle?: string;
    href: string;
    text: string;
    type?: 'native' | 'web' | 'external';
    target?: string;
    iconKey: string | null;
    iconUrl?: string | null;
    image: string | null;
    isFlag: boolean;
    external: boolean;
    isInternal: boolean;
    enabled?: boolean;
    showOnHome: boolean;
    showInNavbar: boolean;
    surfaces?: string[];
    subCategories?: SiteNavigationSubCategory[];
    isCustom: boolean;
}

export interface SiteNavigationConfig {
    navbarTopCount: number;
    useSeparateNavbarOrder: boolean;
    navbarOrder: string[];
    items: SiteNavigationItemData[];
    version: number;
}

export const SITE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    roznama: RoznamaIcon,
    muslim: MuslimIcon,
    quran: QuranIcon,
    quran_radio: QuranRadioIcon,
    games: GamesIcon,
    game_2048: Game2048Icon,
    solitaire: SolitaireIcon,
    tarneeb: TarneebIcon,
    trix: TrixIcon,
    guesswho: GuessWhoIcon,
    transit: TransitIcon,
    mishwar: MishwarIcon,
    board: BoardIcon,
    compass: CompassIcon,
    tierlist: TierlistIcon,
    priorities: PrioritiesIcon,
    crossings: CrossingsIcon,
    recipes: RecipesIcon,
    answers: AnswersIcon,
    syofficial: SyOfficialIcon,
    phonebook: PhonebookIcon,
    sites: SitesIcon,
    contributors: Code2,
    govapps: GovAppsIcon,
    party: PartyIcon,
    house: HouseIcon,
    justice: JusticeIcon,
    syid: SyIdIcon,
    atlas: PopulationIcon,
    codex: CodexCommunityIcon,
    news: NewsIcon,
    globe: Globe,
    wheat: Wheat,
    stats: BarChart3,
    donations: HeartHandshake,
    flag: Flag,
    prompts: Sparkles,
    population: PopulationIcon,
    free: Gift,
};

export const SITE_ICON_OPTIONS: Array<{ key: string; label: string }> = [
    { key: 'roznama', label: 'الروزنامة' },
    { key: 'muslim', label: 'الركن الإسلامي' },
    { key: 'quran', label: 'القرآن الكريم' },
    { key: 'quran_radio', label: 'إذاعة القرآن' },
    { key: 'games', label: 'الألعاب' },
    { key: 'transit', label: 'ترانزيت' },
    { key: 'mishwar', label: 'مشوار' },
    { key: 'board', label: 'لوح' },
    { key: 'compass', label: 'البوصلة السياسية' },
    { key: 'tierlist', label: 'تقييم الحكومة' },
    { key: 'priorities', label: 'أولويات سوريا' },
    { key: 'crossings', label: 'المنافذ الحدودية' },
    { key: 'recipes', label: 'وصفاتنا' },
    { key: 'answers', label: 'إجابات سوريا' },
    { key: 'syofficial', label: 'الحسابات الرسمية' },
    { key: 'phonebook', label: 'دليل الهاتف' },
    { key: 'sites', label: 'دليل المواقع' },
    { key: 'contributors', label: 'المساهمون' },
    { key: 'govapps', label: 'تطبيقات الحكومة' },
    { key: 'party', label: 'دليل الأحزاب' },
    { key: 'house', label: 'المجلس التشريعي' },
    { key: 'justice', label: 'العدالة الانتقالية' },
    { key: 'syid', label: 'الهوية البصرية' },
    { key: 'atlas', label: 'أطلس' },
    { key: 'codex', label: 'مجتمع كوديكس' },
    { key: 'news', label: 'أخبار سوريا' },
    { key: 'globe', label: 'كرة أرضية / موقع عام' },
    { key: 'stats', label: 'إحصائيات' },
    { key: 'wheat', label: 'سنبلة' },
    { key: 'donations', label: 'تبرعات / مساهمات' },
    { key: 'flag', label: 'علم سوريا' },
    { key: 'prompts', label: 'أوامر ذكاء اصطناعي' },
    { key: 'population', label: 'السكان' },
    { key: 'free', label: 'أدوات مجانية' },
];

export const SITE_LINKS: SiteLink[] = [
    // Internal Syrian Zone Tools — Top Row (Most Important: Roznama, Muslim, Games, Transit, Mishwar, Board)
    { id: 'roznama', href: '/roznama', text: 'الروزنامة', title: 'الروزنامة', subtitle: 'التقويم السوري والهجري والمناسبات ومواقيت الصلاة', type: 'native', target: 'roznama', icon: RoznamaIcon, iconKey: 'roznama', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'muslim', href: '/muslim', text: 'الركن الإسلامي', title: 'الركن الإسلامي', subtitle: 'مواقيت الصلاة، القرآن الكريم، وإذاعة القرآن', type: 'native', target: 'muslim_hub', icon: MuslimIcon, iconKey: 'muslim', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'games', href: '/games', text: 'الألعاب', title: 'الألعاب', subtitle: 'ألعاب ورق وذكاء جماعية وفردية', type: 'native', target: 'games_hub', icon: GamesIcon, iconKey: 'games', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'transit', href: '/transit', text: 'ترانزيت', title: 'ترانزيت', subtitle: 'شبكة وخطوط النقل العام', type: 'native', target: 'transit_map', icon: TransitIcon, iconKey: 'transit', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'mishwar', href: '/mishwar', text: 'مشوار', title: 'مشوار', subtitle: 'دليل وخريطة الأماكن والمطاعم والمقاهي في سوريا', type: 'native', target: 'mishwar_map', icon: MishwarIcon, iconKey: 'mishwar', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'board', href: '/board', text: 'لوح', title: 'لوح', subtitle: 'لوحة أدواتك اليومية المخصصة في المساحة السورية', type: 'web', target: '/board', icon: BoardIcon, iconKey: 'board', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    // Civic & Directory Tools
    { id: 'compass', href: '/compass', text: 'البوصلة السياسية', title: 'البوصلة السياسية', subtitle: 'اختبار البوصلة السياسية السورية وتحديد توجهاتك', type: 'web', target: '/compass', icon: CompassIcon, iconKey: 'compass', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'tierlist', href: '/tierlist', text: 'تقييم الحكومة', title: 'تقييم الحكومة', subtitle: 'تقييم أداء الوزراء والجهات الحكومية ومشاركة الترتيب', type: 'native', target: 'tierlist_polls', icon: TierlistIcon, iconKey: 'tierlist', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'priorities', href: '/priorities', text: 'أولويات سوريا', title: 'أولويات سوريا', subtitle: 'استبيان وترتيب أولويات إعادة الإعمار والتنمية في سوريا', type: 'web', target: '/priorities', icon: PrioritiesIcon, iconKey: 'priorities', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'crossings', href: '/crossings', text: 'المنافذ الحدودية', title: 'المنافذ الحدودية', subtitle: 'حالة المعابر البرية والمطارات والمرافئ السورية لحظة بلحظة', type: 'native', target: 'crossings_status', icon: CrossingsIcon, iconKey: 'crossings', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'recipes', href: 'https://food.syrian.zone', text: 'وصفاتنا', title: 'وصفاتنا', subtitle: 'موسوعة وصفات المطبخ السوري التقليدي الأصيل', type: 'external', target: 'https://food.syrian.zone', icon: RecipesIcon, iconKey: 'recipes', external: true, isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'answers', href: 'https://answers.syrian.zone', text: 'إجابات سوريا', title: 'إجابات سوريا', subtitle: 'منصة الأسئلة والأجوبة المجتمعية حول سوريا', type: 'external', target: 'https://answers.syrian.zone', icon: AnswersIcon, iconKey: 'answers', external: true, isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'syofficial', href: '/syofficial', text: 'الحسابات الرسمية', title: 'الحسابات الرسمية', subtitle: 'دليل الحسابات والصفحات الرسمية للوزارات والمؤسسات السورية', type: 'native', target: 'syofficial_directory', icon: SyOfficialIcon, iconKey: 'syofficial', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'phonebook', href: '/phonebook', text: 'دليل الهاتف', title: 'دليل الهاتف', subtitle: 'أرقام الطوارئ والاستعلامات والخدمات العامة في المحافظات', type: 'native', target: 'phonebook_directory', icon: PhonebookIcon, iconKey: 'phonebook', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'sites', href: '/sites', text: 'دليل المواقع', title: 'دليل المواقع', subtitle: 'دليل المواقع والمنصات والمبادرات الرقمية السورية', type: 'web', target: '/sites', icon: SitesIcon, iconKey: 'sites', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'contributors', href: '/syrian-contributors', text: 'المساهمون', title: 'المساهمون', subtitle: 'لوحة المساهمين والمطورين في المشاريع السورية مفتوحة المصدر', type: 'web', target: '/syrian-contributors', icon: Code2, iconKey: 'contributors', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'govapps', href: '/govapps', text: 'تطبيقات الحكومة', title: 'تطبيقات الحكومة', subtitle: 'دليل التطبيقات الحكومية والخدمية الرسمية في سوريا', type: 'native', target: 'govapps_directory', icon: GovAppsIcon, iconKey: 'govapps', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'party', href: '/party', text: 'دليل الأحزاب', title: 'دليل الأحزاب', subtitle: 'دليل الأحزاب والتيارات والكيانات السياسية السورية', type: 'web', target: '/party', icon: PartyIcon, iconKey: 'party', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'house', href: '/house', text: 'المجلس التشريعي', title: 'المجلس التشريعي', subtitle: 'مرصد المجلس التشريعي وتوزيع المقاعد والأعضاء', type: 'web', target: '/house', icon: HouseIcon, iconKey: 'house', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'justice', href: '/justice', text: 'العدالة الانتقالية', title: 'العدالة الانتقالية', subtitle: 'العدالة الانتقالية والتوثيق والمحاسبة', type: 'web', target: '/justice', icon: JusticeIcon, iconKey: 'justice', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'syid', href: '/syid', text: 'الهوية البصرية', title: 'الهوية البصرية', subtitle: 'دليل الهوية البصرية السورية الرسمية، الألوان والخطوط والشعارات', type: 'web', target: '/syid', icon: SyIdIcon, iconKey: 'syid', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'atlas', href: '/atlas', text: 'أطلس', title: 'أطلس', subtitle: 'أطلس السكان والخرائط الديمغرافية والتقسيمات الإدارية', type: 'web', target: '/atlas', icon: PopulationIcon, iconKey: 'atlas', isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'codex', href: 'https://discord.gg/NqE8849VzA', text: 'مجتمع كوديكس', title: 'مجتمع كوديكس', subtitle: 'مجتمع المبرمجين والمصممين السوريين على ديسكورد', type: 'external', target: 'https://discord.gg/NqE8849VzA', icon: CodexCommunityIcon, iconKey: 'codex', external: true, isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'flag_replacer', href: 'https://chromewebstore.google.com/detail/syrian-flag-replacer/dngipobppehfhfggmbdiiiodgcibdeog', text: 'مبدل العلم', title: 'مبدل العلم', subtitle: 'إضافة متصفح لاستبدال العلم القديم بالعلم السوري', type: 'external', target: 'https://chromewebstore.google.com/detail/syrian-flag-replacer/dngipobppehfhfggmbdiiiodgcibdeog', icon: null, image: '/flag-replacer/1f1f8-1f1fe.svg', iconUrl: '/flag-replacer/1f1f8-1f1fe.svg', external: true, isInternal: true, enabled: true, showOnHome: true, showInNavbar: true },

    // External Links
    { id: 'joory', href: 'https://joory.chat', text: 'جوري AI', title: 'جوري AI', subtitle: 'مساعد ذكي باللغة العربية', type: 'external', target: 'https://joory.chat', icon: null, image: 'https://joory.chat/favicon.svg', iconUrl: 'https://joory.chat/favicon.svg', external: true, isInternal: false, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'jard', href: 'https://jard.chat', text: 'جرد', title: 'جرد', subtitle: 'منصة جرد', type: 'external', target: 'https://jard.chat', icon: null, image: 'https://jard.chat/images/logo-light.svg', iconUrl: 'https://jard.chat/images/logo-light.svg', external: true, isInternal: false, enabled: true, showOnHome: true, showInNavbar: true },
    { id: 'news', href: 'https://news.jard.chat', text: 'أخبار سوريا', title: 'أخبار سوريا', subtitle: 'متابعة آخر أخبار سوريا من المصادر الموثوقة', type: 'external', target: 'https://news.jard.chat', icon: NewsIcon, iconKey: 'news', external: true, isInternal: false, enabled: true, showOnHome: true, showInNavbar: true },
];

export function hydrateSiteLink(raw: SiteNavigationItemData): SiteLink {
    const icon = raw.iconKey && SITE_ICON_MAP[raw.iconKey] ? SITE_ICON_MAP[raw.iconKey] : undefined;
    const title = raw.title || raw.text;
    const imageUrl = raw.iconUrl || raw.image || undefined;
    const enabled = raw.enabled !== false;
    return {
        id: raw.id || raw.href,
        title,
        subtitle: raw.subtitle || '',
        href: raw.href,
        text: title,
        type: raw.type || (raw.external ? 'external' : 'web'),
        target: raw.target || raw.href,
        icon,
        iconKey: raw.iconKey,
        iconUrl: imageUrl || null,
        image: imageUrl,
        isFlag: Boolean(raw.isFlag),
        external: Boolean(raw.external),
        isInternal: Boolean(raw.isInternal),
        enabled,
        showOnHome: enabled && raw.showOnHome !== false,
        showInNavbar: enabled && raw.showInNavbar !== false,
        surfaces: Array.isArray(raw.surfaces) ? raw.surfaces : undefined,
        subCategories: Array.isArray(raw.subCategories) ? raw.subCategories : [],
        isCustom: Boolean(raw.isCustom),
    };
}

export function resolveSiteNavigation(config?: SiteNavigationConfig | null) {
    if (!config || !Array.isArray(config.items) || config.items.length === 0) {
        const navbarTopCount = 5;
        return {
            navbarTopCount,
            homeLinks: SITE_LINKS,
            navbarLinks: SITE_LINKS,
            navbarTopLinks: SITE_LINKS.slice(0, navbarTopCount),
            navbarMoreLinks: SITE_LINKS.slice(navbarTopCount),
            allLinks: SITE_LINKS,
        };
    }

    const hydrated = config.items.map(hydrateSiteLink).filter((item) => item.enabled !== false);
    const navbarTopCount = Math.max(1, Math.min(10, Number(config.navbarTopCount) || 5));

    const homeLinks = hydrated.filter((item) => item.showOnHome !== false);

    let navbarBase = hydrated;
    if (config.useSeparateNavbarOrder && Array.isArray(config.navbarOrder) && config.navbarOrder.length > 0) {
        const byKey = new Map<string, SiteLink>();
        for (const item of hydrated) {
            if (item.id) byKey.set(item.id, item);
            byKey.set(item.href, item);
        }
        const ordered: SiteLink[] = [];
        const added = new Set<SiteLink>();
        for (const id of config.navbarOrder) {
            const match = byKey.get(id);
            if (match && !added.has(match)) {
                ordered.push(match);
                added.add(match);
            }
        }
        for (const remaining of hydrated) {
            if (!added.has(remaining)) {
                ordered.push(remaining);
            }
        }
        navbarBase = ordered;
    }

    const navbarLinks = navbarBase.filter((item) => item.showInNavbar !== false);
    const allLinks = hydrated.filter((item) => item.showOnHome !== false || item.showInNavbar !== false);

    return {
        navbarTopCount,
        homeLinks,
        navbarLinks,
        navbarTopLinks: navbarLinks.slice(0, navbarTopCount),
        navbarMoreLinks: navbarLinks.slice(navbarTopCount),
        allLinks,
    };
}

export function useSiteNavigation() {
    const page = usePage<{ siteNavigation?: SiteNavigationConfig | null }>();
    const config = page?.props?.siteNavigation;

    return useMemo(() => resolveSiteNavigation(config), [config]);
}
