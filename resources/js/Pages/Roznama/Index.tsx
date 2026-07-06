import React, { useState, useEffect, useMemo } from 'react';
import { Head } from '@inertiajs/react';
import {
    Calendar, Clock, MapPin, Sparkles, AlertCircle, Info,
    Sun, Sunset, Timer, Check, ShieldAlert, Heart, CalendarDays,
    ExternalLink, MoonStar, Sunrise, SunDim, Moon,
    Cloud, CloudRain, CloudLightning, Snowflake, Wind
} from 'lucide-react';
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { Badge } from "@/Components/ui/badge";
import { Switch } from "@/Components/ui/switch";
interface EventCategory {
    nameAr: string;
    nameEn: string;
}

interface F3aliaEvent {
    id: string;
    name: string;
    description: string;
    address: string;
    isOnline: boolean;
    eventLink: string;
    province: string;
    provinceName: string;
    isFree: boolean;
    ticketPrice: number;
    eventDate: string;
    eventTime: string | null;
    category: EventCategory | null;
}

const GOVERNORATE_TO_F3ALIA_PROVINCE: Record<string, string> = {
    'damascus': 'DAMASCUS',
    'aleppo': 'ALEPPO',
    'homs': 'HOMS',
    'hama': 'HAMA',
    'latakia': 'LATTAKIA',
    'tartus': 'TARTOUS',
    'deir-ez-zor': 'DEIR_EZ_ZOR',
    'idlib': 'IDLIB',
    'daraa': 'DARAA',
    'quneitra': 'QUNEITRA',
    'sweida': 'AS_SUWAYDA',
    'rural-damascus': 'DAMASCUS',
    'hasakah': 'HASAKEH',
    'raqqa': 'RAQQA'
};

const F3ALIA_PROVINCE_TO_ARABIC: Record<string, string> = {
    'DAMASCUS': 'دمشق',
    'ALEPPO': 'حلب',
    'HOMS': 'حمص',
    'HAMA': 'حماة',
    'LATTAKIA': 'اللاذقية',
    'TARTOUS': 'طرطوس',
    'DEIR_EZ_ZOR': 'دير الزور',
    'IDLIB': 'إدلب',
    'DARAA': 'درعا',
    'QUNEITRA': 'القنيطرة',
    'AS_SUWAYDA': 'السويداء',
    'HASAKEH': 'الحسكة',
    'RAQQA': 'الرقة'
};
import { Label } from "@/Components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import MainLayout from '@/Layouts/MainLayout';

const GOVERNORATES: Record<string, { nameAr: string; nameEn: string; lat: number; lon: number }> = {
    'damascus': { nameAr: 'دمشق', nameEn: 'Damascus', lat: 33.5138, lon: 36.2765 },
    'aleppo': { nameAr: 'حلب', nameEn: 'Aleppo', lat: 36.2021, lon: 37.1343 },
    'homs': { nameAr: 'حمص', nameEn: 'Homs', lat: 34.7324, lon: 36.7137 },
    'hama': { nameAr: 'حماة', nameEn: 'Hama', lat: 35.1318, lon: 36.7578 },
    'latakia': { nameAr: 'اللاذقية', nameEn: 'Latakia', lat: 35.5317, lon: 35.7901 },
    'tartus': { nameAr: 'طرطوس', nameEn: 'Tartus', lat: 34.8890, lon: 35.8866 },
    'deir-ez-zor': { nameAr: 'دير الزور', nameEn: 'Deir ez-Zor', lat: 35.3359, lon: 40.1408 },
    'idlib': { nameAr: 'إدلب', nameEn: 'Idlib', lat: 35.9306, lon: 36.6339 },
    'daraa': { nameAr: 'درعا', nameEn: 'Daraa', lat: 32.6255, lon: 36.1016 },
    'quneitra': { nameAr: 'القنيطرة', nameEn: 'Quneitra', lat: 33.1250, lon: 35.8250 },
    'sweida': { nameAr: 'السويداء', nameEn: 'Sweida', lat: 32.7089, lon: 36.5695 },
    'rural-damascus': { nameAr: 'ريف دمشق', nameEn: 'Rural Damascus', lat: 33.5138, lon: 36.2765 },
    'hasakah': { nameAr: 'الحسكة', nameEn: 'Hasakah', lat: 36.5023, lon: 40.7382 },
    'raqqa': { nameAr: 'الرقة', nameEn: 'Raqqa', lat: 35.9520, lon: 39.0081 },
};

const VARIABLE_HOLIDAYS_MAP: Record<number, Record<string, { month: number; day: number }>> = {
    2026: {
        'eid-fitr': { month: 3, day: 20 },
        'eid-adha': { month: 5, day: 27 },
        'hijri-new-year': { month: 6, day: 16 },
        'mawlid': { month: 8, day: 26 },
        'western-easter': { month: 4, day: 5 },
        'eastern-easter': { month: 4, day: 12 },
    },
    2027: {
        'eid-fitr': { month: 3, day: 10 },
        'eid-adha': { month: 5, day: 16 },
        'hijri-new-year': { month: 6, day: 6 },
        'mawlid': { month: 8, day: 15 },
        'western-easter': { month: 3, day: 28 },
        'eastern-easter': { month: 5, day: 2 },
    }
};

const PRAYER_EVENTS = [
    { key: 'Fajr', label: 'الفجر', isPrayer: true },
    { key: 'Sunrise', label: 'الشروق', isPrayer: false },
    { key: 'Dhuhr', label: 'الظهر', isPrayer: true },
    { key: 'Asr', label: 'العصر', isPrayer: true },
    { key: 'Maghrib', label: 'المغرب', isPrayer: true },
    { key: 'Isha', label: 'العشاء', isPrayer: true }
];

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

interface ActiveHoliday {
    nameAr: string;
    nameEn: string;
    date: Date;
    description: string;
    isNew?: boolean;
}

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

const getWeatherIcon = (iconCode: string) => {
    if (iconCode.startsWith('01')) return <Sun className="w-6 h-6 text-yellow-500" />;
    if (iconCode.startsWith('02')) return <Sun className="w-6 h-6 text-orange-400" />;
    if (iconCode.startsWith('03') || iconCode.startsWith('04')) return <Cloud className="w-6 h-6 text-gray-400" />;
    if (iconCode.startsWith('09') || iconCode.startsWith('10')) return <CloudRain className="w-6 h-6 text-blue-400" />;
    if (iconCode.startsWith('11')) return <CloudLightning className="w-6 h-6 text-purple-500" />;
    if (iconCode.startsWith('13')) return <Snowflake className="w-6 h-6 text-white" />;
    if (iconCode.startsWith('50')) return <Wind className="w-6 h-6 text-gray-300" />;
    return <Sun className="w-6 h-6 text-yellow-500" />;
};

export default function Index() {
    const [governorate, setGovernorate] = useState('damascus');
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [prayerTimes, setPrayerTimes] = useState<Record<string, string> | null>(null);
    const [hijriDateFromApi, setHijriDateFromApi] = useState<string | null>(null);
    const [weather, setWeather] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    // F3alia Events States
    const [events, setEvents] = useState<F3aliaEvent[]>([]);
    const [showOtherGovEvents, setShowOtherGovEvents] = useState(false);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [eventsError, setEventsError] = useState<string | null>(null);

    const nextEvent = useMemo(() => {
        return events.length > 0 ? events[0] : null;
    }, [events]);
    
    // Switch state for hiding passed holidays
    const [hidePassed, setHidePassed] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('sz-hide-passed-holidays') === 'true';
        }
        return false;
    });

    // Save Switch preference
    useEffect(() => {
        localStorage.setItem('sz-hide-passed-holidays', String(hidePassed));
    }, [hidePassed]);

    // Load governorate preference from localStorage (Roznama-specific key)
    useEffect(() => {
        const savedGov = localStorage.getItem('sz-roznama-governorate') || 'damascus';
        setGovernorate(savedGov);
        setMounted(true);
        setCurrentTime(new Date());
    }, []);

    // Keep the clock ticking
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch Weather
    useEffect(() => {
        if (!mounted) return;

        const fetchWeather = async () => {
            try {
                const coords = GOVERNORATES[governorate] || GOVERNORATES['damascus'];
                const response = await fetch(`https://syrianzone.hade-alahmad1.workers.dev/?lat=${coords.lat}&lon=${coords.lon}`);
                if (!response.ok) throw new Error('Weather fetch failed');
                const data = await response.json();

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

        fetchWeather();
    }, [governorate, mounted]);

    // Fetch Prayer Times
    useEffect(() => {
        if (!mounted) return;

        const fetchPrayerTimes = async () => {
            setLoading(true);
            setError(null);
            try {
                const coords = GOVERNORATES[governorate] || GOVERNORATES['damascus'];
                const day = String(currentTime.getDate()).padStart(2, '0');
                const month = String(currentTime.getMonth() + 1).padStart(2, '0');
                const year = currentTime.getFullYear();
                const dateStr = `${day}-${month}-${year}`;

                const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${coords.lat}&longitude=${coords.lon}&method=3`;
                const response = await fetch(url);
                if (!response.ok) throw new Error('فشل جلب مواقيت الصلاة');
                const result = await response.json();

                if (result.code === 200 && result.data) {
                    setPrayerTimes(result.data.timings);
                    
                    const hijri = result.data.date.hijri;
                    const formattedHijri = `${hijri.day} ${hijri.month.ar} ${hijri.year}`;
                    setHijriDateFromApi(formattedHijri);
                } else {
                    throw new Error('بيانات مواقيت غير صالحة');
                }
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'حدث خطأ أثناء الاتصال بالخادم');
            } finally {
                setLoading(false);
            }
        };

        fetchPrayerTimes();
    }, [governorate, mounted]);

    // Fetch upcoming events from F3alia public API
    useEffect(() => {
        if (!mounted) return;

        const fetchF3aliaEvents = async () => {
            setLoadingEvents(true);
            setEventsError(null);
            try {
                const query = `
                    query GetEvents($province: Province, $fromDate: Date, $size: Int!) {
                        getAllEventsForVisitor(page: 0, size: $size, province: $province, fromDate: $fromDate) {
                            content {
                                id
                                name
                                description
                                address
                                isOnline
                                eventLink
                                province
                                provinceName
                                isFree
                                ticketPrice
                                eventDate
                                eventTime
                                category {
                                    nameAr
                                    nameEn
                                }
                            }
                        }
                    }
                `;

                const provinceEnum = showOtherGovEvents ? null : (GOVERNORATE_TO_F3ALIA_PROVINCE[governorate] || null);
                
                const d = new Date();
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const todayStr = `${year}-${month}-${day}`;

                const response = await fetch('https://event-backend-production-18c4.up.railway.app/graphql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query,
                        variables: {
                            province: provinceEnum,
                            fromDate: todayStr,
                            size: 15
                        }
                    })
                });

                if (!response.ok) throw new Error();
                const resData = await response.json();
                if (resData.errors && resData.errors.length > 0) throw new Error(resData.errors[0].message);

                const fetchedEvents = (resData.data?.getAllEventsForVisitor?.content || []) as F3aliaEvent[];
                const upcoming = fetchedEvents.filter(e => e.eventDate >= todayStr);
                setEvents(upcoming);
            } catch (err) {
                console.error(err);
                setEventsError('فشل تحميل الفعاليات');
            } finally {
                setLoadingEvents(false);
            }
        };

        fetchF3aliaEvents();
    }, [governorate, showOtherGovEvents, mounted]);

    // Handle governorate change (saves to Roznama-specific key)
    const handleGovChange = (val: string) => {
        setGovernorate(val);
        localStorage.setItem('sz-roznama-governorate', val);
    };

    // Formatter helpers
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    };

    const formatDateGregorian = (date: Date) => {
        return date.toLocaleDateString('ar-SY', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatHijriFallback = (date: Date) => {
        try {
            const formatter = new Intl.DateTimeFormat('ar-SY-u-ca-islamic-umalqura', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            const formatted = formatter.format(date);
            return formatted.includes('هـ') ? formatted : `${formatted} هـ`;
        } catch (e) {
            return '';
        }
    };

    // Calculate Active & Next Prayer/Event
    const activeAndNext = useMemo(() => {
        if (!prayerTimes) return null;

        const parsedEvents = PRAYER_EVENTS.map(ev => {
            const timeStr = prayerTimes[ev.key];
            if (!timeStr) return null;
            const [hours, minutes] = timeStr.split(':').map(Number);
            const eventTime = new Date(currentTime);
            eventTime.setHours(hours, minutes, 0, 0);
            return { ...ev, time: eventTime };
        }).filter(Boolean) as Array<{ key: string; label: string; isPrayer: boolean; time: Date }>;

        if (parsedEvents.length === 0) return null;

        parsedEvents.sort((a, b) => a.time.getTime() - b.time.getTime());

        let nextEventIndex = parsedEvents.findIndex(ev => ev.time > currentTime);
        
        if (nextEventIndex === -1) {
            const firstEvent = parsedEvents[0];
            const tomorrowFajr = new Date(firstEvent.time);
            tomorrowFajr.setDate(tomorrowFajr.getDate() + 1);

            return {
                activeEvent: parsedEvents[parsedEvents.length - 1],
                nextEvent: { ...firstEvent, time: tomorrowFajr },
                timeDiffMs: tomorrowFajr.getTime() - currentTime.getTime()
            };
        } else {
            const activeEventIndex = nextEventIndex === 0 ? parsedEvents.length - 1 : nextEventIndex - 1;
            const activeEvent = parsedEvents[activeEventIndex];
            const nextEvent = parsedEvents[nextEventIndex];

            let adjustedActiveTime = new Date(activeEvent.time);
            if (nextEventIndex === 0) {
                adjustedActiveTime.setDate(adjustedActiveTime.getDate() - 1);
            }

            return {
                activeEvent: { ...activeEvent, time: adjustedActiveTime },
                nextEvent,
                timeDiffMs: nextEvent.time.getTime() - currentTime.getTime()
            };
        }
    }, [prayerTimes, currentTime]);

    const formatDuration = (ms: number) => {
        const totalSecs = Math.floor(ms / 1000);
        if (totalSecs < 0) return '00:00:00';
        const hours = Math.floor(totalSecs / 3600);
        const minutes = Math.floor((totalSecs % 3600) / 60);
        const seconds = totalSecs % 60;
        const pad = (num: number) => String(num).padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    };

    // Resolve Syrian Holidays for current year
    const holidays = useMemo(() => {
        const year = currentTime.getFullYear();
        const list: ActiveHoliday[] = [
            { nameAr: 'رأس السنة الميلادية', nameEn: "New Year's Day", date: new Date(year, 0, 1), description: 'بداية العام الميلادي الجديد' },
            { nameAr: 'عيد الثورة السورية', nameEn: 'Syrian Revolution Day', date: new Date(year, 2, 18), description: 'ذكرى انطلاق الثورة السورية عام 2011، اعتمد كعيد وطني رسمي بموجب المرسوم 188 لعام 2025.', isNew: true },
            { nameAr: 'عيد الأم', nameEn: "Mother's Day", date: new Date(year, 2, 21), description: 'تكريم للأم ودورها في المجتمع.' },
            { nameAr: 'عيد الجلاء', nameEn: 'Evacuation Day', date: new Date(year, 3, 17), description: 'ذكرى جلاء آخر جندي فرنسي عن الأراضي السورية عام 1946.' },
            { nameAr: 'عيد العمال العالمي', nameEn: "International Workers' Day", date: new Date(year, 4, 1), description: 'تكريم للعمال وجهودهم.' },
            { nameAr: 'عيد التحرير الوطني', nameEn: 'National Liberation Day', date: new Date(year, 11, 8), description: 'العيد الوطني الجديد المعتمد بموجب المرسوم 188 لعام 2025 احتفاءً بسقوط الاستبداد عام 2024.', isNew: true },
            { nameAr: 'عيد الميلاد المجيد', nameEn: 'Christmas Day', date: new Date(year, 11, 25), description: 'ذكرى ميلاد السيد المسيح عليه السلام.' }
        ];

        const vars = VARIABLE_HOLIDAYS_MAP[year];
        if (vars) {
            list.push(
                { nameAr: 'عيد الفطر السعيد', nameEn: 'Eid al-Fitr', date: new Date(year, vars['eid-fitr'].month - 1, vars['eid-fitr'].day), description: 'عطلة عيد الفطر السعيد (3 أيام).' },
                { nameAr: 'عيد الأضحى المبارك', nameEn: 'Eid al-Adha', date: new Date(year, vars['eid-adha'].month - 1, vars['eid-adha'].day), description: 'عطلة عيد الأضحى المبارك (4 أيام).' },
                { nameAr: 'رأس السنة الهجرية', nameEn: 'Islamic New Year', date: new Date(year, vars['hijri-new-year'].month - 1, vars['hijri-new-year'].day), description: 'رأس السنة الهجرية الجديدة.' },
                { nameAr: 'المولد النبوي الشريف', nameEn: 'Prophet\'s Birthday', date: new Date(year, vars['mawlid'].month - 1, vars['mawlid'].day), description: 'ذكرى المولد النبوي الشريف.' },
                { nameAr: 'عيد الفصح المجيد (غربي)', nameEn: 'Western Easter', date: new Date(year, vars['western-easter'].month - 1, vars['western-easter'].day), description: 'عيد الفصح المجيد (التقويم الغربي).' },
                { nameAr: 'عيد الفصح المجيد (شرقي)', nameEn: 'Eastern Easter', date: new Date(year, vars['eastern-easter'].month - 1, vars['eastern-easter'].day), description: 'عيد الفصح المجيد (التقويم الشرقي).' }
            );
        }

        return list.sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [currentTime]);

    // Next upcoming holiday
    const nextHoliday = useMemo(() => {
        const startOfToday = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
        let next = holidays.find(h => h.date >= startOfToday);

        if (!next) {
            const nextYear = currentTime.getFullYear() + 1;
            const nextYearHolidays = [
                { nameAr: 'رأس السنة الميلادية', nameEn: "New Year's Day", date: new Date(nextYear, 0, 1), description: 'بداية العام الميلادي الجديد' },
                { nameAr: 'عيد الثورة السورية', nameEn: 'Syrian Revolution Day', date: new Date(nextYear, 2, 18), description: 'ذكرى انطلاق الثورة السورية عام 2011، اعتمد كعيد وطني رسمي بموجب المرسوم 188 لعام 2025.', isNew: true },
                { nameAr: 'عيد الأم', nameEn: "Mother's Day", date: new Date(nextYear, 2, 21), description: 'تكريم للأم ودورها في المجتمع.' },
                { nameAr: 'عيد الجلاء', nameEn: 'Evacuation Day', date: new Date(nextYear, 3, 17), description: 'ذكرى جلاء آخر جندي فرنسي عن الأراضي السورية عام 1946.' },
                { nameAr: 'عيد العمال العالمي', nameEn: "International Workers' Day", date: new Date(nextYear, 4, 1), description: 'تكريم للعمال وجهودهم.' },
                { nameAr: 'عيد التحرير الوطني', nameEn: 'National Liberation Day', date: new Date(nextYear, 11, 8), description: 'العيد الوطني الجديد المعتمد بموجب المرسوم 188 لعام 2025 احتفاءً بسقوط الاستبداد عام 2024.', isNew: true },
                { nameAr: 'عيد الميلاد المجيد', nameEn: 'Christmas Day', date: new Date(nextYear, 11, 25), description: 'ذكرى ميلاد السيد المسيح عليه السلام.' }
            ];
            
            const nextYearVars = VARIABLE_HOLIDAYS_MAP[nextYear];
            if (nextYearVars) {
                nextYearHolidays.push(
                    { nameAr: 'عيد الفطر السعيد', nameEn: 'Eid al-Fitr', date: new Date(nextYear, nextYearVars['eid-fitr'].month - 1, nextYearVars['eid-fitr'].day), description: 'عطلة عيد الفطر السعيد (3 أيام).' },
                    { nameAr: 'عيد الأضحى المبارك', nameEn: 'Eid al-Adha', date: new Date(nextYear, nextYearVars['eid-adha'].month - 1, nextYearVars['eid-adha'].day), description: 'عطلة عيد الأضحى المبارك (4 أيام).' },
                    { nameAr: 'رأس السنة الهجرية', nameEn: 'Islamic New Year', date: new Date(nextYear, nextYearVars['hijri-new-year'].month - 1, nextYearVars['hijri-new-year'].day), description: 'رأس السنة الهجرية الجديدة.' },
                    { nameAr: 'المولد النبوي الشريف', nameEn: 'Prophet\'s Birthday', date: new Date(nextYear, nextYearVars['mawlid'].month - 1, nextYearVars['mawlid'].day), description: 'ذكرى المولد النبوي الشريف.' },
                    { nameAr: 'عيد الفصح المجيد (غربي)', nameEn: 'Western Easter', date: new Date(nextYear, nextYearVars['western-easter'].month - 1, nextYearVars['western-easter'].day), description: 'عيد الفصح المجيد (التقويم الغربي).' },
                    { nameAr: 'عيد الفصح المجيد (شرقي)', nameEn: 'Eastern Easter', date: new Date(nextYear, nextYearVars['eastern-easter'].month - 1, nextYearVars['eastern-easter'].day), description: 'عيد الفصح المجيد (التقويم الشرقي).' }
                );
            }
            nextYearHolidays.sort((a, b) => a.date.getTime() - b.date.getTime());
            next = nextYearHolidays[0];
        }

        const daysLeft = Math.ceil((next.date.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
        return { ...next, daysLeft };
    }, [holidays, currentTime]);

    // Filter holidays to hide passed ones if requested
    const filteredHolidays = useMemo(() => {
        if (!hidePassed) return holidays;
        const startOfToday = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
        return holidays.filter(h => h.date >= startOfToday);
    }, [holidays, hidePassed, currentTime]);

    if (!mounted) return null;

    const activeGov = GOVERNORATES[governorate] || GOVERNORATES['damascus'];

    return (
        <MainLayout>
            <Head>
                <title>الروزنامة السورية | Syrian Zone</title>
                <meta name="description" content="الروزنامة السورية الرسمية: التوقيت المحلي، التاريخ الهجري والميلادي بأسماء الأشهر السورية، مواقيت الصلاة، والأعياد والعطل الرسمية للدولة السورية بموجب المرسوم 188 لعام 2025." />
                
                {/* Open Graph / Facebook */}
                <meta property="og:type" content="website" />
                <meta property="og:title" content="الروزنامة السورية | Syrian Zone" />
                <meta property="og:description" content="الروزنامة السورية الرسمية: التوقيت المحلي، التاريخ الهجري والميلادي بأسماء الأشهر السورية، مواقيت الصلاة، والأعياد والعطل الرسمية للدولة السورية بموجب المرسوم 188 لعام 2025." />
                <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : '/roznama'} />
                <meta property="og:site_name" content="المساحة السورية | Syrian Zone" />
                
                {/* Twitter */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="الروزنامة السورية | Syrian Zone" />
                <meta name="twitter:description" content="الروزنامة السورية الرسمية: التوقيت المحلي، التاريخ الهجري والميلادي بأسماء الأشهر السورية، مواقيت الصلاة، والأعياد والعطل الرسمية للدولة السورية بموجب المرسوم 188 لعام 2025." />
            </Head>

            <div 
                className="min-h-screen text-foreground transition-colors" 
                dir="rtl"
                style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}
            >
                
                {/* Hero Header */}
                <section className="bg-card py-10 shadow-sm border-b border-border">
                    <div className="container mx-auto px-4 text-center max-w-4xl">
                        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">الروزنامة</h1>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            التوقيت المحلي، ومواقيت الصلاة الرسمية، والأعياد والعطل الرسمية للدولة السورية.
                        </p>
                    </div>
                </section>

                <div className="container mx-auto px-4 py-8 max-w-7xl">
                    
                    {/* Top Section: 2 Columns Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        
                        {/* First Column: Date, Time with City selector, Weather & Upcoming Holiday */}
                        <div className="space-y-6 flex flex-col">
                            
                            {/* Date, Time, City Selector & Weather */}
                            <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                                            <MapPin className="h-4 w-4 text-primary" />
                                            <span>المحافظة:</span>
                                        </div>
                                        <Select value={governorate} onValueChange={handleGovChange}>
                                            <SelectTrigger className="w-[140px] bg-card border-border" dir="rtl">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent dir="rtl">
                                                {Object.entries(GOVERNORATES).map(([key, value]) => (
                                                    <SelectItem key={key} value={key}>
                                                        {value.nameAr}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Clock Display */}
                                    <div className="text-center py-4 bg-muted/30 rounded-2xl border border-border/50">
                                        <div className="text-5xl font-bold text-foreground font-mono tracking-wider mb-2">
                                            {formatTime(currentTime)}
                                        </div>
                                        <div className="text-sm font-semibold text-foreground mt-2">
                                            {formatDateGregorian(currentTime)}
                                        </div>
                                        <div className="text-xs text-primary/80 font-medium mt-1">
                                            {hijriDateFromApi || formatHijriFallback(currentTime)}
                                        </div>
                                    </div>

                                    {/* Weather Widget */}
                                    <div className="mt-4 p-4 bg-muted/20 rounded-2xl border border-border/40 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {weather ? (
                                                <>
                                                    <span className="text-2xl">{weather.icon}</span>
                                                    <div>
                                                        <div className="font-semibold text-sm text-foreground">{weather.temp}°C</div>
                                                        <div className="text-xs text-muted-foreground">{weather.description}</div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-xs text-muted-foreground animate-pulse">جاري تحميل الطقس...</div>
                                            )}
                                        </div>
                                        <Badge variant="outline" className="text-[10px] h-5 bg-card border-border/60">
                                            الطقس في {activeGov.nameAr}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Upcoming Holiday Card */}
                            {nextHoliday && (
                                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm overflow-hidden relative flex-1 flex flex-col justify-center">
                                    <div className="absolute top-0 left-0 bg-primary/10 text-primary px-3 py-1 text-xs font-semibold rounded-br-lg border-b border-r border-primary/20">
                                        المناسبة القادمة
                                    </div>
                                    <CardContent className="p-6">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mt-2">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-lg font-bold text-foreground">{nextHoliday.nameAr}</h3>
                                                    {nextHoliday.isNew && (
                                                        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] h-4 px-1">
                                                            جديد
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">{nextHoliday.description}</p>
                                                <div className="flex items-center gap-2 text-xs font-medium text-primary">
                                                    <CalendarDays className="h-4 w-4" />
                                                    <span>
                                                        {nextHoliday.date.toLocaleDateString('ar-SY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="bg-primary text-primary-foreground px-5 py-3 rounded-2xl text-center shadow-md self-stretch sm:self-auto flex flex-col justify-center min-w-[110px]">
                                                <span className="text-[10px] uppercase opacity-85 block mb-1">متبقٍ عليها</span>
                                                <span className="text-2xl font-extrabold font-mono leading-none">
                                                    {nextHoliday.daysLeft}
                                                </span>
                                                <span className="text-[10px] mt-1 block">
                                                    {nextHoliday.daysLeft === 0 ? 'اليوم!' : nextHoliday.daysLeft === 1 ? 'يوم واحد' : nextHoliday.daysLeft === 2 ? 'يومان' : 'يوم'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Next Event section inside Holiday Card */}
                                        {nextEvent && (
                                            <div className="mt-4 pt-4 border-t border-border/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs" dir="rtl">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5 text-primary font-bold">
                                                        <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                                                        <span>الفعالية القادمة: {nextEvent.name}</span>
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-foreground/80">
                                                            {F3ALIA_PROVINCE_TO_ARABIC[nextEvent.province] || nextEvent.provinceName}
                                                        </span>
                                                        <span>•</span>
                                                        <span>{formatDateGregorian(new Date(nextEvent.eventDate))}</span>
                                                        {nextEvent.eventTime && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="font-mono">{nextEvent.eventTime}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <a
                                                    href={nextEvent.eventLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[11px] font-bold text-primary hover:underline inline-flex items-center gap-0.5 bg-primary/10 px-2.5 py-1 rounded border border-primary/20 hover:bg-primary/15 transition-colors shrink-0"
                                                >
                                                    <span>التفاصيل</span>
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                        </div>

                        {/* Second Column: Prayer Times */}
                        <div className="space-y-6">
                            
                            <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm h-full flex flex-col justify-between">
                                <CardContent className="p-6 flex-1 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-3">
                                            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                                                <Clock className="h-5 w-5 text-primary" />
                                                <span>مواقيت الصلاة في {activeGov.nameAr}</span>
                                            </h3>
                                        </div>

                                        {/* Next Prayer Countdown (Simple block with dynamic icon, next prayer label, and countdown) */}
                                        {activeAndNext && (
                                            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 mb-4 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                                        {getPrayerIcon(activeAndNext.nextEvent.key, "h-5 w-5")}
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-primary text-base">
                                                            {activeAndNext.nextEvent.isPrayer ? `صلاة ${activeAndNext.nextEvent.label}` : activeAndNext.nextEvent.label}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-left font-mono">
                                                    <span className="text-xs text-muted-foreground block text-right font-medium">المتبقي</span>
                                                    <span className="text-xl font-bold text-primary tracking-wider">
                                                        {formatDuration(activeAndNext.timeDiffMs)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Prayer Times List */}
                                        {loading ? (
                                            <div className="space-y-3 py-6">
                                                {[1, 2, 3, 4, 5, 6].map(i => (
                                                    <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
                                                ))}
                                            </div>
                                        ) : error ? (
                                            <div className="text-center py-8 text-sm text-red-500 flex flex-col items-center gap-2">
                                                <AlertCircle className="h-8 w-8 text-red-500" />
                                                <p>{error}</p>
                                            </div>
                                        ) : prayerTimes ? (
                                            <div className="space-y-2">
                                                {PRAYER_EVENTS.map(ev => {
                                                    const isActive = activeAndNext?.activeEvent?.key === ev.key;
                                                    const isNext = activeAndNext?.nextEvent?.key === ev.key;
                                                    return (
                                                        <div
                                                            key={ev.key}
                                                            className={`flex items-center justify-between p-3 rounded-xl transition-all border ${
                                                                isActive
                                                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]'
                                                                    : isNext
                                                                    ? 'bg-primary/5 text-foreground border-primary/30 ring-1 ring-primary/10'
                                                                    : 'bg-muted/10 text-foreground border-border/50 hover:bg-muted/20'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                {getPrayerIcon(ev.key, `h-4 w-4 ${
                                                                    isActive 
                                                                        ? 'text-primary-foreground' 
                                                                        : ev.key === 'Sunrise' 
                                                                            ? 'text-orange-500' 
                                                                            : 'text-primary'
                                                                }`)}
                                                                <span className="font-semibold text-sm">{ev.label}</span>
                                                                {isActive && (
                                                                    <Badge className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 text-[10px] font-bold h-5 px-1.5">
                                                                        الآن
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <span className="font-mono text-sm font-bold">
                                                                {prayerTimes[ev.key]}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="text-[10px] text-muted-foreground mt-4 text-center leading-relaxed">
                                        طريقة رابطة العالم الإسلامي (فجر 18° وعشاء 17°)، معتمد من وزارة الأوقاف.
                                    </div>
                                </CardContent>
                            </Card>

                        </div>

                    </div>

                    {/* Bottom Section: Two columns layout (Holidays vs Events) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
                        
                        {/* Compact Table Card */}
                        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm h-full flex flex-col justify-between">
                            <CardContent className="p-6 flex-1 flex flex-col justify-between">
                                <div>
                                    {/* Table Controls Header */}
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-border/60 pb-3">
                                        <div>
                                            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                                                <Calendar className="h-5 w-5 text-primary" />
                                                <span>العطل الرسمية في سوريا ({currentTime.getFullYear()}م)</span>
                                            </h3>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-4">
                                            
                                            {/* Toggle Passed Holidays Switch */}
                                            <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/50">
                                                <Switch
                                                    id="hide-passed"
                                                    dir="rtl"
                                                    checked={hidePassed}
                                                    onCheckedChange={setHidePassed}
                                                />
                                                <Label htmlFor="hide-passed" className="text-xs font-semibold cursor-pointer">
                                                    إخفاء العطل المنقضية
                                                </Label>
                                            </div>

                                            {/* Source Link */}
                                            <a 
                                                href="https://sana.sy/presidency/2299819/" 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-semibold bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 transition-colors hover:bg-primary/15"
                                            >
                                                <span>المرسوم رقم 188 (سانا)</span>
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </div>
                                    </div>

                                    {/* Table */}
                                    <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-muted">
                                                <TableRow>
                                                    <TableHead className="text-right font-bold text-foreground">المناسبة</TableHead>
                                                    <TableHead className="text-right font-bold text-foreground">التاريخ</TableHead>
                                                    <TableHead className="text-right font-bold text-foreground">الحالة</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredHolidays.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-sm">
                                                            لا توجد عطلات رسمية متبقية لهذا العام.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    filteredHolidays.map((holiday, idx) => {
                                                        const isPast = holiday.date < new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
                                                        const daysDiff = Math.ceil((holiday.date.getTime() - new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate()).getTime()) / (1000 * 60 * 60 * 24));
                                                        
                                                        return (
                                                            <TableRow key={idx} className={isPast ? "opacity-50 bg-muted/10" : "hover:bg-muted/50"}>
                                                                <TableCell className="font-semibold text-sm">
                                                                    <div className="flex items-center gap-2">
                                                                        <span>{holiday.nameAr}</span>
                                                                        {holiday.isNew && (
                                                                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-bold h-4 px-1">
                                                                                جديد
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground font-normal mt-0.5 max-w-sm">
                                                                        {holiday.description}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="font-medium text-xs whitespace-nowrap">
                                                                    {holiday.date.toLocaleDateString('ar-SY', { day: 'numeric', month: 'long' })}
                                                                    {holiday.date.getFullYear() !== currentTime.getFullYear() && ` (${holiday.date.getFullYear()})`}
                                                                </TableCell>
                                                                <TableCell className="text-xs">
                                                                    {isPast ? (
                                                                        <span className="text-muted-foreground">منقضية</span>
                                                                    ) : daysDiff === 0 ? (
                                                                        <Badge className="bg-primary text-primary-foreground font-bold animate-pulse text-[10px] h-5">
                                                                            اليوم
                                                                        </Badge>
                                                                    ) : (
                                                                        <span className="text-primary font-medium font-mono">
                                                                            متبقٍ {daysDiff} يوم
                                                                        </span>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Upcoming Events Column */}
                        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm h-full flex flex-col justify-between">
                            <CardContent className="p-6 flex flex-col justify-between h-full">
                                <div>
                                    {/* Events Header */}
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-border/60 pb-3">
                                        <div>
                                            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                                                <Sparkles className="h-5 w-5 text-primary" />
                                                <span>الفعاليات القادمة في {showOtherGovEvents ? 'باقي المحافظات' : activeGov.nameAr}</span>
                                            </h3>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {/* Toggle switch for showing other governorates */}
                                            <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/50">
                                                <Switch
                                                    id="show-other-govs"
                                                    dir="rtl"
                                                    checked={showOtherGovEvents}
                                                    onCheckedChange={setShowOtherGovEvents}
                                                />
                                                <Label htmlFor="show-other-govs" className="text-xs font-semibold cursor-pointer">
                                                    باقي المحافظات
                                                </Label>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Events List */}
                                    {loadingEvents ? (
                                        <div className="space-y-3 py-1">
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/5 animate-pulse gap-4">
                                                    <div className="space-y-2 min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-4 bg-muted rounded w-2/5" />
                                                            <div className="h-3.5 bg-muted rounded w-12" />
                                                        </div>
                                                        <div className="h-3 bg-muted rounded w-3/5" />
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <div className="h-5 bg-muted rounded w-14" />
                                                        <div className="h-7 bg-muted rounded w-7" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : eventsError ? (
                                        <div className="text-center py-8 text-sm text-red-500 flex flex-col items-center gap-2">
                                            <AlertCircle className="h-8 w-8 text-red-500" />
                                            <p>{eventsError}</p>
                                        </div>
                                    ) : events.length === 0 ? (
                                        <div className="text-center py-12 text-sm text-muted-foreground">
                                            <Calendar className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                                            <p>لا توجد فعاليات قادمة مسجلة حالياً في هذه المحافظة.</p>
                                            <button 
                                                onClick={() => setShowOtherGovEvents(true)}
                                                className="text-xs text-primary font-bold hover:underline mt-2"
                                            >
                                                تصفح الفعاليات في باقي المحافظات
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {events.map((event) => (
                                                <div 
                                                    key={event.id}
                                                    className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/10 hover:bg-muted/30 transition-colors gap-4"
                                                >
                                                    <div className="space-y-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-bold text-sm text-foreground truncate">{event.name}</span>
                                                            {event.category && (
                                                                <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 bg-primary/5 text-primary border-primary/20 shrink-0">
                                                                    {event.category.nameAr}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-semibold text-foreground/75">
                                                                {F3ALIA_PROVINCE_TO_ARABIC[event.province] || event.provinceName}
                                                            </span>
                                                            <span>•</span>
                                                            <span>{formatDateGregorian(new Date(event.eventDate))}</span>
                                                            {event.eventTime && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="font-mono">{event.eventTime}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <Badge 
                                                            className={`${
                                                                event.isFree 
                                                                    ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/15 border-emerald-500/20' 
                                                                    : 'bg-primary/10 text-primary hover:bg-primary/15 border-primary/20'
                                                            } border text-[10px] font-bold h-5 px-1.5`}
                                                        >
                                                            {event.isFree ? 'مجاني' : `${event.ticketPrice.toLocaleString()} ل.س`}
                                                        </Badge>
                                                        
                                                        <a 
                                                            href={event.eventLink} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-primary hover:text-primary-foreground hover:bg-primary p-1.5 rounded-lg border border-primary/25 hover:border-primary transition-all"
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                        </a>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Source and Show More button */}
                                <div className="mt-6 pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="text-[10px] text-muted-foreground">
                                        المصدر: منصة فعالية (F3alia) للأحداث والفعاليات
                                    </div>
                                    <a 
                                        href="https://app.f3alia.com" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-semibold bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 transition-all hover:bg-primary/15"
                                    >
                                        <span>عرض المزيد في المصدر</span>
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                            </CardContent>
                        </Card>

                    </div>                        {/* Combined and Simplified Notes & Canceled Holidays Box */}
                        <Card className="border-border bg-muted/20 shadow-sm p-5">
                            <div className="flex gap-3.5 items-start text-xs text-muted-foreground leading-relaxed">
                                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-bold text-foreground block mb-1">ملاحظات حول تعديلات العطل الرسمية (المرسوم 188 لعام 2025):</span>
                                    أعاد المرسوم تنظيم التقويم الوطني بإدراج أعياد جديدة (عيد الثورة السورية 18 آذار، وعيد التحرير الوطني 8 كانون الأول تخليداً لسقوط الاستبداد في 8 ديسمبر 2024). وفي المقابل، أُلغيت رسمياً عطل النظام البائد السابقة (انقلاب 8 آذار، ذكرى حرب تشرين 6 تشرين الأول، عيد الشهداء 6 أيار، وعطلة عيد المعلم كعطلة عامة للدولة) لتأسيس روزنامة وطنية جامعة بعيدة عن رموز عهد الاستبداد.
                                    <div className="mt-2 font-semibold">
                                        المصدر الرسمي: <a href="https://sana.sy/presidency/2299819/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">تصفح نص المرسوم رقم 188 على الرئاسة العامة لوكالة سانا <ExternalLink className="h-3 w-3" /></a>
                                    </div>
                                </div>
                            </div>
                        </Card>

                    </div>

                </div>
            </MainLayout>
    );
}
