import React, { useState, useEffect, useMemo } from 'react';
import { Link } from '@inertiajs/react';
import {
    Calendar, Clock, MapPin, Sparkles, AlertCircle, Info, CalendarDays,
    ExternalLink, Settings,
} from 'lucide-react';
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Badge } from "@/Components/ui/badge";
import { Switch } from "@/Components/ui/switch";
interface EventCategory {
    nameAr: string;
    nameEn: string;
}

/** The server proxy's normalized events payload. */
interface ProxiedEvent {
    id: string;
    name: string;
    description: string;
    url: string;
    address: string;
    is_online: boolean;
    is_free: boolean;
    ticket_price: number | null;
    event_date: string;
    event_time: string | null;
    province: string;
    provinceName: string;
    category: string | null;
    organizer: string | null;
}

interface EventsPayload {
    governorate: string;
    is_fallback: boolean;
    events: ProxiedEvent[];
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

import { Label } from "@/Components/ui/label";
import MainLayout from '@/Layouts/MainLayout';
import { api, API_ROOT, apiErrorMessage } from '@/Lib/api';
import {
    accountPatchForLocation,
    isDeviceLocation,
    resolvePlaceLabel,
    useLocationPreference,
    type LocationPatch,
} from '@/Domain/location/preference';
import { DEFAULT_PRAYER_METHOD, PRAYER_KEYS, PRAYER_LABELS, PRAYER_METHODS } from '@/Domain/prayer/methods';
import { formatHijriDate, hijriDateLabel } from '@/Domain/prayer/hijri';
import { prayerSchedule } from '@/Domain/prayer/nextPrayer';
import { usePrayerTimes } from '@/Domain/prayer/times';
import { wallDateIn } from '@/Domain/prayer/zonedTime';
import { PrayerIcon } from '@/Domain/prayer/PrayerIcon';
import PrayerSettingsFields from '@/Domain/prayer/PrayerSettingsFields';
import ResponsiveSettingsDialog from '@/Domain/prayer/ResponsiveSettingsDialog';
import { todayInSyria, todayKey, useMuslimPrefs } from '@/Domain/settings/prefs';
import { saveAccountSettings } from '@/Domain/settings/accountSettings';
import { useWeather } from '@/Domain/weather/weather';
import { WeatherIcon } from '@/Domain/weather/WeatherIcon';
import { formatDuration } from '@/Lib/format';
import { formatGregorianSyrian, formatGregorianSyrianShort } from '@/Lib/syrian-date';
import { usePageDialog } from '@/Lib/appShell';
import {
    GOVERNORATES_BY_ID,
    governorateNameForF3aliaProvince,
} from '@/Domain/geography/governorates';
import { daysBetweenIso } from '@/Domain/prayer/ramadan';
import { variableHolidays, type VariableHolidayId } from './_lib/variableHolidays';

/** Upstream event links reach an href: only http(s) passes, else the platform. */
const F3ALIA_HOME = 'https://app.f3alia.com';
function safeEventUrl(raw: string | null | undefined): string {
    return typeof raw === 'string' && /^https?:\/\//i.test(raw.trim()) ? raw.trim() : F3ALIA_HOME;
}

// The six rows the card lists, in clock-of-day order.
const PRAYER_EVENTS = PRAYER_KEYS.map((key) => ({ key, label: PRAYER_LABELS[key] }));

interface ActiveHoliday {
    nameAr: string;
    nameEn: string;
    date: Date;
    description: string;
    isNew?: boolean;
}

const VARIABLE_HOLIDAYS: Array<{ id: VariableHolidayId; nameAr: string; nameEn: string; description: string }> = [
    { id: 'eid-fitr', nameAr: 'عيد الفطر السعيد', nameEn: 'Eid al-Fitr', description: 'عطلة عيد الفطر السعيد (3 أيام).' },
    { id: 'eid-adha', nameAr: 'عيد الأضحى المبارك', nameEn: 'Eid al-Adha', description: 'عطلة عيد الأضحى المبارك (4 أيام).' },
    { id: 'hijri-new-year', nameAr: 'رأس السنة الهجرية', nameEn: 'Islamic New Year', description: 'رأس السنة الهجرية الجديدة.' },
    { id: 'mawlid', nameAr: 'المولد النبوي الشريف', nameEn: 'Prophet\'s Birthday', description: 'ذكرى المولد النبوي الشريف.' },
    { id: 'western-easter', nameAr: 'عيد الفصح المجيد (غربي)', nameEn: 'Western Easter', description: 'عيد الفصح المجيد (التقويم الغربي).' },
    { id: 'eastern-easter', nameAr: 'عيد الفصح المجيد (شرقي)', nameEn: 'Eastern Easter', description: 'عيد الفصح المجيد (التقويم الشرقي).' },
];

// Fixed national holidays + the variable (lunar/Easter) ones (reviewed or computed).
function holidaysForYear(year: number): ActiveHoliday[] {
    const list: ActiveHoliday[] = [
        { nameAr: 'رأس السنة الميلادية', nameEn: "New Year's Day", date: new Date(year, 0, 1), description: 'بداية العام الميلادي الجديد' },
        { nameAr: 'عيد الثورة السورية', nameEn: 'Syrian Revolution Day', date: new Date(year, 2, 18), description: 'ذكرى انطلاق الثورة السورية عام 2011، اعتمد كعيد وطني رسمي بموجب المرسوم 188 لعام 2025.', isNew: true },
        { nameAr: 'عيد الأم', nameEn: "Mother's Day", date: new Date(year, 2, 21), description: 'تكريم للأم ودورها في المجتمع.' },
        { nameAr: 'عيد الجلاء', nameEn: 'Evacuation Day', date: new Date(year, 3, 17), description: 'ذكرى جلاء آخر جندي فرنسي عن الأراضي السورية عام 1946.' },
        { nameAr: 'عيد العمال العالمي', nameEn: "International Workers' Day", date: new Date(year, 4, 1), description: 'تكريم للعمال وجهودهم.' },
        { nameAr: 'عيد التحرير الوطني', nameEn: 'National Liberation Day', date: new Date(year, 11, 8), description: 'العيد الوطني الجديد المعتمد بموجب المرسوم 188 لعام 2025 احتفاءً بسقوط الاستبداد عام 2024.', isNew: true },
        { nameAr: 'عيد الميلاد المجيد', nameEn: 'Christmas Day', date: new Date(year, 11, 25), description: 'ذكرى ميلاد السيد المسيح عليه السلام.' }
    ];

    // Reviewed dates where the table has the year, computed ones past it.
    const vars = variableHolidays(year);
    for (const holiday of VARIABLE_HOLIDAYS) {
        for (const at of vars[holiday.id] ?? []) {
            list.push({
                nameAr: holiday.nameAr,
                nameEn: holiday.nameEn,
                date: new Date(year, at.month - 1, at.day),
                description: holiday.description,
            });
        }
    }

    return list.sort((a, b) => a.date.getTime() - b.date.getTime());
}

interface RoznamaServerToday {
    iso: string;
    gregorianAr: string;
    hijriAr: string;
}

interface RoznamaRamadanLead {
    hijriYear: number;
    expectedStartDate: string;
    expectedEndDate: string;
    daysLeft: number;
    status: 'upcoming' | 'during' | 'after';
}

interface RoznamaPageProps {
    serverYear?: number;
    serverToday?: RoznamaServerToday;
    ramadan?: RoznamaRamadanLead;
}

function parseIsoCalendarDate(iso?: string): Date | null {
    if (!iso) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export default function Index({ serverYear, serverToday, ramadan }: RoznamaPageProps) {
    // One location preference, shared with Home, /muslim and the board.
    const location = useLocationPreference();
    // The calculation method is part of `Domain/settings/prefs`: the choice is
    // stored on this device and mirrored to the account, the same as /muslim.
    const { prefs, setPrefs, isLoggedIn } = useMuslimPrefs();
    const method = prefs.method;
    const chosenMethod = PRAYER_METHODS.find((m) => m.id === method);
    const [roznamaSettingsOpen, setRoznamaSettingsOpen] = usePageDialog('roznama-settings');

    const handleMethodChange = (next: number) => {
        setPrefs({ method: next });
    };
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [mounted, setMounted] = useState(false);
    const { weather } = useWeather(location, { enabled: mounted });
    const {
        timings: prayerTimes,
        hijri,
        loading,
        error: prayerError,
        timeZone: prayerTimeZone,
    } = usePrayerTimes(location, method, { enabled: mounted });
    const error = prayerError
        ? prayerError.timedOut
            ? 'انتهت مهلة جلب المواقيت. حاول مجدداً.'
            : prayerError.message || 'حدث خطأ أثناء الاتصال بالخادم'
        : null;

    const [events, setEvents] = useState<F3aliaEvent[]>([]);
    const [showOtherGovEvents, setShowOtherGovEvents] = useState(false);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [eventsError, setEventsError] = useState<string | null>(null);

    const nextEvent = useMemo(() => {
        return events.length > 0 ? events[0] : null;
    }, [events]);
    
    // Storage can throw (blocked site data, private mode): the toggle still works.
    const [hidePassed, setHidePassed] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        try {
            return localStorage.getItem('sz-hide-passed-holidays') === 'true';
        } catch {
            return false;
        }
    });
    useEffect(() => {
        try {
            localStorage.setItem('sz-hide-passed-holidays', String(hidePassed));
        } catch {
            // not persisted on this device
        }
    }, [hidePassed]);

    useEffect(() => {
        setMounted(true);
        setCurrentTime(new Date());
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 10000);

        const fetchF3aliaEvents = async () => {
            setLoadingEvents(true);
            setEventsError(null);
            try {
                const payload = await api.get<EventsPayload>(`${API_ROOT}/events/today`, {
                    params: {
                        governorate: showOtherGovEvents ? 'all' : location.city,
                    },
                    signal: ctrl.signal,
                });
                const fetchedEvents = (payload.events ?? []).map((e) => ({
                    id: e.id,
                    name: e.name,
                    description: e.description,
                    address: e.address,
                    isOnline: e.is_online,
                    eventLink: safeEventUrl(e.url),
                    province: e.province,
                    provinceName: e.provinceName,
                    isFree: e.is_free,
                    ticketPrice: e.ticket_price ?? 0,
                    eventDate: e.event_date,
                    eventTime: e.event_time ?? '',
                    endDate: undefined,
                    category: e.category ? { nameAr: e.category, nameEn: '' } : undefined,
                })) as F3aliaEvent[];
                const todayStr = todayKey();
                const upcoming = fetchedEvents
                    .filter(e => e.eventDate >= todayStr)
                    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
                setEvents(upcoming);
            } catch (err) {
                if (ctrl.signal.aborted) return;
                setEventsError(apiErrorMessage(err, 'فشل تحميل الفعاليات'));
            } finally {
                setLoadingEvents(false);
            }
        };

        fetchF3aliaEvents();
        return () => { clearTimeout(timer); ctrl.abort(); };
    }, [location.city, showOtherGovEvents, mounted]);

    /** Device storage belongs to Domain/location; the account mirror is ours. */
    const handleLocationChange = (patch: LocationPatch) => {
        const accountPatch = accountPatchForLocation(patch);
        if (isLoggedIn && Object.keys(accountPatch).length > 0) saveAccountSettings(accountPatch);
    };

    // The clock and dates are labelled with the place, so they read in the
    // place's zone (Damascus for a governorate), not this device's.
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: prayerTimeZone });
    };

    const formatDateGregorian = (date: Date) => {
        if (!prayerTimeZone) return formatGregorianSyrian(date, 'latn');
        const wall = wallDateIn(date, prayerTimeZone);
        return formatGregorianSyrian(new Date(wall.year, wall.month - 1, wall.day), 'latn');
    };

    /** An event's `YYYY-MM-DD` is a calendar date: never parse it as UTC midnight. */
    const formatEventDate = (value: string) => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        return m ? formatGregorianSyrian(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), 'latn') : formatGregorianSyrianShort(value, 'latn');
    };

    // Active and next prayer, one implementation shared with /muslim, Home and
    // the board widget.
    const schedule = useMemo(
        () => prayerSchedule(prayerTimes, currentTime, { timeZone: prayerTimeZone }),
        [prayerTimes, currentTime, prayerTimeZone],
    );
    const apiHijri = hijriDateLabel(hijri);

    // Once per year, not once per clock tick.
    const currentYear = currentTime.getFullYear();
    const holidays = useMemo(() => holidaysForYear(currentYear), [currentYear]);

    // The national calendar day, not this browser's: the same boundary the
    // prayer log and the timings API use. One value for the holiday filter, the
    // "days left" badge and the events filter, recomputed once per day.
    const syriaDayKey = todayKey(currentTime);
    const startOfToday = useMemo(() => todayInSyria(currentTime), [syriaDayKey]);

    const nextHoliday = useMemo(() => {
        const next = holidays.find(h => h.date >= startOfToday) ?? holidaysForYear(currentYear + 1)[0];

        const daysLeft = Math.ceil((next.date.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
        return { ...next, daysLeft };
    }, [holidays, currentYear, startOfToday]);

    const filteredHolidays = useMemo(() => {
        if (!hidePassed) return holidays;
        return holidays.filter(h => h.date >= startOfToday);
    }, [holidays, hidePassed, startOfToday]);

    const activeGov = GOVERNORATES_BY_ID[location.city] ?? GOVERNORATES_BY_ID['damascus'];
    // Labels follow the effective location: a resolved GPS/IP point wins over
    // the manual governorate while active. Read only after mount — localStorage
    // differs between the server render and the first client render.
    const geoActive = mounted && isDeviceLocation(location) ? location.geo : null;
    const placeLabel = mounted ? resolvePlaceLabel(location) : activeGov.nameAr;

    const displayYear = serverYear ?? currentYear;
    const ssrTodayDate = useMemo(
        () => parseIsoCalendarDate(serverToday?.iso) ?? new Date(displayYear, 0, 1),
        [serverToday?.iso, displayYear],
    );
    const ssrNextHoliday = useMemo(() => {
        const list = holidaysForYear(displayYear);
        const next = list.find((h) => h.date >= ssrTodayDate) ?? holidaysForYear(displayYear + 1)[0];
        const daysLeft = Math.ceil((next.date.getTime() - ssrTodayDate.getTime()) / (1000 * 60 * 60 * 24));
        return { ...next, daysLeft };
    }, [displayYear, ssrTodayDate]);

    const ramadanStart = ramadan?.expectedStartDate ?? '2027-02-08';
    const ramadanHijriYear = ramadan?.hijriYear ?? 1448;
    const ramadanDaysLeft = ramadan
        ? ramadan.daysLeft
        : Math.max(0, daysBetweenIso(serverToday?.iso ?? syriaDayKey, ramadanStart));
    const ramadanStatus = ramadan?.status ?? 'upcoming';

    return (
        <MainLayout>
            

            <div 
                className="min-h-screen text-foreground transition-colors" 
                dir="rtl"
                style={{ fontFamily: "var(--site-font, inherit)" }}
            >
                
                <section className="bg-card py-10 shadow-sm border-b border-border">
                    <div className="container mx-auto px-4 text-center max-w-4xl">
                        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
                            الروزنامة السورية {mounted ? currentYear : displayYear} — التقويم والعطل الرسمية
                        </h1>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            الروزنامة (التقويم) السورية لعرض التاريخ اليوم ميلادياً وهجرياً، والأعياد والعطل الرسمية، وكم باقي على رمضان ومواقيت الصلاة بتوقيت دمشق (وتُعرف أيضاً باسم «روزناما» سوريا).
                        </p>
                    </div>
                </section>

                {!mounted && (
                <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="border-border bg-card/60 shadow-sm">
                            <CardContent className="p-5 space-y-1.5">
                                <p className="text-xs font-semibold text-primary">التاريخ اليوم في سوريا</p>
                                <p className="text-lg font-bold text-foreground">
                                    {serverToday?.gregorianAr || formatGregorianSyrian(ssrTodayDate, 'latn')}
                                </p>
                                {serverToday?.hijriAr && (
                                    <p className="text-sm text-muted-foreground">{serverToday.hijriAr}</p>
                                )}
                            </CardContent>
                        </Card>
                        <Card className="border-border bg-card/60 shadow-sm">
                            <CardContent className="p-5 space-y-1.5">
                                <p className="text-xs font-semibold text-primary">العطلة الرسمية القادمة</p>
                                <p className="text-lg font-bold text-foreground">{ssrNextHoliday.nameAr}</p>
                                <p className="text-sm text-muted-foreground">
                                    {formatGregorianSyrian(ssrNextHoliday.date, 'latn')} —{' '}
                                    <span className="font-semibold text-foreground">
                                        {ssrNextHoliday.daysLeft === 0
                                            ? 'اليوم'
                                            : ssrNextHoliday.daysLeft === 1
                                                ? 'متبقٍ يوم واحد'
                                                : ssrNextHoliday.daysLeft === 2
                                                    ? 'متبقٍ يومان'
                                                    : `متبقٍ ${ssrNextHoliday.daysLeft} يوماً`}
                                    </span>
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="border-primary/20 bg-primary/5 shadow-sm">
                            <CardContent className="p-5 space-y-1.5">
                                <p className="text-xs font-semibold text-primary">كم باقي على رمضان {ramadanHijriYear}؟</p>
                                <p className="text-lg font-bold text-foreground">
                                    {ramadanStatus === 'during'
                                        ? `شهر رمضان ${ramadanHijriYear} هـ جارٍ حالياً`
                                        : ramadanStatus === 'after'
                                            ? `إمساكية رمضان ${ramadanHijriYear} هـ`
                                            : `متبقٍ ${ramadanDaysLeft} يوماً`}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    الغرة الفلكية المتوقعة: {formatGregorianSyrianShort(ramadanStart, 'latn')} ·{' '}
                                    <Link href="/muslim/ramadan" className="font-semibold text-primary hover:underline">
                                        عرض إمساكية رمضان
                                    </Link>
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                    <Card className="border-border bg-card/60 shadow-sm">
                        <CardContent className="p-6">
                            <h2 className="font-bold text-lg text-foreground flex items-center gap-2 mb-4 border-b border-border/60 pb-3">
                                <Calendar className="h-5 w-5 text-primary" aria-hidden="true" />
                                <span>العطل الرسمية في سوريا ({displayYear}م)</span>
                            </h2>
                            <ul className="divide-y divide-border/50 text-sm">
                                {holidaysForYear(displayYear).map((h) => (
                                    <li key={`${h.nameEn}-${h.date.getTime()}`} className="py-2.5">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="font-semibold text-foreground">{h.nameAr}</span>
                                            <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">
                                                {h.date.getFullYear()}-{String(h.date.getMonth() + 1).padStart(2, '0')}-{String(h.date.getDate()).padStart(2, '0')}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-xs text-muted-foreground">{h.description}</p>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                    <Card className="border-border bg-muted/20 shadow-sm p-5">
                        <div className="flex gap-3.5 items-start text-xs text-muted-foreground leading-relaxed">
                            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                            <div>
                                <span className="font-bold text-foreground block mb-1">ملاحظات حول تعديلات العطل الرسمية (المرسوم 188 لعام 2025):</span>
                                أعاد المرسوم تنظيم التقويم الوطني بإدراج أعياد جديدة (عيد الثورة السورية 18 آذار، وعيد التحرير الوطني 8 كانون الأول تخليداً لسقوط الاستبداد في 8 ديسمبر 2024). وفي المقابل، أُلغيت رسمياً عطل النظام البائد السابقة (انقلاب 8 آذار، ذكرى حرب تشرين 6 تشرين الأول، عيد الشهداء 6 أيار، وعطلة عيد المعلم كعطلة عامة للدولة) لتأسيس روزنامة وطنية جامعة بعيدة عن رموز عهد الاستبداد.
                            </div>
                        </div>
                    </Card>
                </div>
                )}

                {mounted && (
                <div className="container mx-auto px-4 py-8 max-w-7xl">
                    <Card className="mb-6 border-primary/20 bg-primary/5 shadow-sm">
                        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="font-bold text-sm text-foreground">
                                    كم باقي على رمضان {ramadanHijriYear} هـ؟{' '}
                                    <span className="text-primary">
                                        {ramadanStatus === 'during'
                                            ? 'شهر رمضان جارٍ حالياً'
                                            : ramadanStatus === 'after'
                                                ? 'إمساكية رمضان 1448 هـ / 2027 م'
                                                : `متبقٍ ${ramadanDaysLeft} يوماً`}
                                    </span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    الغرة الفلكية المتوقعة: {formatGregorianSyrianShort(ramadanStart, 'latn')} — مواعيد الإمساك والفجر والإفطار لجميع المحافظات.
                                </p>
                            </div>
                            <Link
                                href="/muslim/ramadan"
                                className="text-xs font-semibold text-primary hover:underline shrink-0"
                            >
                                عرض إمساكية رمضان
                            </Link>
                        </CardContent>
                    </Card>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        
                        <div className="space-y-6 flex flex-col">
                            
                            <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                                            <MapPin className="h-4 w-4 text-primary" />
                                            <span>{placeLabel}</span>
                                            {geoActive && (
                                                <Badge variant="secondary" className="text-[10px]">موقع تلقائي</Badge>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-center py-4 bg-muted/30 rounded-2xl border border-border/50">
                                        <div className="text-5xl font-bold text-foreground font-mono tracking-wider mb-2">
                                            {formatTime(currentTime)}
                                        </div>
                                        <div className="text-sm font-semibold text-foreground mt-2">
                                            {formatDateGregorian(currentTime)}
                                        </div>
                                        <div className="text-xs text-primary font-medium mt-1">
                                            {apiHijri || formatHijriDate(currentTime, prayerTimeZone, 'latn')}
                                        </div>
                                    </div>

                                    <div className="mt-4 p-4 bg-muted/20 rounded-2xl border border-border/40 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {weather ? (
                                                <>
                                                    <span className="text-2xl"><WeatherIcon code={weather.icon} className="h-6 w-6" /></span>
                                                    <div>
                                                        <div className="font-semibold text-sm text-foreground">{weather.temp}°C</div>
                                                        <div className="text-xs text-muted-foreground">{weather.description}</div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="h-9" aria-hidden="true" />
                                            )}
                                        </div>
                                        <Badge variant="outline" className="text-[10px] h-5 bg-card border-border/60">
                                            الطقس في {placeLabel}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>

                            {nextHoliday && (
                                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm overflow-hidden relative flex-1 flex flex-col justify-center">
                                    <div className="absolute top-0 end-0 bg-primary/10 text-primary px-3 py-1 text-xs font-semibold rounded-es-lg border-b border-s border-primary/20">
                                        المناسبة القادمة
                                    </div>
                                    <CardContent className="p-6">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mt-2">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h2 className="text-lg font-bold text-foreground">{nextHoliday.nameAr}</h2>
                                                    {nextHoliday.isNew && (
                                                        <Badge className="bg-emerald-700 hover:bg-emerald-800 text-white text-[9px] h-4 px-1">
                                                            جديد
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">{nextHoliday.description}</p>
                                                <div className="flex items-center gap-2 text-xs font-medium text-primary">
                                                    <CalendarDays className="h-4 w-4" />
                                                    <span>
                                                        {formatGregorianSyrian(nextHoliday.date, 'latn')}
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

                                        {nextEvent && (
                                            <div className="mt-4 pt-4 border-t border-border/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs" dir="rtl">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5 text-primary font-bold">
                                                        <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                                                        <span>الفعالية القادمة: {nextEvent.name}</span>
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-foreground/80">
                                                            {governorateNameForF3aliaProvince(nextEvent.province) || nextEvent.provinceName}
                                                        </span>
                                                        <span aria-hidden="true">•</span>
                                                        <span>{formatEventDate(nextEvent.eventDate)}</span>
                                                        {nextEvent.eventTime && (
                                                            <>
                                                                <span aria-hidden="true">•</span>
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

                        <div className="space-y-6">
                            
                            <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm h-full flex flex-col justify-between">
                                <CardContent className="p-6 flex-1 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-3">
                                            <h2 className="font-bold text-lg text-foreground flex items-center gap-2 min-w-0">
                                                <Clock className="h-5 w-5 shrink-0 text-primary" />
                                                <span className="truncate">مواقيت الصلاة في {placeLabel}</span>
                                            </h2>
                                            <div className="flex shrink-0 items-center gap-1.5">
                                                {apiHijri && (
                                                    <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
                                                        {apiHijri} هـ
                                                    </Badge>
                                                )}
                                                <Button aria-label="إعدادات الروزنامة"
                                                    variant="ghost" size="icon" className="h-8 w-8"
                                                    title="إعدادات الروزنامة"
                                                    onClick={() => setRoznamaSettingsOpen(true)}
                                                >
                                                    <Settings className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {schedule?.next && (
                                            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 mb-4 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                                        <PrayerIcon prayer={schedule.next.key} className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-primary text-base">
                                                            {schedule.next.isPrayer ? `صلاة ${schedule.next.label}` : schedule.next.label}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-end font-mono">
                                                    <span className="text-xs text-foreground/70 block text-start font-medium">المتبقي</span>
                                                    <span className="text-xl font-bold text-primary tracking-wider">
                                                        {formatDuration(schedule.next.remainingMs)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {loading ? (
                                            <div className="min-h-[348px]" aria-hidden="true" />
                                        ) : error ? (
                                            <div className="text-center py-8 text-sm text-destructive flex flex-col items-center gap-2">
                                                <AlertCircle className="h-8 w-8 text-destructive" />
                                                <p role="alert">{error}</p>
                                            </div>
                                        ) : prayerTimes ? (
                                            <div className="space-y-2">
                                                {PRAYER_EVENTS.map(ev => {
                                                    const isActive = schedule?.active?.key === ev.key;
                                                    const isNext = schedule?.next?.key === ev.key;
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
                                                                <PrayerIcon prayer={ev.key} className={`h-4 w-4 ${
                                                                    isActive
                                                                        ? 'text-primary-foreground'
                                                                        : ev.key === 'Sunrise'
                                                                            ? 'text-orange-600 dark:text-orange-400'
                                                                            : 'text-primary'
                                                                }`} />
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

                                    <div className="text-[10px] text-muted-foreground mt-4 text-center leading-relaxed space-y-1.5">
                                        <p>
                                            {method === DEFAULT_PRAYER_METHOD || !chosenMethod
                                                ? 'طريقة رابطة العالم الإسلامي (فجر 18° وعشاء 17°)، معتمد من وزارة الأوقاف.'
                                                : `طريقة ${chosenMethod.nameAr} (${chosenMethod.detail}) — اخترتها في الإعدادات.`}
                                        </p>
                                        <p>
                                            <Link href="/muslim/ramadan" className="font-semibold text-primary hover:underline">
                                                إمساكية رمضان 1448 هـ / 2027 م
                                            </Link>
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                        </div>

                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
                        
                        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm h-full flex flex-col justify-between">
                            <CardContent className="p-6 flex flex-col justify-between h-full">
                                <div>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-border/60 pb-3">
                                        <div>
                                            <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
                                                <Calendar className="h-5 w-5 text-primary" />
                                                <span>العطل الرسمية في سوريا ({currentTime.getFullYear()}م)</span>
                                            </h2>
                                        </div>
                                        <div className="flex items-center gap-4">
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
                                        </div>
                                    </div>

                                    {filteredHolidays.length === 0 ? (
                                        <div className="text-center py-12 text-sm text-muted-foreground">
                                            <Calendar className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                                            <p>لا توجد عطلات رسمية متبقية لهذا العام.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {filteredHolidays.map((holiday, idx) => {
                                                const isPast = holiday.date < startOfToday;
                                                const daysDiff = Math.ceil((holiday.date.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
                                                
                                                return (
                                                    <div 
                                                        key={idx}
                                                        className={`flex items-center justify-between p-3 rounded-xl border border-border/50 transition-colors gap-4 bg-muted/10 ${isPast ? '' : 'hover:bg-muted/30'}`}
                                                    >
                                                        <div className="space-y-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className={`font-bold text-sm truncate ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>{holiday.nameAr}</span>
                                                                {holiday.isNew && (
                                                                    <Badge className="bg-emerald-700 hover:bg-emerald-800 text-white text-[9px] font-bold h-4 px-1">
                                                                        جديد
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                                                <span className={`font-semibold ${isPast ? 'text-muted-foreground' : 'text-foreground/75'}`}>
                                                                    {formatGregorianSyrianShort(holiday.date, 'latn')}
                                                                    {holiday.date.getFullYear() !== currentTime.getFullYear() && ` (${holiday.date.getFullYear()})`}
                                                                </span>
                                                                {holiday.description && (
                                                                    <>
                                                                        <span aria-hidden="true">•</span>
                                                                        <span>{holiday.description}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3 shrink-0">
                                                            {isPast ? (
                                                                <span className="text-xs text-muted-foreground">منقضية</span>
                                                            ) : daysDiff === 0 ? (
                                                                <Badge className="bg-primary text-primary-foreground font-bold animate-pulse text-[10px] h-5">
                                                                    اليوم
                                                                </Badge>
                                                            ) : (
                                                                <Badge className="bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20 text-[10px] font-bold h-5 px-1.5">
                                                                    متبقٍ {daysDiff} يوم
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-6 pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="text-[10px] text-muted-foreground">
                                        المصدر: المرسوم رقم 188 لعام 2025
                                    </div>
                                    <a 
                                        href="https://sana.sy/presidency/2299819/" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-semibold bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 transition-all hover:bg-primary/15"
                                    >
                                        <span>عرض المرسوم في المصدر</span>
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm h-full flex flex-col justify-between">
                            <CardContent className="p-6 flex flex-col justify-between h-full">
                                <div>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-border/60 pb-3">
                                        <div>
                                            <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
                                                <Sparkles className="h-5 w-5 text-primary" />
                                                <span>الفعاليات القادمة في {showOtherGovEvents ? 'باقي المحافظات' : activeGov.nameAr}</span>
                                            </h2>
                                        </div>
                                        <div className="flex items-center gap-4">
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

                                    {loadingEvents ? (
                                        <div className="min-h-[340px]" aria-hidden="true" />
                                    ) : eventsError ? (
                                        <div className="text-center py-8 text-sm text-destructive flex flex-col items-center gap-2">
                                            <AlertCircle className="h-8 w-8 text-destructive" />
                                            <p role="alert">{eventsError}</p>
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
                                                                {governorateNameForF3aliaProvince(event.province) || event.provinceName}
                                                            </span>
                                                            <span aria-hidden="true">•</span>
                                                            <span>{formatEventDate(event.eventDate)}</span>
                                                            {event.eventTime && (
                                                                <>
                                                                    <span aria-hidden="true">•</span>
                                                                    <span className="font-mono">{event.eventTime}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <Badge 
                                                            className={`${
                                                                event.isFree 
                                                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 border-emerald-500/30' 
                                                                    : 'bg-primary/10 text-primary hover:bg-primary/15 border-primary/20'
                                                            } border text-[10px] font-bold h-5 px-1.5`}
                                                        >
                                                            {event.isFree ? 'مجاني' : `${event.ticketPrice.toLocaleString('en-US')} ل.س`}
                                                        </Badge>
                                                        
                                                        <a 
                                                            href={event.eventLink} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            aria-label={`فتح رابط فعالية ${event.name} في نافذة جديدة`}
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

                    </div>
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
                )}

                </div>

                <ResponsiveSettingsDialog
                    open={roznamaSettingsOpen}
                    onOpenChange={setRoznamaSettingsOpen}
                    title="إعدادات الروزنامة"
                    description="الموقع المستخدم لمواقيت الصلاة والطقس — GPS أو الإنترنت أو مدينة يدوية."
                >
                    <PrayerSettingsFields
                        cityLabel="المدينة (للمواقيت والطقس والفعاليات)"
                        method={method}
                        onMethodChange={handleMethodChange}
                        onLocationChange={handleLocationChange}
                    />
                </ResponsiveSettingsDialog>
            </MainLayout>
    );
}
