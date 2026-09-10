import React, { useState, useEffect, useMemo } from 'react';
import { Head, usePage } from '@inertiajs/react';
import {
    Settings, Sun, Link, Moon, Globe, Plus, Edit, X,
    Cloud, CloudRain, CloudLightning, Snowflake, Wind, Clock,
    Sunrise, Sunset, SunDim, MoonStar
} from 'lucide-react';
import { Button } from "@/Components/ui/button";
import { Card, CardContent } from "@/Components/ui/card";
import MainLayout from '@/Layouts/MainLayout';
import axios from '@/Lib/axios';
import { applyTheme as persistTheme, getThemePreference, resolveTheme, SYSTEM_THEME, isDarkTheme } from '@/lib/theme';
import { applyFont, getFontPreference, FontPreference } from '@/Lib/font';
import { ThemeToggle } from '@/Components/ThemeToggle';
import UserNav from '@/Components/UserNav';
import F3aliaEvents from '@/Components/F3aliaEvents';
import type { CustomLink } from '@/Pages/Home/_components/AddLinkDialog';
import { getGeo, getLocMode, useLocSignal } from '@/Pages/Muslim/_lib/location';

const HomeSettingsDialog = React.lazy(() => import('@/Pages/Home/_components/HomeSettingsDialog'));
const AddLinkDialog = React.lazy(() => import('@/Pages/Home/_components/AddLinkDialog'));
const EditLinkDialog = React.lazy(() => import('@/Pages/Home/_components/EditLinkDialog'));

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
    RecipesIcon,
    NewsIcon,
    AnswersIcon,
    CodexCommunityIcon,
} from '@/Components/Icons/ProjectIcons';



interface PresetLink {
    href: string;
    icon: React.ComponentType<{ className?: string }> | null;
    text: string;
    image?: string;
    external?: boolean;
    isInternal?: boolean;
    className?: string;
}

const PRESET_LINKS: PresetLink[] = [
    { href: '/syofficial', icon: SyOfficialIcon, text: 'الحسابات الرسمية', isInternal: true },
    { href: '/roznama', icon: RoznamaIcon, text: 'الروزنامة', isInternal: true },
    { href: '/phonebook', icon: PhonebookIcon, text: 'دليل الهاتف', isInternal: true },
    { href: '/syid', icon: SyIdIcon, text: 'الهوية البصرية', isInternal: true },
    { href: '/party', icon: PartyIcon, text: 'دليل الأحزاب', isInternal: true },
    { href: '/tierlist', icon: TierlistIcon, text: 'تقييم الحكومة', isInternal: true },
    { href: '/house', icon: HouseIcon, text: 'المجلس التشريعي', isInternal: true },
    { href: '/compass', icon: CompassIcon, text: 'البوصلة السياسية', isInternal: true },
    { href: '/priorities', icon: PrioritiesIcon, text: 'أولويات سوريا', isInternal: true },
    { href: '/sites', icon: SitesIcon, text: 'دليل المواقع', isInternal: true },
    { href: '/atlas', icon: PopulationIcon, text: 'أطلس', isInternal: true },
    { href: '/govapps', icon: GovAppsIcon, text: 'تطبيقات الحكومة', isInternal: true },
    { href: '/transit', icon: TransitIcon, text: 'ترانزيت', isInternal: true },
    { href: '/justice', icon: JusticeIcon, text: 'العدالة الانتقالية', isInternal: true },
    { href: '/crossings', icon: CrossingsIcon, text: 'المنافذ الحدودية', isInternal: true },
    { href: '/mishwar', icon: MishwarIcon, text: 'مشوار', isInternal: true },
    { href: '/board', icon: BoardIcon, text: 'لوح', isInternal: true },
    { href: '/muslim', icon: MuslimIcon, text: 'الركن الإسلامي', isInternal: true },
    { href: 'https://food.syrian.zone', icon: RecipesIcon, text: 'وصفاتنا', external: true, isInternal: true },
    { href: 'https://answers.syrian.zone', icon: AnswersIcon, text: 'إجابات سوريا', external: true, isInternal: true },
    { href: 'https://chromewebstore.google.com/detail/syrian-flag-replacer/dngipobppehfhfggmbdiiiodgcibdeog', icon: null, text: 'مبدل العلم', image: '/flag-replacer/1f1f8-1f1fe.svg', external: true, isInternal: true },
    { href: 'https://joory.chat', icon: null, image: 'https://joory.chat/favicon.svg', text: 'جوري AI', external: true },
    { href: 'https://jard.chat', icon: null, image: 'https://jard.chat/images/logo-light.svg', text: 'جرد', external: true },
    { href: 'https://news.jard.chat', icon: NewsIcon, text: 'أخبار سوريا', external: true },
    { href: 'https://discord.gg/NqE8849VzA', icon: CodexCommunityIcon, text: 'مجتمع كوديكس', external: true },
];

const GOVERNORATES: Record<string, { lat: number; lon: number }> = {
    'damascus': { lat: 33.5138, lon: 36.2765 },
    'aleppo': { lat: 36.2021, lon: 37.1343 },
    'homs': { lat: 34.7324, lon: 36.7137 },
    'hama': { lat: 35.1318, lon: 36.7578 },
    'latakia': { lat: 35.5317, lon: 35.7901 },
    'tartus': { lat: 34.8890, lon: 35.8866 },
    'deir-ez-zor': { lat: 35.3359, lon: 40.1408 },
    'idlib': { lat: 35.9306, lon: 36.6339 },
    'daraa': { lat: 32.6255, lon: 36.1016 },
    'quneitra': { lat: 33.1250, lon: 35.8250 },
    'sweida': { lat: 32.7089, lon: 36.5695 },
    'rural-damascus': { lat: 33.5138, lon: 36.2765 },
    'hasakah': { lat: 36.5023, lon: 40.7382 },
    'raqqa': { lat: 35.9520, lon: 39.0081 },
};


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

const WEATHER_TRANSLATIONS: Record<string, string> = {
    "clear sky": "سماء صافية",
    "few clouds": "غيوم قليلة",
    "scattered clouds": "غيوم متفرقة",
    "broken clouds": "غيوم جزئية",
    "shower rain": "مطر غزير",
    "rain": "ممطر",
    "thunderstorm": "عاصفة رعدية",
    "snow": "مثلج",
    "mist": "ضباب",
    "overcast clouds": "غيوم ملبدة",
    "light rain": "مطر خفيف",
    "moderate rain": "مطر متوسط",
};



export default function Home() {
    const { props } = usePage<{ auth?: { user: { id: number; name: string; email: string; avatar_url: string; role: string; settings?: Record<string, any> | null } | null } }>();
    const user = props.auth?.user ?? null;


    const [theme, setTheme] = useState<string | null>(null);
    const [systemDark, setSystemDark] = useState(false);
        const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);
    const [editingLink, setEditingLink] = useState<CustomLink | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [addLinkOpen, setAddLinkOpen] = useState(false);
    const [govDropdownOpen, setGovDropdownOpen] = useState(false);
    const [govSearch, setGovSearch] = useState('');
    const [editMode, setEditMode] = useState(false);
    // Shared device location (GPS/IP resolved in /muslim or settings):
    // overrides the manual city while active.
    const locSig = useLocSignal();
    const sharedCoords = () => {
        const mode = getLocMode();
        const geo = getGeo();
        if ((mode === 'gps' || mode === 'ip') && geo) {
            return { lat: geo.lat, lon: geo.lon };
        }
        return null;
    };
    const [mounted, setMounted] = useState(false);

    // Weather & Clock state
    const [weather, setWeather] = useState<any>(null);
    const [governorate, setGovernorate] = useState('damascus');
    const [clockFormat, setClockFormat] = useState<'12' | '24'>('24');
    const [prayerTimes, setPrayerTimes] = useState<Record<string, string> | null>(null);

    // Widget visibility states
    const [showClock, setShowClock] = useState(true);
    const [showWeather, setShowWeather] = useState(true);
    const [showPrayerTimes, setShowPrayerTimes] = useState(true);
    const [showEvents, setShowEvents] = useState(true);

    // Custom coordinates states
    const [useCustomCoords, setUseCustomCoords] = useState(false);
    const [customLat, setCustomLat] = useState('');
    const [customLon, setCustomLon] = useState('');

    // Theme & Font state
    const [fontFamily, setFontFamily] = useState<FontPreference>('ibm-plex');

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
            await axios.post('/api/user/settings', { settings: payload });
        } catch (e) {
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

    // Load settings from localStorage
    useEffect(() => {
        const accSettings = user?.settings || {};

        const savedTheme = accSettings.theme ?? getThemePreference();
        const savedFont = (accSettings.fontFamily ?? getFontPreference()) as FontPreference;
        const savedGovernorate = accSettings.governorate ?? (localStorage.getItem('governorate') || 'damascus');
        const savedClockFormat = (accSettings.clockFormat ?? (localStorage.getItem('clockFormat') || '24')) as '12' | '24';

        const savedShowClock = accSettings.showClock ?? (localStorage.getItem('sz-showClock') !== 'false');
        const savedShowWeather = accSettings.showWeather ?? (localStorage.getItem('sz-showWeather') !== 'false');
        const savedShowPrayerTimes = accSettings.showPrayerTimes ?? (localStorage.getItem('sz-showPrayerTimes') !== 'false');
        const savedShowEvents = accSettings.showEvents ?? (localStorage.getItem('sz-showEvents') !== 'false');

        const savedUseCustomCoords = accSettings.useCustomCoords ?? (localStorage.getItem('useCustomCoords') === 'true');
        const savedCustomLat = accSettings.customLat ?? (localStorage.getItem('customLat') || '');
        const savedCustomLon = accSettings.customLon ?? (localStorage.getItem('customLon') || '');

        let parsedLinks: CustomLink[] = [];
        if (accSettings.customLinks) {
            parsedLinks = accSettings.customLinks;
        } else {
            const savedLinks = localStorage.getItem('customLinks');
            if (savedLinks) {
                try { parsedLinks = JSON.parse(savedLinks); } catch (e) { console.error(e); }
            }
        }

        // Sync to localStorage (governorate set-if-absent only: it is a
        // conflict-tracked key, so a logged-out change must survive until the
        // login sync compares both sides; everything else keeps server-wins).
        if (savedTheme) persistTheme(savedTheme);
        if (savedFont) applyFont(savedFont);
        if (localStorage.getItem('governorate') === null) {
            localStorage.setItem('governorate', savedGovernorate);
        }
        localStorage.setItem('clockFormat', savedClockFormat);
        localStorage.setItem('sz-showClock', String(savedShowClock));
        localStorage.setItem('sz-showWeather', String(savedShowWeather));
        localStorage.setItem('sz-showPrayerTimes', String(savedShowPrayerTimes));
        localStorage.setItem('sz-showEvents', String(savedShowEvents));
        localStorage.setItem('useCustomCoords', String(savedUseCustomCoords));
        localStorage.setItem('customLat', savedCustomLat);
        localStorage.setItem('customLon', savedCustomLon);
        localStorage.setItem('customLinks', JSON.stringify(parsedLinks));

        setTheme(savedTheme);
        setGovernorate(savedGovernorate);
        setClockFormat(savedClockFormat);
        setShowClock(savedShowClock);
        setShowWeather(savedShowWeather);
        setShowPrayerTimes(savedShowPrayerTimes);
        setShowEvents(savedShowEvents);
        setUseCustomCoords(savedUseCustomCoords);
        setCustomLat(savedCustomLat);
        setCustomLon(savedCustomLon);
        setCustomLinks(parsedLinks);

        // If user logged in and has missing account settings, sync initial state to DB
        if (user && Object.keys(accSettings).length === 0) {
            saveAccountSettings({
                theme: savedTheme,
                governorate: savedGovernorate,
                clockFormat: savedClockFormat,
                showClock: savedShowClock,
                showWeather: savedShowWeather,
                showPrayerTimes: savedShowPrayerTimes,
                showEvents: savedShowEvents,
                useCustomCoords: savedUseCustomCoords,
                customLat: savedCustomLat,
                customLon: savedCustomLon,
                customLinks: parsedLinks,
            });
        }

        document.documentElement.setAttribute('data-theme', resolveTheme(savedTheme));
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



    const getWeatherIcon = (iconCode: string) => {
        if (iconCode.startsWith('01')) return <Sun className="w-8 h-8 text-yellow-500" />;
        if (iconCode.startsWith('02')) return <Sun className="w-8 h-8 text-orange-400" />;
        if (iconCode.startsWith('03') || iconCode.startsWith('04')) return <Cloud className="w-8 h-8 text-gray-400" />;
        if (iconCode.startsWith('09') || iconCode.startsWith('10')) return <CloudRain className="w-8 h-8 text-blue-400" />;
        if (iconCode.startsWith('11')) return <CloudLightning className="w-8 h-8 text-purple-500" />;
        if (iconCode.startsWith('13')) return <Snowflake className="w-8 h-8 text-white" />;
        if (iconCode.startsWith('50')) return <Wind className="w-8 h-8 text-gray-300" />;
        return <Sun className="w-8 h-8 text-yellow-500" />;
    };

    // Fetch weather
    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const hasCustom = useCustomCoords && customLat && customLon;
                const coords = sharedCoords() ?? (hasCustom
                    ? { lat: parseFloat(customLat), lon: parseFloat(customLon) }
                    : (GOVERNORATES[governorate] || GOVERNORATES['damascus']));

                if (isNaN(coords.lat) || isNaN(coords.lon)) return;

                const cacheKey = `sz_weather_${coords.lat}_${coords.lon}`;
                const cached = sessionStorage.getItem(cacheKey);
                if (cached) {
                    try {
                        const { data, timestamp } = JSON.parse(cached);
                        if (Date.now() - timestamp < 15 * 60 * 1000) {
                            let description = data.weather[0].description;
                            if (WEATHER_TRANSLATIONS[description]) {
                                description = WEATHER_TRANSLATIONS[description];
                            }
                            setWeather({
                                temp: Math.round(data.main.temp),
                                description: description,
                                icon: getWeatherIcon(data.weather[0].icon)
                            });
                            return;
                        }
                    } catch (err) {}
                }

                const response = await fetch(`/api/weather?lat=${coords.lat}&lon=${coords.lon}`);
                if (!response.ok) throw new Error('Weather fetch failed');
                const data = await response.json();

                sessionStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));

                let description = data.weather[0].description;
                if (WEATHER_TRANSLATIONS[description]) {
                    description = WEATHER_TRANSLATIONS[description];
                }

                setWeather({
                    temp: Math.round(data.main.temp),
                    description: description,
                    icon: getWeatherIcon(data.weather[0].icon)
                });
            } catch (e) {
                console.error(e);
                setWeather(null);
            }
        };

        if (mounted && showWeather) {
            fetchWeather();
        }
    }, [governorate, useCustomCoords, customLat, customLon, mounted, showWeather, locSig]);

    // Fetch prayer times for the upcoming prayer widget.
    // Unified with /muslim: calculation method + custom coords saved there
    // drive this widget (server proxy, cached per day like Roznama/Board).
    useEffect(() => {
        const fetchPrayers = async () => {
            try {
                const muslimMethod = Number(localStorage.getItem('sz-muslim-method') || '3') || 3;
                const muslimCustom = localStorage.getItem('sz-muslim-use-custom') === 'true';
                const muslimLat = localStorage.getItem('sz-muslim-lat') || '';
                const muslimLon = localStorage.getItem('sz-muslim-lon') || '';
                const hasCustom = (useCustomCoords && customLat && customLon)
                    || (muslimCustom && muslimLat && muslimLon);
                const coords = sharedCoords() ?? (hasCustom
                    ? {
                        lat: parseFloat(useCustomCoords && customLat ? customLat : muslimLat),
                        lon: parseFloat(useCustomCoords && customLon ? customLon : muslimLon),
                    }
                    : (GOVERNORATES[governorate] || GOVERNORATES['damascus']));

                if (isNaN(coords.lat) || isNaN(coords.lon)) return;

                const now = new Date();
                const day = String(now.getDate()).padStart(2, '0');
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const year = now.getFullYear();
                const dateStr = `${day}-${month}-${year}`;

                const cacheKey = `sz_prayers_${coords.lat}_${coords.lon}_${muslimMethod}_${dateStr}`;
                const cached = sessionStorage.getItem(cacheKey);
                if (cached) {
                    try {
                        setPrayerTimes(JSON.parse(cached));
                        return;
                    } catch (err) {}
                }

                const params = new URLSearchParams({
                    latitude: String(coords.lat),
                    longitude: String(coords.lon),
                    method: String(muslimMethod),
                });
                const response = await fetch(`/api/prayer-times?${params.toString()}`);
                if (!response.ok) throw new Error('Prayer times fetch failed');
                const data = await response.json();
                if (data.timings) {
                    sessionStorage.setItem(cacheKey, JSON.stringify(data.timings));
                    setPrayerTimes(data.timings);
                }
            } catch (e) {
                console.error(e);
            }
        };

        if (mounted && showPrayerTimes) {
            fetchPrayers();
        }
    }, [governorate, useCustomCoords, customLat, customLon, mounted, showPrayerTimes, locSig]);



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



    if (!mounted) return null;

    const activeTheme = theme || SYSTEM_THEME;
    const isDark = isDarkTheme(activeTheme, systemDark);

    return (
        <MainLayout>
            <Head>
                <title>الرئيسية</title>
                <meta name="description" content="المساحة السورية - منصة تفاعلية تجمع وتوفر الموارد والخدمات والمعلومات المفتوحة المتعلقة بالشأن السوري من استطلاعات رأي، وأدلة رسمية، وأطلس، وترانزيت، وهويات بصرية." />
            </Head>
            <div className="min-h-screen text-foreground transition-colors" dir="rtl">
                {/* Top Controls */}
                <div className="fixed top-20 left-4 right-4 lg:top-4 flex justify-between items-center z-40">
                    <Button variant="ghost" size="sm" asChild>
                        <a href="/about" className="text-sm font-medium">
                            حول المنصة
                        </a>
                    </Button>

                    <div className="flex gap-2 items-center">
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
                        <div className="hidden lg:flex">
                            <ThemeToggle />
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
                            <Settings className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="container mx-auto px-4 pt-32 lg:pt-20 pb-12 max-w-6xl">
                    {/* Weather & Clock & Prayer Times */}
                    {(showWeather || showClock || showPrayerTimes) && (
                        <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-6 mb-12 w-full">
                            {/* Weather Widget */}
                            {showWeather ? (
                                <Card className="w-full md:w-auto justify-self-stretch md:justify-self-start bg-card/50 backdrop-blur-sm border-border">
                                    <CardContent className="p-4">
                                        <div className="text-sm text-muted-foreground">
                                            {weather ? (
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl">{weather.icon}</span>
                                                    <div>
                                                        <div className="font-semibold text-foreground">{weather.temp}°C</div>
                                                        <div className="text-xs">{weather.description}</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="animate-pulse">Loading weather...</div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : <div />}

                            {/* Clock */}
                            {showClock ? (
                                <ClockWidget clockFormat={clockFormat} />
                            ) : <div />}

                            {/* Next Prayer Widget */}
                            {showPrayerTimes ? (
                                <NextPrayerWidget prayerTimes={prayerTimes} />
                            ) : <div />}
                        </div>
                    )}

                    {/* Logo */}
                    <div className="flex justify-center mb-12">
                        {mounted && (
                            <img
                                src={isDark ? '/assets/logo-darkmode.svg' : '/assets/logo-lightmode.svg'}
                                alt="Syrian Zone"
                                className="h-16 md:h-24"
                            />
                        )}
                    </div>

                    {/* F3alia Events integration */}
                    {showEvents && (
                        <F3aliaEvents governorate={governorate} language="ar" variant="single" />
                    )}

                    {/* Internal Syrian Zone Tools */}
                    <div className="mb-12">
                        <h3 className="text-xl font-bold text-foreground mb-6 text-start">
                            أدوات المساحة السورية
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3.5 sm:gap-4">
                            {PRESET_LINKS.filter(l => l.isInternal).map((link, idx) => {
                                const Icon = link.icon;
                                return (
                                    <a
                                        key={idx}
                                        href={link.href}
                                        target={link.external ? '_blank' : undefined}
                                        rel={link.external ? 'noopener noreferrer' : undefined}
                                        className="group"
                                    >
                                        <Card className="h-full hover:shadow-lg transition-all border-border bg-card">
                                            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                                                {Icon && <Icon className="w-7 h-7 group-hover:scale-110 transition-transform" />}
                                                {link.image && <img src={link.image} alt={link.text} loading="lazy" decoding="async" className="w-7 h-7 group-hover:scale-110 transition-transform" />}
                                                {link.className && <div className={link.className} style={{ width: '1.8rem', height: '1.8rem' }}></div>}
                                                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                                    {link.text}
                                                </span>
                                            </CardContent>
                                        </Card>
                                    </a>
                                );
                            })}
                        </div>
                    </div>

                    {/* External & Sister Links */}
                    <div className="mb-12">
                        <h3 className="text-xl font-bold text-foreground mb-6 text-start">
                            روابط خارجية وشقيقة
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3.5 sm:gap-4">
                            {PRESET_LINKS.filter(l => !l.isInternal).map((link, idx) => {
                                const Icon = link.icon;
                                return (
                                    <a
                                        key={idx}
                                        href={link.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group"
                                    >
                                        <Card className="h-full hover:shadow-lg transition-all border-border bg-card">
                                            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                                                {Icon && <Icon className="w-7 h-7 group-hover:scale-110 transition-transform" />}
                                                {link.image && <img src={link.image} alt={link.text} loading="lazy" decoding="async" className="w-7 h-7 group-hover:scale-110 transition-transform" />}
                                                {link.className && <div className={link.className} style={{ width: '1.8rem', height: '1.8rem' }}></div>}
                                                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                                    {link.text}
                                                </span>
                                            </CardContent>
                                        </Card>
                                    </a>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom Links */}
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-foreground">
                                روابط مخصصة
                            </h3>
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
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3.5 sm:gap-4">
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
                                                    <Card className="h-full border-border bg-card ring-2 ring-primary/40 transition-all hover:shadow-lg">
                                                        <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                                                            {useFavicon ? (
                                                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-100 p-1 flex items-center justify-center border border-border/80 overflow-hidden shrink-0">
                                                                    <img
                                                                        src={faviconUrl}
                                                                        alt={link.name}
                                                                        className="w-6 h-6 object-contain"
                                                                        onError={(e) => {
                                                                            e.currentTarget.style.display = 'none';
                                                                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                                        }}
                                                                    />
                                                                    <Globe className="w-5 h-5 text-zinc-700 hidden" />
                                                                </div>
                                                            ) : (
                                                                <span className="text-2xl">{link.icon}</span>
                                                            )}
                                                            <span className="text-sm font-medium text-foreground line-clamp-2">
                                                                {link.name}
                                                            </span>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                            ) : safeUrl ? (
                                                <a
                                                    href={safeUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block h-full group"
                                                >
                                                    <Card className="h-full hover:shadow-lg transition-all border-border bg-card">
                                                        <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                                                            {useFavicon ? (
                                                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-100 p-1 flex items-center justify-center border border-border/80 overflow-hidden shrink-0">
                                                                    <img
                                                                        src={faviconUrl}
                                                                        alt={link.name}
                                                                        className="w-6 h-6 object-contain group-hover:scale-110 transition-transform"
                                                                        onError={(e) => {
                                                                            e.currentTarget.style.display = 'none';
                                                                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                                        }}
                                                                    />
                                                                    <Globe className="w-5 h-5 text-zinc-700 hidden group-hover:scale-110 transition-transform" />
                                                                </div>
                                                            ) : (
                                                                <span className="text-2xl">{link.icon}</span>
                                                            )}
                                                            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                                                                {link.name}
                                                            </span>
                                                        </CardContent>
                                                    </Card>
                                                </a>
                                            ) : (
                                                <div className="block h-full group opacity-60">
                                                    <Card className="h-full border-border bg-card">
                                                        <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                                                            <span className="text-sm font-medium text-foreground line-clamp-2">
                                                                {link.name}
                                                            </span>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                            )}

                                            {editMode && (
                                                <div className="absolute -top-2.5 -end-2.5 flex gap-1 z-20 opacity-100 pointer-events-auto">
                                                    <Button
                                                        variant="secondary"
                                                        size="icon"
                                                        className="h-7 w-7 rounded-full shadow-md bg-background border border-border hover:bg-accent text-foreground opacity-100"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setEditingLink(link);
                                                        }}
                                                        title="تعديل الرابط"
                                                    >
                                                        <Edit className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="icon"
                                                        className="h-7 w-7 rounded-full shadow-md opacity-100"
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
                </div>

                {/* Lazy-loaded Dialogs */}
                {settingsOpen && (
                    <React.Suspense fallback={null}>
                        <HomeSettingsDialog
                            open={settingsOpen}
                            onOpenChange={setSettingsOpen}
                            clockFormat={clockFormat}
                            setClockFormat={setClockFormat}
                            fontFamily={fontFamily}
                            setFontFamily={setFontFamily}
                            governorate={governorate}
                            setGovernorate={setGovernorate}
                            activeTheme={activeTheme}
                            applyTheme={applyTheme}
                            showClock={showClock}
                            setShowClock={setShowClock}
                            showWeather={showWeather}
                            setShowWeather={setShowWeather}
                            showPrayerTimes={showPrayerTimes}
                            setShowPrayerTimes={setShowPrayerTimes}
                            showEvents={showEvents}
                            setShowEvents={setShowEvents}
                            useCustomCoords={useCustomCoords}
                            setUseCustomCoords={setUseCustomCoords}
                            customLat={customLat}
                            setCustomLat={setCustomLat}
                            customLon={customLon}
                            setCustomLon={setCustomLon}
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
                            language="ar"
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
                            language="ar"
                        />
                    </React.Suspense>
                )}
            </div>
        </MainLayout>
    );
}


// Isolated Clock Widget (Updates time every second without re-rendering parent page) — Arabic only
const ClockWidget = React.memo(function ClockWidget({
    clockFormat
}: {
    clockFormat: '12' | '24';
}) {
    const [currentTime, setCurrentTime] = useState<Date | null>(null);

    useEffect(() => {
        setCurrentTime(new Date());
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date: Date | null) => {
        if (!date) return "--:--:--";
        if (clockFormat === '12') {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        }
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    };

    const formatDate = (date: Date | null) => {
        if (!date) return "";
        return date.toLocaleDateString('ar-SY', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatHijriDate = (date: Date | null) => {
        if (!date) return "";
        try {
            const formatter = new Intl.DateTimeFormat('ar-SY-u-ca-islamic-umalqura', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            const formatted = formatter.format(date);
            return formatted.includes('هـ') ? formatted : `${formatted} هـ`;
        } catch (e) {
            try {
                const formatter = new Intl.DateTimeFormat('ar-SY-u-ca-islamic', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
                const formatted = formatter.format(date);
                return formatted.includes('هـ') ? formatted : `${formatted} هـ`;
            } catch (err) {
                return "";
            }
        }
    };

    return (
        <div className="text-center justify-self-center">
            <div className="text-4xl md:text-6xl font-bold text-foreground mb-2">
                {formatTime(currentTime)}
            </div>
            <div className="text-sm text-muted-foreground flex flex-col items-center gap-1">
                <span>{formatDate(currentTime)}</span>
                {currentTime && (
                    <span className="text-xs text-primary/80 font-medium">
                        {formatHijriDate(currentTime)}
                    </span>
                )}
            </div>
        </div>
    );
});

// Isolated Next Prayer Widget (Updates countdown every second without re-rendering parent page) — Arabic only
const NextPrayerWidget = React.memo(function NextPrayerWidget({
    prayerTimes
}: {
    prayerTimes: Record<string, string> | null;
}) {
    const [currentTime, setCurrentTime] = useState<Date | null>(null);

    useEffect(() => {
        setCurrentTime(new Date());
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const nextPrayerInfo = useMemo(() => {
        if (!prayerTimes || !currentTime) return null;

        const events = [
            { key: 'Fajr', label: 'الفجر' },
            { key: 'Sunrise', label: 'الشروق' },
            { key: 'Dhuhr', label: 'الظهر' },
            { key: 'Asr', label: 'العصر' },
            { key: 'Maghrib', label: 'المغرب' },
            { key: 'Isha', label: 'العشاء' }
        ];

        const parsedEvents = events.map(ev => {
            const timeStr = prayerTimes[ev.key];
            if (!timeStr) return null;
            const [hours, minutes] = timeStr.split(':').map(Number);
            const eventTime = new Date(currentTime);
            eventTime.setHours(hours, minutes, 0, 0);
            return { ...ev, time: eventTime };
        }).filter(Boolean) as Array<{ key: string; label: string; time: Date }>;

        if (parsedEvents.length === 0) return null;

        parsedEvents.sort((a, b) => a.time.getTime() - b.time.getTime());

        const nextEventIndex = parsedEvents.findIndex(ev => ev.time > currentTime);

        if (nextEventIndex === -1) {
            const firstEvent = parsedEvents[0];
            const tomorrowFajr = new Date(firstEvent.time);
            tomorrowFajr.setDate(tomorrowFajr.getDate() + 1);

            return {
                key: firstEvent.key,
                label: firstEvent.label,
                timeStr: prayerTimes[firstEvent.key],
                timeDiffMs: tomorrowFajr.getTime() - currentTime.getTime()
            };
        } else {
            const nextEvent = parsedEvents[nextEventIndex];
            return {
                key: nextEvent.key,
                label: nextEvent.label,
                timeStr: prayerTimes[nextEvent.key],
                timeDiffMs: nextEvent.time.getTime() - currentTime.getTime()
            };
        }
    }, [prayerTimes, currentTime]);

    const getPrayerIcon = (key: string, className?: string) => {
        switch (key) {
            case 'Fajr': return <MoonStar className={className} />;
            case 'Sunrise': return <Sunrise className={className} />;
            case 'Dhuhr': return <Sun className={className} />;
            case 'Asr': return <SunDim className={className} />;
            case 'Maghrib': return <Sunset className={className} />;
            case 'Isha': return <Moon className={className} />;
            default: return <Clock className={className} />;
        }
    };

    const formatDuration = (ms: number) => {
        const totalSecs = Math.floor(ms / 1000);
        if (totalSecs < 0) return '00:00:00';
        const hours = Math.floor(totalSecs / 3600);
        const minutes = Math.floor((totalSecs % 3600) / 60);
        const seconds = totalSecs % 60;
        const pad = (num: number) => String(num).padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    };

    return (
        <Card className="w-full md:w-auto justify-self-stretch md:justify-self-end bg-card/40 backdrop-blur-sm border-border" dir="rtl">
            <CardContent className="p-3.5 flex items-center gap-3">
                {nextPrayerInfo ? (
                    <>
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            {getPrayerIcon(nextPrayerInfo.key, "w-5 h-5")}
                        </div>
                        <div className="flex flex-col">
                            <span dir="ltr" className="font-mono text-xs font-bold tabular-nums tracking-wider text-primary">
                                {formatDuration(nextPrayerInfo.timeDiffMs)}
                            </span>
                            <div className="flex items-baseline gap-1.5 mt-1 leading-none">
                                <span className="font-bold text-sm text-foreground">{nextPrayerInfo.label}</span>
                                <span className="text-[10px] text-muted-foreground font-semibold">({nextPrayerInfo.timeStr})</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-xs text-muted-foreground animate-pulse py-1 px-4">
                        جاري تحميل المواقيت...
                    </div>
                )}
            </CardContent>
        </Card>
    );
});
