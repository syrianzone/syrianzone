import React, { useState, useEffect, useMemo } from 'react';
import { Link, usePage } from '@inertiajs/react';
import {
    Settings, Globe, Plus, Edit, X, History, Search,
} from 'lucide-react';
import { Button } from '@/Components/ui/button';
import MainLayout, { prefetchCommandPalette } from '@/Layouts/MainLayout';
import { applyTheme as persistTheme, getThemePreference } from '@/Lib/theme';
import { applyFont, getFontPreference } from '@/Lib/font';
import UserNav from '@/Components/UserNav';
import AppearanceMenu from '@/Components/AppearanceMenu';
import { Logo } from '@/Components/brand/Logo';
import { Node } from '@/Components/brand/Node';
import type { CustomLink } from '@/Pages/Home/_lib/links';
import { readCustomLinks, saveCustomLinks } from '@/Pages/Home/_lib/links';
import {
    DEFAULT_HOME_DISPLAY_PREFS,
    persistHomeDisplayPrefs,
    readEventsGovernorate,
    readHomeDisplayPrefs,
    setEventsGovernorate,
    setHomeToggle,
    type HomeDisplayPrefs,
    type HomeToggleKey,
} from '@/Pages/Home/_lib/homePrefs';
import { saveAccountSettings } from '@/Domain/settings/accountSettings';
import {
    accountPatchForLocation,
    readLocationPreference,
    useLocationPreference,
    type LocationPatch,
} from '@/Domain/location/preference';
import { readStoredMethod } from '@/Domain/settings/prefs';
import { nextPrayer } from '@/Domain/prayer/nextPrayer';
import { usePrayerTimes } from '@/Domain/prayer/times';
import { useWeather } from '@/Domain/weather/weather';
import { WeatherIcon } from '@/Domain/weather/WeatherIcon';
import { getLastPage } from '@/Lib/visit';
import { useAppShell, usePageDialog } from '@/Lib/appShell';
import { useIsMac } from '@/Lib/platform';
import { formatGregorianSyrian } from '@/Lib/syrian-date';
import { confirmDialog } from '@/Lib/confirm';
import { trackEvent } from '@/Lib/analyticsConsent';
import { groupSiteLinks, useSiteNavigation, type SiteLink } from '@/Lib/siteLinks';

const F3aliaEvents = React.lazy(() => import('@/Pages/Home/_components/F3aliaEvents'));
const HomeSettingsDialog = React.lazy(() => import('@/Pages/Home/_components/HomeSettingsDialog'));
const AddLinkDialog = React.lazy(() => import('@/Pages/Home/_components/AddLinkDialog'));
const EditLinkDialog = React.lazy(() => import('@/Pages/Home/_components/EditLinkDialog'));

const getFaviconUrl = (urlStr: string) => {
    try {
        const formatted = urlStr.startsWith('http://') || urlStr.startsWith('https://')
            ? urlStr
            : `https://${urlStr}`;
        const domain = new URL(formatted).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
        return '';
    }
};

function GoogleMark() {
    return (
        <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
        </svg>
    );
}

export default function Home() {
    const { props } = usePage<{ auth?: { user: { id: number; name: string; email: string; avatar_url: string; role: string; settings?: Record<string, any> | null } | null } }>();
    const user = props.auth?.user ?? null;
    const { homeLinks, groups } = useSiteNavigation();
    const setSearchOpen = useAppShell((s) => s.setSearchOpen);
    const shortcutLabel = useIsMac() ? '⌘K' : 'Ctrl K';

    const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);
    const [editingLink, setEditingLink] = useState<CustomLink | null>(null);
    const [settingsOpen, setSettingsOpen] = usePageDialog('home-settings');
    const [addLinkOpen, setAddLinkOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    // Last-visited page badge. Read after mount (localStorage) so SSR and first
    // client render match.
    const [lastPage, setLastPage] = useState<string | null>(null);
    const location = useLocationPreference();
    const [mounted, setMounted] = useState(false);

    const [eventsGovernorate, setEventsGovernorateState] = useState('all');

    const [displayPrefs, setDisplayPrefs] = useState<HomeDisplayPrefs>(DEFAULT_HOME_DISPLAY_PREFS);
    const { showWeather, showPrayerTimes, showEvents } = displayPrefs;

    const { weather } = useWeather(location, { enabled: mounted && showWeather, sessionCache: true });
    const { timings: prayerTimes, timeZone: prayerTimeZone } = usePrayerTimes(location, readStoredMethod(), {
        enabled: mounted && showPrayerTimes,
        timeoutMs: null,
        sessionCache: true,
    });

    useEffect(() => { setLastPage(getLastPage()); }, []);

    useEffect(() => {
        const accSettings = user?.settings || {};

        const savedTheme = accSettings.theme ?? getThemePreference();
        const savedFont = accSettings.fontFamily ?? getFontPreference();
        const savedDisplayPrefs = readHomeDisplayPrefs(accSettings);
        const savedEventsGovernorate = readEventsGovernorate(accSettings);
        const savedLocation = readLocationPreference();
        const parsedLinks = readCustomLinks(accSettings);

        if (savedTheme) persistTheme(savedTheme);
        if (savedFont) applyFont(savedFont);
        persistHomeDisplayPrefs(savedDisplayPrefs);
        saveCustomLinks(parsedLinks, false);

        setDisplayPrefs(savedDisplayPrefs);
        setEventsGovernorateState(savedEventsGovernorate);
        setCustomLinks(parsedLinks);

        if (user && Object.keys(accSettings).length === 0) {
            saveAccountSettings({
                theme: savedTheme,
                ...savedDisplayPrefs,
                eventsGovernorate: savedEventsGovernorate,
                customLinks: parsedLinks,
                ...accountPatchForLocation(savedLocation),
            });
        }

        setMounted(true);
    }, []);

    const addCustomLink = (link: CustomLink) => {
        const updated = [...customLinks, link];
        setCustomLinks(updated);
        saveCustomLinks(updated, Boolean(user));
    };

    const updateCustomLink = (updatedLink: CustomLink) => {
        const updated = customLinks.map((l) => (l.id === updatedLink.id ? updatedLink : l));
        setCustomLinks(updated);
        saveCustomLinks(updated, Boolean(user));
    };

    const removeCustomLink = (id: string) => {
        const updated = customLinks.filter((l) => l.id !== id);
        setCustomLinks(updated);
        saveCustomLinks(updated, Boolean(user));
    };

    const prayerMini = showPrayerTimes ? nextPrayer(prayerTimes, new Date(), { timeZone: prayerTimeZone }) : null;
    const weatherMini = showWeather && weather ? weather : null;
    const groupedLinks = useMemo(() => groupSiteLinks(homeLinks, groups), [homeLinks, groups]);

    const handleLocationChange = (patch: LocationPatch) => {
        const accountPatch = accountPatchForLocation(patch);
        if (user && Object.keys(accountPatch).length > 0) saveAccountSettings(accountPatch);
    };

    const handleToggleChange = (key: HomeToggleKey, value: boolean) => {
        setDisplayPrefs((prev) => ({ ...prev, [key]: value }));
        setHomeToggle(key, value, Boolean(user));
    };

    const handleEventsGovernorateChange = (governorate: string) => {
        setEventsGovernorateState(governorate);
        setEventsGovernorate(governorate, Boolean(user));
    };

    const openSearch = () => {
        setSearchOpen(true);
    };

    const renderTile = (link: SiteLink) => {
        const Icon = link.icon;
        const tileClass =
            'group relative flex min-h-[44px] h-full flex-col items-center justify-start gap-1.5 rounded-xl px-1.5 py-2 text-center transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
        const body = (
            <>
                {Icon && (
                    <Icon
                        className="h-8 w-8 shrink-0 text-foreground transition-transform group-hover:scale-105 group-hover:text-primary"
                        aria-hidden="true"
                    />
                )}
                {lastPage === link.href && (
                    <span
                        title="آخر صفحة تمت زيارتها"
                        className="absolute top-1 end-1 rounded-full border border-border bg-background p-0.5 text-primary shadow-2xs"
                    >
                        <History className="h-3 w-3" aria-hidden="true" />
                    </span>
                )}
                {link.image && link.imageDark ? (
                    <>
                        <img
                            src={link.image}
                            alt=""
                            width={32}
                            height={32}
                            loading="lazy"
                            decoding="async"
                            className="h-8 w-8 shrink-0 object-contain transition-transform group-hover:scale-105 dark:hidden"
                        />
                        <img
                            src={link.imageDark}
                            alt=""
                            width={32}
                            height={32}
                            loading="lazy"
                            decoding="async"
                            className="hidden h-8 w-8 shrink-0 object-contain transition-transform group-hover:scale-105 dark:block"
                        />
                    </>
                ) : link.image ? (
                    <img
                        src={link.image}
                        alt=""
                        width={32}
                        height={32}
                        loading="lazy"
                        decoding="async"
                        className="h-8 w-8 shrink-0 object-contain transition-transform group-hover:scale-105"
                    />
                ) : null}
                <span className="line-clamp-2 text-[11.5px] sm:text-xs font-medium leading-tight text-foreground transition-colors group-hover:text-primary">
                    {link.text}
                </span>
            </>
        );

        const handleTileClick = () => {
            const moduleSlug = link.id || link.href.replace(/^\/+/, '').split(/[?#]/)[0] || 'home';
            trackEvent('nav_select', {
                module: moduleSlug,
                surface: 'home_grid',
                is_external: Boolean(link.external),
            });
        };

        return (
            <li key={link.id || link.href}>
                {link.external ? (
                    <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleTileClick}
                        className={tileClass}
                    >
                        {body}
                    </a>
                ) : (
                    <Link href={link.href} onClick={handleTileClick} className={tileClass}>
                        {body}
                    </Link>
                )}
            </li>
        );
    };

    const todayGregorian = mounted ? formatGregorianSyrian(new Date()) : '';

    return (
        <MainLayout>
            <h1 className="sr-only">المساحة السورية</h1>
            <div className="text-foreground transition-colors" dir="rtl">
                {/* Single Unified Top Bar (h-14) — Desktop + Mobile */}
                <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    {/* Desktop row */}
                    <div className="mx-auto hidden h-14 max-w-[76rem] items-center justify-between gap-3 px-4 md:px-8 lg:flex">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <Link href="/" className="flex shrink-0 items-center">
                                <Logo className="h-8 w-auto" title="المساحة السورية" />
                            </Link>

                            {/* Lightweight search trigger — opens GlobalCommandPalette lazily */}
                            <button
                                type="button"
                                onClick={openSearch}
                                onMouseEnter={prefetchCommandPalette}
                                onFocus={prefetchCommandPalette}
                                aria-label={`ابحث في المساحة السورية (${shortcutLabel})`}
                                className="flex h-9 w-full max-w-xs xl:max-w-sm items-center justify-between gap-2 rounded-lg border border-input bg-muted/35 px-3 text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    <span className="truncate">ابحث في المساحة السورية...</span>
                                </span>
                                <kbd
                                    dir="ltr"
                                    className="inline-flex h-5 shrink-0 select-none items-center rounded border border-border bg-background/80 px-1.5 font-mono text-[10px] font-medium text-muted-foreground"
                                >
                                    {shortcutLabel}
                                </kbd>
                            </button>

                            {/* Live Status Chip: Date · Weather · Next Prayer */}
                            {mounted && (
                                <div className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border/60 bg-muted/25 px-2.5 text-xs text-muted-foreground">
                                    <Link
                                        href="/roznama"
                                        className="whitespace-nowrap font-medium text-foreground transition-colors hover:text-primary"
                                    >
                                        {todayGregorian}
                                    </Link>
                                    {weatherMini && (
                                        <>
                                            <span aria-hidden="true" className="text-border">·</span>
                                            <span
                                                className="inline-flex items-center gap-1 whitespace-nowrap"
                                                title={weatherMini.description}
                                            >
                                                <span className="[&>svg]:h-3.5 [&>svg]:w-3.5" aria-hidden="true">
                                                    <WeatherIcon code={weatherMini.icon} />
                                                </span>
                                                <span className="font-semibold tabular-nums text-foreground">
                                                    {weatherMini.temp}°
                                                </span>
                                            </span>
                                        </>
                                    )}
                                    {prayerMini && (
                                        <>
                                            <span aria-hidden="true" className="text-border">·</span>
                                            <Link
                                                href="/muslim/prayer"
                                                className="inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-primary"
                                            >
                                                <span className="font-semibold text-foreground">{prayerMini.label}</span>
                                                <span dir="ltr" className="font-mono tabular-nums">{prayerMini.time}</span>
                                            </Link>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                            <AppearanceMenu />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => setSettingsOpen(true)}
                                title="الإعدادات"
                                aria-label="الإعدادات"
                            >
                                <Settings className="h-4.5 w-4.5" aria-hidden="true" />
                            </Button>
                            <div className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
                            {user ? (
                                <UserNav />
                            ) : (
                                <Button variant="outline" size="sm" asChild className="h-9 gap-2">
                                    <a href="/auth/google" className="flex items-center gap-2">
                                        <GoogleMark />
                                        <span>تسجيل الدخول</span>
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Mobile row: [Settings] · [Logo] · [AppearanceMenu · UserNav] */}
                    <div className="relative mx-auto flex h-14 items-center justify-between px-4 lg:hidden">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setSettingsOpen(true)}
                            title="الإعدادات"
                            aria-label="الإعدادات"
                        >
                            <Settings className="h-5 w-5" aria-hidden="true" />
                        </Button>

                        <div className="pointer-events-none absolute inset-x-0 flex justify-center">
                            <Link
                                href="/"
                                className="pointer-events-auto flex items-center"
                            >
                                <Logo className="h-7 w-auto" title="المساحة السورية" />
                            </Link>
                        </div>

                        <div className="flex items-center gap-1">
                            <AppearanceMenu />
                            {user ? (
                                <UserNav />
                            ) : (
                                <Button variant="outline" size="icon" asChild className="h-9 w-9">
                                    <a href="/auth/google" aria-label="تسجيل الدخول">
                                        <GoogleMark />
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>
                </header>

                <div className="mx-auto w-full max-w-[76rem] px-4 pt-3 pb-8 sm:pt-5 sm:pb-10 md:px-8">
                    {/* Mobile compact 1-line strip: [Search trigger] + [Temp° · Next Prayer] */}
                    <div className="mb-3 flex items-center gap-2 lg:hidden">
                        <button
                            type="button"
                            onClick={openSearch}
                            onFocus={prefetchCommandPalette}
                            aria-label="ابحث في المساحة السورية"
                            className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-muted/35 px-3 text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">ابحث في المساحة السورية...</span>
                        </button>

                        {mounted && (weatherMini || prayerMini || todayGregorian) && (
                            <div className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border/60 bg-muted/25 px-2.5 text-xs text-muted-foreground">
                                {weatherMini && (
                                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5" aria-hidden="true">
                                            <WeatherIcon code={weatherMini.icon} />
                                        </span>
                                        <span className="font-semibold tabular-nums text-foreground">
                                            {weatherMini.temp}°
                                        </span>
                                    </span>
                                )}
                                {weatherMini && prayerMini && (
                                    <span aria-hidden="true" className="text-border">·</span>
                                )}
                                {prayerMini ? (
                                    <Link
                                        href="/muslim/prayer"
                                        className="inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-primary"
                                    >
                                        <span className="font-semibold text-foreground">{prayerMini.label}</span>
                                        <span dir="ltr" className="font-mono tabular-nums">{prayerMini.time}</span>
                                    </Link>
                                ) : !weatherMini && todayGregorian ? (
                                    <Link
                                        href="/roznama"
                                        className="whitespace-nowrap font-medium text-foreground"
                                    >
                                        {todayGregorian}
                                    </Link>
                                ) : null}
                            </div>
                        )}
                    </div>

                    {/* Mobile 1-tap group jump pills */}
                    <nav
                        aria-label="أقسام الأدوات"
                        className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar lg:hidden"
                    >
                        {groupedLinks.map((group) => (
                            <a
                                key={group.id}
                                href={`#home-group-${group.id}`}
                                className="inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-muted/25 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                            >
                                <Node size="xs" />
                                {group.title}
                            </a>
                        ))}
                    </nav>

                    {/* Borderless Startpage Grid: all 6 groups separated by crisp hairlines */}
                    <div className="space-y-5 sm:space-y-6">
                        {groupedLinks.map((group) => (
                            <section
                                key={group.id}
                                id={`home-group-${group.id}`}
                                aria-labelledby={`home-group-heading-${group.id}`}
                                className="scroll-mt-16"
                            >
                                <div className="mb-2 flex items-center gap-2.5">
                                    <h2
                                        id={`home-group-heading-${group.id}`}
                                        className="flex shrink-0 items-center gap-1.5 font-display text-sm font-bold tracking-tight text-foreground"
                                    >
                                        <Node size="xs" />
                                        {group.title}
                                    </h2>
                                    <div className="h-px flex-1 border-t border-border/60" aria-hidden="true" />
                                </div>

                                <ul
                                    role="list"
                                    className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-9 gap-1.5 sm:gap-2"
                                >
                                    {group.links.map(renderTile)}
                                </ul>
                            </section>
                        ))}
                    </div>

                    {/* Demoted lazy upcoming-event ticker (renders null on empty/error) */}
                    {showEvents && mounted && (
                        <div className="mt-6">
                            <React.Suspense fallback={null}>
                                <F3aliaEvents governorate={eventsGovernorate} />
                            </React.Suspense>
                        </div>
                    )}

                    {/* Custom Links: single compact 40px inline bar when empty */}
                    <section aria-labelledby="home-group-custom" className="mt-6">
                        {customLinks.length > 0 ? (
                            <>
                                <div className="mb-2.5 flex items-center justify-between gap-2.5">
                                    <h2
                                        id="home-group-custom"
                                        className="flex shrink-0 items-center gap-1.5 font-display text-sm font-bold tracking-tight text-foreground"
                                    >
                                        <Node size="xs" />
                                        روابط مخصصة
                                    </h2>
                                    <div className="h-px flex-1 border-t border-border/60" aria-hidden="true" />
                                    <div className="flex shrink-0 gap-1.5">
                                        <Button
                                            variant={editMode ? 'default' : 'ghost'}
                                            size="sm"
                                            className="h-7 gap-1 px-2 text-xs"
                                            onClick={() => setEditMode(!editMode)}
                                        >
                                            <Edit className="h-3.5 w-3.5" aria-hidden="true" />
                                            {editMode ? 'تم' : 'تعديل'}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 gap-1 px-2 text-xs"
                                            onClick={() => setAddLinkOpen(true)}
                                        >
                                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                            إضافة
                                        </Button>
                                    </div>
                                </div>

                                <ul
                                    role="list"
                                    className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-9 gap-1.5 sm:gap-2"
                                >
                                    {customLinks.map((link) => {
                                        const useFavicon = !link.icon || link.icon === '🔗';
                                        const faviconUrl = getFaviconUrl(link.url);
                                        const safeUrl =
                                            typeof link.url === 'string' &&
                                            (link.url.startsWith('http://') || link.url.startsWith('https://'))
                                                ? link.url
                                                : null;

                                        return (
                                            <li key={link.id} className="relative group">
                                                {editMode ? (
                                                    <div
                                                        onClick={() => setEditingLink(link)}
                                                        aria-hidden="true"
                                                        className="block h-full cursor-pointer"
                                                    >
                                                        <div className="flex min-h-[44px] h-full flex-col items-center justify-start gap-1.5 rounded-xl px-1.5 py-2 text-center ring-2 ring-primary/40">
                                                            {useFavicon ? (
                                                                <>
                                                                    <img
                                                                        src={faviconUrl}
                                                                        alt=""
                                                                        width={32}
                                                                        height={32}
                                                                        loading="lazy"
                                                                        referrerPolicy="no-referrer"
                                                                        className="h-8 w-8 shrink-0 object-contain"
                                                                        onError={(e) => {
                                                                            e.currentTarget.style.display = 'none';
                                                                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                                        }}
                                                                    />
                                                                    <Globe className="hidden h-8 w-8 text-muted-foreground" />
                                                                </>
                                                            ) : (
                                                                <span className="text-[30px] leading-8">{link.icon}</span>
                                                            )}
                                                            <span className="line-clamp-2 text-[11.5px] sm:text-xs font-medium leading-tight text-foreground">
                                                                {link.name}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : safeUrl ? (
                                                    <a
                                                        href={safeUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="group flex min-h-[44px] h-full flex-col items-center justify-start gap-1.5 rounded-xl px-1.5 py-2 text-center transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    >
                                                        {useFavicon ? (
                                                            <>
                                                                <img
                                                                    src={faviconUrl}
                                                                    alt=""
                                                                    width={32}
                                                                    height={32}
                                                                    loading="lazy"
                                                                    referrerPolicy="no-referrer"
                                                                    className="h-8 w-8 shrink-0 object-contain transition-transform group-hover:scale-105"
                                                                    onError={(e) => {
                                                                        e.currentTarget.style.display = 'none';
                                                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                                    }}
                                                                />
                                                                <Globe className="hidden h-8 w-8 text-muted-foreground transition-transform group-hover:scale-105" />
                                                            </>
                                                        ) : (
                                                            <span className="text-[30px] leading-8 transition-transform group-hover:scale-105">
                                                                {link.icon}
                                                            </span>
                                                        )}
                                                        <span className="line-clamp-2 text-[11.5px] sm:text-xs font-medium leading-tight text-foreground transition-colors group-hover:text-primary">
                                                            {link.name}
                                                        </span>
                                                    </a>
                                                ) : (
                                                    <div className="flex min-h-[44px] h-full flex-col items-center justify-start gap-1.5 rounded-xl px-1.5 py-2 text-center opacity-60">
                                                        <span className="line-clamp-2 text-[11.5px] sm:text-xs font-medium leading-tight text-foreground">
                                                            {link.name}
                                                        </span>
                                                    </div>
                                                )}

                                                {editMode && (
                                                    <div className="pointer-events-auto absolute -top-2 -end-2 z-20 flex gap-1">
                                                        <Button
                                                            aria-label={`تعديل الرابط ${link.name}`}
                                                            variant="secondary"
                                                            size="icon"
                                                            className="h-7 w-7 rounded-full border border-border bg-background text-foreground shadow-sm hover:bg-accent"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setEditingLink(link);
                                                            }}
                                                            title="تعديل الرابط"
                                                        >
                                                            <Edit className="h-3.5 w-3.5" aria-hidden="true" />
                                                        </Button>
                                                        <Button
                                                            aria-label={`حذف الرابط ${link.name}`}
                                                            variant="destructive"
                                                            size="icon"
                                                            className="h-7 w-7 rounded-full shadow-sm"
                                                            onClick={async (e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                if (
                                                                    !(await confirmDialog({
                                                                        title: 'حذف هذا الرابط؟',
                                                                        destructive: true,
                                                                        confirmText: 'حذف',
                                                                        cancelText: 'إلغاء',
                                                                    }))
                                                                ) {
                                                                    return;
                                                                }
                                                                removeCustomLink(link.id);
                                                            }}
                                                            title="حذف الرابط"
                                                        >
                                                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </>
                        ) : (
                            <div className="flex h-10 items-center justify-between gap-2.5 border-t border-border/60 pt-2">
                                <h2
                                    id="home-group-custom"
                                    className="flex shrink-0 items-center gap-1.5 font-display text-sm font-bold tracking-tight text-foreground"
                                >
                                    <Node size="xs" />
                                    روابط مخصصة
                                </h2>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => setAddLinkOpen(true)}
                                >
                                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                    إضافة رابط
                                </Button>
                            </div>
                        )}
                    </section>
                </div>

                {settingsOpen && (
                    <React.Suspense fallback={null}>
                        <HomeSettingsDialog
                            open={settingsOpen}
                            onOpenChange={setSettingsOpen}
                            eventsGovernorate={eventsGovernorate}
                            onEventsGovernorateChange={handleEventsGovernorateChange}
                            displayPrefs={displayPrefs}
                            onToggleChange={handleToggleChange}
                            onLocationChange={handleLocationChange}
                        />
                    </React.Suspense>
                )}

                {addLinkOpen && (
                    <React.Suspense fallback={null}>
                        <AddLinkDialog
                            open={addLinkOpen}
                            onOpenChange={setAddLinkOpen}
                            onAdd={addCustomLink}
                        />
                    </React.Suspense>
                )}

                {editingLink && (
                    <React.Suspense fallback={null}>
                        <EditLinkDialog
                            link={editingLink}
                            onOpenChange={(open) => { if (!open) setEditingLink(null); }}
                            onSave={updateCustomLink}
                            onDelete={removeCustomLink}
                        />
                    </React.Suspense>
                )}
            </div>
        </MainLayout>
    );
}
