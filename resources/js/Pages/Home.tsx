import React, { useState, useEffect, useMemo } from 'react';
import { Head } from '@inertiajs/react';
import {
    CheckCircle2, Palette, Users2, ListOrdered, Landmark, Compass,
    Settings, Sun, Link, Moon, Utensils, Globe, Plus, Edit, X, Download, Upload, RotateCcw,
    Cloud, CloudRain, CloudLightning, Snowflake, Wind, MessageSquareCode, Smartphone, Bus,
    Newspaper, Sliders, Calendar, Clock, Sunrise, Sunset, SunDim, MoonStar, Phone, Scale, Search
} from 'lucide-react';
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { Card, CardContent } from "@/Components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/Components/ui/dialog";
import { Label } from "@/Components/ui/label";
import { marked } from 'marked';
import MainLayout from '@/Layouts/MainLayout';
import { applyTheme as persistTheme, getThemePreference, resolveTheme, SYSTEM_THEME, THEME_REGISTRY, isDarkTheme } from '@/lib/theme';
import { ThemeToggle } from '@/Components/ThemeToggle';
import F3aliaEvents from '@/Components/F3aliaEvents';

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
    className?: string;
}

const PRESET_LINKS: PresetLink[] = [
    { href: '/syofficial', icon: CheckCircle2, text: 'الحسابات الرسمية' },
    { href: '/roznama', icon: Calendar, text: 'الروزنامة' },
    { href: '/phonebook', icon: Phone, text: 'دليل الهاتف' },
    { href: '/syid', icon: Palette, text: 'الهوية البصرية' },
    { href: '/party', icon: Users2, text: 'دليل الأحزاب' },
    { href: '/tierlist', icon: ListOrdered, text: 'تقييم الحكومة' },
    { href: '/house', icon: Landmark, text: 'المجلس التشريعي' },
    { href: '/compass', icon: Compass, text: 'البوصلة السياسية' },
    { href: '/priorities', icon: Sliders, text: 'أولويات سوريا' },
    { href: '/sites', icon: Link, text: 'دليل المواقع' },
    { href: '/population', icon: Globe, text: 'أطلس' },
    { href: '/govapps', icon: Smartphone, text: 'تطبيقات الحكومة' },
    { href: '/transit', icon: Bus, text: 'ترانزيت' },
    { href: '/justice', icon: Scale, text: 'العدالة الانتقالية' },
    { href: 'https://joory.chat', image: 'https://joory.chat/favicon.svg', text: 'جوري AI', external: true },
    { href: 'https://jard.chat', image: 'https://jard.chat/images/logo-light.svg', text: 'جرد', external: true },
    { href: 'https://food.syrian.zone', icon: Utensils, text: 'وصفاتنا' },
    { href: 'https://news.jard.chat', icon: Newspaper, text: 'أخبار سوريا', external: true },
    { href: 'https://discord.gg/NqE8849VzA', icon: MessageSquareCode, text: 'مجتمع كوديكس', external: true },
    { href: 'https://chromewebstore.google.com/detail/syrian-flag-replacer/dngipobppehfhfggmbdiiiodgcibdeog', icon: null, text: 'مبدل العلم', image: '/flag-replacer/1f1f8-1f1fe.svg', external: true },
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
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [aboutOpen, setAboutOpen] = useState(false);
    const [addLinkOpen, setAddLinkOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Weather & Clock state
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    const [weather, setWeather] = useState<any>(null);
    const [governorate, setGovernorate] = useState('damascus');
    const [clockFormat, setClockFormat] = useState<'12' | '24'>('24');
    const [prayerTimes, setPrayerTimes] = useState<Record<string, string> | null>(null);

    // Load settings from localStorage
    useEffect(() => {
        const savedTheme = getThemePreference();
        const savedLang = localStorage.getItem('sz-language') as 'ar' | 'en' || 'ar';
        const savedLinks = localStorage.getItem('customLinks');
        const savedGovernorate = localStorage.getItem('governorate') || 'damascus';
        const savedClockFormat = localStorage.getItem('clockFormat') as '12' | '24' || '24';

        setTheme(savedTheme);
        setLanguage(savedLang);
        setGovernorate(savedGovernorate);
        setClockFormat(savedClockFormat);

        if (savedLinks) {
            try {
                setCustomLinks(JSON.parse(savedLinks));
            } catch (e) {
                console.error('Failed to parse custom links', e);
            }
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
                const coords = GOVERNORATES[governorate] || GOVERNORATES['damascus'];
                const response = await fetch(`https://syrianzone.hade-alahmad1.workers.dev/?lat=${coords.lat}&lon=${coords.lon}`);
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

        if (mounted) {
            fetchWeather();
        }
    }, [governorate, language, mounted]);

    // Fetch prayer times for the upcoming prayer widget
    useEffect(() => {
        const fetchPrayers = async () => {
            try {
                const coords = GOVERNORATES[governorate] || GOVERNORATES['damascus'];
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

        if (mounted) {
            fetchPrayers();
        }
    }, [governorate, mounted]);

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

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        const searchUrls: Record<string, string> = {
            duckduckgo: `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`,
            google: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
            bing: `https://www.bing.com/search?q=${encodeURIComponent(searchQuery)}`,
            searx: `https://searx.be/search?q=${encodeURIComponent(searchQuery)}`,
        };

        const url = searchUrls[searchEngine] || searchUrls.duckduckgo;
        window.open(url, '_blank');
        setSearchQuery('');
    };

    const applyTheme = (newTheme: string) => {
        setTheme(newTheme);
        persistTheme(newTheme);
    };



    const toggleLanguage = () => {
        const newLang = language === 'ar' ? 'en' : 'ar';
        setLanguage(newLang);
        localStorage.setItem('sz-language', newLang);
    };

    const addCustomLink = (link: CustomLink) => {
        const updated = [...customLinks, link];
        setCustomLinks(updated);
        localStorage.setItem('customLinks', JSON.stringify(updated));
    };

    const removeCustomLink = (id: string) => {
        const updated = customLinks.filter(l => l.id !== id);
        setCustomLinks(updated);
        localStorage.setItem('customLinks', JSON.stringify(updated));
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
                {/* Weather & Clock */}
                <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-6 mb-12 w-full">
                    {/* Weather Widget */}
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

                    {/* Clock */}
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

                    {/* Next Prayer Widget */}
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
                                    <div className="mr-auto rtl:mr-0 rtl:ml-auto pl-2 rtl:pl-0 rtl:pr-2 border-l rtl:border-l-0 rtl:border-r border-border/80 font-mono text-xs text-primary font-bold tracking-wider">
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
                </div>

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
                            <Select value={searchEngine} onValueChange={setSearchEngine}>
                                <SelectTrigger className="w-[110px] border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 px-2 h-auto text-xs font-bold text-muted-foreground hover:text-foreground shrink-0 gap-1.5 cursor-pointer">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end" className="w-[140px]" dir={currentLang === 'ar' ? 'rtl' : 'ltr'}>
                                    <SelectItem value="duckduckgo">DuckDuckGo</SelectItem>
                                    <SelectItem value="searx">SearX</SelectItem>
                                    <SelectItem value="google">Google</SelectItem>
                                    <SelectItem value="bing">Bing</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </form>
                </div>

                {/* F3alia Events integration */}
                <F3aliaEvents governorate={governorate} language={currentLang} variant="single" />

                {/* Quick Links */}
                <div className="mb-12">
                    <h3 className="text-xl font-bold text-foreground mb-6 text-center">
                        {language === 'ar' ? 'روابط سريعة' : 'Quick Links'}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {PRESET_LINKS.map((link, idx) => {
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
                                            {Icon && <Icon className="w-7 h-7 text-primary group-hover:scale-110 transition-transform" />}
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
                                variant="outline"
                                size="sm"
                                onClick={() => setEditMode(!editMode)}
                                className="bg-muted text-foreground border-border hover:bg-accent"
                            >
                                <Edit className="w-4 h-4 mr-2" />
                                {language === 'ar' ? 'تعديل' : 'Edit'}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setAddLinkOpen(true)}
                                className="bg-muted text-foreground border-border hover:bg-accent"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {language === 'ar' ? 'إضافة' : 'Add'}
                            </Button>
                        </div>
                    </div>

                    {customLinks.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {customLinks.map((link) => (
                                <div key={link.id} className="relative group">
                                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                                        <Card className="h-full hover:shadow-lg transition-all border-border bg-card">
                                            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                                                {link.icon && <span className="text-2xl">{link.icon}</span>}
                                                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                                    {link.name}
                                                </span>
                                            </CardContent>
                                        </Card>
                                    </a>
                                    {editMode && (
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => removeCustomLink(link.id)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            ))}
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
                                    <Plus className="w-4 h-4 mr-2" />
                                    {language === 'ar' ? 'إضافة رابط' : 'Add Link'}
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Settings Dialog */}
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{currentLang === 'ar' ? 'الإعدادات' : 'Settings'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        {/* Weather Settings */}
                        <div className="space-y-4">
                            <h4 className="font-semibold text-foreground">
                                {currentLang === 'ar' ? 'إعدادات الطقس' : 'Weather Settings'}
                            </h4>
                            <div className="space-y-2">
                                <Label>{currentLang === 'ar' ? 'المحافظة' : 'Governorate'}</Label>
                                <Select value={governorate} onValueChange={(val) => {
                                    setGovernorate(val);
                                    localStorage.setItem('governorate', val);
                                }}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="damascus">Damascus</SelectItem>
                                        <SelectItem value="aleppo">Aleppo</SelectItem>
                                        <SelectItem value="homs">Homs</SelectItem>
                                        <SelectItem value="hama">Hama</SelectItem>
                                        <SelectItem value="latakia">Latakia</SelectItem>
                                        <SelectItem value="tartus">Tartus</SelectItem>
                                        <SelectItem value="deir-ez-zor">Deir ez-Zor</SelectItem>
                                        <SelectItem value="idlib">Idlib</SelectItem>
                                        <SelectItem value="daraa">Daraa</SelectItem>
                                        <SelectItem value="quneitra">Quneitra</SelectItem>
                                        <SelectItem value="sweida">Sweida</SelectItem>
                                        <SelectItem value="rural-damascus">Rural Damascus</SelectItem>
                                        <SelectItem value="hasakah">Hasakah</SelectItem>
                                        <SelectItem value="raqqa">Raqqa</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Clock Settings */}
                        <div className="space-y-4">
                            <h4 className="font-semibold text-foreground">
                                {currentLang === 'ar' ? 'إعدادات الساعة' : 'Clock Settings'}
                            </h4>
                            <div className="space-y-2">
                                <Label>{currentLang === 'ar' ? 'تنسيق الوقت' : 'Time Format'}</Label>
                                <Select value={clockFormat} onValueChange={(val: '12' | '24') => {
                                    setClockFormat(val);
                                    localStorage.setItem('clockFormat', val);
                                }}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="12">12 Hour</SelectItem>
                                        <SelectItem value="24">24 Hour</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Theme Settings */}
                        <div className="space-y-4">
                            <h4 className="font-semibold text-foreground">
                                {currentLang === 'ar' ? 'إعدادات المظهر' : 'Theme Settings'}
                            </h4>
                            <div className="space-y-2">
                                <Label>{currentLang === 'ar' ? 'اللغة' : 'Language'}</Label>
                                <Select value={currentLang} onValueChange={(val: 'ar' | 'en') => {
                                    setLanguage(val);
                                    localStorage.setItem('sz-language', val);
                                }}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="en">English</SelectItem>
                                        <SelectItem value="ar">العربية</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>{currentLang === 'ar' ? 'المظهر' : 'Theme'}</Label>

                                {/* Standard themes list */}
                                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pt-1">
                                    {currentLang === 'ar' ? 'المظاهر الأساسية' : 'Standard'}
                                </p>
                                <div className="flex flex-col gap-1.5">
                                    {THEME_REGISTRY.filter(t => t.group === 'standard' || t.group === 'system').map((t) => {
                                        const isActive = activeTheme === t.id;
                                        return (
                                            <button
                                                key={t.id}
                                                onClick={() => applyTheme(t.id)}
                                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:scale-[1.01] focus:outline-none w-full"
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
                                                <span className="text-sm font-medium" style={{ color: isActive ? t.primary : 'hsl(var(--foreground))' }}>
                                                    {t.emoji} {currentLang === 'ar' ? t.nameAr : t.nameEn}
                                                </span>
                                                {isActive && (
                                                    <span className="ms-auto text-sm" style={{ color: t.primary }}>✓</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Syrian Heritage themes list */}
                                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pt-3">
                                    {currentLang === 'ar' ? 'التراث السوري' : 'Syrian Heritage'}
                                </p>
                                <div className="flex flex-col gap-1.5">
                                    {THEME_REGISTRY.filter(t => t.group === 'heritage').map((t) => {
                                        const isActive = activeTheme === t.id;
                                        return (
                                            <button
                                                key={t.id}
                                                onClick={() => applyTheme(t.id)}
                                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:scale-[1.01] focus:outline-none w-full"
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
                                                <span className="text-sm font-medium" style={{ color: isActive ? t.primary : 'hsl(var(--foreground))' }}>
                                                    {t.emoji} {currentLang === 'ar' ? t.nameAr : t.nameEn}
                                                </span>
                                                {isActive && (
                                                    <span className="ms-auto text-sm" style={{ color: t.primary }}>✓</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
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

            {/* About Dialog */}
            <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{currentLang === 'ar' ? 'حول Syrian Zone' : 'About Syrian Zone'}</DialogTitle>
                    </DialogHeader>
                    <div
                        className="py-4 space-y-4 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-4 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mt-6 [&>h2]:mb-2 [&>p]:mb-4 [&>p]:leading-relaxed [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4 [&_a]:text-primary [&_a]:underline"
                        dir={currentLang === 'ar' ? 'rtl' : 'ltr'}
                        dangerouslySetInnerHTML={{ __html: aboutHtml || (currentLang === 'ar' ? 'جاري التحميل...' : 'Loading...') }}
                    />
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
            icon: icon || '🔗'
        });

        setName('');
        setUrl('');
        setIcon('');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{language === 'ar' ? 'إضافة رابط مخصص' : 'Add Custom Link'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
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
                        <Label>{language === 'ar' ? 'الرابط' : 'URL'}</Label>
                        <Input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{language === 'ar' ? 'أيقونة (اختياري)' : 'Icon (optional)'}</Label>
                        <Input
                            value={icon}
                            onChange={(e) => setIcon(e.target.value)}
                            placeholder="🔗"
                            maxLength={2}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {language === 'ar' ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                            {language === 'ar' ? 'حفظ' : 'Save'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}