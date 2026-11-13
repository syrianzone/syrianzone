import React, { useMemo } from 'react';
import { usePage } from '@inertiajs/react';
import {
    BarChart3,
    Code2,
    Flag,
    Gift,
    Globe,
    HeartHandshake,
    Sparkles,
    Wheat,
} from 'lucide-react';
import { projectIcon } from './projectIcons';
import { NAVBAR_TOP_COUNT, SITE_MODULES } from './siteModules';

/**
 * The navigation the browser renders, and the vocabulary that decorates it.
 *
 * The list is not written here: `resources/data/site-modules.json` holds the
 * catalogue both languages read, `SiteSetting::defaultNavigationItems()` turns
 * it into the defaults and the admin editor stores an override. What this
 * module adds is the web schema (`SiteLink`: resolved icon component, `text`,
 * `image`) and the ordering rules from the shared prop.
 */
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

/**
 * Icon key to drawing. The project icons come from the shared data file
 * (`Lib/projectIcons.tsx`); these few are single-colour glyphs from lucide,
 * which the Blade side does not need because no capability group uses them.
 */
export const SITE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    roznama: projectIcon('roznama'),
    muslim: projectIcon('muslim'),
    quran: projectIcon('quran'),
    quran_radio: projectIcon('quran_radio'),
    games: projectIcon('games'),
    game_2048: projectIcon('game_2048'),
    solitaire: projectIcon('solitaire'),
    tarneeb: projectIcon('tarneeb'),
    trix: projectIcon('trix'),
    guesswho: projectIcon('guesswho'),
    transit: projectIcon('transit'),
    mishwar: projectIcon('mishwar'),
    board: projectIcon('board'),
    compass: projectIcon('compass'),
    tierlist: projectIcon('tierlist'),
    promises: projectIcon('promises'),
    priorities: projectIcon('priorities'),
    crossings: projectIcon('crossings'),
    recipes: projectIcon('recipes'),
    answers: projectIcon('answers'),
    syofficial: projectIcon('syofficial'),
    phonebook: projectIcon('phonebook'),
    sites: projectIcon('sites'),
    contributors: Code2,
    govapps: projectIcon('govapps'),
    party: projectIcon('party'),
    house: projectIcon('house'),
    justice: projectIcon('justice'),
    syid: projectIcon('syid'),
    atlas: projectIcon('population'),
    codex: projectIcon('codex'),
    news: projectIcon('news'),
    globe: Globe,
    wheat: Wheat,
    stats: BarChart3,
    donations: HeartHandshake,
    flag: Flag,
    prompts: Sparkles,
    population: projectIcon('population'),
    free: Gift,
};

/** The icons the admin editor offers, in display order, with their labels. */
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
    { key: 'promises', label: 'عداد الوعود' },
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

function iconFor(iconKey?: string | null) {
    return iconKey && SITE_ICON_MAP[iconKey] ? SITE_ICON_MAP[iconKey] : undefined;
}

interface SiteLinkFields {
    id: string;
    title: string;
    subtitle?: string;
    href: string;
    type: 'native' | 'web' | 'external';
    target: string;
    iconKey: string | null;
    iconUrl: string | null;
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

/** The web schema (`SiteLink`) for one catalog entry, from either source. */
function toSiteLink(fields: SiteLinkFields): SiteLink {
    const imageUrl = fields.iconUrl ?? undefined;
    const enabled = fields.enabled !== false;
    const title = fields.title || fields.href;

    return {
        id: fields.id,
        title,
        subtitle: fields.subtitle ?? '',
        href: fields.href,
        text: title,
        type: fields.type,
        target: fields.target,
        icon: iconFor(fields.iconKey),
        iconKey: fields.iconKey,
        iconUrl: imageUrl ?? null,
        image: imageUrl,
        isFlag: Boolean(fields.isFlag),
        external: Boolean(fields.external),
        isInternal: Boolean(fields.isInternal),
        enabled,
        showOnHome: enabled && fields.showOnHome !== false,
        showInNavbar: enabled && fields.showInNavbar !== false,
        surfaces: Array.isArray(fields.surfaces) ? fields.surfaces : undefined,
        subCategories: Array.isArray(fields.subCategories) ? fields.subCategories : [],
        isCustom: Boolean(fields.isCustom),
    };
}

function hydrateSiteLink(raw: SiteNavigationItemData): SiteLink {
    return toSiteLink({
        id: raw.id || raw.href,
        title: raw.title || raw.text,
        subtitle: raw.subtitle || '',
        href: raw.href,
        type: raw.type || (raw.external ? 'external' : 'web'),
        target: raw.target || raw.href,
        iconKey: raw.iconKey,
        iconUrl: raw.iconUrl || raw.image || null,
        isFlag: raw.isFlag,
        external: raw.external,
        isInternal: raw.isInternal,
        enabled: raw.enabled,
        showOnHome: raw.showOnHome,
        showInNavbar: raw.showInNavbar,
        surfaces: raw.surfaces,
        subCategories: raw.subCategories,
        isCustom: raw.isCustom,
    });
}

/**
 * The catalogue's default entries in the web schema. Used when the shared
 * `siteNavigation` prop is absent (a page rendered outside Inertia, a unit
 * test) — the server shares it on every response, so this is the same list,
 * not a second one.
 */
export const SITE_LINKS: SiteLink[] = SITE_MODULES.map((module) =>
    toSiteLink({
        id: module.id,
        title: module.title,
        subtitle: module.subtitle,
        href: module.href,
        type: module.type,
        target: module.target,
        iconKey: module.iconKey,
        iconUrl: module.iconUrl,
        isInternal: module.isInternal,
        external: module.type === 'external',
        subCategories: module.subCategories,
    }),
);

function resolveSiteNavigation(config?: SiteNavigationConfig | null) {
    if (!config || !Array.isArray(config.items) || config.items.length === 0) {
        const navbarTopCount = NAVBAR_TOP_COUNT;
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
    const navbarTopCount = Math.max(1, Math.min(10, Number(config.navbarTopCount) || NAVBAR_TOP_COUNT));

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
