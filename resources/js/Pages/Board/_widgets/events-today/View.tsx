import { CalendarDays, ExternalLink, MapPin } from 'lucide-react';
import { WidgetShell } from '../../_components/WidgetShell';
import { useWidgetQuery } from '../../_lib/query';
import { sources, type TodayEvent } from '../../_lib/sources';
import { GOVERNORATES } from '../../_lib/governorates';
import type { WidgetProps } from '../../_lib/types';
import { eventsTodayWidget, ALL_SYRIA, type EventsTodayConfig } from './index';

// Upstream sends "HH:MM:SS"; the seconds are always noise here.
function shortTime(time: string | null): string | null {
  if (!time) return null;
  const parts = time.split(':');
  if (parts.length < 2) return null;
  return `${parts[0]}:${parts[1]}`;
}

function priceLabel(event: TodayEvent): string | null {
  if (event.is_free) return 'مجاني';
  if (event.ticket_price === null) return null;
  return `${event.ticket_price.toLocaleString('en-US')} ل.س`;
}

export default function EventsTodayView({ config }: WidgetProps<EventsTodayConfig>) {
  const governorate = config.governorate ?? 'damascus';
  const label = governorate === ALL_SYRIA ? 'كل سوريا' : (GOVERNORATES[governorate]?.label ?? '');
  const query = useWidgetQuery(eventsTodayWidget, governorate, () => sources.eventsToday(governorate));
  const events = query.data?.events ?? [];
  const isFallback = query.data?.is_fallback ?? false;

  return (
    <WidgetShell
      title={`فعاليات اليوم · ${label}`}
      icon={CalendarDays}
      loading={query.isPending}
      refreshing={query.isFetching && !query.isPending}
      error={query.isError ? 'تعذر تحميل الفعاليات' : null}
      onRetry={() => query.refetch()}
      empty={!query.isPending && !query.isError && events.length === 0}
      emptyText="لا توجد فعاليات اليوم"
    >
      {isFallback && (
        <p className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          لا توجد فعاليات اليوم في {label}، نعرض فعاليات من باقي المحافظات.
        </p>
      )}

      <ul className="divide-y divide-border">
        {events.map((event) => {
          const time = shortTime(event.event_time);
          const price = priceLabel(event);

          return (
            <li key={event.id}>
              <a
                href={event.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-3 px-3 py-2 hover:bg-accent/50"
              >
                {/* a multi day event often has no start time for today, so it
                    reads as running all day rather than as a missing value */}
                {time ? (
                  <span
                    dir="ltr"
                    className="w-11 shrink-0 pt-0.5 text-center text-xs font-semibold tabular-nums text-muted-foreground"
                  >
                    {time}
                  </span>
                ) : (
                  <span className="w-11 shrink-0 pt-0.5 text-center text-xs text-muted-foreground">طوال اليوم</span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{event.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {event.is_online ? 'عبر الإنترنت' : (event.address || 'مكان غير محدد')}
                    </span>
                  </p>
                  {(price || event.category) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {price && <span className={event.is_free ? 'text-primary' : undefined}>{price}</span>}
                      {price && event.category && ' · '}
                      {event.category}
                    </p>
                  )}
                </div>

                <ExternalLink className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
}
