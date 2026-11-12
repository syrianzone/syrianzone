import { useState, useEffect } from 'react';
import { Calendar, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { formatGregorianSyrianShort } from "@/Lib/syrian-date";
import { f3aliaProvinceFor, getGovernorateNameAr, governorateNameForF3aliaProvince } from '@/Domain/geography/governorates';

interface F3aliaEventsProps {
    governorate: string; // local governorate key, e.g., 'damascus'
    /** The homepage passes these; the section is Arabic single-row only. */
    language?: 'ar';
    variant?: 'single';
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

export default function F3aliaEvents({ governorate }: F3aliaEventsProps) {
    const [events, setEvents] = useState<F3aliaEvent[]>([]);
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

            // Only the next upcoming event is shown, so a couple of rows are
            // enough even after the local past-date filter.
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
                        size: 3
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
            return (data?.content || []) as F3aliaEvent[];
        } catch (err: any) {
            console.error('F3alia fetch error:', err);
            throw err;
        }
    };

    const loadEventsData = async () => {
        const provinceEnum = f3aliaProvinceFor(governorate);
        try {
            // Step 1: Try fetching events for selected governorate (upcoming only)
            const result = await fetchEvents(provinceEnum);

            if (result.length === 0 && provinceEnum !== null) {
                // Step 2: Fallback to all upcoming events if none found for selected governorate
                setEvents(await fetchEvents(null));
                setIsShowingFallbackEvents(true);
            } else {
                setEvents(result);
                setIsShowingFallbackEvents(false);
            }
        } catch (err: any) {
            setError('فشل تحميل الفعاليات حالياً');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEventsData();
    }, [governorate]);

    // Filter events locally just in case (to guarantee no past events ever slip through)
    const todayStr = getTodayDateString();
    const upcomingEvents = events.filter(e => e.eventDate >= todayStr);

    // Only the very first next upcoming event is shown (homepage spotlight).
    const displayedEvents = upcomingEvents.slice(0, 1);

    const currentGovName = getGovernorateNameAr(governorate);

    return (
        <div className="w-full" dir="rtl">
            {/* Notification when showing fallback events */}
            {isShowingFallbackEvents && !loading && !error && displayedEvents.length > 0 && (
                <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-500 flex items-start gap-3">
                    <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-semibold block mb-0.5">
                            {`لا توجد فعاليات قادمة مسجلة حالياً في ${currentGovName}`}
                        </span>
                        نعرض لك الفعاليات القادمة في باقي المحافظات السورية.
                    </div>
                </div>
            )}

            {/* Content Area */}
            {loading ? (
                /* Skeleton loader */
                <div className="w-full animate-pulse" dir="rtl" aria-hidden="true">
                    <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1.5">
                        <div className="h-5 bg-muted rounded w-16" />
                        <div className="h-6 bg-muted rounded w-64 max-w-full" />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                        <div className="h-4 bg-muted rounded w-24" />
                        <div className="h-4 bg-muted rounded w-14" />
                        <div className="h-4 bg-muted rounded w-12" />
                    </div>
                    <div className="mt-2 flex justify-center">
                        <div className="h-4 bg-muted rounded w-24" />
                    </div>
                </div>
            ) : error ? (
                /* Error block */
                <Card className="border-destructive/20 bg-destructive/5 text-center p-8">
                    <CardContent className="flex flex-col items-center gap-3">
                        <AlertCircle className="h-10 w-10 text-destructive" />
                        <p className="text-sm font-medium">{error}</p>
                        <Button variant="outline" size="sm" onClick={loadEventsData} className="mt-2">
                            <RefreshCw className="h-4 w-4 ms-2" />
                            إعادة المحاولة
                        </Button>
                    </CardContent>
                </Card>
            ) : displayedEvents.length === 0 ? (
                /* Empty state */
                <Card className="border-dashed border-2 border-border bg-transparent p-12 text-center">
                    <CardContent className="flex flex-col items-center gap-2">
                        <Calendar className="h-10 w-10 text-muted-foreground/60 mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">
                            لا توجد فعاليات قادمة مسجلة حالياً في هذه المحافظة.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                /* Single Event Layout (Homepage Spotlight) - plain row, no card */
                (() => {
                    const event = displayedEvents[0];
                    return (
                        <div className="w-full text-center" dir="rtl">
                            <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1.5">
                                <span className="text-sm font-bold text-primary">
                                    {governorateNameForF3aliaProvince(event.province) || event.provinceName}
                                </span>
                                <span className="text-base font-bold text-foreground">{event.name}</span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                <span>{formatGregorianSyrianShort(event.eventDate)}</span>
                                {event.eventTime && (
                                    <>
                                        <span>•</span>
                                        <span className="font-mono">{event.eventTime}</span>
                                    </>
                                )}
                                <span>•</span>
                                <a
                                    href={event.eventLink || `https://app.f3alia.com/?event_id=${event.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-bold text-primary hover:underline inline-flex items-center gap-1"
                                >
                                    <span>التفاصيل</span>
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>
                            <a
                                href="https://app.f3alia.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-block text-[11px] font-semibold text-muted-foreground hover:text-primary hover:underline transition-colors"
                            >
                                عرض كل الفعاليات
                            </a>
                        </div>
                    );
                })()
            )}
        </div>
    );
}
