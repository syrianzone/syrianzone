import React, { useState, useEffect, useMemo } from 'react';
import { Head, usePage } from '@inertiajs/react';
import {
    CheckCircle2, Palette, Users2, ListOrdered, Landmark, Compass,
    Settings, Sun, Link, Moon, Utensils, Globe, Plus, Edit, X, Download, Upload, RotateCcw,
    Cloud, CloudRain, CloudLightning, Snowflake, Wind, MessageSquareCode, Smartphone, Bus,
    Newspaper, Sliders, Calendar, Clock, Sunrise, Sunset, SunDim, MoonStar, Phone, Scale, Search, Shield, FileText, HelpCircle, MapPin, LayoutGrid
} from 'lucide-react';
import { Button } from "@/Components/ui/button";
import { ScrollArea } from "@/Components/ui/scroll-area";
import { Switch } from "@/Components/ui/switch";
import { Input } from "@/Components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { Card, CardContent } from "@/Components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/Components/ui/dialog";
import { Label } from "@/Components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { marked } from 'marked';

const GOVERNORATE_LIST = [
    { value: "damascus", nameAr: "دمشق", nameEn: "Damascus" },
    { value: "aleppo", nameAr: "حلب", nameEn: "Aleppo" },
    { value: "homs", nameAr: "حمص", nameEn: "Homs" },
    { value: "hama", nameAr: "حماة", nameEn: "Hama" },
    { value: "latakia", nameAr: "اللاذقية", nameEn: "Latakia" },
    { value: "tartus", nameAr: "طرطوس", nameEn: "Tartus" },
    { value: "deir-ez-zor", nameAr: "دير الزور", nameEn: "Deir ez-Zor" },
    { value: "idlib", nameAr: "إدلب", nameEn: "Idlib" },
    { value: "daraa", nameAr: "درعا", nameEn: "Daraa" },
    { value: "quneitra", nameAr: "القنيطرة", nameEn: "Quneitra" },
    { value: "sweida", nameAr: "السويداء", nameEn: "Sweida" },
    { value: "rural-damascus", nameAr: "ريف دمشق", nameEn: "Rural Damascus" },
    { value: "hasakah", nameAr: "الحسكة", nameEn: "Hasakah" },
    { value: "raqqa", nameAr: "الرقة", nameEn: "Raqqa" },
];
import MainLayout from '@/Layouts/MainLayout';
import { applyTheme as persistTheme, getThemePreference, resolveTheme, SYSTEM_THEME, THEME_REGISTRY, isDarkTheme } from '@/lib/theme';
import { ThemeToggle } from '@/Components/ThemeToggle';
import UserNav from '@/Components/UserNav';
import F3aliaEvents from '@/Components/F3aliaEvents';

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
    MishwarIcon,
    BoardIcon,
    RecipesIcon,
    NewsIcon,
    AnswersIcon,
    CodexCommunityIcon,
} from '@/Components/Icons/ProjectIcons';

interface CustomLink {
    id: string;
    name: string;
    url: string;
    icon?: string;
}

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
    { href: '/population', icon: PopulationIcon, text: 'أطلس', isInternal: true },
    { href: '/govapps', icon: GovAppsIcon, text: 'تطبيقات الحكومة', isInternal: true },
    { href: '/transit', icon: TransitIcon, text: 'ترانزيت', isInternal: true },
    { href: '/justice', icon: JusticeIcon, text: 'العدالة الانتقالية', isInternal: true },
    { href: '/mishwar', icon: MishwarIcon, text: 'مشوار', isInternal: true },
    { href: '/board', icon: BoardIcon, text: 'لوح', isInternal: true },
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



export default function Home({ aboutContent = '' }: { aboutContent?: string }) {
    const { props } = usePage<{ auth?: { user: { id: number; name: string; email: string; avatar_url: string; role: string; settings?: Record<string, any> | null } | null } }>();
    const user = props.auth?.user ?? null;
    const [aboutHtml, setAboutHtml] = useState('');

    useEffect(() => {
        const parseContent = async () => {
            if (aboutContent) {
                const html = await marked.parse(aboutContent);
                setAboutHtml(html);
            }
        };
        parseContent();
    }, [aboutContent]);

    const [theme, setTheme] = useState<string | null>(null);
    const [systemDark, setSystemDark] = useState(false);
    const [language, setLanguage] = useState<'ar' | 'en' | null>(null);
    const [searchEngine, setSearchEngine] = useState('duckduckgo');
    const [searchQuery, setSearchQuery] = useState('');
        const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);
    const [editingLink, setEditingLink] = useState<CustomLink | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [aboutOpen, setAboutOpen] = useState(false);
    const [addLinkOpen, setAddLinkOpen] = useState(false);
    const [govDropdownOpen, setGovDropdownOpen] = useState(false);
    const [govSearch, setGovSearch] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Weather & Clock state
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    const [weather, setWeather] = useState<any>(null);
    const [governorate, setGovernorate] = useState('damascus');
    const [clockFormat, setClockFormat] = useState<'12' | '24'>('24');
    const [prayerTimes, setPrayerTimes] = useState<Record<string, string> | null>(null);

    // Widget visibility states
    const [showClock, setShowClock] = useState(true);
    const [showWeather, setShowWeather] = useState(true);
    const [showPrayerTimes, setShowPrayerTimes] = useState(true);
    const [showEvents, setShowEvents] = useState(true);
    const [showSearch, setShowSearch] = useState(true);

    // Custom coordinates states
    const [useCustomCoords, setUseCustomCoords] = useState(false);
    const [customLat, setCustomLat] = useState('');
    const [customLon, setCustomLon] = useState('');

    // Custom search engine URL state
    const [customSearchUrl, setCustomSearchUrl] = useState('');

    const saveAccountSettings = async (partialSettings: Record<string, any>) => {
        if (!user) return;
        try {
            await fetch('/api/user/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || ''
                },
                body: JSON.stringify({ settings: partialSettings })
            });
        } catch (e) {
            console.error('Failed to save settings to account', e);
        }
    };

    // Load settings from localStorage
    useEffect(() => {
        const accSettings = user?.settings || {};

        const savedTheme = accSettings.theme ?? getThemePreference();
        const savedLang = (accSettings.language ?? (localStorage.getItem('sz-language') || 'ar')) as 'ar' | 'en';
        const savedGovernorate = accSettings.governorate ?? (localStorage.getItem('governorate') || 'damascus');
        const savedClockFormat = (accSettings.clockFormat ?? (localStorage.getItem('clockFormat') || '24')) as '12' | '24';
        const savedSearchEngine = accSettings.searchEngine ?? (localStorage.getItem('sz-searchEngine') || 'duckduckgo');

        const savedShowClock = accSettings.showClock ?? (localStorage.getItem('sz-showClock') !== 'false');
        const savedShowWeather = accSettings.showWeather ?? (localStorage.getItem('sz-showWeather') !== 'false');
        const savedShowPrayerTimes = accSettings.showPrayerTimes ?? (localStorage.getItem('sz-showPrayerTimes') !== 'false');
        const savedShowEvents = accSettings.showEvents ?? (localStorage.getItem('sz-showEvents') !== 'false');
        const savedShowSearch = accSettings.showSearch ?? (localStorage.getItem('sz-showSearch') !== 'false');

        const savedUseCustomCoords = accSettings.useCustomCoords ?? (localStorage.getItem('useCustomCoords') === 'true');
        const savedCustomLat = accSettings.customLat ?? (localStorage.getItem('customLat') || '');
        const savedCustomLon = accSettings.customLon ?? (localStorage.getItem('customLon') || '');
        const savedCustomSearchUrl = accSettings.customSearchUrl ?? (localStorage.getItem('customSearchUrl') || '');

        let parsedLinks: CustomLink[] = [];
        if (accSettings.customLinks) {
            parsedLinks = accSettings.customLinks;
        } else {
            const savedLinks = localStorage.getItem('customLinks');
            if (savedLinks) {
                try { parsedLinks = JSON.parse(savedLinks); } catch (e) { console.error(e); }
            }
        }

        // Sync to localStorage
        if (savedTheme) persistTheme(savedTheme);
        localStorage.setItem('sz-language', savedLang);
        localStorage.setItem('governorate', savedGovernorate);
        localStorage.setItem('clockFormat', savedClockFormat);
        localStorage.setItem('sz-searchEngine', savedSearchEngine);
        localStorage.setItem('sz-showClock', String(savedShowClock));
        localStorage.setItem('sz-showWeather', String(savedShowWeather));
        localStorage.setItem('sz-showPrayerTimes', String(savedShowPrayerTimes));
        localStorage.setItem('sz-showEvents', String(savedShowEvents));
        localStorage.setItem('sz-showSearch', String(savedShowSearch));
        localStorage.setItem('useCustomCoords', String(savedUseCustomCoords));
        localStorage.setItem('customLat', savedCustomLat);
        localStorage.setItem('customLon', savedCustomLon);
        localStorage.setItem('customSearchUrl', savedCustomSearchUrl);
        localStorage.setItem('customLinks', JSON.stringify(parsedLinks));

        setTheme(savedTheme);
        setLanguage(savedLang);
        setGovernorate(savedGovernorate);
        setClockFormat(savedClockFormat);
        setSearchEngine(savedSearchEngine);
        setShowClock(savedShowClock);
        setShowWeather(savedShowWeather);
        setShowPrayerTimes(savedShowPrayerTimes);
        setShowEvents(savedShowEvents);
        setShowSearch(savedShowSearch);
        setUseCustomCoords(savedUseCustomCoords);
        setCustomLat(savedCustomLat);
        setCustomLon(savedCustomLon);
        setCustomSearchUrl(savedCustomSearchUrl);
        setCustomLinks(parsedLinks);

        // If user logged in and has missing account settings, sync initial state to DB
        if (user && Object.keys(accSettings).length === 0) {
            saveAccountSettings({
                theme: savedTheme,
                language: savedLang,
                governorate: savedGovernorate,
                clockFormat: savedClockFormat,
                searchEngine: savedSearchEngine,
                showClock: savedShowClock,
                showWeather: savedShowWeather,
                showPrayerTimes: savedShowPrayerTimes,
                showEvents: savedShowEvents,
                showSearch: savedShowSearch,
                useCustomCoords: savedUseCustomCoords,
                customLat: savedCustomLat,
                customLon: savedCustomLon,
                customSearchUrl: savedCustomSearchUrl,
                customLinks: parsedLinks,
            });
        }

        document.documentElement.setAttribute('data-theme', resolveTheme(savedTheme));
        setMounted(true);
        setCurrentTime(new Date());
    }, []);

    // Track the device scheme so system-resolved UI (logo, sun/moon icon) stays in sync
    useEffect(() => {
        const query = window.matchMedia('(prefers-color-scheme: dark)');
        setSystemDark(query.matches);
        const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    }, []);

    // Clock update
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
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
                const coords = hasCustom
                    ? { lat: parseFloat(customLat), lon: parseFloat(customLon) }
                    : (GOVERNORATES[governorate] || GOVERNORATES['damascus']);

                if (isNaN(coords.lat) || isNaN(coords.lon)) return;

                const response = await fetch(`/api/weather?lat=${coords.lat}&lon=${coords.lon}`);
                if (!response.ok) throw new Error('Weather fetch failed');
                const data = await response.json();

                let description = data.weather[0].description;
                if (language === 'ar' && WEATHER_TRANSLATIONS[description]) {
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
    }, [governorate, useCustomCoords, customLat, customLon, language, mounted, showWeather]);

    // Fetch prayer times for the upcoming prayer widget
    useEffect(() => {
        const fetchPrayers = async () => {
            try {
                const hasCustom = useCustomCoords && customLat && customLon;
                const coords = hasCustom
                    ? { lat: parseFloat(customLat), lon: parseFloat(customLon) }
                    : (GOVERNORATES[governorate] || GOVERNORATES['damascus']);

                if (isNaN(coords.lat) || isNaN(coords.lon)) return;

                const now = new Date();
                const day = String(now.getDate()).padStart(2, '0');
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const year = now.getFullYear();
                const dateStr = `${day}-${month}-${year}`;

                // Method 3: Muslim World League (Syrian standard)
                const response = await fetch(`https://api.aladhan.com/v1/timings/${dateStr}?latitude=${coords.lat}&longitude=${coords.lon}&method=3`);
                if (!response.ok) throw new Error('Prayer times fetch failed');
                const data = await response.json();
                if (data.code === 200 && data.data) {
                    setPrayerTimes(data.data.timings);
                }
            } catch (e) {
                console.error(e);
            }
        };

        if (mounted && showPrayerTimes) {
            fetchPrayers();
        }
    }, [governorate, useCustomCoords, customLat, customLon, mounted, showPrayerTimes]);

    // Calculate upcoming prayer in Home.tsx
    const nextPrayerInfo = useMemo(() => {
        if (!prayerTimes || !currentTime) return null;

        const events = [
            { key: 'Fajr', labelAr: 'الفجر', labelEn: 'Fajr' },
            { key: 'Sunrise', labelAr: 'الشروق', labelEn: 'Sunrise' },
            { key: 'Dhuhr', labelAr: 'الظهر', labelEn: 'Dhuhr' },
            { key: 'Asr', labelAr: 'العصر', labelEn: 'Asr' },
            { key: 'Maghrib', labelAr: 'المغرب', labelEn: 'Maghrib' },
            { key: 'Isha', labelAr: 'العشاء', labelEn: 'Isha' }
        ];

        const parsedEvents = events.map(ev => {
            const timeStr = prayerTimes[ev.key];
            if (!timeStr) return null;
            const [hours, minutes] = timeStr.split(':').map(Number);
            const eventTime = new Date(currentTime);
            eventTime.setHours(hours, minutes, 0, 0);
            return { ...ev, time: eventTime };
        }).filter(Boolean) as Array<{ key: string; labelAr: string; labelEn: string; time: Date }>;

        if (parsedEvents.length === 0) return null;

        // Sort chronologically
        parsedEvents.sort((a, b) => a.time.getTime() - b.time.getTime());

        const nextEventIndex = parsedEvents.findIndex(ev => ev.time > currentTime);
        const currentLang = language || 'ar';

        if (nextEventIndex === -1) {
            // Next is Fajr tomorrow
            const firstEvent = parsedEvents[0];
            const tomorrowFajr = new Date(firstEvent.time);
            tomorrowFajr.setDate(tomorrowFajr.getDate() + 1);

            return {
                key: firstEvent.key,
                label: currentLang === 'ar' ? firstEvent.labelAr : firstEvent.labelEn,
                timeStr: prayerTimes[firstEvent.key],
                timeDiffMs: tomorrowFajr.getTime() - currentTime.getTime()
            };
        } else {
            const nextEvent = parsedEvents[nextEventIndex];
            return {
                key: nextEvent.key,
                label: currentLang === 'ar' ? nextEvent.labelAr : nextEvent.labelEn,
                timeStr: prayerTimes[nextEvent.key],
                timeDiffMs: nextEvent.time.getTime() - currentTime.getTime()
            };
        }
    }, [prayerTimes, currentTime, language]);

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

    const getDeviceLocation = () => {
        const currentLang = language || 'ar';
        if (!navigator.geolocation) {
            alert(currentLang === 'ar' ? 'متصفحك لا يدعم تحديد الموقع الجغرافي' : 'Geolocation is not supported by your browser');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude.toFixed(4);
                const lon = position.coords.longitude.toFixed(4);
                setCustomLat(lat);
                setCustomLon(lon);
                setUseCustomCoords(true);
                localStorage.setItem('customLat', lat);
                localStorage.setItem('customLon', lon);
                localStorage.setItem('useCustomCoords', 'true');
                saveAccountSettings({ customLat: lat, customLon: lon, useCustomCoords: true });
            },
            (error) => {
                console.error(error);
                alert(currentLang === 'ar' ? 'فشل الحصول على الموقع الجغرافي. تأكد من تفعيل الـ GPS وإعطاء الصلاحية.' : 'Failed to retrieve location. Please check your GPS settings and permissions.');
            }
        );
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        const searchUrls: Record<string, string> = {
            duckduckgo: `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`,
            google: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
            bing: `https://www.bing.com/search?q=${encodeURIComponent(searchQuery)}`,
            searx: `https://searx.be/search?q=${encodeURIComponent(searchQuery)}`,
        };

        let url = searchUrls[searchEngine] || searchUrls.duckduckgo;
        if (searchEngine === 'custom' && customSearchUrl) {
            if (customSearchUrl.includes('%s')) {
                url = customSearchUrl.replace('%s', encodeURIComponent(searchQuery));
            } else {
                url = `${customSearchUrl}${encodeURIComponent(searchQuery)}`;
            }
        }

        window.open(url, '_blank');
        setSearchQuery('');
    };

    const applyTheme = (newTheme: string) => {
        setTheme(newTheme);
        persistTheme(newTheme);
        saveAccountSettings({ theme: newTheme });
    };



    const toggleLanguage = () => {
        const newLang = language === 'ar' ? 'en' : 'ar';
        setLanguage(newLang);
        localStorage.setItem('sz-language', newLang);
        saveAccountSettings({ language: newLang });
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

    const formatTime = (date: Date | null) => {
        if (!date) return "--:--:--";
        if (clockFormat === '12') {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        }
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    };

    const formatDate = (date: Date | null) => {
        if (!date) return "";
        return date.toLocaleDateString(language === 'ar' ? 'ar-SY' : 'en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatHijriDate = (date: Date | null) => {
        if (!date) return "";
        try {
            const formatter = new Intl.DateTimeFormat(language === 'ar' ? 'ar-SY-u-ca-islamic-umalqura' : 'en-US-u-ca-islamic-umalqura', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            const formatted = formatter.format(date);
            if (language === 'ar') {
                return formatted.includes('هـ') ? formatted : `${formatted} هـ`;
            } else {
                return formatted.includes('AH') ? formatted : `${formatted} AH`;
            }
        } catch (e) {
            console.error('Intl Hijri format error', e);
            try {
                const formatter = new Intl.DateTimeFormat(language === 'ar' ? 'ar-SY-u-ca-islamic' : 'en-US-u-ca-islamic', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
                const formatted = formatter.format(date);
                if (language === 'ar') {
                    return formatted.includes('هـ') ? formatted : `${formatted} هـ`;
                } else {
                    return formatted.includes('AH') ? formatted : `${formatted} AH`;
                }
            } catch (err) {
                return "";
            }
        }
    };

    if (!mounted) return null;

    const currentLang = language || 'ar';
    const activeTheme = theme || SYSTEM_THEME;
    const isDark = isDarkTheme(activeTheme, systemDark);

    return (
        <MainLayout>
            <Head>
                <title>الرئيسية</title>
                <meta name="description" content="المساحة السورية - منصة تفاعلية تجمع وتوفر الموارد والخدمات والمعلومات المفتوحة المتعلقة بالشأن السوري من استطلاعات رأي، وأدلة رسمية، وأطلس، وترانزيت، وهويات بصرية." />
            </Head>
            <div className="min-h-screen text-foreground transition-colors" dir={currentLang === 'ar' ? 'rtl' : 'ltr'}>
                {/* Top Controls */}
                <div className="fixed top-4 left-4 right-4 flex justify-between items-center z-50">
                    <Button variant="ghost" size="sm" onClick={() => setAboutOpen(true)}>
                        {currentLang === 'ar' ? 'حول' : 'About'}
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
                        <Button variant="ghost" size="icon" onClick={toggleLanguage}>
                            <img src={`/assets/${currentLang}.svg`} alt={currentLang} className="w-5 h-5" />
                        </Button>
                        <ThemeToggle />
                        <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
                            <Settings className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="container mx-auto px-4 pt-20 pb-12 max-w-6xl">
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
                            ) : <div />}

                            {/* Next Prayer Widget */}
                            {showPrayerTimes ? (
                                <Card className="w-full md:w-auto justify-self-stretch md:justify-self-end bg-card/40 backdrop-blur-sm border-border" dir={currentLang === 'ar' ? 'rtl' : 'ltr'}>
                                    <CardContent className="p-3.5 flex items-center gap-3">
                                        {nextPrayerInfo ? (
                                            <>
                                                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                                    {getPrayerIcon(nextPrayerInfo.key, "w-5 h-5")}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-muted-foreground font-medium leading-none">
                                                        {currentLang === 'ar' ? 'الصلاة القادمة' : 'Next Prayer'}
                                                    </span>
                                                    <div className="flex items-baseline gap-1.5 mt-1 leading-none">
                                                        <span className="font-bold text-sm text-foreground">{nextPrayerInfo.label}</span>
                                                        <span className="text-[10px] text-muted-foreground font-semibold">({nextPrayerInfo.timeStr})</span>
                                                    </div>
                                                </div>
                                                <div className="ms-auto ps-2 border-s border-border/80 font-mono text-xs text-primary font-bold tracking-wider">
                                                    {formatDuration(nextPrayerInfo.timeDiffMs)}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-xs text-muted-foreground animate-pulse py-1 px-4">
                                                {currentLang === 'ar' ? 'جاري تحميل المواقيت...' : 'Loading times...'}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
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

                    {/* Search */}
                    {showSearch && (
                        <div className="max-w-2xl mx-auto mb-16 px-4">
                            <form onSubmit={handleSearch} className="w-full">
                                <div className="relative flex items-center w-full h-12 rounded-full border border-input bg-card/45 backdrop-blur-sm px-4 py-1.5 shadow-sm focus-within:ring-1 focus-within:ring-ring transition-all">
                                    {/* Search Icon */}
                                    <Search className="h-5 w-5 text-muted-foreground shrink-0 ms-1" />

                                    {/* Text Input */}
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={currentLang === 'ar' ? 'ابحث في الويب...' : 'Search the web...'}
                                        className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground w-full min-w-0"
                                    />

                                    {/* Divider */}
                                    <div className="h-6 w-[1px] bg-border mx-2 shrink-0" />

                                    {/* Dropdown Selection */}
                                    <Select value={searchEngine} onValueChange={(val) => {
                                        setSearchEngine(val);
                                        localStorage.setItem('sz-searchEngine', val);
                                        saveAccountSettings({ searchEngine: val });
                                    }}>
                                        <SelectTrigger className="w-[110px] border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 px-2 h-auto text-xs font-bold text-muted-foreground hover:text-foreground shrink-0 gap-1.5 cursor-pointer">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent align="end" className="w-[140px]" dir={currentLang === 'ar' ? 'rtl' : 'ltr'}>
                                            <SelectItem value="duckduckgo">DuckDuckGo</SelectItem>
                                            <SelectItem value="searx">SearX</SelectItem>
                                            <SelectItem value="google">Google</SelectItem>
                                            <SelectItem value="bing">Bing</SelectItem>
                                            <SelectItem value="custom">{currentLang === 'ar' ? 'مخصص' : 'Custom'}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* F3alia Events integration */}
                    {showEvents && (
                        <F3aliaEvents governorate={governorate} language={currentLang} variant="single" />
                    )}

                    {/* Internal Syrian Zone Tools */}
                    <div className="mb-12">
                        <h3 className="text-xl font-bold text-foreground mb-6 text-start">
                            {language === 'ar' ? 'أدوات المساحة السورية' : 'Syrian Zone Tools'}
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
                                                {link.image && <img src={link.image} alt={link.text} className="w-7 h-7 group-hover:scale-110 transition-transform" />}
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
                            {language === 'ar' ? 'روابط خارجية وشقيقة' : 'External & Sister Links'}
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
                                                {link.image && <img src={link.image} alt={link.text} className="w-7 h-7 group-hover:scale-110 transition-transform" />}
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
                                {language === 'ar' ? 'روابط مخصصة' : 'Custom Links'}
                            </h3>
                            <div className="flex gap-2">
                                <Button
                                    variant={editMode ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setEditMode(!editMode)}
                                    className={editMode ? "" : "bg-muted text-foreground border-border hover:bg-accent"}
                                >
                                    <Edit className="w-4 h-4 me-2" />
                                    {language === 'ar' ? (editMode ? 'تم' : 'تعديل') : (editMode ? 'Done' : 'Edit')}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setAddLinkOpen(true)}
                                    className="bg-muted text-foreground border-border hover:bg-accent"
                                >
                                    <Plus className="w-4 h-4 me-2" />
                                    {language === 'ar' ? 'إضافة' : 'Add'}
                                </Button>
                            </div>
                        </div>

                        {customLinks.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3.5 sm:gap-4">
                                {customLinks.map((link) => {
                                    const useFavicon = !link.icon || link.icon === '🔗';
                                    const faviconUrl = getFaviconUrl(link.url);

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
                                            ) : (
                                                <a
                                                    href={link.url}
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
                                                        title={currentLang === 'ar' ? 'تعديل الرابط' : 'Edit link'}
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
                                                        title={currentLang === 'ar' ? 'حذف الرابط' : 'Remove link'}
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
                                        {language === 'ar' ? 'لا توجد روابط مخصصة' : 'No custom links yet'}
                                    </p>
                                    <Button
                                        variant="outline"
                                        onClick={() => setAddLinkOpen(true)}
                                        className="bg-muted text-foreground border-border hover:bg-accent"
                                    >
                                        <Plus className="w-4 h-4 me-2" />
                                        {language === 'ar' ? 'إضافة رابط' : 'Add Link'}
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>

                {/* Settings Dialog */}
                <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                    <DialogContent className="max-w-2xl md:max-w-3xl max-h-[85vh] flex flex-col p-0" dir={currentLang === 'ar' ? 'rtl' : 'ltr'}>
                        <DialogHeader className="px-6 pt-6 pb-2 text-start sm:text-start">
                            <DialogTitle>{currentLang === 'ar' ? 'الإعدادات' : 'Settings'}</DialogTitle>
                        </DialogHeader>

                        <Tabs defaultValue="simple" dir={currentLang === 'ar' ? 'rtl' : 'ltr'} className="w-full flex-1 flex flex-col min-h-0">
                            <div className="px-6 border-b">
                                <TabsList className="w-full justify-start rounded-none border-b-0 bg-transparent p-0 h-10 gap-6" dir={currentLang === 'ar' ? 'rtl' : 'ltr'}>
                                    <TabsTrigger
                                        value="simple"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-3 pt-2 text-sm font-semibold cursor-pointer"
                                    >
                                        {currentLang === 'ar' ? 'عام' : 'General'}
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="advanced"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-3 pt-2 text-sm font-semibold cursor-pointer"
                                    >
                                        {currentLang === 'ar' ? 'خيارات متقدمة' : 'Advanced'}
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="flex-1 min-h-0">
                                <TabsContent value="simple" className="h-full m-0">
                                    <ScrollArea className="h-[450px] max-h-[50vh] px-6 pb-6" dir={currentLang === 'ar' ? 'rtl' : 'ltr'}>
                                        <div className="space-y-6 py-4 text-start">
                                            {/* Row with Language & Clock segmented controls */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {/* Language Selection */}
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{currentLang === 'ar' ? 'اللغة' : 'Language'}</Label>
                                                    <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg border border-border/50">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setLanguage('ar');
                                                                localStorage.setItem('sz-language', 'ar');
                                                                saveAccountSettings({ language: 'ar' });
                                                            }}
                                                            className={`py-1.5 text-xs font-medium rounded-md transition-all ${currentLang === 'ar'
                                                                    ? 'bg-background text-foreground shadow-sm'
                                                                    : 'text-muted-foreground hover:text-foreground'
                                                                }`}
                                                        >
                                                            العربية
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setLanguage('en');
                                                                localStorage.setItem('sz-language', 'en');
                                                                saveAccountSettings({ language: 'en' });
                                                            }}
                                                            className={`py-1.5 text-xs font-medium rounded-md transition-all ${currentLang === 'en'
                                                                    ? 'bg-background text-foreground shadow-sm'
                                                                    : 'text-muted-foreground hover:text-foreground'
                                                                }`}
                                                        >
                                                            English
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Clock Format Selection */}
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{currentLang === 'ar' ? 'تنسيق الوقت' : 'Time Format'}</Label>
                                                    <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg border border-border/50">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setClockFormat('12');
                                                                localStorage.setItem('clockFormat', '12');
                                                                saveAccountSettings({ clockFormat: '12' });
                                                            }}
                                                            className={`py-1.5 text-xs font-medium rounded-md transition-all ${clockFormat === '12'
                                                                    ? 'bg-background text-foreground shadow-sm'
                                                                    : 'text-muted-foreground hover:text-foreground'
                                                                }`}
                                                        >
                                                            {currentLang === 'ar' ? '12 ساعة' : '12-Hour'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setClockFormat('24');
                                                                localStorage.setItem('clockFormat', '24');
                                                                saveAccountSettings({ clockFormat: '24' });
                                                            }}
                                                            className={`py-1.5 text-xs font-medium rounded-md transition-all ${clockFormat === '24'
                                                                    ? 'bg-background text-foreground shadow-sm'
                                                                    : 'text-muted-foreground hover:text-foreground'
                                                                }`}
                                                        >
                                                            {currentLang === 'ar' ? '24 ساعة' : '24-Hour'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Governorate dropdown with search */}
                                            <div className="space-y-2 relative">
                                                <Label className="text-sm font-semibold">{currentLang === 'ar' ? 'المحافظة الافتراضية' : 'Default Governorate'}</Label>
                                                <button
                                                    type="button"
                                                    onClick={() => setGovDropdownOpen(!govDropdownOpen)}
                                                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-start"
                                                >
                                                    <span>
                                                        {(() => {
                                                            const activeGov = GOVERNORATE_LIST.find(g => g.value === governorate);
                                                            return activeGov ? (currentLang === 'ar' ? `${activeGov.nameAr} / ${activeGov.nameEn}` : `${activeGov.nameEn} / ${activeGov.nameAr}`) : (currentLang === 'ar' ? 'اختر محافظة...' : 'Select governorate...');
                                                        })()}
                                                    </span>
                                                    <span className="text-muted-foreground text-xs">▼</span>
                                                </button>

                                                {govDropdownOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => { setGovDropdownOpen(false); setGovSearch(''); }} />
                                                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-80">
                                                            <div className="flex items-center border-b px-3">
                                                                <Search className="h-4 w-4 shrink-0 opacity-50 me-2" />
                                                                <input
                                                                    type="text"
                                                                    value={govSearch}
                                                                    onChange={(e) => setGovSearch(e.target.value)}
                                                                    placeholder={currentLang === 'ar' ? 'ابحث عن محافظة...' : 'Search governorate...'}
                                                                    className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                                                />
                                                            </div>
                                                            <div className="max-h-[200px] overflow-y-auto p-1">
                                                                {(() => {
                                                                    const filtered = GOVERNORATE_LIST.filter(g =>
                                                                        g.nameAr.includes(govSearch) ||
                                                                        g.nameEn.toLowerCase().includes(govSearch.toLowerCase())
                                                                    );

                                                                    if (filtered.length === 0) {
                                                                        return <div className="py-6 text-center text-sm text-muted-foreground">{currentLang === 'ar' ? 'لم يتم العثور على نتائج' : 'No results found.'}</div>;
                                                                    }

                                                                    return filtered.map((g) => {
                                                                        const isSelected = g.value === governorate;
                                                                        return (
                                                                            <button
                                                                                type="button"
                                                                                key={g.value}
                                                                                onClick={() => {
                                                                                    setGovernorate(g.value);
                                                                                    localStorage.setItem('governorate', g.value);
                                                                                    saveAccountSettings({ governorate: g.value });
                                                                                    setGovDropdownOpen(false);
                                                                                    setGovSearch('');
                                                                                }}
                                                                                className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer text-start ${isSelected ? 'bg-accent/50 font-semibold' : ''}`}
                                                                            >
                                                                                <span>{currentLang === 'ar' ? `${g.nameAr} / ${g.nameEn}` : `${g.nameEn} / ${g.nameAr}`}</span>
                                                                                {isSelected && <span className="text-primary text-xs">✓</span>}
                                                                            </button>
                                                                        );
                                                                    });
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {/* Theme Settings */}
                                            <div className="space-y-4 pt-2">
                                                <h4 className="font-semibold text-foreground text-sm">
                                                    {currentLang === 'ar' ? 'إعدادات المظهر' : 'Theme Settings'}
                                                </h4>

                                                <div className="space-y-2">
                                                    {/* Standard themes list */}
                                                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pt-1">
                                                        {currentLang === 'ar' ? 'المظاهر الأساسية' : 'Standard'}
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {THEME_REGISTRY.filter(t => t.group === 'standard' || t.group === 'system').map((t) => {
                                                            const isActive = activeTheme === t.id;
                                                            return (
                                                                <button
                                                                    key={t.id}
                                                                    type="button"
                                                                    onClick={() => applyTheme(t.id)}
                                                                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:scale-[1.01] focus:outline-none w-full border text-start"
                                                                    style={{
                                                                        background: isActive ? t.primary + '1a' : 'hsl(var(--muted))',
                                                                        border: isActive ? `2px solid ${t.primary}` : '2px solid transparent',
                                                                    }}
                                                                >
                                                                    <div
                                                                        className="w-6 h-6 rounded-full flex-shrink-0 overflow-hidden shadow-sm"
                                                                        style={{ background: t.bg, border: `2px solid ${t.primary}` }}
                                                                    >
                                                                        <div style={{ background: t.primary, height: '50%', marginTop: '50%' }} />
                                                                    </div>
                                                                    <span className="text-xs font-medium truncate" style={{ color: isActive ? t.primary : 'hsl(var(--foreground))' }}>
                                                                        {t.emoji} {currentLang === 'ar' ? t.nameAr : t.nameEn}
                                                                    </span>
                                                                    {isActive && (
                                                                        <span className="ms-auto text-xs" style={{ color: t.primary }}>✓</span>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Syrian Heritage themes list */}
                                                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pt-3">
                                                        {currentLang === 'ar' ? 'التراث السوري' : 'Syrian Heritage'}
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {THEME_REGISTRY.filter(t => t.group === 'heritage').map((t) => {
                                                            const isActive = activeTheme === t.id;
                                                            return (
                                                                <button
                                                                    key={t.id}
                                                                    type="button"
                                                                    onClick={() => applyTheme(t.id)}
                                                                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:scale-[1.01] focus:outline-none w-full border text-start"
                                                                    style={{
                                                                        background: isActive ? t.primary + '1a' : 'hsl(var(--muted))',
                                                                        border: isActive ? `2px solid ${t.primary}` : '2px solid transparent',
                                                                    }}
                                                                >
                                                                    <div
                                                                        className="w-6 h-6 rounded-full flex-shrink-0 overflow-hidden shadow-sm"
                                                                        style={{ background: t.bg, border: `2px solid ${t.primary}` }}
                                                                    >
                                                                        <div style={{ background: t.primary, height: '50%', marginTop: '50%' }} />
                                                                    </div>
                                                                    <span className="text-xs font-medium truncate" style={{ color: isActive ? t.primary : 'hsl(var(--foreground))' }}>
                                                                        {t.emoji} {currentLang === 'ar' ? t.nameAr : t.nameEn}
                                                                    </span>
                                                                    {isActive && (
                                                                        <span className="ms-auto text-xs" style={{ color: t.primary }}>✓</span>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </TabsContent>

                                <TabsContent value="advanced" className="h-full m-0">
                                    <ScrollArea className="h-[450px] max-h-[50vh] px-6 pb-6" dir={currentLang === 'ar' ? 'rtl' : 'ltr'}>
                                        <div className="space-y-6 py-4 text-start">
                                            {/* Widget visibility toggles */}
                                            <div className="space-y-4">
                                                <h4 className="font-semibold text-foreground text-sm">
                                                    {currentLang === 'ar' ? 'عرض وإخفاء الودجات' : 'Widget Visibility'}
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {/* Toggle Clock */}
                                                    <div className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-card/20">
                                                        <span className="text-xs font-medium text-foreground">{currentLang === 'ar' ? 'الساعة' : 'Clock'}</span>
                                                        <Switch
                                                            checked={showClock}
                                                            onCheckedChange={(checked) => {
                                                                setShowClock(checked);
                                                                localStorage.setItem('sz-showClock', String(checked));
                                                                saveAccountSettings({ showClock: checked });
                                                            }}
                                                        />
                                                    </div>
                                                    {/* Toggle Weather */}
                                                    <div className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-card/20">
                                                        <span className="text-xs font-medium text-foreground">{currentLang === 'ar' ? 'الطقس' : 'Weather'}</span>
                                                        <Switch
                                                            checked={showWeather}
                                                            onCheckedChange={(checked) => {
                                                                setShowWeather(checked);
                                                                localStorage.setItem('sz-showWeather', String(checked));
                                                                saveAccountSettings({ showWeather: checked });
                                                            }}
                                                        />
                                                    </div>
                                                    {/* Toggle Prayer Times */}
                                                    <div className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-card/20">
                                                        <span className="text-xs font-medium text-foreground">{currentLang === 'ar' ? 'مواقيت الصلاة' : 'Prayer Times'}</span>
                                                        <Switch
                                                            checked={showPrayerTimes}
                                                            onCheckedChange={(checked) => {
                                                                setShowPrayerTimes(checked);
                                                                localStorage.setItem('sz-showPrayerTimes', String(checked));
                                                                saveAccountSettings({ showPrayerTimes: checked });
                                                            }}
                                                        />
                                                    </div>
                                                    {/* Toggle Events */}
                                                    <div className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-card/20">
                                                        <span className="text-xs font-medium text-foreground">{currentLang === 'ar' ? 'الفعاليات والأحداث' : 'Events Widget'}</span>
                                                        <Switch
                                                            checked={showEvents}
                                                            onCheckedChange={(checked) => {
                                                                setShowEvents(checked);
                                                                localStorage.setItem('sz-showEvents', String(checked));
                                                                saveAccountSettings({ showEvents: checked });
                                                            }}
                                                        />
                                                    </div>
                                                    {/* Toggle Search */}
                                                    <div className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-card/20 flex-1 col-span-1 sm:col-span-2">
                                                        <span className="text-xs font-medium text-foreground">{currentLang === 'ar' ? 'شريط البحث' : 'Search Bar'}</span>
                                                        <Switch
                                                            checked={showSearch}
                                                            onCheckedChange={(checked) => {
                                                                setShowSearch(checked);
                                                                localStorage.setItem('sz-showSearch', String(checked));
                                                                saveAccountSettings({ showSearch: checked });
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="h-[1px] bg-border w-full" />

                                            {/* Custom Coordinates Section */}
                                            <div className="space-y-4 pt-2">
                                                <h4 className="font-semibold text-foreground text-sm">
                                                    {currentLang === 'ar' ? 'إحداثيات جغرافية مخصصة' : 'Custom Location Coordinates'}
                                                </h4>
                                                <p className="text-xs text-muted-foreground leading-normal">
                                                    {currentLang === 'ar'
                                                        ? 'استخدم إحداثيات مخصصة بدلاً من موقع المحافظة الافتراضي لجلب الطقس ومواقيت الصلاة بشكل دقيق للغاية.'
                                                        : 'Set custom GPS coordinates to fetch local weather and prayer times with high precision.'}
                                                </p>

                                                <div className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-card/20">
                                                    <span className="text-xs font-medium text-foreground">{currentLang === 'ar' ? 'تفعيل الإحداثيات المخصصة' : 'Use Custom Coordinates'}</span>
                                                    <Switch
                                                        checked={useCustomCoords}
                                                        onCheckedChange={(checked) => {
                                                            setUseCustomCoords(checked);
                                                            localStorage.setItem('useCustomCoords', String(checked));
                                                            saveAccountSettings({ useCustomCoords: checked });
                                                        }}
                                                    />
                                                </div>

                                                {useCustomCoords && (
                                                    <div className="space-y-3 p-3 rounded-lg border border-border bg-card/10">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="space-y-1 text-start">
                                                                <Label className="text-xs">{currentLang === 'ar' ? 'خط العرض (Lat)' : 'Latitude'}</Label>
                                                                <Input
                                                                    type="text"
                                                                    value={customLat}
                                                                    onChange={(e) => {
                                                                        setCustomLat(e.target.value);
                                                                        localStorage.setItem('customLat', e.target.value);
                                                                        saveAccountSettings({ customLat: e.target.value });
                                                                    }}
                                                                    placeholder="33.5138"
                                                                />
                                                            </div>
                                                            <div className="space-y-1 text-start">
                                                                <Label className="text-xs">{currentLang === 'ar' ? 'خط الطول (Lon)' : 'Longitude'}</Label>
                                                                <Input
                                                                    type="text"
                                                                    value={customLon}
                                                                    onChange={(e) => {
                                                                        setCustomLon(e.target.value);
                                                                        localStorage.setItem('customLon', e.target.value);
                                                                        saveAccountSettings({ customLon: e.target.value });
                                                                    }}
                                                                    placeholder="36.2765"
                                                                />
                                                            </div>
                                                        </div>

                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full text-xs cursor-pointer flex items-center justify-center gap-1.5"
                                                            onClick={getDeviceLocation}
                                                        >
                                                            <Compass className="w-3.5 h-3.5" />
                                                            {currentLang === 'ar' ? 'الحصول على إحداثيات موقعي الحالي' : 'Get coordinates from device'}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="h-[1px] bg-border w-full" />

                                            {/* Custom Search Engine Section */}
                                            <div className="space-y-4 pt-2">
                                                <h4 className="font-semibold text-foreground text-sm">
                                                    {currentLang === 'ar' ? 'محرك بحث مخصص' : 'Custom Search Engine'}
                                                </h4>
                                                <p className="text-xs text-muted-foreground leading-normal">
                                                    {currentLang === 'ar'
                                                        ? 'إذا اخترت محرك البحث "مخصص" من الصفحة الرئيسية، سيتم استخدام هذا الرابط. ضع %s في مكان كلمة البحث (مثال: https://search.yahoo.com/search?q=%s).'
                                                        : 'If "Custom" is selected as the search provider on the homepage, queries will be sent to this URL. Use %s to specify where the query should be injected (e.g. https://search.yahoo.com/search?q=%s).'}
                                                </p>
                                                <div className="space-y-1 text-start">
                                                    <Label className="text-xs">{currentLang === 'ar' ? 'رابط محرك البحث المخصص' : 'Custom Search Query URL'}</Label>
                                                    <Input
                                                        type="text"
                                                        value={customSearchUrl}
                                                        onChange={(e) => {
                                                            setCustomSearchUrl(e.target.value);
                                                            localStorage.setItem('customSearchUrl', e.target.value);
                                                        }}
                                                        placeholder="https://search.yahoo.com/search?q=%s"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </TabsContent>
                            </div>
                        </Tabs>

                        <div className="border-t bg-muted/20 p-4">
                            <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                                <a href="/privacy" className="hover:text-primary transition-colors flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                                    {currentLang === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
                                </a>
                                <span>•</span>
                                <a href="/terms" className="hover:text-primary transition-colors flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                                    {currentLang === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions'}
                                </a>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Add Link Dialog */}
                <AddLinkDialog
                    open={addLinkOpen}
                    onOpenChange={setAddLinkOpen}
                    onAdd={addCustomLink}
                    language={currentLang}
                />

                {/* Edit Link Dialog */}
                <EditLinkDialog
                    link={editingLink}
                    onOpenChange={(open) => { if (!open) setEditingLink(null); }}
                    onSave={updateCustomLink}
                    onDelete={removeCustomLink}
                    language={currentLang}
                />

                {/* About Dialog */}
                <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
                    <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0" dir={currentLang === 'ar' ? 'rtl' : 'ltr'}>
                        <DialogHeader className="px-6 pt-6 pb-2 text-start sm:text-start">
                            <DialogTitle>{currentLang === 'ar' ? 'حول Syrian Zone' : 'About Syrian Zone'}</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="h-[500px] max-h-[60vh] px-6 pb-6" dir={currentLang === 'ar' ? 'rtl' : 'ltr'}>
                            <div
                                className="py-4 space-y-4 text-start [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-4 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mt-6 [&>h2]:mb-2 [&>p]:mb-4 [&>p]:leading-relaxed [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4 [&_a]:text-primary [&_a]:underline"
                                dir={currentLang === 'ar' ? 'rtl' : 'ltr'}
                                dangerouslySetInnerHTML={{ __html: aboutHtml || (currentLang === 'ar' ? 'جاري التحميل...' : 'Loading...') }}
                            />
                        </ScrollArea>
                    </DialogContent>
                </Dialog>
            </div>
        </MainLayout>
    );
}

// Add Link Dialog Component
function AddLinkDialog({
    open,
    onOpenChange,
    onAdd,
    language
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdd: (link: CustomLink) => void;
    language: 'ar' | 'en';
}) {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [icon, setIcon] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !url) return;

        onAdd({
            id: Date.now().toString(),
            name,
            url,
            icon: icon.trim()
        });

        setName('');
        setUrl('');
        setIcon('');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent dir={language === 'ar' ? 'rtl' : 'ltr'}>
                <DialogHeader className="text-start sm:text-start">
                    <DialogTitle>{language === 'ar' ? 'إضافة رابط مخصص' : 'Add Custom Link'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4 text-start">
                    <div className="space-y-2">
                        <Label>{language === 'ar' ? 'الاسم' : 'Name'}</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={language === 'ar' ? 'اسم الرابط' : 'Link name'}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{language === 'ar' ? 'الرابط (URL)' : 'URL'}</Label>
                        <Input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{language === 'ar' ? 'أيقونة أو Emoji (اختياري - اتركها فارغة لجلب أيقونة الموقع تلقائياً)' : 'Icon or Emoji (optional - leave empty for website favicon)'}</Label>
                        <Input
                            value={icon}
                            onChange={(e) => setIcon(e.target.value)}
                            placeholder={language === 'ar' ? 'تلقائي (Favicon)' : 'Auto (Favicon)'}
                            maxLength={4}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                            {language === 'ar' ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                            {language === 'ar' ? 'حفظ' : 'Save'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// Edit Link Dialog Component
function EditLinkDialog({
    link,
    onOpenChange,
    onSave,
    onDelete,
    language
}: {
    link: CustomLink | null;
    onOpenChange: (open: boolean) => void;
    onSave: (link: CustomLink) => void;
    onDelete: (id: string) => void;
    language: 'ar' | 'en';
}) {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [icon, setIcon] = useState('');

    useEffect(() => {
        if (link) {
            setName(link.name || '');
            setUrl(link.url || '');
            setIcon(link.icon === '🔗' ? '' : (link.icon || ''));
        }
    }, [link]);

    if (!link) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !url) return;

        onSave({
            ...link,
            name,
            url,
            icon: icon.trim()
        });

        onOpenChange(false);
    };

    const handleDelete = () => {
        onDelete(link.id);
        onOpenChange(false);
    };

    return (
        <Dialog open={!!link} onOpenChange={onOpenChange}>
            <DialogContent dir={language === 'ar' ? 'rtl' : 'ltr'}>
                <DialogHeader className="text-start sm:text-start">
                    <DialogTitle>{language === 'ar' ? 'تعديل الرابط المخصص' : 'Edit Custom Link'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4 text-start">
                    <div className="space-y-2">
                        <Label>{language === 'ar' ? 'الاسم' : 'Name'}</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={language === 'ar' ? 'اسم الرابط' : 'Link name'}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{language === 'ar' ? 'الرابط (URL)' : 'URL'}</Label>
                        <Input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{language === 'ar' ? 'أيقونة أو Emoji (اختياري - اتركها فارغة لجلب أيقونة الموقع تلقائياً)' : 'Icon or Emoji (optional - leave empty for website favicon)'}</Label>
                        <Input
                            value={icon}
                            onChange={(e) => setIcon(e.target.value)}
                            placeholder={language === 'ar' ? 'تلقائي (Favicon)' : 'Auto (Favicon)'}
                            maxLength={4}
                        />
                    </div>
                    <div className="flex justify-between items-center pt-2">
                        <Button type="button" variant="destructive" size="sm" onClick={handleDelete} className="gap-1.5">
                            <X className="w-4 h-4" />
                            {language === 'ar' ? 'حذف الرابط' : 'Remove Link'}
                        </Button>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                                {language === 'ar' ? 'إلغاء' : 'Cancel'}
                            </Button>
                            <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                                {language === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}