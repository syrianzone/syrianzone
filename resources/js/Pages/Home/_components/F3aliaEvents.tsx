import { useState, useEffect } from 'react';
import { Calendar, ExternalLink } from 'lucide-react';
import { formatGregorianSyrianShort } from '@/Lib/syrian-date';
import { api, API_ROOT } from '@/Lib/api';
import { governorateNameForF3aliaProvince } from '@/Domain/geography/governorates';

/** Upstream event links reach an href: only http(s) passes, else the platform. */
const F3ALIA_HOME = 'https://app.f3alia.com';
function safeEventUrl(raw: string | null | undefined): string {
    return typeof raw === 'string' && /^https?:\/\//i.test(raw.trim()) ? raw.trim() : F3ALIA_HOME;
}

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

/**
 * Compact single-line upcoming event ticker for the homepage.
 * Renders null while loading, on error, or when no upcoming events exist so it
 * never adds empty cards or causes layout shift above the tool grid.
 */
export default function F3aliaEvents({ governorate }: F3aliaEventsProps) {
    const [event, setEvent] = useState<ProxiedEvent | null>(null);

    useEffect(() => {
        const ctrl = new AbortController();
        void (async () => {
            try {
                const payload = await api.get<EventsPayload>(`${API_ROOT}/events/today`, {
                    params: { governorate, scope: 'upcoming' },
                    signal: ctrl.signal,
                });
                if (ctrl.signal.aborted) return;
                setEvent(payload.events?.[0] ?? null);
            } catch {
                if (ctrl.signal.aborted) return;
                setEvent(null);
            }
        })();
        return () => ctrl.abort();
    }, [governorate]);

    if (!event) return null;

    const provinceLabel = governorateNameForF3aliaProvince(event.province) || event.provinceName;

    return (
        <aside
            aria-label="فعالية قادمة"
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-lg border border-border/60 bg-muted/20 px-3.5 py-2 text-xs"
            dir="rtl"
        >
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                {provinceLabel && (
                    <span className="shrink-0 font-semibold text-primary">
                        {provinceLabel}
                    </span>
                )}
                <span className="min-w-0 truncate font-medium text-foreground">
                    {event.name}
                </span>
                <span aria-hidden="true" className="text-border">·</span>
                <span className="shrink-0 text-muted-foreground">
                    {formatGregorianSyrianShort(event.event_date)}
                </span>
                {event.event_time && (
                    <>
                        <span aria-hidden="true" className="text-border">·</span>
                        <span dir="ltr" className="shrink-0 font-mono tabular-nums text-muted-foreground">
                            {event.event_time}
                        </span>
                    </>
                )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
                <a
                    href={safeEventUrl(event.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                    <span>التفاصيل</span>
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
                <a
                    href={F3ALIA_HOME}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                >
                    كل الفعاليات
                </a>
            </div>
        </aside>
    );
}
