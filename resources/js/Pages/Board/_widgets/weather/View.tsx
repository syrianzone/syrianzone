import { CloudSun } from 'lucide-react';
import { WidgetShell } from '../../_components/WidgetShell';
import { useWidgetQuery } from '../../_lib/query';
import { sources } from '../../_lib/sources';
import { GOVERNORATES } from '../../_lib/governorates';
import type { WidgetProps } from '../../_lib/types';
import { weatherWidget, type WeatherConfig } from './index';

const WEATHER_AR: Record<string, string> = {
  'clear sky': 'سماء صافية',
  'few clouds': 'غيوم قليلة',
  'scattered clouds': 'غيوم متفرقة',
  'broken clouds': 'غيوم متقطعة',
  'overcast clouds': 'غائم',
  'light rain': 'مطر خفيف',
  'moderate rain': 'مطر معتدل',
  'heavy intensity rain': 'مطر غزير',
  'shower rain': 'زخات مطر',
  'rain': 'مطر',
  'thunderstorm': 'عاصفة رعدية',
  'snow': 'ثلج',
  'mist': 'ضباب',
  'haze': 'ضباب خفيف',
  'fog': 'ضباب كثيف',
  'dust': 'غبار',
  'sand': 'عواصف رملية',
};

// WMO codes from the forecast upstream. Kept client-side next to WEATHER_AR so
// all the display vocabulary lives in one file: the server passes the code
// through raw and never has to know how it is worded.
const WMO_AR: Record<number, string> = {
  0: 'صافية',
  1: 'صافية غالبا',
  2: 'غيوم متفرقة',
  3: 'غائم',
  45: 'ضباب',
  48: 'ضباب',
  51: 'رذاذ',
  53: 'رذاذ',
  55: 'رذاذ كثيف',
  61: 'مطر خفيف',
  63: 'مطر',
  65: 'مطر غزير',
  71: 'ثلج خفيف',
  73: 'ثلج',
  75: 'ثلج كثيف',
  80: 'زخات',
  81: 'زخات',
  82: 'زخات غزيرة',
  95: 'عاصفة رعدية',
  96: 'عاصفة رعدية',
  99: 'عاصفة رعدية',
};

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
  const description = query.data ? (WEATHER_AR[query.data.description] ?? query.data.description) : '';
  // four fits the tile at its default and minimum widths; the endpoint sends
  // five so a taller layout later needs no backend change
  const forecast = (query.data?.forecast ?? []).slice(0, 4);

  return (
    <WidgetShell
      title={`الطقس · ${GOVERNORATES[governorate]?.label ?? ''}`}
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
                  title={WMO_AR[day.code] ?? ''}
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
