import { useState, useEffect } from 'react';
import { Calendar, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { formatGregorianSyrianShort } from "@/Lib/syrian-date";
import { api, API_ROOT, apiErrorMessage } from '@/Lib/api';
import { getGovernorateNameAr, governorateNameForF3aliaProvince } from '@/Domain/geography/governorates';

interface F3aliaEventsProps {
    governorate: string; // local governorate key, e.g., 'damascus'
}

/** One event exactly as the server proxy (`/api/events/today`) normalizes it. */
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

export default function F3aliaEvents({ governorate }: F3aliaEventsProps) {
    const [events, setEvents] = useState<ProxiedEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isShowingFallbackEvents, setIsShowingFallbackEvents] = useState(false);

    const loadEventsData = async () => {
        setLoading(true);
        setError(null);
        try {
            // `upcoming`, not the default `today`: the homepage spotlight shows
            // the next event. The query, the province map and the all-Syria
            // fallback live in EventsController, never in the browser.
            const payload = await api.get<EventsPayload>(`${API_ROOT}/events/today`, {
                params: { governorate, scope: 'upcoming' },
            });
            setEvents(payload.events ?? []);
            setIsShowingFallbackEvents(Boolean(payload.is_fallback));
        } catch (err) {
            setError(apiErrorMessage(err, 'فشل تحميل الفعاليات حالياً'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEventsData();
    }, [governorate]);

    // Only the very first next upcoming event is shown (homepage spotlight).
    const displayedEvents = events.slice(0, 1);

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
                <Card className="border-dashed border-2 border-border bg-transparent p-12 text-center">
                    <CardContent className="flex flex-col items-center gap-2">
                        <Calendar className="h-10 w-10 text-muted-foreground/60 mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">
                            لا توجد فعاليات قادمة مسجلة حالياً في هذه المحافظة.
                        </p>
                    </CardContent>
                </Card>
            ) : (
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
                                <span>{formatGregorianSyrianShort(event.event_date)}</span>
                                {event.event_time && (
                                    <>
                                        <span>•</span>
                                        <span className="font-mono">{event.event_time}</span>
                                    </>
                                )}
                                <span>•</span>
                                <a
                                    href={event.url}
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
