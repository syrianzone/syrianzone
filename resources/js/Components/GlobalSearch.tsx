/**
 * The eagerly loaded half of the global search: the search engine
 * (`useGlobalSearchData`), the shared results renderer, and the three places
 * the search UI is mounted outside the Ctrl+K modal — the navbar's desktop
 * trigger, the mobile menu panel, and the homepage inline search.
 *
 * These are imported statically by Navbar.tsx and Pages/Home.tsx, so they must
 * not live next to the lazily loaded `GlobalCommandPalette`: that file is
 * dynamically imported by MainLayout, and a single static import of it from the
 * eager graph puts the whole module back in the entry chunk (Rollup then drops
 * the code-split entirely). The modal itself imports the shared pieces from
 * here.
 */
import { api, API_V1 } from '@/Lib/api';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, router } from '@inertiajs/react';
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
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from '@/Components/ui/command';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { cn } from '@/Lib/utils';
import { useSiteNavigation, type SiteLink } from '@/Lib/siteLinks';
import { useIsMac } from '@/Lib/platform';
import { siteModule } from '@/Lib/siteModules';
import { isActive } from '@/Lib/routes';
import { normalizeArabic } from '@/Lib/arabic';
import { useAppShell } from '@/Lib/appShell';
import { useQuranTarget } from '@/Domain/quran/targetAyah';
import { SURAH_AYAH_COUNTS, SURAH_NAMES_AR } from '@/Domain/quran/quran';
import { GAMES, gameEntryHref } from '@/Domain/games/games';
import { TOOLS as MUSLIM_TOOLS, toolHref } from '@/Domain/muslim/tools';
import { STATUS_TEXT, crossings, statusOf, syriaMinutes } from '@/Domain/crossings/crossings';
import { useTransitCities } from '@/Domain/transit/cities';

// All 114 Surahs (1-based index); the names and counts live in the Quran domain.
const SURAHS: Array<{ number: number; name: string; ayahs: number }> = SURAH_NAMES_AR.slice(1).map(
    (name, index) => ({
        number: index + 1,
        name: `سورة ${name}`,
        ayahs: SURAH_AYAH_COUNTS[index + 1],
    }),
);

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
    // The city group is the API's list, so the badge counts the routes the city
    // actually has and a city with none offers no dead link.
    const { data: transitCities } = useTransitCities(enabled && (scope === 'all' || scope === 'transit'));
    const cities = useMemo(() => transitCities ?? [], [transitCities]);
    const cityNames = useMemo(
        () => Object.fromEntries(cities.map((city) => [city.id, city.nameAr])),
        [cities],
    );

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
            api.get<RemoteSearchResults>(`${API_V1}/global-search`, {
                params: { q: trimmed },
                signal: controller.signal,
            })
                .then((data) => {
                    setRemote({
                        routes: Array.isArray(data.routes) ? data.routes : [],
                        places: Array.isArray(data.places) ? data.places : [],
                        phonebook: Array.isArray(data.phonebook) ? data.phonebook : [],
                        officials: Array.isArray(data.officials) ? data.officials : [],
                        govapps: Array.isArray(data.govapps) ? data.govapps : [],
                    });
                })
                .catch(() => {
                    // Type-ahead: a failed keystroke request keeps the local
                    // matches working instead of raising a toast per keystroke.
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
                siteModule(item.id)?.description,
                item.href,
            ),
        );
    }, [trimmedQuery, scope, allLinks]);

    const matchedCities = useMemo(() => {
        if (scope !== 'all' && scope !== 'transit') return [];
        const list = cities.filter((c) =>
            matchesSearch(trimmedQuery, c.nameAr, c.nameEn, c.id, 'ترانزيت سرفيس باص محافظة مدينة'),
        );
        if (!trimmedQuery && scope !== 'transit') {
            return list.filter((c) => c.routeCount > 0 || c.status === 'active').slice(0, 6);
        }
        return scope === 'transit' && !trimmedQuery ? list : list.slice(0, 8);
    }, [trimmedQuery, scope, cities]);

    const matchedMuslimTools = useMemo(() => {
        if (scope !== 'all' && scope !== 'muslim') return [];
        return MUSLIM_TOOLS.filter((t) =>
            matchesSearch(trimmedQuery, t.title, t.slug, 'صلاة قرآن اذاعة قبلة'),
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
            matchesSearch(trimmedQuery, g.title, g.slug, 'لعبة العاب شدة ورق'),
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
        cityNames,
    };
}

export function DesktopSearchTrigger({ className = '' }: { className?: string }) {
    const setSearchOpen = useAppShell((s) => s.setSearchOpen);
    const shortcutLabel = useIsMac() ? '⌘ K' : 'Ctrl K';
    return (
        <Button
            type="button"
            variant="outline"
            onClick={() => setSearchOpen(true)}
            aria-label={`بحث سريع في المنصة (${shortcutLabel})`}
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
                {shortcutLabel}
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
    const setTargetAyah = useQuranTarget((s) => s.setTargetAyah);

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
        cityNames,
    } = data;

    const tileClassName =
        'group flex h-full select-none flex-col items-center gap-2 rounded-lg px-1 py-2 text-center no-underline outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring transition-colors';

    /** One site-section tile; the palette wraps it in a cmdk item, the inline mounts in a link. */
    const siteLinkTile = (link: SiteLink, current: boolean) => {
        const Icon = link.icon;
        return (
            <>
                {link.isFlag ? (
                    <img
                        src="/flag-replacer/1f1f8-1f1fe.svg"
                        alt=""
                        className="h-12 w-12 shrink-0 object-contain transition-transform group-hover:scale-110"
                    />
                ) : link.image ? (
                    <img
                        src={link.image}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-12 w-12 shrink-0 object-contain transition-transform group-hover:scale-110"
                    />
                ) : Icon ? (
                    <Icon
                        className={cn(
                            'h-12 w-12 shrink-0 transition-all group-hover:scale-110',
                            current ? 'text-primary' : 'text-foreground group-hover:text-primary',
                        )}
                    />
                ) : (
                    <Globe className="h-12 w-12 shrink-0 text-foreground transition-all group-hover:scale-110 group-hover:text-primary" />
                )}
                <span
                    className={cn(
                        'line-clamp-2 text-xs font-medium leading-tight transition-colors',
                        current ? 'text-primary' : 'text-foreground group-hover:text-primary',
                    )}
                >
                    {link.text}
                </span>
            </>
        );
    };

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
                useCmdkPrimitives ? (
                    <CommandGroup
                        heading="أقسام وأدوات المنصة"
                        className="px-1 py-2 [&_[cmdk-group-heading]]:mb-2 [&_[cmdk-group-heading]]:px-1 [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-items]]:grid [&_[cmdk-group-items]]:grid-cols-3 [&_[cmdk-group-items]]:gap-x-2 [&_[cmdk-group-items]]:gap-y-4 sm:[&_[cmdk-group-items]]:grid-cols-4 md:[&_[cmdk-group-items]]:grid-cols-6"
                    >
                        {matchedSiteLinks.map((link) => (
                            <CommandItem
                                key={link.id || link.href}
                                value={`site-${link.id || link.href}-${link.text}`}
                                onSelect={() => navigateTo(link.href, link.external)}
                                className={cn(tileClassName, 'data-[selected=true]:text-foreground')}
                            >
                                {siteLinkTile(link, isActive(link.href, pathname))}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                ) : (
                    <div className="px-1 py-2">
                        <p className="mb-2 px-1 text-xs font-bold text-muted-foreground/80">
                            أقسام وأدوات المنصة
                        </p>
                        <ul className={cn('grid gap-x-2 gap-y-4 py-1', gridColsClass)}>
                            {matchedSiteLinks.map((link) => (
                                <li key={link.id || link.href}>
                                    {link.external ? (
                                        <a
                                            href={link.href}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={onClose}
                                            className={tileClassName}
                                        >
                                            {siteLinkTile(link, isActive(link.href, pathname))}
                                        </a>
                                    ) : (
                                        <Link
                                            href={link.href}
                                            onClick={onClose}
                                            className={tileClassName}
                                        >
                                            {siteLinkTile(link, isActive(link.href, pathname))}
                                        </Link>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )
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
                                        خط نقل عام · {cityNames[route.cityId] || route.cityId}
                                    </span>
                                </div>
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                                {cityNames[route.cityId] || route.cityId}
                            </Badge>
                        </ItemRow>
                    ))}
                </GroupWrapper>
            )}

            {/* 3. Transit Cities */}
            {matchedCities.length > 0 && (
                <GroupWrapper heading="مدن ومحافظات ترانزيت">
                    {matchedCities.map((city) => {
                        const count = city.routeCount;
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
                                key={`muslim-${tool.slug}`}
                                value={`muslim-${tool.slug}-${tool.title}`}
                                onSelect={() => navigateTo(toolHref(tool.slug))}
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
                                key={`game-${game.slug}`}
                                value={`game-${game.slug}-${game.title}`}
                                onSelect={() => navigateTo(gameEntryHref(game), game.external)}
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
                        const isOpen = crossing.liveStatus === 'open';
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
                                    {STATUS_TEXT[crossing.liveStatus]}
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
 * Search and navigation panel for the mobile menu sheet. Uses native DOM
 * buttons/links (`useCmdkPrimitives={false}`) instead of cmdk's `<Command>`
 * wrapper so clicking the search input never triggers cmdk's `scrollIntoView()`
 * viewport jump.
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
 * Homepage inline search & links section. Renders `children` while the query is
 * empty and the scope is 'all'; otherwise it replaces them with the unified
 * search results.
 */
export function HomeInlineSearchSection({
    children,
}: {
    children: React.ReactNode;
}) {
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState<FilterScope>('all');
    const inputRef = useRef<HTMLInputElement | null>(null);
    const registerInlineSearch = useAppShell((s) => s.registerInlineSearch);
    const shortcutLabel = useIsMac() ? '⌘ K' : 'Ctrl K';

    // The shell's Ctrl/Cmd+K handler focuses this field instead of opening the
    // palette while the homepage is mounted. Registering the focus function is
    // the contract; the shell never looks up an element id.
    useEffect(() => {
        registerInlineSearch(() => {
            const input = inputRef.current;
            if (!input) return;
            input.focus();
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        return () => registerInlineSearch(null);
    }, [registerInlineSearch]);

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
                            {shortcutLabel}
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
