import React, { useState, useEffect, useMemo } from 'react';
import { Link, usePage } from '@inertiajs/react';
import {
    Settings, Globe, Plus, Edit, X,
    History
} from 'lucide-react';
import { Button } from "@/Components/ui/button";
import MainLayout from '@/Layouts/MainLayout';
import { applyTheme as persistTheme, getThemePreference } from '@/Lib/theme';
import { applyFont, getFontPreference } from '@/Lib/font';
import UserNav from '@/Components/UserNav';
import AppearanceMenu from '@/Components/AppearanceMenu';
import { HomeInlineSearchSection } from '@/Components/GlobalSearch';
import { Logo } from '@/Components/brand/Logo';
import { Node } from '@/Components/brand/Node';
import F3aliaEvents from '@/Pages/Home/_components/F3aliaEvents';
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
import { formatHijriDate } from '@/Domain/prayer/hijri';
import { nextPrayer } from '@/Domain/prayer/nextPrayer';
import { usePrayerTimes } from '@/Domain/prayer/times';
import { useWeather } from '@/Domain/weather/weather';
import { WeatherIcon } from '@/Domain/weather/WeatherIcon';
import { getLastPage } from '@/Lib/visit';
import { usePageDialog } from '@/Lib/appShell';
import { formatGregorianSyrian } from '@/Lib/syrian-date';
import { confirmDialog } from '@/Lib/confirm';

const HomeSettingsDialog = React.lazy(() => import('@/Pages/Home/_components/HomeSettingsDialog'));
const AddLinkDialog = React.lazy(() => import('@/Pages/Home/_components/AddLinkDialog'));
const EditLinkDialog = React.lazy(() => import('@/Pages/Home/_components/EditLinkDialog'));

import { groupSiteLinks, useSiteNavigation, type SiteLink } from '@/Lib/siteLinks';

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

export default function Home() {
    const { props } = usePage<{ auth?: { user: { id: number; name: string; email: string; avatar_url: string; role: string; settings?: Record<string, any> | null } | null } }>();
    const user = props.auth?.user ?? null;
    const { homeLinks, groups } = useSiteNavigation();

    const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);
    const [editingLink, setEditingLink] = useState<CustomLink | null>(null);
    const [settingsOpen, setSettingsOpen] = usePageDialog('home-settings');
    const [addLinkOpen, setAddLinkOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    // Last-visited page badge. Read after mount (localStorage) so the server
    // render and first client render agree; see the SSR note below.
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

    // Read the last-visited page after mount (localStorage) so SSR and the
    // first client render match.
    useEffect(() => { setLastPage(getLastPage()); }, []);

    useEffect(() => {
        const accSettings = user?.settings || {};

        const savedTheme = accSettings.theme ?? getThemePreference();
        const savedFont = accSettings.fontFamily ?? getFontPreference();
        const savedDisplayPrefs = readHomeDisplayPrefs(accSettings);
        const savedEventsGovernorate = readEventsGovernorate(accSettings);

        // The location keys are conflict-tracked and owned by Domain/location:
        // the login sync seeds an empty device from the account (once, before it
        // compares the two sides), so this page only reads the preference.
        const savedLocation = readLocationPreference();

        const parsedLinks = readCustomLinks(accSettings);

        // Everything except the location keys, which the location module already
        // seeded above.
        if (savedTheme) persistTheme(savedTheme);
        if (savedFont) applyFont(savedFont);
        persistHomeDisplayPrefs(savedDisplayPrefs);
        // The device copy follows the value the page resolved (the account's when
        // it has one), so a signed-out visit shows the same links.
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
        const updated = customLinks.map(l => l.id === updatedLink.id ? updatedLink : l);
        setCustomLinks(updated);
        saveCustomLinks(updated, Boolean(user));
    };

    const removeCustomLink = (id: string) => {
        const updated = customLinks.filter(l => l.id !== id);
        setCustomLinks(updated);
        saveCustomLinks(updated, Boolean(user));
    };

    const prayerMini = showPrayerTimes ? nextPrayer(prayerTimes, new Date(), { timeZone: prayerTimeZone }) : null;
    const weatherMini = showWeather && weather ? weather : null;

    /** Mirror a location edit into the account settings (device storage is the module's). */
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

    return (
        <MainLayout>
            
      <h1 className="sr-only">المساحة السورية</h1>
            <div className="text-foreground transition-colors" dir="rtl">
                <header className="hidden lg:block sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <div className="mx-auto flex h-16 max-w-[76rem] items-center justify-between gap-4 px-4 md:px-8">
                        <div className="flex items-center gap-5">
                        <Link href="/" className="flex items-center shrink-0">
                            <Logo className="h-9 w-auto" title="المساحة السورية" />
                        </Link>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {prayerMini && (
                                <span className="flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="font-semibold text-foreground">{prayerMini.label}</span>
                                    <span dir="ltr" className="font-mono tabular-nums">{prayerMini.time}</span>
                                </span>
                            )}
                            {prayerMini && weatherMini && (
                                <div className="w-px h-4 bg-border shrink-0" />
                            )}
                            {weatherMini && (
                                <span className="flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="[&>svg]:w-4 [&>svg]:h-4"><WeatherIcon code={weatherMini.icon} /></span>
                                    <span className="font-semibold tabular-nums text-foreground">{weatherMini.temp}°C</span>
                                    <span>{weatherMini.description}</span>
                                </span>
                            )}
                            {(prayerMini || weatherMini) && (
                                <div className="w-px h-4 bg-border shrink-0" />
                            )}
                            {mounted && (
                                <span className="whitespace-nowrap font-medium text-foreground">
                                    {formatGregorianSyrian(new Date())} <span aria-hidden="true" className="text-muted-foreground">·</span> <span className="text-muted-foreground">{formatHijriDate(new Date())}</span>
                                </span>
                            )}
                        </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <AppearanceMenu />
                            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="الإعدادات" aria-label="الإعدادات">
                                <Settings className="h-5 w-5" aria-hidden="true" />
                            </Button>
                            <div className="w-px h-5 bg-border shrink-0" />
                            {user ? (
                                <UserNav />
                            ) : (
                                <Button variant="outline" size="sm" asChild className="h-9 gap-2">
                                    <a href="/auth/google" className="flex items-center gap-2">
                                        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
                                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                        </svg>
                                        <span>تسجيل الدخول</span>
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>
                </header>

                <div className="mx-auto w-full max-w-[76rem] px-4 pt-5 pb-12 md:px-8">
                    {/* Compact mobile status bar: date + weather + next prayer on one calm strip */}
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-xs lg:hidden min-h-11">
                        {mounted && (
                            <div className="min-w-0">
                                <span className="font-semibold text-foreground">{formatGregorianSyrian(new Date())}</span>
                                <span className="mx-1.5 text-muted-foreground" aria-hidden="true">·</span>
                                <span className="text-muted-foreground">{formatHijriDate(new Date())}</span>
                            </div>
                        )}
                        {(weatherMini || prayerMini) && (
                            <div className="flex items-center gap-3 text-muted-foreground shrink-0">
                                {weatherMini && (
                                    <span className="inline-flex items-center gap-1">
                                        <span className="[&>svg]:w-4 [&>svg]:h-4"><WeatherIcon code={weatherMini.icon} /></span>
                                        <span className="font-semibold tabular-nums text-foreground">{weatherMini.temp}°</span>
                                    </span>
                                )}
                                {prayerMini && (
                                    <span className="inline-flex items-center gap-1">
                                        <span className="font-semibold text-foreground">{prayerMini.label}</span>
                                        <span dir="ltr" className="font-mono tabular-nums">{prayerMini.time}</span>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {showEvents && mounted && (
                        <div className="mb-8">
                            <F3aliaEvents governorate={eventsGovernorate} />
                        </div>
                    )}

                    <HomeInlineSearchSection>
                        {(() => {
                            const grouped = groupSiteLinks(homeLinks, groups);
                            const byId = new Map(grouped.map((g) => [g.id, g]));
                            const daily = byId.get('daily');
                            const maps = byId.get('maps');
                            const state = byId.get('state');
                            const interactive = byId.get('interactive');
                            const community = byId.get('community');
                            const external = byId.get('external');
                            const knownIds = new Set(['daily', 'maps', 'state', 'interactive', 'community', 'external']);
                            const others = grouped.filter((g) => !knownIds.has(g.id));

                            const renderTile = (link: SiteLink) => {
                                const Icon = link.icon;
                                const tileClass = "group relative flex h-full flex-col items-center justify-between gap-2 rounded-lg px-1 py-2 text-center transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
                                const body = (
                                    <>
                                        {Icon && <Icon className="w-10 h-10 shrink-0 text-foreground transition-all group-hover:scale-110 group-hover:text-primary" aria-hidden="true" />}
                                        {lastPage === link.href && (
                                            <span title="آخر صفحة تمت زيارتها" className="absolute -top-1 -end-1 rounded-full border border-border bg-background p-0.5 text-primary shadow-sm">
                                                <History className="w-3.5 h-3.5" aria-hidden="true" />
                                            </span>
                                        )}
                                        {link.image && link.imageDark ? (
                                            <>
                                                <img src={link.image} alt="" width={40} height={40} loading="lazy" decoding="async" className="w-10 h-10 shrink-0 object-contain transition-transform group-hover:scale-110 dark:hidden" />
                                                <img src={link.imageDark} alt="" width={40} height={40} loading="lazy" decoding="async" className="hidden w-10 h-10 shrink-0 object-contain transition-transform group-hover:scale-110 dark:block" />
                                            </>
                                        ) : link.image ? (
                                            <img src={link.image} alt="" width={40} height={40} loading="lazy" decoding="async" className="w-10 h-10 shrink-0 object-contain transition-transform group-hover:scale-110" />
                                        ) : null}
                                        <span className="text-xs font-medium text-foreground transition-colors group-hover:text-primary line-clamp-2">
                                            {link.text}
                                        </span>
                                    </>
                                );
                                if (link.external) {
                                    return (
                                        <a
                                            key={link.id || link.href}
                                            href={link.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={tileClass}
                                        >
                                            {body}
                                        </a>
                                    );
                                }
                                return (
                                    <Link
                                        key={link.id || link.href}
                                        href={link.href}
                                        className={tileClass}
                                    >
                                        {body}
                                    </Link>
                                );
                            };

                            const bentoCard = 'rounded-xl border border-border bg-card p-4 sm:p-5';
                            const renderHeading = (id: string, title: string) => (
                                <h2 id={id} className="mb-4 flex items-center gap-2 font-display text-lg font-bold tracking-tight text-foreground">
                                    <Node size="sm" />
                                    {title}
                                </h2>
                            );

                            return (
                                <div className="mb-10 grid grid-cols-1 lg:grid-cols-12 gap-4">
                                    {/* Row 1 (7 + 5 = 12): Daily & Utilities (7) + Syria & Maps (5) */}
                                    {daily && (
                                        <section aria-labelledby="home-group-daily" className={`lg:col-span-7 ${bentoCard}`}>
                                            {renderHeading('home-group-daily', daily.title)}
                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-2 gap-y-4">
                                                {daily.links.map(renderTile)}
                                            </div>
                                        </section>
                                    )}

                                    {maps && (
                                        <section aria-labelledby="home-group-maps" className={`lg:col-span-5 ${bentoCard}`}>
                                            {renderHeading('home-group-maps', maps.title)}
                                            <div className="grid grid-cols-3 gap-x-2 gap-y-4">
                                                {maps.links.map(renderTile)}
                                            </div>
                                        </section>
                                    )}

                                    {/* Row 2 (6 + 6 = 12): State & Civic (6) + Interactive & Games (6) */}
                                    {state && (
                                        <section aria-labelledby="home-group-state" className={`lg:col-span-6 ${bentoCard}`}>
                                            {renderHeading('home-group-state', state.title)}
                                            <div className="grid grid-cols-3 gap-x-2 gap-y-4">
                                                {state.links.map(renderTile)}
                                            </div>
                                        </section>
                                    )}

                                    {interactive && (
                                        <section aria-labelledby="home-group-interactive" className={`lg:col-span-6 ${bentoCard}`}>
                                            {renderHeading('home-group-interactive', interactive.title)}
                                            <div className="grid grid-cols-3 gap-x-2 gap-y-4">
                                                {interactive.links.map(renderTile)}
                                            </div>
                                        </section>
                                    )}

                                    {/* Row 3 (8 + 4 = 12): Identity & Community (7) + Partners & Sources (3) */}
                                    {community && (
                                        <section aria-labelledby="home-group-community" className={`lg:col-span-8 ${bentoCard}`}>
                                            {renderHeading('home-group-community', community.title)}
                                            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-x-2 gap-y-4">
                                                {community.links.map(renderTile)}
                                            </div>
                                        </section>
                                    )}

                                    {external && (
                                        <section aria-labelledby="home-group-external" className={`lg:col-span-4 ${bentoCard}`}>
                                            {renderHeading('home-group-external', external.title)}
                                            <div className="grid grid-cols-3 gap-x-2 gap-y-4">
                                                {external.links.map(renderTile)}
                                            </div>
                                        </section>
                                    )}

                                    {others.map((group) => (
                                        <section key={group.id} aria-labelledby={`home-group-${group.id}`} className={`lg:col-span-12 ${bentoCard}`}>
                                            {renderHeading(`home-group-${group.id}`, group.title)}
                                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                                {group.links.map(renderTile)}
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            );
                        })()}
                    </HomeInlineSearchSection>

                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-foreground">
                                <Node size="sm" />
                                روابط مخصصة
                            </h2>
                            <div className="flex gap-2">
                                <Button
                                    variant={editMode ? "default" : "outline"}
                                    size="sm"
                                    className="h-8 gap-1.5 text-xs"
                                    onClick={() => setEditMode(!editMode)}
                                >
                                    <Edit className="w-3.5 h-3.5" aria-hidden="true" />
                                    {editMode ? 'تم' : 'تعديل'}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1.5 text-xs"
                                    onClick={() => setAddLinkOpen(true)}
                                >
                                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                    إضافة
                                </Button>
                            </div>
                        </div>

                        {customLinks.length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-x-2 gap-y-5">
                                {customLinks.map((link) => {
                                    const useFavicon = !link.icon || link.icon === '🔗';
                                    const faviconUrl = getFaviconUrl(link.url);
                                    const safeUrl = typeof link.url === 'string' && (link.url.startsWith('http://') || link.url.startsWith('https://')) ? link.url : null;

                                    return (
                                        <div key={link.id} className="relative group">
                                            {editMode ? (
                                                // A pointer shortcut only: keyboard and screen-reader users
                                                // reach the same action through the named edit button.
                                                <div
                                                    onClick={() => setEditingLink(link)}
                                                    aria-hidden="true"
                                                    className="block h-full cursor-pointer"
                                                >
                                                    <div className="flex h-full flex-col items-center justify-between gap-2 rounded-lg px-1 py-1 text-center ring-2 ring-primary/40">
                                                        {useFavicon ? (
                                                            <>
                                                                <img
                                                                    src={faviconUrl}
                                                                    alt=""
                                                                    loading="lazy"
                                                                    referrerPolicy="no-referrer"
                                                                    className="w-12 h-12 shrink-0 object-contain"
                                                                    onError={(e) => {
                                                                        e.currentTarget.style.display = 'none';
                                                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                                    }}
                                                                />
                                                                <Globe className="w-12 h-12 text-muted-foreground hidden" />
                                                            </>
                                                        ) : (
                                                            <span className="text-[48px] leading-none">{link.icon}</span>
                                                        )}
                                                        <span className="text-xs font-medium text-foreground line-clamp-2">
                                                            {link.name}
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : safeUrl ? (
                                                <a
                                                    href={safeUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block h-full group"
                                                >
                                                    <div className="flex h-full flex-col items-center justify-between gap-2 py-1 text-center">
                                                        {useFavicon ? (
                                                            <>
                                                                <img
                                                                    src={faviconUrl}
                                                                    alt=""
                                                                    loading="lazy"
                                                                    referrerPolicy="no-referrer"
                                                                    className="w-12 h-12 shrink-0 object-contain transition-transform group-hover:scale-110"
                                                                    onError={(e) => {
                                                                        e.currentTarget.style.display = 'none';
                                                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                                    }}
                                                                />
                                                                <Globe className="w-12 h-12 text-muted-foreground hidden transition-transform group-hover:scale-110" />
                                                            </>
                                                        ) : (
                                                            <span className="text-[48px] leading-none transition-transform group-hover:scale-110">{link.icon}</span>
                                                        )}
                                                        <span className="text-xs font-medium text-foreground transition-colors group-hover:text-primary line-clamp-2">
                                                            {link.name}
                                                        </span>
                                                    </div>
                                                </a>
                                            ) : (
                                                <div className="block h-full group opacity-60">
                                                    <div className="flex h-full flex-col items-center justify-between gap-2 py-1 text-center">
                                                        <span className="text-xs font-medium text-foreground line-clamp-2">
                                                            {link.name}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {editMode && (
                                                <div className="absolute -top-2.5 -end-2.5 flex gap-1 z-20 opacity-100 pointer-events-auto">
                                                    <Button aria-label={`تعديل الرابط ${link.name}`}
                                                        variant="secondary"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-full shadow-md bg-background border border-border hover:bg-accent text-foreground opacity-100"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setEditingLink(link);
                                                        }}
                                                        title="تعديل الرابط"
                                                    >
                                                        <Edit className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button aria-label={`حذف الرابط ${link.name}`}
                                                        variant="destructive"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-full shadow-md opacity-100"
                                                        onClick={async (e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            if (!(await confirmDialog({ title: 'حذف هذا الرابط؟', destructive: true, confirmText: 'حذف', cancelText: 'إلغاء' }))) return;
                                                            removeCustomLink(link.id);
                                                        }}
                                                        title="حذف الرابط"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-card/50 px-4 py-4">
                                <p className="text-sm text-muted-foreground">
                                    أضف اختصارات لمواقعك وأدواتك اليومية للوصول إليها بسرعة.
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1.5 text-xs"
                                    onClick={() => setAddLinkOpen(true)}
                                >
                                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                    إضافة رابط
                                </Button>
                            </div>
                        )}
                    </div>
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
