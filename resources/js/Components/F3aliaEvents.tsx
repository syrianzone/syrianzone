import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, ExternalLink, Sparkles, AlertCircle, RefreshCw, ChevronRight, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Badge } from "@/Components/ui/badge";

interface F3aliaEventsProps {
    governorate: string; // local governorate key, e.g., 'damascus'
    language?: 'ar' | 'en';
    variant?: 'single' | 'grid'; // 'single' for homepage (next event only), 'grid' for roznama (all upcoming)
}

interface EventAttachment {
    fileUrl: string;
    fileType: string;
}

interface EventCategory {
    nameAr: string;
    nameEn: string;
}

interface EventOwner {
    organizerName: string;
    logoImage: string | null;
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
    endDate: string | null;
    endTime: string | null;
    category: EventCategory | null;
    owner: EventOwner | null;
    attachments: EventAttachment[] | null;
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
    'rural-damascus': 'DAMASCUS', // Fallback Rural Damascus to Damascus
    'hasakah': 'HASAKEH',
    'raqqa': 'RAQQA'
};

const GOVERNORATE_NAMES_AR: Record<string, string> = {
    'damascus': 'دمشق',
    'aleppo': 'حلب',
    'homs': 'حمص',
    'hama': 'حماة',
    'latakia': 'اللاذقية',
    'tartus': 'طرطوس',
    'deir-ez-zor': 'دير الزور',
    'idlib': 'إدلب',
    'daraa': 'درعا',
    'quneitra': 'القنيطرة',
    'sweida': 'السويداء',
    'rural-damascus': 'ريف دمشق',
    'hasakah': 'الحسكة',
    'raqqa': 'الرقة'
};

const GOVERNORATE_NAMES_EN: Record<string, string> = {
    'damascus': 'Damascus',
    'aleppo': 'Aleppo',
    'homs': 'Homs',
    'hama': 'Hama',
    'latakia': 'Latakia',
    'tartus': 'Tartus',
    'deir-ez-zor': 'Deir ez-Zor',
    'idlib': 'Idlib',
    'daraa': 'Daraa',
    'quneitra': 'Quneitra',
    'sweida': 'Sweida',
    'rural-damascus': 'Rural Damascus',
    'hasakah': 'Hasakah',
    'raqqa': 'Raqqa'
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

const F3ALIA_PROVINCE_TO_ENGLISH: Record<string, string> = {
    'DAMASCUS': 'Damascus',
    'ALEPPO': 'Aleppo',
    'HOMS': 'Homs',
    'HAMA': 'Hama',
    'LATTAKIA': 'Lattakia',
    'TARTOUS': 'Tartous',
    'DEIR_EZ_ZOR': 'Deir ez-Zor',
    'IDLIB': 'Idlib',
    'DARAA': 'Daraa',
    'QUNEITRA': 'Quneitra',
    'AS_SUWAYDA': 'As-Suwayda',
    'HASAKEH': 'Hasakah',
    'RAQQA': 'Raqqa'
};

export default function F3aliaEvents({ governorate, language = 'ar', variant = 'grid' }: F3aliaEventsProps) {
    const [events, setEvents] = useState<F3aliaEvent[]>([]);
    const [totalElements, setTotalElements] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isShowingFallbackEvents, setIsShowingFallbackEvents] = useState(false);

    // Get today's date in YYYY-MM-DD format
    const getTodayDateString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const fetchEvents = async (selectedProvince: string | null) => {
        setLoading(true);
        setError(null);
        try {
            const query = `
                query GetEvents($province: Province, $fromDate: Date, $size: Int!) {
                    getAllEventsForVisitor(page: 0, size: $size, province: $province, fromDate: $fromDate) {
                        totalElements
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
                            endDate
                            endTime
                            category {
                                nameAr
                                nameEn
                            }
                            owner {
                                organizerName
                                logoImage
                            }
                            attachments {
                                fileUrl
                                fileType
                            }
                        }
                    }
                }
            `;

            // If variant is single, we fetch 2 events just in case we need to filter further locally,
            // but we'll show only the first upcoming one. For grid we fetch 30 to show all upcoming ones.
            const fetchSize = variant === 'single' ? 3 : 30;

            const response = await fetch('https://event-backend-production-18c4.up.railway.app/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    variables: {
                        province: selectedProvince,
                        fromDate: getTodayDateString(),
                        size: fetchSize
                    }
                })
            });

            if (!response.ok) {
                throw new Error('GraphQL request failed');
            }

            const resData = await response.json();
            if (resData.errors && resData.errors.length > 0) {
                throw new Error(resData.errors[0].message);
            }

            const data = resData.data?.getAllEventsForVisitor;
            return {
                content: (data?.content || []) as F3aliaEvent[],
                totalElements: data?.totalElements || 0
            };
        } catch (err: any) {
            console.error('F3alia fetch error:', err);
            throw err;
        }
    };

    const loadEventsData = async () => {
        const provinceEnum = GOVERNORATE_TO_F3ALIA_PROVINCE[governorate] || null;
        try {
            // Step 1: Try fetching events for selected governorate (upcoming only)
            const result = await fetchEvents(provinceEnum);
            
            if (result.content.length === 0 && provinceEnum !== null) {
                // Step 2: Fallback to all upcoming events if none found for selected governorate
                const allResult = await fetchEvents(null);
                setEvents(allResult.content);
                setTotalElements(allResult.totalElements);
                setIsShowingFallbackEvents(true);
            } else {
                setEvents(result.content);
                setTotalElements(result.totalElements);
                setIsShowingFallbackEvents(false);
            }
        } catch (err: any) {
            setError(language === 'ar' ? 'فشل تحميل الفعاليات حالياً' : 'Failed to load events');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEventsData();
    }, [governorate, variant]);

    // Format Gregorian date nicely
    const formatEventDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString(language === 'ar' ? 'ar-SY' : 'en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        } catch (e) {
            return dateStr;
        }
    };

    // Get event cover image from attachments list
    const getEventImage = (event: F3aliaEvent) => {
        if (!event.attachments || event.attachments.length === 0) return null;
        const img = event.attachments.find(a => a.fileType === 'EVENT_IMAGE') || 
                    event.attachments.find(a => a.fileType === 'EVENT_SMALL_IMAGE') ||
                    event.attachments[0];
        return img ? img.fileUrl : null;
    };

    // Fallback gradient generator based on event ID to keep it consistent
    const getFallbackGradient = (id: string) => {
        const index = parseInt(id) || 0;
        const gradients = [
            'from-purple-600 to-indigo-600',
            'from-emerald-500 to-teal-600',
            'from-pink-500 to-rose-600',
            'from-blue-600 to-cyan-500',
            'from-amber-500 to-orange-600',
            'from-violet-600 to-fuchsia-600'
        ];
        return gradients[index % gradients.length];
    };

    const currentGovName = language === 'ar' ? GOVERNORATE_NAMES_AR[governorate] : GOVERNORATE_NAMES_EN[governorate];

    // Filter events locally just in case (to guarantee no past events ever slip through)
    const todayStr = getTodayDateString();
    const upcomingEvents = events.filter(e => e.eventDate >= todayStr);

    // If variant is single, we only show the very first next upcoming event
    const displayedEvents = variant === 'single' ? upcomingEvents.slice(0, 1) : upcomingEvents;

    return (
        <div className="w-full mt-10 mb-8" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            {/* Section Header */}
            {variant !== 'single' && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-border/60 pb-3">
                    <div>
                        <h3 className="font-bold text-xl text-foreground flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                            <span>
                                {variant === 'single' ? (
                                    language === 'ar'
                                        ? `الفعالية القادمة في ${currentGovName || ''}`
                                        : `Next Event in ${currentGovName || ''}`
                                ) : (
                                    language === 'ar'
                                        ? `الفعاليات القادمة في ${currentGovName || ''}`
                                        : `Upcoming Events in ${currentGovName || ''}`
                                )}
                            </span>
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {variant === 'single' ? (
                                language === 'ar'
                                    ? 'الفعالية القادمة الأقرب تاريخاً في محافظتك.'
                                    : 'The closest upcoming event in your governorate.'
                            ) : (
                                language === 'ar'
                                    ? 'اكتشف الفعاليات، المعارض، الأنشطة الثقافية والتعليمية القريبة منك.'
                                    : 'Explore events, exhibitions, cultural & educational activities near you.'
                            )}
                        </p>
                    </div>
                    
                    {/* Source badge */}
                    <div className="flex items-center gap-2">
                        <a
                            href="https://app.f3alia.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-semibold bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 transition-all hover:bg-primary/15"
                        >
                            <span>{language === 'ar' ? 'المصدر: منصة فعالية (F3alia)' : 'Source: F3alia Platform'}</span>
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                </div>
            )}

            {/* Notification when showing fallback events */}
            {isShowingFallbackEvents && !loading && !error && displayedEvents.length > 0 && (
                <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-500 flex items-start gap-3">
                    <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-semibold block mb-0.5">
                            {language === 'ar' 
                                ? `لا توجد فعاليات قادمة مسجلة حالياً في ${currentGovName}` 
                                : `No upcoming events currently registered in ${currentGovName}`}
                        </span>
                        {language === 'ar'
                            ? 'نعرض لك الفعاليات القادمة في باقي المحافظات السورية.'
                            : 'Showing upcoming events from other Syrian governorates instead.'}
                    </div>
                </div>
            )}

            {/* Content Area */}
            {loading ? (
                /* Skeleton loader */
                variant === 'single' ? (
                    <div className="max-w-2xl mx-auto px-4 animate-pulse">
                        <Card className="border-border bg-card/35 backdrop-blur-sm shadow-sm">
                            <CardContent className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-3.5 bg-muted rounded w-28" />
                                        <div className="h-3.5 bg-muted rounded w-36" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="h-3 bg-muted rounded w-16" />
                                        <div className="h-3 bg-muted rounded w-3" />
                                        <div className="h-3 bg-muted rounded w-24" />
                                        <div className="h-3 bg-muted rounded w-3" />
                                        <div className="h-3 bg-muted rounded w-12" />
                                    </div>
                                </div>
                                <div className="h-7 bg-muted rounded w-16 shrink-0" />
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <Card key={i} className="h-full border-border bg-card/40 backdrop-blur-sm overflow-hidden animate-pulse">
                                <div className="w-full h-44 bg-muted" />
                                <CardContent className="p-4 space-y-3">
                                    <div className="h-4 bg-muted rounded w-1/3" />
                                    <div className="h-6 bg-muted rounded w-3/4" />
                                    <div className="h-4 bg-muted rounded w-full" />
                                    <div className="h-4 bg-muted rounded w-5/6" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )
            ) : error ? (
                /* Error block */
                <Card className="border-destructive/20 bg-destructive/5 text-center p-8">
                    <CardContent className="flex flex-col items-center gap-3">
                        <AlertCircle className="h-10 w-10 text-destructive" />
                        <p className="text-sm font-medium">{error}</p>
                        <Button variant="outline" size="sm" onClick={loadEventsData} className="mt-2">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            {language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
                        </Button>
                    </CardContent>
                </Card>
            ) : displayedEvents.length === 0 ? (
                /* Empty state */
                <Card className="border-dashed border-2 border-border bg-transparent p-12 text-center">
                    <CardContent className="flex flex-col items-center gap-2">
                        <Calendar className="h-10 w-10 text-muted-foreground/60 mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">
                            {language === 'ar' 
                                ? 'لا توجد فعاليات قادمة مسجلة حالياً في هذه المحافظة.' 
                                : 'No upcoming events registered for this province.'}
                        </p>
                    </CardContent>
                </Card>
            ) : variant === 'single' ? (
                /* Single Event Layout (Homepage Spotlight) - Compact & Simple */
                (() => {
                    const event = displayedEvents[0];
                    return (
                        <div className="max-w-2xl mx-auto px-4" dir="rtl">
                            <Card className="border-border bg-card/35 backdrop-blur-sm shadow-sm hover:bg-card/50 transition-colors">
                                <CardContent className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                                    <div className="flex flex-col gap-1 text-foreground">
                                        <div className="flex items-center gap-1.5 text-primary font-bold">
                                            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                                            <span>{language === 'ar' ? 'الفعالية القادمة:' : 'Next Event:'} {event.name}</span>
                                        </div>
                                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-foreground/80">
                                                {language === 'ar' 
                                                    ? (F3ALIA_PROVINCE_TO_ARABIC[event.province] || event.provinceName)
                                                    : (F3ALIA_PROVINCE_TO_ENGLISH[event.province] || event.province)}
                                            </span>
                                            <span>•</span>
                                            <span>{formatEventDate(event.eventDate)}</span>
                                            {event.eventTime && (
                                                <>
                                                    <span>•</span>
                                                    <span className="font-mono">{event.eventTime}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <a 
                                        href={event.eventLink || `https://app.f3alia.com/?event_id=${event.id}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-[11px] font-bold text-primary hover:underline inline-flex items-center gap-0.5 bg-primary/10 px-2.5 py-1 rounded border border-primary/20 hover:bg-primary/15 transition-colors shrink-0"
                                    >
                                        <span>{language === 'ar' ? 'التفاصيل' : 'Details'}</span>
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </CardContent>
                            </Card>
                        </div>
                    );
                })()
            ) : (
                /* Grid Layout (Roznama All Upcoming Events) */
                <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {displayedEvents.map((event) => {
                            const imgUrl = getEventImage(event);
                            const fallbackGrad = getFallbackGradient(event.id);
                            
                            return (
                                <Card 
                                    key={event.id} 
                                    className="group h-full flex flex-col justify-between border-border bg-card/40 backdrop-blur-md hover:bg-card/60 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg overflow-hidden"
                                >
                                    <div className="relative">
                                        {/* Image or Fallback Gradient */}
                                        {imgUrl ? (
                                            <div className="w-full h-44 overflow-hidden relative">
                                                <img 
                                                    src={imgUrl} 
                                                    alt={event.name} 
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                    loading="lazy"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                            </div>
                                        ) : (
                                            <div className={`w-full h-44 bg-gradient-to-br ${fallbackGrad} flex items-center justify-center p-4 relative`}>
                                                <Sparkles className="absolute top-3 left-3 h-5 w-5 text-white/20" />
                                                <span className="font-extrabold text-white text-lg text-center drop-shadow-md leading-relaxed line-clamp-2">
                                                    {event.category ? (language === 'ar' ? event.category.nameAr : event.category.nameEn) : (language === 'ar' ? 'فعالية جديدة' : 'New Event')}
                                                </span>
                                            </div>
                                        )}

                                        {/* Badges Overlay */}
                                        <div className="absolute top-3 right-3 flex flex-wrap gap-1.5">
                                            {event.category && (
                                                <Badge variant="secondary" className="bg-black/60 backdrop-blur-md text-white border-0 text-[10px] font-bold py-0.5 px-2">
                                                    {language === 'ar' ? event.category.nameAr : event.category.nameEn}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="absolute top-3 left-3">
                                            <Badge 
                                                className={`${
                                                    event.isFree 
                                                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                                                        : 'bg-primary text-primary-foreground'
                                                } border-0 text-[10px] font-extrabold py-0.5 px-2`}
                                            >
                                                {event.isFree 
                                                    ? (language === 'ar' ? 'مجاني' : 'Free') 
                                                    : (language === 'ar' ? `${event.ticketPrice.toLocaleString()} ل.س` : `${event.ticketPrice.toLocaleString()} SYP`)}
                                            </Badge>
                                        </div>
                                    </div>

                                    <CardContent className="p-5 flex-1 flex flex-col justify-between">
                                        <div className="space-y-3">
                                            <h4 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 min-h-[3rem] leading-snug">
                                                {event.name}
                                            </h4>

                                            <div className="space-y-1.5 text-xs text-muted-foreground">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-3.5 w-3.5 text-primary/80 shrink-0" />
                                                    <span className="font-medium">{formatEventDate(event.eventDate)}</span>
                                                </div>
                                                {event.eventTime && (
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="h-3.5 w-3.5 text-primary/80 shrink-0" />
                                                        <span className="font-medium font-mono">{event.eventTime}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="h-3.5 w-3.5 text-primary/80 shrink-0" />
                                                    <span className="font-medium line-clamp-1">
                                                        {event.isOnline 
                                                            ? (language === 'ar' ? 'فعالية افتراضية (عبر الإنترنت)' : 'Online Event') 
                                                            : event.address}
                                                    </span>
                                                </div>
                                            </div>

                                            <p className="text-xs text-muted-foreground/80 line-clamp-3 leading-relaxed">
                                                {event.description}
                                            </p>
                                        </div>

                                        <div className="pt-4 flex items-center justify-between border-t border-border/40 mt-4">
                                            <span className="text-[10px] text-muted-foreground font-semibold">
                                                {event.owner ? event.owner.organizerName : (language === 'ar' ? 'منصة فعالية' : 'F3alia Platform')}
                                            </span>
                                            <a 
                                                href={event.eventLink || `https://app.f3alia.com/?event_id=${event.id}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                            >
                                                <Button size="sm" className="h-8 text-xs font-bold gap-1 px-3 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg">
                                                    <span>{language === 'ar' ? 'حجز / تفاصيل' : 'Details & Tickets'}</span>
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </Button>
                                            </a>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {/* "Show More in Source" button for Roznama Grid layout */}
                    <div className="mt-8 flex justify-center">
                        <a 
                            href="https://app.f3alia.com" 
                            target="_blank" 
                            rel="noopener noreferrer"
                        >
                            <Button 
                                variant="outline" 
                                className="font-bold gap-2 px-6 py-5 border-primary/30 hover:border-primary/50 text-foreground hover:bg-primary/5 rounded-xl shadow-sm transition-all"
                            >
                                <span>
                                    {language === 'ar' 
                                        ? 'عرض المزيد من الفعاليات في المصدر (فعالية)' 
                                        : 'View more events at source (F3alia)'}
                                </span>
                                {language === 'ar' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
