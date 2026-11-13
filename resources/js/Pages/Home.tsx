import React, { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import {
    Settings, Globe, Plus, Edit, X,
    Info, BarChart3, Shield, FileText,
    History
} from 'lucide-react';
import { Button } from "@/Components/ui/button";
import { Card, CardContent } from "@/Components/ui/card";
import MainLayout from '@/Layouts/MainLayout';
import { api } from '@/Lib/api';
import { applyTheme as persistTheme, getThemePreference, SYSTEM_THEME, isDarkTheme } from '@/lib/theme';
import { applyFont, getFontPreference } from '@/Lib/font';
import UserNav from '@/Components/UserNav';
import AppearanceMenu from '@/Components/AppearanceMenu';
import { HomeInlineSearchSection } from '@/Components/GlobalSearch';
import F3aliaEvents from '@/Components/F3aliaEvents';
import type { CustomLink } from '@/Pages/Home/_lib/links';
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
import { useAppShell } from '@/Lib/appShell';
import { formatGregorianSyrian } from '@/Lib/syrian-date';

const HomeSettingsDialog = React.lazy(() => import('@/Pages/Home/_components/HomeSettingsDialog'));
const AddLinkDialog = React.lazy(() => import('@/Pages/Home/_components/AddLinkDialog'));
const EditLinkDialog = React.lazy(() => import('@/Pages/Home/_components/EditLinkDialog'));

import { useSiteNavigation } from '@/Lib/siteLinks';

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
    const { homeLinks } = useSiteNavigation();

    const [theme, setTheme] = useState<string | null>(null);
    const [systemDark, setSystemDark] = useState(false);
    const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);
    const [editingLink, setEditingLink] = useState<CustomLink | null>(null);
    const [settingsOpen, setSettingsOpen] = [useAppShell((s) => s.homeSettingsOpen), useAppShell((s) => s.setHomeSettingsOpen)] as const;
    const [addLinkOpen, setAddLinkOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    // Last-visited page badge. Read after mount (localStorage) so the server
    // render and first client render agree; see the SSR note below.
    const [lastPage, setLastPage] = useState<string | null>(null);
    // The shared location preference (city, manual coordinates, GPS/IP point).
    const location = useLocationPreference();
    const [mounted, setMounted] = useState(false);

    // Weather and the upcoming prayer for that same location.
    const [eventsGovernorate, setEventsGovernorate] = useState('all');

    // Widget visibility states
    const [showWeather, setShowWeather] = useState(true);
    const [showPrayerTimes, setShowPrayerTimes] = useState(true);
    const [showEvents, setShowEvents] = useState(true);

    const { weather } = useWeather(location, { enabled: mounted && showWeather, sessionCache: true });
    const { timings: prayerTimes } = usePrayerTimes(location, readStoredMethod(), {
        enabled: mounted && showPrayerTimes,
        timeoutMs: null,
        sessionCache: true,
    });

    // Debounced account-settings saver: per-keystroke POSTs (lat/lon, toggles)
    // previously hit /api/user/settings unthrottled. Coalesce partials over
    // 500ms so rapid toggles collapse into one request.
    const pendingSettings = React.useRef<Record<string, any>>({});
    const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const flushAccountSettings = async () => {
        if (!user) return;
        const payload = pendingSettings.current;
        pendingSettings.current = {};
        if (Object.keys(payload).length === 0) return;
        try {
            await api.post('/api/user/settings', { settings: payload });
        } catch (e) {
            // Background mirror of device preferences: the value is already in
            // localStorage and the next change retries, so no toast per pause.
            console.error('Failed to save settings to account', e);
        }
    };

    const saveAccountSettings = (partialSettings: Record<string, any>) => {
        if (!user) return;
        pendingSettings.current = { ...pendingSettings.current, ...partialSettings };
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => { void flushAccountSettings(); }, 500);
    };

    useEffect(() => {
        const flush = () => { void flushAccountSettings(); };
        window.addEventListener('visibilitychange', flush);
        window.addEventListener('beforeunload', flush);
        return () => {
            window.removeEventListener('visibilitychange', flush);
            window.removeEventListener('beforeunload', flush);
            if (saveTimer.current) clearTimeout(saveTimer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    // Read the last-visited page after mount (localStorage) so SSR and the
    // first client render match.
    useEffect(() => { setLastPage(getLastPage()); }, []);

    // Load settings from localStorage
    useEffect(() => {
        const accSettings = user?.settings || {};

        const savedTheme = accSettings.theme ?? getThemePreference();
        const savedFont = accSettings.fontFamily ?? getFontPreference();
        const savedEventsGovernorate = accSettings.eventsGovernorate ?? (localStorage.getItem('eventsGovernorate') || 'all');
        const savedShowWeather = accSettings.showWeather ?? (localStorage.getItem('sz-showWeather') !== 'false');
        const savedShowPrayerTimes = accSettings.showPrayerTimes ?? (localStorage.getItem('sz-showPrayerTimes') !== 'false');
        const savedShowEvents = accSettings.showEvents ?? (localStorage.getItem('sz-showEvents') !== 'false');

        // The location keys are conflict-tracked and owned by Domain/location:
        // the login sync seeds an empty device from the account (once, before it
        // compares the two sides), so this page only reads the preference.
        const savedLocation = readLocationPreference();

        let parsedLinks: CustomLink[] = [];
        if (accSettings.customLinks) {
            parsedLinks = accSettings.customLinks;
        } else {
            const savedLinks = localStorage.getItem('customLinks');
            if (savedLinks) {
                try { parsedLinks = JSON.parse(savedLinks); } catch (e) { console.error(e); }
            }
        }

        // Sync to localStorage (everything except the location keys, which the
        // location module already seeded above).
        if (savedTheme) persistTheme(savedTheme);
        if (savedFont) applyFont(savedFont);
        if (localStorage.getItem('eventsGovernorate') === null) {
            localStorage.setItem('eventsGovernorate', savedEventsGovernorate);
        }
        localStorage.setItem('sz-showWeather', String(savedShowWeather));
        localStorage.setItem('sz-showPrayerTimes', String(savedShowPrayerTimes));
        localStorage.setItem('sz-showEvents', String(savedShowEvents));
        localStorage.setItem('customLinks', JSON.stringify(parsedLinks));

        setTheme(savedTheme);
        setEventsGovernorate(savedEventsGovernorate);
        setShowWeather(savedShowWeather);
        setShowPrayerTimes(savedShowPrayerTimes);
        setShowEvents(savedShowEvents);
        setCustomLinks(parsedLinks);

        // If user logged in and has missing account settings, sync initial state to DB
        if (user && Object.keys(accSettings).length === 0) {
            saveAccountSettings({
                theme: savedTheme,
                showWeather: savedShowWeather,
                showPrayerTimes: savedShowPrayerTimes,
                showEvents: savedShowEvents,
                customLinks: parsedLinks,
                ...accountPatchForLocation(savedLocation),
            });
        }

        setMounted(true);
    }, []);

    // Track the device scheme so system-resolved UI (logo, sun/moon icon) stays in sync
    useEffect(() => {
        const query = window.matchMedia('(prefers-color-scheme: dark)');
        setSystemDark(query.matches);
        const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    }, []);

    // Stay in sync when the theme changes elsewhere (user menu, other menus).
    useEffect(() => {
        const sync = () => setTheme(getThemePreference());
        const observer = new MutationObserver(sync);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, []);

    const applyTheme = (newTheme: string) => {
        setTheme(newTheme);
        persistTheme(newTheme);
        saveAccountSettings({ theme: newTheme });
    };

    const addCustomLink = (link: CustomLink) => {
        const updated = [...customLinks, link];
        setCustomLinks(updated);
        localStorage.setItem('customLinks', JSON.stringify(updated));
        saveAccountSettings({ customLinks: updated });
    };

    const updateCustomLink = (updatedLink: CustomLink) => {
        const updated = customLinks.map(l => l.id === updatedLink.id ? updatedLink : l);
        setCustomLinks(updated);
        localStorage.setItem('customLinks', JSON.stringify(updated));
        saveAccountSettings({ customLinks: updated });
    };

    const removeCustomLink = (id: string) => {
        const updated = customLinks.filter(l => l.id !== id);
        setCustomLinks(updated);
        localStorage.setItem('customLinks', JSON.stringify(updated));
        saveAccountSettings({ customLinks: updated });
    };

    const activeTheme = theme || SYSTEM_THEME;
    const isDark = isDarkTheme(activeTheme, systemDark);

    // Navbar info strip (static per render): next prayer + weather + date.
    const prayerMini = showPrayerTimes ? nextPrayer(prayerTimes, new Date()) : null;
    const weatherMini = showWeather && weather ? weather : null;

    /** Mirror a location edit into the account settings (device storage is the module's). */
    const handleLocationChange = (patch: LocationPatch) => {
        const accountPatch = accountPatchForLocation(patch);
        if (Object.keys(accountPatch).length > 0) saveAccountSettings(accountPatch);
    };

    return (
        <MainLayout>
            
      <h1 className="sr-only">المساحة السورية</h1>
            <div className="min-h-screen text-foreground transition-colors" dir="rtl">
                {/* Home Navbar (desktop): logo + dates + minis + controls */}
                <header className="hidden lg:block border-b border-border bg-card/60 backdrop-blur-sm">
                    <div className="mx-auto max-w-6xl px-3 pt-1.5 pb-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-5">
                        <a href="/" className="flex items-center shrink-0">
                            <img
                                src={isDark ? '/assets/logo-darkmode.svg' : '/assets/logo-lightmode.svg'}
                                alt="المساحة السورية"
                                className="h-10 w-auto"
                            />
                        </a>
                        {/* Info strip (left of logo): prayer • weather • date, single line each */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {prayerMini && (
                                <span className="flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="font-semibold text-foreground">{prayerMini.label}</span>
                                    <span dir="ltr" className="tabular-nums">{prayerMini.time}</span>
                                </span>
                            )}
                            {prayerMini && weatherMini && (
                                <div className="w-px h-6 bg-border shrink-0" />
                            )}
                            {weatherMini && (
                                <span className="flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="[&>svg]:w-4 [&>svg]:h-4"><WeatherIcon code={weatherMini.icon} /></span>
                                    <span className="font-semibold text-foreground">{weatherMini.temp}°C</span>
                                    <span>{weatherMini.description}</span>
                                </span>
                            )}
                            {(prayerMini || weatherMini) && (
                                <div className="w-px h-6 bg-border shrink-0" />
                            )}
                            {mounted && (
                                <span className="whitespace-nowrap font-medium text-foreground">
                                    {formatGregorianSyrian(new Date())} • {formatHijriDate(new Date())}
                                </span>
                            )}
                        </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <AppearanceMenu />
                            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="الإعدادات" aria-label="الإعدادات">
                                <Settings className="h-5 w-5" />
                            </Button>
                            <div className="w-px h-6 bg-border shrink-0" />
                            {user ? (
                                <UserNav />
                            ) : (
                                <Button variant="ghost" size="sm" asChild className="gap-2">
                                    <a href="/auth/google" className="flex items-center gap-2">
                                        <svg className="h-4 w-4" viewBox="0 0 24 24">
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

                {/* Main Content */}
                <div className="container mx-auto px-4 pt-6 pb-12 max-w-6xl">
                    {/* Dates (mobile only; PC shows them in the navbar) */}
                    <div className="flex flex-col items-center gap-1 mb-6 lg:hidden">
                        {mounted && (
                            <>
                                <span className="text-base font-bold text-foreground">{formatGregorianSyrian(new Date())}</span>
                                <span className="text-sm text-primary/80 font-medium">{formatHijriDate(new Date())}</span>
                            </>
                        )}
                    </div>

                    {/* Quick row: weather + next prayer (mobile only; PC shows them in the navbar) */}
                    <div className="flex items-center justify-center gap-4 mb-6 text-sm lg:hidden">
                        {showWeather && weather && (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                                <span className="[&>svg]:w-5 [&>svg]:h-5"><WeatherIcon code={weather.icon} /></span>
                                <span className="font-semibold text-foreground">{weather.temp}°C</span>
                                <span className="text-xs">{weather.description}</span>
                            </span>
                        )}
                        {prayerMini && (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                                <span className="font-semibold text-foreground">{prayerMini.label}</span>
                                <span dir="ltr" className="tabular-nums text-xs">{prayerMini.time}</span>
                            </span>
                        )}
                    </div>

                    {/* Events */}
                    {showEvents && (
                        <div className="mb-8">
                            <F3aliaEvents governorate={eventsGovernorate} language="ar" variant="single" />
                        </div>
                    )}

                    {/* Search Bar + Internal & External Syrian Zone Tools (in-place search on PC & Mobile) */}
                    <HomeInlineSearchSection>
                        {/* Internal Syrian Zone Tools */}
                        <div className="mb-12">
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-x-2 gap-y-5">
                                {homeLinks.filter((l) => l.isInternal).map((link) => {
                                    const Icon = link.icon;
                                    return (
                                        <a
                                            key={link.id || link.href}
                                            href={link.href}
                                            target={link.external ? '_blank' : undefined}
                                            rel={link.external ? 'noopener noreferrer' : undefined}
                                            className="group relative flex h-full flex-col items-center justify-between gap-2 py-1 text-center"
                                        >
                                            {Icon && <Icon className="w-12 h-12 shrink-0 text-foreground transition-all group-hover:scale-110 group-hover:text-primary" />}
                                            {lastPage === link.href && (
                                                <span title="آخر صفحة تمت زيارتها" className="absolute -top-1.5 -end-1.5 rounded-full border border-border bg-background p-0.5 text-primary shadow-sm">
                                                    <History className="w-3.5 h-3.5" />
                                                </span>
                                            )}
                                            {link.image && <img src={link.image} alt="" loading="lazy" decoding="async" className="w-12 h-12 shrink-0 object-contain transition-transform group-hover:scale-110" />}
                                            <span className="text-xs font-medium text-foreground transition-colors group-hover:text-primary line-clamp-2">
                                                {link.text}
                                            </span>
                                        </a>
                                    );
                                })}
                            </div>
                        </div>

                        {/* External & Sister Links */}
                        <div>
                            <h2 className="text-xl font-bold text-foreground mb-6 text-center">
                                روابط خارجية وشقيقة
                            </h2>
                            <div className="flex flex-wrap justify-center gap-x-8 gap-y-5">
                                {homeLinks.filter((l) => !l.isInternal).map((link, idx) => {
                                    const Icon = link.icon;
                                    return (
                                        <a
                                            key={link.id || link.href || idx}
                                            href={link.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group flex w-24 shrink-0 flex-col items-center justify-between gap-2 py-1 text-center"
                                        >
                                            {Icon && <Icon className="w-12 h-12 shrink-0 text-foreground transition-all group-hover:scale-110 group-hover:text-primary" />}
                                            {link.image && <img src={link.image} alt="" loading="lazy" decoding="async" className="w-12 h-12 shrink-0 object-contain transition-transform group-hover:scale-110" />}
                                            <span className="text-xs font-medium text-foreground transition-colors group-hover:text-primary line-clamp-2">
                                                {link.text}
                                            </span>
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    </HomeInlineSearchSection>

                    {/* Custom Links */}
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-foreground">
                                روابط مخصصة
                            </h2>
                            <div className="flex gap-2">
                                <Button
                                    variant={editMode ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setEditMode(!editMode)}
                                    className={editMode ? "" : "bg-muted text-foreground border-border hover:bg-accent"}
                                >
                                    <Edit className="w-4 h-4 me-2" />
                                    {editMode ? 'تم' : 'تعديل'}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setAddLinkOpen(true)}
                                    className="bg-muted text-foreground border-border hover:bg-accent"
                                >
                                    <Plus className="w-4 h-4 me-2" />
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
                                                <div
                                                    onClick={() => setEditingLink(link)}
                                                    className="block h-full cursor-pointer"
                                                >
                                                    <div className="flex h-full flex-col items-center justify-between gap-2 rounded-lg px-1 py-1 text-center ring-2 ring-primary/40">
                                                        {useFavicon ? (
                                                            <>
                                                                <img
                                                                    src={faviconUrl}
                                                                    alt={link.name}
                                                                    loading="lazy"
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
                                                                    alt={link.name}
                                                                    loading="lazy"
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
                                                    <Button aria-label="تعديل الرابط"
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
                                                    <Button aria-label="حذف الرابط"
                                                        variant="destructive"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-full shadow-md opacity-100"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
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
                            <Card className="border-dashed border-2 border-border bg-transparent">
                                <CardContent className="p-12 text-center">
                                    <p className="text-muted-foreground mb-4">
                                        لا توجد روابط مخصصة
                                    </p>
                                    <Button
                                        variant="outline"
                                        onClick={() => setAddLinkOpen(true)}
                                        className="bg-muted text-foreground border-border hover:bg-accent"
                                    >
                                        <Plus className="w-4 h-4 me-2" />
                                        إضافة رابط
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                    {/* Footer */}
                    <footer className="mt-4 border-t border-border pt-6 flex flex-col items-center gap-3">
                        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                            <a href="/about" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                                <Info className="h-4 w-4" />
                                <span>عن المنصة</span>
                            </a>
                            <span>•</span>
                            <a href="/stats" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                                <BarChart3 className="h-4 w-4" />
                                <span>الإحصائيات</span>
                            </a>
                            <span>•</span>
                            <a href="/privacy" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                                <Shield className="h-4 w-4" />
                                <span>سياسة الخصوصية</span>
                            </a>
                            <span>•</span>
                            <a href="/terms" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                                <FileText className="h-4 w-4" />
                                <span>الشروط والأحكام</span>
                            </a>
                        </div>
                    </footer>
                </div>

                {/* Lazy-loaded Dialogs */}
                {settingsOpen && (
                    <React.Suspense fallback={null}>
                        <HomeSettingsDialog
                            open={settingsOpen}
                            onOpenChange={setSettingsOpen}
                            eventsGovernorate={eventsGovernorate}
                            setEventsGovernorate={setEventsGovernorate}
                            showWeather={showWeather}
                            setShowWeather={setShowWeather}
                            showPrayerTimes={showPrayerTimes}
                            setShowPrayerTimes={setShowPrayerTimes}
                            showEvents={showEvents}
                            setShowEvents={setShowEvents}
                            onLocationChange={handleLocationChange}
                            saveAccountSettings={saveAccountSettings}
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
