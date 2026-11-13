import { CloudSun } from 'lucide-react';
import { WidgetShell } from '../../_components/WidgetShell';
import { useWidgetQuery } from '../../_lib/query';
import { sources } from '../../_lib/sources';
import { GOVERNORATES_BY_ID } from '@/Domain/geography/governorates';
import { weatherCodeAr, weatherDescriptionAr } from '@/Domain/weather/weather';
import type { WidgetProps } from '../../_lib/types';
import { weatherWidget, type WeatherConfig } from './index';

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// The upstream sends a bare YYYY-MM-DD, which `new Date()` reads as UTC and can
// land on the previous day locally, so the parts are split by hand.
function dayLabel(date: string, index: number): string {
  if (index === 0) return 'اليوم';
  const [y, m, d] = date.split('-').map(Number);
  return DAYS_AR[new Date(y, m - 1, d).getDay()] ?? '';
}

export default function WeatherView({ config }: WidgetProps<WeatherConfig>) {
  const governorate = config.governorate ?? 'damascus';
  const query = useWidgetQuery(weatherWidget, governorate, () => sources.weather(governorate));
  const description = query.data ? weatherDescriptionAr(query.data.description) : '';
  // four fits the tile at its default and minimum widths; the endpoint sends
  // five so a taller layout later needs no backend change
  const forecast = (query.data?.forecast ?? []).slice(0, 4);

  return (
    <WidgetShell
      title={`الطقس · ${GOVERNORATES_BY_ID[governorate]?.nameAr ?? ''}`}
      icon={CloudSun}
      loading={query.isPending}
      refreshing={query.isFetching && !query.isPending}
      error={query.isError ? 'تعذر تحميل الطقس' : null}
      onRetry={() => query.refetch()}
    >
      <div className="flex h-full flex-col items-center justify-center gap-1 p-3">
        <p dir="ltr" className="text-3xl font-semibold tabular-nums text-foreground">
          {query.data?.temp}°
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>

        {/* absent when the forecast upstream is down: the tile keeps its
            current-conditions layout rather than reserving an empty strip */}
        {forecast.length > 0 && (
          <ul className="mt-1 grid w-full shrink-0 grid-cols-4 gap-1 border-t border-border pt-1.5">
            {forecast.map((day, i) => (
              <li key={day.date} className="flex min-w-0 flex-col items-center gap-0.5">
                <span className="truncate text-[10px] leading-tight text-muted-foreground">
                  {dayLabel(day.date, i)}
                </span>
                <span
                  dir="ltr"
                  className="text-[11px] leading-tight tabular-nums text-foreground"
                  title={weatherCodeAr(day.code) ?? ''}
                >
                  {day.max}° / {day.min}°
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </WidgetShell>
  );
}
